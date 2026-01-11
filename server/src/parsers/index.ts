import { VendorType, VendorCommands } from '../types';
import huaweiParser from './huawei';
import ciscoParser from './cisco';
import juniperParser from './juniper';
import mikrotikParser from './mikrotik';
import datacomParser from './datacom';

export interface VendorParser {
  commands: VendorCommands;
  parseLLDPNeighbors: (rawOutput: string) => any[];
  parseOSPFNeighbors: (rawOutput: string) => any[];
  parseInterfaces: (rawOutput: string) => any[];
  parseSystemInfo: (rawOutput: string) => any;
}

const vendorParsers: Record<VendorType, VendorParser> = {
  huawei: huaweiParser,
  cisco: ciscoParser,
  juniper: juniperParser,
  mikrotik: mikrotikParser,
  datacom: datacomParser,
  other: huaweiParser, // Default to Huawei-style commands
};

export function getVendorParser(vendor: VendorType): VendorParser {
  return vendorParsers[vendor] || vendorParsers.huawei;
}

export function getVendorCommands(vendor: VendorType): VendorCommands {
  const parser = getVendorParser(vendor);
  return parser.commands;
}

export { huaweiParser, ciscoParser, juniperParser, mikrotikParser, datacomParser };
