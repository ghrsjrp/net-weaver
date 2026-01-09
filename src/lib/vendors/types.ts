// Tipos e interfaces base para abstração de vendors
// Arquitetura vendor-agnostic - cada vendor implementa essas interfaces

import { TopologyNeighbor, DeviceInterface, NetworkDevice } from '@/types/network';

/**
 * Interface para parsers de saída de comandos SSH
 * Cada vendor deve implementar seus próprios parsers
 */
export interface CommandParser {
  parseLLDPNeighbors(rawOutput: string): ParsedLLDPNeighbor[];
  parseOSPFNeighbors(rawOutput: string): ParsedOSPFNeighbor[];
  parseInterfaces(rawOutput: string): ParsedInterface[];
  parseSystemInfo(rawOutput: string): ParsedSystemInfo;
}

/**
 * Dados de vizinho LLDP parseados
 */
export interface ParsedLLDPNeighbor {
  localInterface: string;
  remoteDeviceName: string;
  remoteInterface: string;
  remoteIP?: string;
  remoteDescription?: string;
  capabilities?: string[];
  rawData: Record<string, unknown>;
}

/**
 * Dados de vizinho OSPF parseados
 */
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

/**
 * Dados de interface parseados
 */
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

/**
 * Informações do sistema parseadas
 */
export interface ParsedSystemInfo {
  hostname: string;
  model?: string;
  serialNumber?: string;
  osVersion?: string;
  uptime?: string;
}

/**
 * Comandos SSH específicos por vendor
 */
export interface VendorCommands {
  getLLDPNeighbors: string;
  getOSPFNeighbors: string;
  getInterfaces: string;
  getSystemInfo: string;
  testConnection: string;
}

/**
 * Configuração de vendor
 */
export interface VendorConfig {
  name: string;
  displayName: string;
  commands: VendorCommands;
  parser: CommandParser;
  promptPattern: RegExp;
  errorPatterns: RegExp[];
}

/**
 * Resultado de coleta de dados
 */
export interface CollectionResult {
  success: boolean;
  data?: {
    neighbors?: TopologyNeighbor[];
    interfaces?: DeviceInterface[];
    systemInfo?: Partial<NetworkDevice>;
  };
  error?: string;
  rawOutput?: string;
  executedAt: string;
}

/**
 * Mapa de vendors registrados
 */
export type VendorRegistry = Map<string, VendorConfig>;
