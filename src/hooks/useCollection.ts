import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Verifica se estamos em ambiente self-hosted (com API local)
const isSelfHosted = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return true;
  }
  return false;
};

const getApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

export interface CollectionResult {
  success: boolean;
  deviceId: string;
  collectionId?: string;
  lldpNeighbors?: Array<{
    localInterface: string;
    remoteDeviceName: string;
    remoteInterface: string;
    remoteIP?: string;
  }>;
  ospfNeighbors?: Array<{
    area: string;
    neighborId: string;
    neighborIP: string;
    state: string;
  }>;
  interfaces?: Array<{
    name: string;
    adminStatus: 'up' | 'down';
    operStatus: 'up' | 'down';
  }>;
  systemInfo?: {
    hostname: string;
    osVersion?: string;
    model?: string;
    uptime?: string;
  };
  error?: string;
}

export interface CollectionHistory {
  id: string;
  device_id: string;
  collection_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  parsed_data: Record<string, unknown>;
}

export interface SSHTestResult {
  success: boolean;
  message: string;
  deviceId: string;
  connectionTime?: number;
}

/**
 * Executa coleta via API local (self-hosted)
 */
async function collectViaLocalApi(deviceId: string, collectionTypes: string[]): Promise<CollectionResult> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/collect/${deviceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionTypes }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Erro na coleta');
  }
  
  return data;
}

/**
 * Simula coleta via Supabase (para preview/dev)
 * Em produção self-hosted, isso será substituído pela API local
 */
async function collectViaSupabase(deviceId: string, collectionTypes: string[]): Promise<CollectionResult> {
  // Busca o dispositivo
  const { data: device, error: deviceError } = await supabase
    .from('network_devices')
    .select('*')
    .eq('id', deviceId)
    .single();
  
  if (deviceError || !device) {
    throw new Error('Dispositivo não encontrado');
  }

  // Cria registro de coleta
  const { data: collection, error: collectionError } = await supabase
    .from('collection_history')
    .insert({
      device_id: deviceId,
      collection_type: collectionTypes.join(','),
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (collectionError) {
    throw new Error('Erro ao criar registro de coleta');
  }

  // Simula resultado de coleta (em self-hosted será SSH real)
  const simulatedResult: CollectionResult = {
    success: true,
    deviceId,
    collectionId: collection.id,
    lldpNeighbors: [
      {
        localInterface: 'GigabitEthernet0/0/1',
        remoteDeviceName: 'switch-neighbor-01',
        remoteInterface: 'GigabitEthernet0/0/24',
        remoteIP: '10.0.0.2',
      },
    ],
    interfaces: [
      { name: 'GigabitEthernet0/0/1', adminStatus: 'up', operStatus: 'up' },
      { name: 'GigabitEthernet0/0/2', adminStatus: 'up', operStatus: 'down' },
    ],
    systemInfo: {
      hostname: device.hostname,
      osVersion: device.os_version || 'Unknown',
      model: device.model || 'Unknown',
    },
  };

  // Atualiza coleta como concluída
  await supabase
    .from('collection_history')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      parsed_data: JSON.parse(JSON.stringify(simulatedResult)),
    })
    .eq('id', collection.id);

  // Atualiza status do dispositivo
  await supabase
    .from('network_devices')
    .update({
      status: 'online',
      last_seen: new Date().toISOString(),
    })
    .eq('id', deviceId);

  return simulatedResult;
}

/**
 * Hook para testar conexão SSH com um dispositivo
 */
export function useTestSSHConnection() {
  return useMutation({
    mutationFn: async (deviceId: string): Promise<SSHTestResult> => {
      if (isSelfHosted()) {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/collect/test/${deviceId}`, {
          method: 'POST',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao testar conexão');
        }
        return data;
      }
      
      // Simula teste de SSH no ambiente de preview
      return {
        success: true,
        message: 'Conexão simulada (ambiente de preview)',
        deviceId,
        connectionTime: 150,
      };
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Conexão SSH bem-sucedida', {
          description: `Conectado em ${data.connectionTime}ms`,
        });
      } else {
        toast.error('Falha na conexão SSH', {
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao testar SSH', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook para executar coleta SSH em um dispositivo
 */
export function useCollectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      deviceId, 
      collectionTypes = ['lldp', 'ospf', 'interfaces', 'system'] 
    }: { 
      deviceId: string; 
      collectionTypes?: string[];
    }): Promise<CollectionResult> => {
      if (isSelfHosted()) {
        return collectViaLocalApi(deviceId, collectionTypes);
      }
      return collectViaSupabase(deviceId, collectionTypes);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['collection-history'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['topology-neighbors'] });
      queryClient.invalidateQueries({ queryKey: ['topology-links'] });
      
      if (data.success) {
        const neighborsCount = data.lldpNeighbors?.length || 0;
        const interfacesCount = data.interfaces?.length || 0;
        
        toast.success('Coleta concluída', {
          description: `${neighborsCount} vizinhos LLDP e ${interfacesCount} interfaces descobertos`,
        });
      } else {
        toast.error('Coleta falhou', {
          description: data.error || 'Erro desconhecido',
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erro na coleta', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook para buscar histórico de coletas
 */
export function useCollectionHistory(deviceId?: string) {
  return useQuery({
    queryKey: ['collection-history', deviceId],
    queryFn: async () => {
      let query = supabase
        .from('collection_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data as CollectionHistory[];
    },
  });
}

/**
 * Hook para executar coleta em múltiplos dispositivos
 */
export function useCollectAllDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceIds: string[]): Promise<CollectionResult[]> => {
      if (isSelfHosted()) {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceIds }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro na coleta em lote');
        }
        return data.results;
      }
      
      // Coleta sequencial via Supabase
      const results: CollectionResult[] = [];
      for (const deviceId of deviceIds) {
        try {
          const result = await collectViaSupabase(deviceId, ['lldp', 'ospf', 'interfaces', 'system']);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            deviceId,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['collection-history'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['topology-neighbors'] });
      queryClient.invalidateQueries({ queryKey: ['topology-links'] });
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0 && failCount === 0) {
        toast.success('Coleta em lote concluída', {
          description: `${successCount} dispositivos coletados com sucesso`,
        });
      } else if (successCount > 0 && failCount > 0) {
        toast.warning('Coleta em lote parcial', {
          description: `${successCount} sucesso, ${failCount} falhas`,
        });
      } else {
        toast.error('Coleta em lote falhou', {
          description: `${failCount} dispositivos falharam`,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erro na coleta em lote', {
        description: error.message,
      });
    },
  });
}
