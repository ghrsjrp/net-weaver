import {
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
  VendorCommands,
} from '../types';

export const huaweiCommands: VendorCommands = {
  getLLDPNeighbors: 'display lldp neighbor brief',
  getOSPFNeighbors: 'display ospf peer brief',
  getInterfaces: 'display interface brief',
  getSystemInfo: 'display version',
  testConnection: 'display clock',
};

export function parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[] {
  const neighbors: ParsedLLDPNeighbor[] = [];
  const lines = rawOutput.split('\n');

  // Skip header lines until we find data
  let dataStarted = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Local') || trimmedLine.startsWith('-')) {
      continue;
    }

    // Look for lines with interface data
    // Format: LocalInterface  Neighbor SystemName  NeighborInterface  ExpTime(s)
    // Example: GE0/0/1         SW-ACCESS-01        GE0/0/24           120
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      // Check if first part looks like an interface name
      if (/^(GE|XGE|ETH|10GE|40GE|100GE|Eth-Trunk|MEth)/i.test(parts[0])) {
        dataStarted = true;
        
        const neighbor: ParsedLLDPNeighbor = {
          localInterface: parts[0],
          remoteDeviceName: parts[1],
          remoteInterface: parts.length >= 3 ? parts[2] : '',
          rawData: { originalLine: trimmedLine },
        };

        // Try to extract IP if present (sometimes in capabilities or description)
        const ipMatch = trimmedLine.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch) {
          neighbor.remoteIP = ipMatch[1];
        }

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
    
    // Skip empty lines, headers, and separator lines
    if (!trimmedLine || trimmedLine.startsWith('Area') || trimmedLine.startsWith('-') || 
        trimmedLine.startsWith('Router') || trimmedLine.startsWith('OSPF')) {
      continue;
    }

    // Format varies, but typically:
    // RouterId        Address         State     Mode     Pri  Dead-Time  Interface
    // Example: 10.0.0.1    10.0.0.1    Full/DR   Normal   1    00:00:35   GE0/0/1
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 6) {
      // Check if first part looks like an IP/Router ID
      const routerIdMatch = parts[0].match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
      
      if (routerIdMatch) {
        const neighbor: ParsedOSPFNeighbor = {
          neighborId: parts[0],
          neighborIP: parts[1],
          state: parts[2],
          interface: parts[parts.length - 1], // Interface is usually last
          area: '0', // Will be extracted from context if available
          rawData: { originalLine: trimmedLine },
        };

        // Try to extract priority and dead time
        if (parts.length >= 5) {
          const priMatch = parts.find(p => /^\d+$/.test(p) && parseInt(p) <= 255);
          if (priMatch) {
            neighbor.priority = parseInt(priMatch);
          }
          
          const deadTimeMatch = parts.find(p => /^\d{2}:\d{2}:\d{2}$/.test(p));
          if (deadTimeMatch) {
            neighbor.deadTime = deadTimeMatch;
          }
        }

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
    if (!trimmedLine || trimmedLine.startsWith('Interface') || trimmedLine.startsWith('-') ||
        trimmedLine.startsWith('PHY') || trimmedLine.startsWith('Brief')) {
      continue;
    }

    // Format: Interface  PHY   Protocol  InUti OutUti  inErrors  outErrors
    // Example: GE0/0/1   up    up        0.01%  0.01%  0         0
    // Or: Interface  PHY  Protocol  Link-Protocol
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      // Check if first part looks like an interface name
      if (/^(GE|XGE|ETH|10GE|40GE|100GE|Eth-Trunk|MEth|Vlanif|LoopBack|NULL)/i.test(parts[0])) {
        const iface: ParsedInterface = {
          name: parts[0],
          adminStatus: parts[1]?.toLowerCase() === 'up' ? 'up' : 'down',
          operStatus: parts[2]?.toLowerCase() === 'up' ? 'up' : 'down',
        };

        // Try to extract speed from interface name or other fields
        const speedMatch = parts[0].match(/^(\d+)GE/i);
        if (speedMatch) {
          iface.speedMbps = parseInt(speedMatch[1]) * 1000;
        } else if (/^GE/i.test(parts[0])) {
          iface.speedMbps = 1000;
        } else if (/^XGE|10GE/i.test(parts[0])) {
          iface.speedMbps = 10000;
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

    // Hostname - look for sysname or hostname
    const hostnameMatch = trimmedLine.match(/(?:sysname|hostname|device name)[:\s]+(\S+)/i);
    if (hostnameMatch) {
      info.hostname = hostnameMatch[1];
    }

    // Alternative: look for prompt pattern like "<HOSTNAME>"
    const promptMatch = trimmedLine.match(/<([A-Za-z0-9_-]+)>/);
    if (promptMatch && info.hostname === 'Unknown') {
      info.hostname = promptMatch[1];
    }

    // Model
    const modelMatch = trimmedLine.match(/(?:HUAWEI|model|product)[:\s]*(S\d+|CE\d+|AR\d+|NE\d+|USG\d+)/i);
    if (modelMatch) {
      info.model = modelMatch[1];
    }

    // Serial number
    const serialMatch = trimmedLine.match(/(?:serial number|ESN)[:\s]*(\S+)/i);
    if (serialMatch) {
      info.serialNumber = serialMatch[1];
    }

    // OS Version
    const versionMatch = trimmedLine.match(/(?:VRP|software|version)[^\d]*(\d+\.\d+[\.\d]*)/i);
    if (versionMatch) {
      info.osVersion = `VRP ${versionMatch[1]}`;
    }

    // Uptime
    const uptimeMatch = trimmedLine.match(/uptime[:\s]+(.+)/i);
    if (uptimeMatch) {
      info.uptime = uptimeMatch[1].trim();
    }
  }

  return info;
}

export const huaweiParser = {
  commands: huaweiCommands,
  parseLLDPNeighbors,
  parseOSPFNeighbors,
  parseInterfaces,
  parseSystemInfo,
};

export default huaweiParser;
