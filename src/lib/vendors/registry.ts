// Registro central de vendors
// Arquitetura extensível - novos vendors são registrados aqui

import { VendorConfig, VendorRegistry } from './types';
import huaweiConfig from './huawei';

/**
 * Registro global de vendors
 * Cada vendor é registrado com sua configuração completa
 */
const vendorRegistry: VendorRegistry = new Map();

// Registrar vendors implementados
vendorRegistry.set('huawei', huaweiConfig);

// Placeholder para vendors futuros (não implementados ainda)
// vendorRegistry.set('juniper', juniperConfig);
// vendorRegistry.set('mikrotik', mikrotikConfig);
// vendorRegistry.set('datacom', datacomConfig);
// vendorRegistry.set('cisco', ciscoConfig);

/**
 * Obtém a configuração de um vendor pelo nome
 */
export function getVendorConfig(vendorName: string): VendorConfig | undefined {
  return vendorRegistry.get(vendorName.toLowerCase());
}

/**
 * Lista todos os vendors registrados
 */
export function getRegisteredVendors(): string[] {
  return Array.from(vendorRegistry.keys());
}

/**
 * Verifica se um vendor está implementado
 */
export function isVendorSupported(vendorName: string): boolean {
  return vendorRegistry.has(vendorName.toLowerCase());
}

/**
 * Obtém informações de display de todos os vendors
 */
export function getVendorDisplayInfo(): Array<{ name: string; displayName: string; supported: boolean }> {
  const allVendors = ['huawei', 'juniper', 'mikrotik', 'datacom', 'cisco', 'other'];
  
  return allVendors.map(name => {
    const config = vendorRegistry.get(name);
    return {
      name,
      displayName: config?.displayName || name.charAt(0).toUpperCase() + name.slice(1),
      supported: !!config,
    };
  });
}

/**
 * Registra um novo vendor (para extensibilidade futura)
 */
export function registerVendor(config: VendorConfig): void {
  vendorRegistry.set(config.name.toLowerCase(), config);
}

export { vendorRegistry };
