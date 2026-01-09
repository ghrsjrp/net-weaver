// Módulo de exportação de topologia
// Gera arquivos compatíveis com draw.io

import { TopologyData, TopologyNode, TopologyEdge } from '@/types/network';

/**
 * Gera XML compatível com draw.io a partir dos dados de topologia
 */
export function generateDrawioXML(topology: TopologyData): string {
  const { nodes, edges } = topology;
  
  // Criar mapeamento de IDs para posições no draw.io
  const nodeIdMap = new Map<string, string>();
  nodes.forEach((node, index) => {
    nodeIdMap.set(node.id, `node-${index + 2}`); // draw.io usa IDs a partir de 2
  });
  
  // Gerar células para nós
  const nodeCells = nodes.map((node, index) => generateNodeCell(node, index + 2));
  
  // Gerar células para edges
  const edgeCells = edges.map((edge, index) => 
    generateEdgeCell(edge, nodes.length + index + 2, nodeIdMap)
  );
  
  // Montar XML completo
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="NetTopo Exporter" version="21.0.0">
  <diagram id="network-topology" name="Network Topology">
    <mxGraphModel dx="1434" dy="780" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" background="#1a1a2e">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${nodeCells.join('\n        ')}
        ${edgeCells.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  
  return xml;
}

/**
 * Gera célula XML para um nó (dispositivo)
 */
function generateNodeCell(node: TopologyNode, cellId: number): string {
  const x = Math.round(node.x || 100);
  const y = Math.round(node.y || 100);
  const width = node.size || 30;
  const height = node.size || 30;
  
  const vendorIcon = getVendorIcon(node.device.vendor);
  const statusColor = getStatusColor(node.device.status);
  
  // Estilo do nó com ícone de switch/router
  const style = `shape=mxgraph.cisco.switches.${vendorIcon};html=1;fillColor=${node.color || '#00b4d8'};strokeColor=${statusColor};strokeWidth=2;shadow=1;`;
  
  return `<mxCell id="${cellId}" value="${escapeXML(node.label)}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width * 2}" height="${height * 2}" as="geometry"/>
        </mxCell>`;
}

/**
 * Gera célula XML para um edge (link)
 */
function generateEdgeCell(
  edge: TopologyEdge,
  cellId: number,
  nodeIdMap: Map<string, string>
): string {
  const sourceId = nodeIdMap.get(edge.source) || '2';
  const targetId = nodeIdMap.get(edge.target) || '3';
  
  const isActive = edge.status === 'up';
  const strokeColor = isActive ? '#00b4d8' : '#666666';
  const strokeWidth = isActive ? 2 : 1;
  
  const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=${strokeColor};strokeWidth=${strokeWidth};endArrow=none;`;
  
  // Label com interfaces
  const label = edge.sourceInterface && edge.targetInterface
    ? `${edge.sourceInterface} ↔ ${edge.targetInterface}`
    : '';
  
  return `<mxCell id="${cellId}" value="${escapeXML(label)}" style="${style}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

/**
 * Gera JSON para exportação alternativa
 */
export function generateTopologyJSON(topology: TopologyData): string {
  return JSON.stringify(topology, null, 2);
}

/**
 * Gera CSV dos dispositivos
 */
export function generateDevicesCSV(topology: TopologyData): string {
  const headers = ['Name', 'Hostname', 'IP Address', 'Vendor', 'Model', 'Status', 'Location'];
  const rows = topology.nodes.map(node => [
    node.device.name,
    node.device.hostname,
    node.device.ip_address,
    node.device.vendor,
    node.device.model || '',
    node.device.status,
    node.device.location || '',
  ]);
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

/**
 * Faz download do arquivo
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Funções auxiliares

function getVendorIcon(vendor: string): string {
  const icons: Record<string, string> = {
    huawei: 'workgroup_switch',
    juniper: 'layer_3_switch',
    cisco: 'layer_2_switch',
    mikrotik: 'workgroup_switch',
    datacom: 'workgroup_switch',
  };
  return icons[vendor] || 'workgroup_switch';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: '#22c55e',
    offline: '#ef4444',
    unknown: '#6b7280',
    error: '#ef4444',
  };
  return colors[status] || colors.unknown;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
