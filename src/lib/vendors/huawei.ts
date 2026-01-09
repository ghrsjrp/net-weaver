// Implementação específica para Huawei
// Este é o primeiro vendor implementado como referência

import {
  VendorConfig,
  VendorCommands,
  CommandParser,
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
} from './types';

/**
 * Comandos SSH para dispositivos Huawei
 */
const huaweiCommands: VendorCommands = {
  getLLDPNeighbors: 'display lldp neighbor brief',
  getOSPFNeighbors: 'display ospf peer brief',
  getInterfaces: 'display interface brief',
  getSystemInfo: 'display version',
  testConnection: 'display clock',
};

/**
 * Parser de saída de comandos Huawei
 */
const huaweiParser: CommandParser = {
  /**
   * Parse da saída do comando 'display lldp neighbor brief'
   * Formato típico:
   * Local Intf    Neighbor Dev           Neighbor Intf    
   * GE0/0/1       switch-core-01         GE0/0/24
   */
  parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[] {
    const neighbors: ParsedLLDPNeighbor[] = [];
    const lines = rawOutput.split('\n');
    
    let dataStarted = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Pular linhas vazias e cabeçalhos
      if (!trimmedLine || trimmedLine.startsWith('Local Intf') || trimmedLine.startsWith('-')) {
        if (trimmedLine.startsWith('Local Intf')) {
          dataStarted = true;
        }
        continue;
      }
      
      if (!dataStarted) continue;
      
      // Parse da linha de dados
      // Formato: LocalIntf  NeighborDev  NeighborIntf
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
  },

  /**
   * Parse da saída do comando 'display ospf peer brief'
   * Formato típico:
   * Area      RouterId        Address         Pri Dead-Time  Interface   State
   * 0.0.0.0   10.0.0.2        10.0.0.2        1   00:00:38   GE0/0/1     Full
   */
  parseOSPFNeighbors(rawOutput: string): ParsedOSPFNeighbor[] {
    const neighbors: ParsedOSPFNeighbor[] = [];
    const lines = rawOutput.split('\n');
    
    let dataStarted = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Pular linhas vazias e cabeçalhos
      if (!trimmedLine || trimmedLine.startsWith('Area') || trimmedLine.startsWith('-')) {
        if (trimmedLine.startsWith('Area')) {
          dataStarted = true;
        }
        continue;
      }
      
      if (!dataStarted) continue;
      
      // Parse da linha de dados
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
  },

  /**
   * Parse da saída do comando 'display interface brief'
   * Formato típico:
   * Interface                 PHY   Protocol InUti OutUti   inBand   outBand
   * GE0/0/1                   up    up       0.01%  0.01%    8.64Kbps 7.23Kbps
   */
  parseInterfaces(rawOutput: string): ParsedInterface[] {
    const interfaces: ParsedInterface[] = [];
    const lines = rawOutput.split('\n');
    
    let dataStarted = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Pular linhas vazias e cabeçalhos
      if (!trimmedLine || trimmedLine.startsWith('Interface') || trimmedLine.startsWith('-')) {
        if (trimmedLine.startsWith('Interface')) {
          dataStarted = true;
        }
        continue;
      }
      
      if (!dataStarted) continue;
      
      // Parse da linha de dados
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
  },

  /**
   * Parse da saída do comando 'display version'
   */
  parseSystemInfo(rawOutput: string): ParsedSystemInfo {
    const info: ParsedSystemInfo = {
      hostname: 'Unknown',
    };
    
    const lines = rawOutput.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Extrair hostname
      if (trimmedLine.includes('sysname')) {
        const match = trimmedLine.match(/sysname\s+(\S+)/i);
        if (match) {
          info.hostname = match[1];
        }
      }
      
      // Extrair versão do software
      if (trimmedLine.includes('VRP')) {
        const match = trimmedLine.match(/VRP\s*\(R\)\s*software,\s*Version\s*([\d.]+)/i);
        if (match) {
          info.osVersion = `VRP ${match[1]}`;
        }
      }
      
      // Extrair modelo
      if (trimmedLine.includes('HUAWEI') && trimmedLine.includes('uptime')) {
        const match = trimmedLine.match(/HUAWEI\s+(\S+)/i);
        if (match) {
          info.model = match[1];
        }
      }
      
      // Extrair uptime
      if (trimmedLine.includes('uptime is')) {
        const match = trimmedLine.match(/uptime is\s+(.+)/i);
        if (match) {
          info.uptime = match[1].trim();
        }
      }
    }
    
    return info;
  },
};

/**
 * Configuração completa do vendor Huawei
 */
export const huaweiConfig: VendorConfig = {
  name: 'huawei',
  displayName: 'Huawei',
  commands: huaweiCommands,
  parser: huaweiParser,
  promptPattern: /<[\w\-]+>/,
  errorPatterns: [
    /Error:/i,
    /% Unknown command/i,
    /% Incomplete command/i,
    /% Ambiguous command/i,
  ],
};

export default huaweiConfig;
