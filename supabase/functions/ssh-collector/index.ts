import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos para parsing
interface ParsedLLDPNeighbor {
  localInterface: string;
  remoteDeviceName: string;
  remoteInterface: string;
  remoteIP?: string;
  rawData: Record<string, unknown>;
}

interface ParsedOSPFNeighbor {
  area: string;
  neighborId: string;
  neighborIP: string;
  priority: number;
  deadTime: string;
  interface: string;
  state: string;
  rawData: Record<string, unknown>;
}

interface ParsedInterface {
  name: string;
  adminStatus: 'up' | 'down';
  operStatus: 'up' | 'down';
  ipAddress?: string;
  macAddress?: string;
  speed?: number;
  description?: string;
}

interface ParsedSystemInfo {
  hostname: string;
  osVersion?: string;
  model?: string;
  serialNumber?: string;
  uptime?: string;
}

interface CollectionResult {
  success: boolean;
  deviceId: string;
  collectionId?: string;
  lldpNeighbors?: ParsedLLDPNeighbor[];
  ospfNeighbors?: ParsedOSPFNeighbor[];
  interfaces?: ParsedInterface[];
  systemInfo?: ParsedSystemInfo;
  error?: string;
}

// Comandos por vendor
const vendorCommands: Record<string, Record<string, string>> = {
  huawei: {
    getLLDPNeighbors: 'display lldp neighbor brief',
    getOSPFNeighbors: 'display ospf peer brief',
    getInterfaces: 'display interface brief',
    getSystemInfo: 'display version',
    testConnection: 'display clock',
  },
  cisco: {
    getLLDPNeighbors: 'show lldp neighbors',
    getOSPFNeighbors: 'show ip ospf neighbor',
    getInterfaces: 'show ip interface brief',
    getSystemInfo: 'show version',
    testConnection: 'show clock',
  },
  juniper: {
    getLLDPNeighbors: 'show lldp neighbors',
    getOSPFNeighbors: 'show ospf neighbor',
    getInterfaces: 'show interfaces terse',
    getSystemInfo: 'show version',
    testConnection: 'show system uptime',
  },
  mikrotik: {
    getLLDPNeighbors: '/ip neighbor print',
    getOSPFNeighbors: '/routing ospf neighbor print',
    getInterfaces: '/interface print',
    getSystemInfo: '/system resource print',
    testConnection: '/system clock print',
  },
  datacom: {
    getLLDPNeighbors: 'show lldp neighbors',
    getOSPFNeighbors: 'show ip ospf neighbor',
    getInterfaces: 'show interface status',
    getSystemInfo: 'show version',
    testConnection: 'show clock',
  },
};

// Parsers por vendor
function parseHuaweiLLDP(output: string): ParsedLLDPNeighbor[] {
  const neighbors: ParsedLLDPNeighbor[] = [];
  const lines = output.split('\n');
  let dataStarted = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('Local Intf') || trimmedLine.startsWith('-')) {
      if (trimmedLine.startsWith('Local Intf')) dataStarted = true;
      continue;
    }
    if (!dataStarted) continue;

    const parts = trimmedLine.split(/\s{2,}/);
    if (parts.length >= 3) {
      neighbors.push({
        localInterface: parts[0].trim(),
        remoteDeviceName: parts[1].trim(),
        remoteInterface: parts[2].trim(),
        rawData: { originalLine: trimmedLine },
      });
    }
  }
  return neighbors;
}

function parseHuaweiOSPF(output: string): ParsedOSPFNeighbor[] {
  const neighbors: ParsedOSPFNeighbor[] = [];
  const lines = output.split('\n');
  let dataStarted = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('Area') || trimmedLine.startsWith('-')) {
      if (trimmedLine.startsWith('Area')) dataStarted = true;
      continue;
    }
    if (!dataStarted) continue;

    const parts = trimmedLine.split(/\s+/);
    if (parts.length >= 7) {
      neighbors.push({
        area: parts[0],
        neighborId: parts[1],
        neighborIP: parts[2],
        priority: parseInt(parts[3], 10),
        deadTime: parts[4],
        interface: parts[5],
        state: parts[6],
        rawData: { originalLine: trimmedLine },
      });
    }
  }
  return neighbors;
}

function parseHuaweiInterfaces(output: string): ParsedInterface[] {
  const interfaces: ParsedInterface[] = [];
  const lines = output.split('\n');
  let dataStarted = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('Interface') || trimmedLine.startsWith('-')) {
      if (trimmedLine.startsWith('Interface')) dataStarted = true;
      continue;
    }
    if (!dataStarted) continue;

    const parts = trimmedLine.split(/\s+/);
    if (parts.length >= 2) {
      interfaces.push({
        name: parts[0],
        adminStatus: parts[1]?.toLowerCase() === 'up' ? 'up' : 'down',
        operStatus: parts[2]?.toLowerCase() === 'up' ? 'up' : 'down',
      });
    }
  }
  return interfaces;
}

function parseHuaweiSystemInfo(output: string): ParsedSystemInfo {
  const info: ParsedSystemInfo = { hostname: 'Unknown' };
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('sysname')) {
      const match = trimmedLine.match(/sysname\s+(\S+)/i);
      if (match) info.hostname = match[1];
    }
    
    if (trimmedLine.includes('VRP')) {
      const match = trimmedLine.match(/VRP\s*\(R\)\s*software,\s*Version\s*([\d.]+)/i);
      if (match) info.osVersion = `VRP ${match[1]}`;
    }
    
    if (trimmedLine.includes('HUAWEI') && trimmedLine.includes('uptime')) {
      const match = trimmedLine.match(/HUAWEI\s+(\S+)/i);
      if (match) info.model = match[1];
    }
    
    if (trimmedLine.includes('uptime is')) {
      const match = trimmedLine.match(/uptime is\s+(.+)/i);
      if (match) info.uptime = match[1].trim();
    }
  }
  
  return info;
}

// Simulação de coleta SSH (para ambiente cloud sem acesso direto)
// Em produção local, isso usaria uma biblioteca SSH real
async function simulateSSHCollection(
  device: {
    ip_address: string;
    vendor: string;
    ssh_username?: string;
    ssh_password_encrypted?: string;
    ssh_port?: number;
  }
): Promise<{
  lldpOutput: string;
  ospfOutput: string;
  interfacesOutput: string;
  systemInfoOutput: string;
}> {
  // NOTA: Esta é uma simulação para demonstração
  // Em um ambiente real (servidor Linux local), você usaria:
  // - Deno ssh2 library
  // - Comando exec via Deno.run
  // - API de um serviço SSH intermediário
  
  console.log(`[SSH-COLLECTOR] Simulando conexão SSH para ${device.ip_address}`);
  console.log(`[SSH-COLLECTOR] Vendor: ${device.vendor}`);
  console.log(`[SSH-COLLECTOR] Port: ${device.ssh_port || 22}`);
  
  // Simular saída de comandos para teste
  const simulatedLLDP = `
Local Intf    Neighbor Dev           Neighbor Intf    
---------------------------------------------------------
GE0/0/1       SW-DIST-01             GE0/0/24
GE0/0/2       SW-DIST-02             GE0/0/24
GE0/0/3       SW-ACCESS-01           GE0/0/1
GE0/0/4       ROUTER-EDGE-01         GE0/0/0
`;

  const simulatedOSPF = `
Area      RouterId        Address         Pri Dead-Time  Interface   State
0.0.0.0   10.0.0.2        10.0.0.2        1   00:00:38   GE0/0/1     Full
0.0.0.0   10.0.0.3        10.0.0.3        1   00:00:35   GE0/0/2     Full
`;

  const simulatedInterfaces = `
Interface                 PHY   Protocol InUti OutUti   inBand   outBand
GE0/0/1                   up    up       0.01%  0.01%    8.64Kbps 7.23Kbps
GE0/0/2                   up    up       0.02%  0.01%    12.5Kbps 9.12Kbps
GE0/0/3                   up    up       0.00%  0.00%    1.2Kbps  0.8Kbps
GE0/0/4                   up    up       0.05%  0.03%    45.2Kbps 32.1Kbps
GE0/0/5                   down  down     0.00%  0.00%    0Kbps    0Kbps
`;

  const simulatedSystemInfo = `
Huawei Versatile Routing Platform Software
VRP (R) software, Version 8.180 (S5735 V200R019C10SPC500)
HUAWEI S5735-L24T4X-A1 uptime is 45 days, 12 hours, 33 minutes
`;

  return {
    lldpOutput: simulatedLLDP,
    ospfOutput: simulatedOSPF,
    interfacesOutput: simulatedInterfaces,
    systemInfoOutput: simulatedSystemInfo,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deviceId, collectionTypes = ['lldp', 'ospf', 'interfaces', 'system'] } = await req.json();

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'deviceId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SSH-COLLECTOR] Iniciando coleta para device: ${deviceId}`);
    console.log(`[SSH-COLLECTOR] Tipos de coleta: ${collectionTypes.join(', ')}`);

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar informações do dispositivo
    const { data: device, error: deviceError } = await supabase
      .from('network_devices')
      .select('*')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      console.error('[SSH-COLLECTOR] Dispositivo não encontrado:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Dispositivo não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SSH-COLLECTOR] Dispositivo encontrado: ${device.name} (${device.ip_address})`);

    // Criar registro de coleta
    const { data: collection, error: collectionError } = await supabase
      .from('collection_history')
      .insert({
        device_id: deviceId,
        collection_type: collectionTypes.join(','),
        status: 'running',
      })
      .select()
      .single();

    if (collectionError) {
      console.error('[SSH-COLLECTOR] Erro ao criar registro de coleta:', collectionError);
      return new Response(
        JSON.stringify({ error: 'Erro ao iniciar coleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SSH-COLLECTOR] Registro de coleta criado: ${collection.id}`);

    // Executar coleta SSH (simulada em cloud, real em servidor local)
    let result: CollectionResult = {
      success: false,
      deviceId,
      collectionId: collection.id,
    };

    try {
      const sshOutput = await simulateSSHCollection({
        ip_address: device.ip_address,
        vendor: device.vendor,
        ssh_username: device.ssh_username,
        ssh_password_encrypted: device.ssh_password_encrypted,
        ssh_port: device.ssh_port,
      });

      // Parsear resultados baseado no vendor
      if (device.vendor === 'huawei') {
        if (collectionTypes.includes('lldp')) {
          result.lldpNeighbors = parseHuaweiLLDP(sshOutput.lldpOutput);
          console.log(`[SSH-COLLECTOR] LLDP: ${result.lldpNeighbors.length} vizinhos encontrados`);
        }
        if (collectionTypes.includes('ospf')) {
          result.ospfNeighbors = parseHuaweiOSPF(sshOutput.ospfOutput);
          console.log(`[SSH-COLLECTOR] OSPF: ${result.ospfNeighbors.length} vizinhos encontrados`);
        }
        if (collectionTypes.includes('interfaces')) {
          result.interfaces = parseHuaweiInterfaces(sshOutput.interfacesOutput);
          console.log(`[SSH-COLLECTOR] Interfaces: ${result.interfaces.length} encontradas`);
        }
        if (collectionTypes.includes('system')) {
          result.systemInfo = parseHuaweiSystemInfo(sshOutput.systemInfoOutput);
          console.log(`[SSH-COLLECTOR] System Info: ${result.systemInfo.hostname}`);
        }
      }

      result.success = true;

      // Atualizar registro de coleta com sucesso
      await supabase
        .from('collection_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          parsed_data: {
            lldpNeighbors: result.lldpNeighbors,
            ospfNeighbors: result.ospfNeighbors,
            interfaces: result.interfaces,
            systemInfo: result.systemInfo,
          },
          raw_output: JSON.stringify(sshOutput),
        })
        .eq('id', collection.id);

      // Salvar vizinhos descobertos na tabela topology_neighbors
      if (result.lldpNeighbors && result.lldpNeighbors.length > 0) {
        for (const neighbor of result.lldpNeighbors) {
          await supabase
            .from('topology_neighbors')
            .upsert({
              local_device_id: deviceId,
              local_interface: neighbor.localInterface,
              remote_device_name: neighbor.remoteDeviceName,
              remote_interface: neighbor.remoteInterface,
              remote_ip: neighbor.remoteIP || null,
              discovery_protocol: 'lldp',
              raw_data: neighbor.rawData,
              last_updated: new Date().toISOString(),
            }, {
              onConflict: 'local_device_id,local_interface,discovery_protocol',
            });
        }
        console.log(`[SSH-COLLECTOR] ${result.lldpNeighbors.length} vizinhos LLDP salvos`);
      }

      // Atualizar interfaces do dispositivo
      if (result.interfaces && result.interfaces.length > 0) {
        for (const iface of result.interfaces) {
          await supabase
            .from('device_interfaces')
            .upsert({
              device_id: deviceId,
              name: iface.name,
              admin_status: iface.adminStatus,
              oper_status: iface.operStatus,
              description: iface.description,
              mac_address: iface.macAddress,
              speed_mbps: iface.speed,
            }, {
              onConflict: 'device_id,name',
            });
        }
        console.log(`[SSH-COLLECTOR] ${result.interfaces.length} interfaces atualizadas`);
      }

      // Atualizar informações do sistema no dispositivo
      if (result.systemInfo) {
        await supabase
          .from('network_devices')
          .update({
            hostname: result.systemInfo.hostname !== 'Unknown' ? result.systemInfo.hostname : device.hostname,
            model: result.systemInfo.model || device.model,
            os_version: result.systemInfo.osVersion || device.os_version,
            status: 'online',
            last_seen: new Date().toISOString(),
          })
          .eq('id', deviceId);
        console.log(`[SSH-COLLECTOR] Informações do dispositivo atualizadas`);
      }

      console.log(`[SSH-COLLECTOR] Coleta finalizada com sucesso`);

    } catch (sshError) {
      console.error('[SSH-COLLECTOR] Erro na coleta SSH:', sshError);
      
      result.error = sshError instanceof Error ? sshError.message : 'Erro desconhecido na coleta SSH';

      // Atualizar registro de coleta com erro
      await supabase
        .from('collection_history')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: result.error,
        })
        .eq('id', collection.id);

      // Atualizar status do dispositivo para erro
      await supabase
        .from('network_devices')
        .update({
          status: 'error',
          last_seen: new Date().toISOString(),
        })
        .eq('id', deviceId);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SSH-COLLECTOR] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
