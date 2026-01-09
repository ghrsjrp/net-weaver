// Tipos base para o sistema de topologia de rede

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

export interface TopologySnapshot {
  id: string;
  name: string;
  description?: string;
  topology_data: TopologyData;
  drawio_xml?: string;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Tipos para visualização de topologia
export interface TopologyNode {
  id: string;
  label: string;
  device: NetworkDevice;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  sourceInterface?: string;
  targetInterface?: string;
  bandwidth?: number;
  status: string;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  metadata?: {
    generatedAt: string;
    deviceCount: number;
    linkCount: number;
  };
}

// Tipos para formulários
export interface DeviceFormData {
  name: string;
  hostname: string;
  ip_address: string;
  vendor: VendorType;
  model?: string;
  location?: string;
  description?: string;
  ssh_port: number;
  ssh_username?: string;
  ssh_password?: string;
}

// Estatísticas do dashboard
export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalLinks: number;
  lastCollection?: string;
  vendorBreakdown: Record<VendorType, number>;
}
