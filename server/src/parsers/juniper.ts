import {
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
  VendorCommands,
} from '../types';

export const juniperCommands: VendorCommands = {
  getLLDPNeighbors: 'show lldp neighbors',
  getOSPFNeighbors: 'show ospf neighbor',
  getInterfaces: 'show interfaces terse',
  getSystemInfo: 'show version',
  testConnection: 'show system uptime',
};

export function parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[] {
  const neighbors: ParsedLLDPNeighbor[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Local') || 
        trimmedLine.startsWith('LLDP')) {
      continue;
    }

    // Format: Local Interface  Parent Interface  Chassis Id  Port info  System Name
    // Example: ge-0/0/1  -  aa:bb:cc:dd:ee:ff  ge-0/0/24  SW-ACCESS-01
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 4) {
      if (/^(ge-|xe-|et-|ae)/i.test(parts[0])) {
        const neighbor: ParsedLLDPNeighbor = {
          localInterface: parts[0],
          remoteDeviceName: parts[parts.length - 1],
          remoteInterface: parts[3] || '',
          rawData: { 
            originalLine: trimmedLine,
            chassisId: parts[2] || '',
          },
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
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Address') || 
        trimmedLine.startsWith('OSPF')) {
      continue;
    }

    // Format: Address  Interface  State  ID  Pri  Dead
    // Example: 10.0.0.1  ge-0/0/1.0  Full  10.0.0.1  128  35
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 6) {
      const ipMatch = parts[0].match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
      
      if (ipMatch) {
        const neighbor: ParsedOSPFNeighbor = {
          neighborId: parts[3],
          neighborIP: parts[0],
          state: parts[2],
          interface: parts[1],
          area: '0',
          priority: parseInt(parts[4]) || 128,
          deadTime: parts[5] + 's',
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
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Interface')) {
      continue;
    }

    // Format: Interface  Admin  Link  Proto  Local  Remote
    // Example: ge-0/0/1  up  up
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      if (/^(ge-|xe-|et-|ae|lo|vlan|irb)/i.test(parts[0])) {
        const iface: ParsedInterface = {
          name: parts[0],
          adminStatus: parts[1]?.toLowerCase() === 'up' ? 'up' : 'down',
          operStatus: parts[2]?.toLowerCase() === 'up' ? 'up' : 'down',
        };

        // Determine speed from interface name
        if (/^ge-/i.test(parts[0])) {
          iface.speedMbps = 1000;
        } else if (/^xe-/i.test(parts[0])) {
          iface.speedMbps = 10000;
        } else if (/^et-/i.test(parts[0])) {
          iface.speedMbps = 100000;
        }

        interfaces.push(iface);
      }
    }
  }

  return interfaces;
}

export function parseSystemInfo(rawOutput: string): ParsedSystemInfo {
  const info: ParsedSystemInfo = {
    hostname: 'Unknown',
  };

  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Hostname
    const hostnameMatch = trimmedLine.match(/^Hostname:\s+(\S+)/i);
    if (hostnameMatch) {
      info.hostname = hostnameMatch[1];
    }

    // Model
    const modelMatch = trimmedLine.match(/^Model:\s+(\S+)/i);
    if (modelMatch) {
      info.model = modelMatch[1];
    }

    // Serial number
    const serialMatch = trimmedLine.match(/(?:serial number|Chassis)[:\s]+(\S+)/i);
    if (serialMatch) {
      info.serialNumber = serialMatch[1];
    }

    // JUNOS Version
    const versionMatch = trimmedLine.match(/^Junos:\s+(\S+)/i);
    if (versionMatch) {
      info.osVersion = `JUNOS ${versionMatch[1]}`;
    }

    // Alternative version format
    const altVersionMatch = trimmedLine.match(/JUNOS[^\[]*\[(\S+)\]/i);
    if (altVersionMatch && !info.osVersion) {
      info.osVersion = `JUNOS ${altVersionMatch[1]}`;
    }
  }

  return info;
}

export const juniperParser = {
  commands: juniperCommands,
  parseLLDPNeighbors,
  parseOSPFNeighbors,
  parseInterfaces,
  parseSystemInfo,
};

export default juniperParser;
