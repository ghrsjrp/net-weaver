import {
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
  VendorCommands,
} from '../types';

export const mikrotikCommands: VendorCommands = {
  getLLDPNeighbors: '/ip neighbor print',
  getOSPFNeighbors: '/routing ospf neighbor print',
  getInterfaces: '/interface print',
  getSystemInfo: '/system resource print',
  testConnection: '/system clock print',
};

export function parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[] {
  const neighbors: ParsedLLDPNeighbor[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines, headers, and flags line
    if (!trimmedLine || trimmedLine.startsWith('Flags') || 
        trimmedLine.startsWith('#')) {
      continue;
    }

    // MikroTik format varies, typically:
    //  # INTERFACE  ADDRESS  IDENTITY  PLATFORM
    //  0 ether1  10.0.0.1  SW-ACCESS-01  MikroTik
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      // Skip the index number if present
      const startIdx = /^\d+$/.test(parts[0]) ? 1 : 0;
      
      if (parts[startIdx] && /^(ether|sfp|wlan|bridge)/i.test(parts[startIdx])) {
        const neighbor: ParsedLLDPNeighbor = {
          localInterface: parts[startIdx],
          remoteDeviceName: parts[startIdx + 2] || 'Unknown',
          remoteInterface: '',
          remoteIP: parts[startIdx + 1],
          rawData: { originalLine: trimmedLine },
        };

        neighbors.push(neighbor);
      }
    }
  }

  return neighbors;
}

export function parseOSPFNeighbors(rawOutput: string): ParsedOSPFNeighbor[] {
  const neighbors: ParsedOSPFNeighbor[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines, headers, and flags line
    if (!trimmedLine || trimmedLine.startsWith('Flags') || 
        trimmedLine.startsWith('#')) {
      continue;
    }

    // MikroTik OSPF neighbor format:
    //  # INSTANCE  ROUTER-ID  ADDRESS  PRIORITY  STATE  STATE-CHANGES  LS-RETRANSMITS
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 5) {
      const startIdx = /^\d+$/.test(parts[0]) ? 1 : 0;
      
      const routerIdMatch = parts[startIdx + 1]?.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
      
      if (routerIdMatch) {
        const neighbor: ParsedOSPFNeighbor = {
          neighborId: parts[startIdx + 1],
          neighborIP: parts[startIdx + 2],
          state: parts[startIdx + 4] || 'Unknown',
          interface: parts[startIdx] || '',
          area: '0',
          priority: parseInt(parts[startIdx + 3]) || 1,
          rawData: { originalLine: trimmedLine },
        };

        neighbors.push(neighbor);
      }
    }
  }

  return neighbors;
}

export function parseInterfaces(rawOutput: string): ParsedInterface[] {
  const interfaces: ParsedInterface[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines, headers, and flags line
    if (!trimmedLine || trimmedLine.startsWith('Flags') || 
        trimmedLine.startsWith('#')) {
      continue;
    }

    // MikroTik interface format:
    //  # NAME  TYPE  MTU  L2MTU  TX-BYTE  RX-BYTE
    // Or with status flags: R - running, D - disabled, S - slave
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 2) {
      const startIdx = /^\d+$/.test(parts[0]) ? 1 : 0;
      
      // Check for flags like R, D, S, X
      let flags = '';
      let nameIdx = startIdx;
      if (/^[RDSX,]+$/.test(parts[startIdx])) {
        flags = parts[startIdx];
        nameIdx = startIdx + 1;
      }

      const name = parts[nameIdx];
      if (name && /^(ether|sfp|wlan|bridge|vlan|lo)/i.test(name)) {
        const iface: ParsedInterface = {
          name: name,
          adminStatus: flags.includes('D') ? 'down' : 'up',
          operStatus: flags.includes('R') ? 'up' : 'down',
        };

        // Get type if present
        const type = parts[nameIdx + 1];
        if (type) {
          if (/ether/i.test(type)) {
            iface.speedMbps = 1000; // Default to gigabit
          } else if (/sfp/i.test(type) || /10g/i.test(name)) {
            iface.speedMbps = 10000;
          }
        }

        interfaces.push(iface);
      }
    }
  }

  return interfaces;
}

export function parseSystemInfo(rawOutput: string): ParsedSystemInfo {
  const info: ParsedSystemInfo = {
    hostname: 'MikroTik',
  };

  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Board name / Model
    const boardMatch = trimmedLine.match(/board-name:\s*(\S+)/i);
    if (boardMatch) {
      info.model = boardMatch[1];
    }

    // Platform
    const platformMatch = trimmedLine.match(/platform:\s*(\S+)/i);
    if (platformMatch && !info.model) {
      info.model = platformMatch[1];
    }

    // Version
    const versionMatch = trimmedLine.match(/version:\s*(\S+)/i);
    if (versionMatch) {
      info.osVersion = `RouterOS ${versionMatch[1]}`;
    }

    // Uptime
    const uptimeMatch = trimmedLine.match(/uptime:\s*(.+)/i);
    if (uptimeMatch) {
      info.uptime = uptimeMatch[1].trim();
    }

    // Serial number
    const serialMatch = trimmedLine.match(/serial-number:\s*(\S+)/i);
    if (serialMatch) {
      info.serialNumber = serialMatch[1];
    }
  }

  return info;
}

export const mikrotikParser = {
  commands: mikrotikCommands,
  parseLLDPNeighbors,
  parseOSPFNeighbors,
  parseInterfaces,
  parseSystemInfo,
};

export default mikrotikParser;
