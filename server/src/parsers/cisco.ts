import {
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
  VendorCommands,
} from '../types';

export const ciscoCommands: VendorCommands = {
  getLLDPNeighbors: 'show lldp neighbors',
  getOSPFNeighbors: 'show ip ospf neighbor',
  getInterfaces: 'show ip interface brief',
  getSystemInfo: 'show version',
  testConnection: 'show clock',
};

export function parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[] {
  const neighbors: ParsedLLDPNeighbor[] = [];
  const lines = rawOutput.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Capability') || 
        trimmedLine.startsWith('Device') || trimmedLine.startsWith('Total')) {
      continue;
    }

    // Format: Device ID  Local Intf  Hold-time  Capability  Port ID
    // Example: SW-CORE-01  Gi0/1       120        B,R         Gi0/24
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      // Check if second part looks like an interface
      if (/^(Gi|Fa|Te|Eth|Po)/i.test(parts[1])) {
        const neighbor: ParsedLLDPNeighbor = {
          localInterface: parts[1],
          remoteDeviceName: parts[0],
          remoteInterface: parts[parts.length - 1],
          rawData: { originalLine: trimmedLine },
        };

        // Extract capabilities if present
        const capMatch = trimmedLine.match(/([B,R,T,S,W,P,D,C,H]+)/);
        if (capMatch) {
          neighbor.capabilities = capMatch[1].split(',');
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
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('Neighbor') || 
        trimmedLine.startsWith('Process')) {
      continue;
    }

    // Format: Neighbor ID  Pri  State      Dead Time  Address       Interface
    // Example: 10.0.0.1    1    FULL/DR    00:00:35   10.0.0.1      GigabitEthernet0/1
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
    if (!trimmedLine || trimmedLine.startsWith('Interface') || 
        trimmedLine.startsWith('Any interface')) {
      continue;
    }

    // Format: Interface  IP-Address  OK?  Method  Status  Protocol
    // Example: GigabitEthernet0/1  10.0.0.1  YES  manual  up  up
    const parts = trimmedLine.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length >= 6) {
      if (/^(Gi|Fa|Te|Eth|Po|Lo|Vl)/i.test(parts[0])) {
        const iface: ParsedInterface = {
          name: parts[0],
          adminStatus: parts[4]?.toLowerCase() === 'up' || 
                       parts[4]?.toLowerCase() === 'administratively' ? 'up' : 'down',
          operStatus: parts[5]?.toLowerCase() === 'up' ? 'up' : 'down',
        };

        // Extract IP if present and valid
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parts[1])) {
          iface.ipAddresses = [parts[1]];
        }

        // Determine speed from interface name
        if (/^Gi/i.test(parts[0])) {
          iface.speedMbps = 1000;
        } else if (/^Te/i.test(parts[0])) {
          iface.speedMbps = 10000;
        } else if (/^Fa/i.test(parts[0])) {
          iface.speedMbps = 100;
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
    const hostnameMatch = trimmedLine.match(/^(\S+)\s+uptime/i);
    if (hostnameMatch) {
      info.hostname = hostnameMatch[1];
    }

    // Model
    const modelMatch = trimmedLine.match(/(?:cisco|Cisco)\s+(\S+)/);
    if (modelMatch && !info.model) {
      info.model = modelMatch[1];
    }

    // Serial number
    const serialMatch = trimmedLine.match(/(?:System serial number|Processor board ID)[:\s]+(\S+)/i);
    if (serialMatch) {
      info.serialNumber = serialMatch[1];
    }

    // IOS Version
    const versionMatch = trimmedLine.match(/(?:IOS|Software)[^\d]*Version\s+(\S+)/i);
    if (versionMatch) {
      info.osVersion = `IOS ${versionMatch[1]}`;
    }

    // Uptime
    const uptimeMatch = trimmedLine.match(/uptime is\s+(.+)/i);
    if (uptimeMatch) {
      info.uptime = uptimeMatch[1].trim();
    }
  }

  return info;
}

export const ciscoParser = {
  commands: ciscoCommands,
  parseLLDPNeighbors,
  parseOSPFNeighbors,
  parseInterfaces,
  parseSystemInfo,
};

export default ciscoParser;
