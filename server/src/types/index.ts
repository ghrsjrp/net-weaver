// Types for NetTopo Self-Hosted Backend

export type VendorType = 'huawei' | 'juniper' | 'mikrotik' | 'datacom' | 'cisco' | 'other';
export type DeviceStatus = 'online' | 'offline' | 'unknown' | 'error';
export type CollectionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type DiscoveryProtocol = 'lldp' | 'ospf' | 'cdp' | 'manual';

export interface NetworkDevice {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  vendor: VendorType;
  model?: string;
  serial_number?: string;
  os_version?: string;
  management_ip?: string;
  ssh_port: number;
  ssh_username?: string;
  ssh_password_encrypted?: string;
  status: DeviceStatus;
  last_seen?: string;
  location?: string;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeviceInterface {
  id: string;
  device_id: string;
  name: string;
  description?: string;
  mac_address?: string;
  speed_mbps?: number;
  admin_status?: string;
  oper_status?: string;
  vlan_id?: number;
  ip_addresses?: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TopologyNeighbor {
  id: string;
  local_device_id: string;
  local_interface: string;
  remote_device_id?: string;
  remote_device_name?: string;
  remote_interface?: string;
  remote_ip?: string;
  discovery_protocol: DiscoveryProtocol;
  raw_data: Record<string, unknown>;
  discovered_at: string;
  last_updated: string;
}

export interface TopologyLink {
  id: string;
  source_device_id: string;
  source_interface?: string;
  target_device_id: string;
  target_interface?: string;
  link_type: string;
  bandwidth_mbps?: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CollectionHistory {
  id: string;
  device_id: string;
  collection_type: string;
  status: CollectionStatus;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  raw_output?: string;
  parsed_data: Record<string, unknown>;
  created_at: string;
}

export interface ParsedLLDPNeighbor {
  localInterface: string;
  remoteDeviceName: string;
  remoteInterface: string;
  remoteIP?: string;
  remoteDescription?: string;
  capabilities?: string[];
  rawData: Record<string, unknown>;
}

export interface ParsedOSPFNeighbor {
  neighborId: string;
  neighborIP: string;
  state: string;
  interface: string;
  area: string;
  priority?: number;
  deadTime?: string;
  rawData: Record<string, unknown>;
}

export interface ParsedInterface {
  name: string;
  description?: string;
  macAddress?: string;
  speedMbps?: number;
  adminStatus: 'up' | 'down';
  operStatus: 'up' | 'down';
  ipAddresses?: string[];
  vlanId?: number;
}

export interface ParsedSystemInfo {
  hostname: string;
  model?: string;
  serialNumber?: string;
  osVersion?: string;
  uptime?: string;
}

export interface CollectionResult {
  success: boolean;
  deviceId: string;
  lldpNeighbors?: ParsedLLDPNeighbor[];
  ospfNeighbors?: ParsedOSPFNeighbor[];
  interfaces?: ParsedInterface[];
  systemInfo?: ParsedSystemInfo;
  error?: string;
  rawOutput?: string;
  collectedAt: string;
}

export interface VendorCommands {
  getLLDPNeighbors: string;
  getOSPFNeighbors: string;
  getInterfaces: string;
  getSystemInfo: string;
  testConnection: string;
}
