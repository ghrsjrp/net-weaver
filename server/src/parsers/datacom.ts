import {
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
  VendorCommands,
} from '../types';

// Datacom switches use commands similar to Cisco/Huawei style
export const datacomCommands: VendorCommands = {
  getLLDPNeighbors: 'show lldp neighbors',
  getOSPFNeighbors: 'show ip ospf neighbor',
  getInterfaces: 'show interface status',
  getSystemInfo: 'show version',
  testConnection: 'show clock',
};

export function parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[] {
  const neighbors: ParsedLLDPNeighbor[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Local') || 
        trimmedLine.startsWith('Device') || trimmedLine.startsWith('-')) {
      continue;
    }

    // Format similar to Cisco:
    // Local Intf  Hold-time  Capability  Port ID  Device ID
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      // Check if first part looks like an interface
      if (/^(gi|te|ge|eth|po)/i.test(parts[0])) {
        const neighbor: ParsedLLDPNeighbor = {
          localInterface: parts[0],
          remoteDeviceName: parts[parts.length - 1],
          remoteInterface: parts.length >= 4 ? parts[parts.length - 2] : '',
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
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Neighbor') || 
        trimmedLine.startsWith('-')) {
      continue;
    }

    // Format: Neighbor ID  Pri  State  Dead Time  Address  Interface
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 6) {
      const routerIdMatch = parts[0].match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
      
      if (routerIdMatch) {
        const neighbor: ParsedOSPFNeighbor = {
          neighborId: parts[0],
          neighborIP: parts[4],
          state: parts[2],
          interface: parts[5],
          area: '0',
          priority: parseInt(parts[1]) || 1,
          deadTime: parts[3],
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
    if (!trimmedLine || trimmedLine.startsWith('Port') || 
        trimmedLine.startsWith('-') || trimmedLine.startsWith('Interface')) {
      continue;
    }

    // Format: Port  Name  Status  Vlan  Duplex  Speed  Type
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      if (/^(gi|te|ge|eth|po)/i.test(parts[0])) {
        const iface: ParsedInterface = {
          name: parts[0],
          adminStatus: parts[2]?.toLowerCase().includes('up') ? 'up' : 'down',
          operStatus: parts[2]?.toLowerCase().includes('connected') || 
                     parts[2]?.toLowerCase() === 'up' ? 'up' : 'down',
        };

        // Try to extract speed
        const speedPart = parts.find(p => /^\d+(G|M|T)$/i.test(p));
        if (speedPart) {
          const speedMatch = speedPart.match(/^(\d+)(G|M|T)$/i);
          if (speedMatch) {
            const num = parseInt(speedMatch[1]);
            const unit = speedMatch[2].toUpperCase();
            if (unit === 'G') iface.speedMbps = num * 1000;
            else if (unit === 'M') iface.speedMbps = num;
            else if (unit === 'T') iface.speedMbps = num * 1000000;
          }
        } else if (/^gi/i.test(parts[0])) {
          iface.speedMbps = 1000;
        } else if (/^te/i.test(parts[0])) {
          iface.speedMbps = 10000;
        }

        // Extract VLAN if present
        const vlanPart = parts.find(p => /^\d+$/.test(p) && parseInt(p) <= 4096);
        if (vlanPart) {
          iface.vlanId = parseInt(vlanPart);
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
    const hostnameMatch = trimmedLine.match(/(?:hostname|System Name)[:\s]+(\S+)/i);
    if (hostnameMatch) {
      info.hostname = hostnameMatch[1];
    }

    // Model
    const modelMatch = trimmedLine.match(/(?:Model|Product Name)[:\s]+(\S+)/i);
    if (modelMatch) {
      info.model = modelMatch[1];
    }

    // Serial number
    const serialMatch = trimmedLine.match(/(?:Serial Number|S\/N)[:\s]+(\S+)/i);
    if (serialMatch) {
      info.serialNumber = serialMatch[1];
    }

    // Software Version
    const versionMatch = trimmedLine.match(/(?:Software Version|Version)[:\s]+(\S+)/i);
    if (versionMatch) {
      info.osVersion = versionMatch[1];
    }

    // Uptime
    const uptimeMatch = trimmedLine.match(/(?:Uptime|Up Time)[:\s]+(.+)/i);
    if (uptimeMatch) {
      info.uptime = uptimeMatch[1].trim();
    }
  }

  return info;
}

export const datacomParser = {
  commands: datacomCommands,
  parseLLDPNeighbors,
  parseOSPFNeighbors,
  parseInterfaces,
  parseSystemInfo,
};

export default datacomParser;
