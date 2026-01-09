// Módulo de normalização de dados de topologia
// Responsável por converter dados brutos em estrutura normalizada

import { NetworkDevice, TopologyLink, TopologyNeighbor, TopologyNode, TopologyEdge, TopologyData } from '@/types/network';

/**
 * Converte lista de dispositivos em nós de topologia
 */
export function devicesToNodes(devices: NetworkDevice[]): TopologyNode[] {
  return devices.map((device, index) => ({
    id: device.id,
    label: device.name || device.hostname,
    device,
    // Posição inicial em grade
    x: (index % 5) * 200 + 100,
    y: Math.floor(index / 5) * 150 + 100,
    color: getDeviceColor(device),
    size: getDeviceSize(device),
  }));
}

/**
 * Converte links de topologia em edges para visualização
 */
export function linksToEdges(links: TopologyLink[]): TopologyEdge[] {
  return links.map(link => ({
    id: link.id,
    source: link.source_device_id,
    target: link.target_device_id,
    sourceInterface: link.source_interface,
    targetInterface: link.target_interface,
    bandwidth: link.bandwidth_mbps,
    status: link.status,
  }));
}

/**
 * Converte vizinhos descobertos em links de topologia
 */
export function neighborsToLinks(
  neighbors: TopologyNeighbor[],
  devices: NetworkDevice[]
): Partial<TopologyLink>[] {
  const deviceMap = new Map(devices.map(d => [d.name.toLowerCase(), d.id]));
  const deviceByHostname = new Map(devices.map(d => [d.hostname.toLowerCase(), d.id]));
  
  const links: Partial<TopologyLink>[] = [];
  const processedPairs = new Set<string>();
  
  for (const neighbor of neighbors) {
    // Tentar encontrar o dispositivo remoto pelo nome ou hostname
    const remoteDeviceId = 
      deviceMap.get(neighbor.remote_device_name?.toLowerCase() || '') ||
      deviceByHostname.get(neighbor.remote_device_name?.toLowerCase() || '');
    
    if (!remoteDeviceId) continue;
    
    // Evitar duplicatas (A->B e B->A)
    const pairKey = [neighbor.local_device_id, remoteDeviceId].sort().join('-');
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);
    
    links.push({
      source_device_id: neighbor.local_device_id,
      source_interface: neighbor.local_interface,
      target_device_id: remoteDeviceId,
      target_interface: neighbor.remote_interface,
      link_type: 'physical',
      status: 'up',
      metadata: {
        discoveredBy: neighbor.discovery_protocol,
        discoveredAt: neighbor.discovered_at,
      },
    });
  }
  
  return links;
}

/**
 * Gera estrutura completa de topologia
 */
export function generateTopologyData(
  devices: NetworkDevice[],
  links: TopologyLink[]
): TopologyData {
  const nodes = devicesToNodes(devices);
  const edges = linksToEdges(links);
  
  return {
    nodes,
    edges,
    metadata: {
      generatedAt: new Date().toISOString(),
      deviceCount: devices.length,
      linkCount: links.length,
    },
  };
}

/**
 * Calcula layout automático usando algoritmo force-directed simplificado
 */
export function calculateLayout(nodes: TopologyNode[], edges: TopologyEdge[]): TopologyNode[] {
  const iterations = 50;
  const repulsion = 5000;
  const attraction = 0.01;
  const damping = 0.9;
  
  // Clonar nós para não modificar originais
  const layoutNodes = nodes.map(n => ({ ...n, vx: 0, vy: 0 }));
  
  for (let i = 0; i < iterations; i++) {
    // Força de repulsão entre todos os nós
    for (let a = 0; a < layoutNodes.length; a++) {
      for (let b = a + 1; b < layoutNodes.length; b++) {
        const nodeA = layoutNodes[a];
        const nodeB = layoutNodes[b];
        
        const dx = (nodeB.x || 0) - (nodeA.x || 0);
        const dy = (nodeB.y || 0) - (nodeA.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        nodeA.vx = (nodeA.vx || 0) - fx;
        nodeA.vy = (nodeA.vy || 0) - fy;
        nodeB.vx = (nodeB.vx || 0) + fx;
        nodeB.vy = (nodeB.vy || 0) + fy;
      }
    }
    
    // Força de atração para nós conectados
    for (const edge of edges) {
      const nodeA = layoutNodes.find(n => n.id === edge.source);
      const nodeB = layoutNodes.find(n => n.id === edge.target);
      
      if (!nodeA || !nodeB) continue;
      
      const dx = (nodeB.x || 0) - (nodeA.x || 0);
      const dy = (nodeB.y || 0) - (nodeA.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const force = dist * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      nodeA.vx = (nodeA.vx || 0) + fx;
      nodeA.vy = (nodeA.vy || 0) + fy;
      nodeB.vx = (nodeB.vx || 0) - fx;
      nodeB.vy = (nodeB.vy || 0) - fy;
    }
    
    // Aplicar velocidades
    for (const node of layoutNodes) {
      node.x = (node.x || 0) + (node.vx || 0);
      node.y = (node.y || 0) + (node.vy || 0);
      node.vx = (node.vx || 0) * damping;
      node.vy = (node.vy || 0) * damping;
    }
  }
  
  // Normalizar posições para área visível
  const minX = Math.min(...layoutNodes.map(n => n.x || 0));
  const minY = Math.min(...layoutNodes.map(n => n.y || 0));
  const maxX = Math.max(...layoutNodes.map(n => n.x || 0));
  const maxY = Math.max(...layoutNodes.map(n => n.y || 0));
  
  const padding = 100;
  const width = 800;
  const height = 600;
  
  return layoutNodes.map(node => ({
    ...node,
    x: padding + ((node.x || 0) - minX) / ((maxX - minX) || 1) * (width - padding * 2),
    y: padding + ((node.y || 0) - minY) / ((maxY - minY) || 1) * (height - padding * 2),
  }));
}

// Funções auxiliares

function getDeviceColor(device: NetworkDevice): string {
  const vendorColors: Record<string, string> = {
    huawei: 'hsl(0, 72%, 51%)', // Vermelho Huawei
    juniper: 'hsl(142, 71%, 45%)', // Verde
    mikrotik: 'hsl(199, 89%, 48%)', // Azul
    datacom: 'hsl(25, 95%, 53%)', // Laranja
    cisco: 'hsl(199, 89%, 48%)', // Azul Cisco
    other: 'hsl(220, 10%, 50%)',
  };
  
  return vendorColors[device.vendor] || vendorColors.other;
}

function getDeviceSize(device: NetworkDevice): number {
  // Dispositivos maiores para roteadores/switches core
  if (device.name.toLowerCase().includes('core')) return 40;
  if (device.name.toLowerCase().includes('dist')) return 35;
  return 30;
}
