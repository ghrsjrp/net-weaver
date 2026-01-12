import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

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
 * Hook para testar conexão SSH com um dispositivo
 */
export function useTestSSHConnection() {
  return useMutation({
    mutationFn: async (deviceId: string): Promise<SSHTestResult> => {
      const response = await api.post<SSHTestResult>(`/api/collect/test/${deviceId}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao testar conexão SSH');
      }
      
      return response.data!;
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
 * Usa a API local self-hosted ao invés de Edge Functions
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
      // Chama a API local self-hosted
      const response = await api.post<CollectionResult>(`/api/collect/${deviceId}`, {
        collectionTypes,
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao executar coleta');
      }

      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['collection-history'] });
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
    mutationFn: async (deviceIds: string[]) => {
      // Chama a API local para coleta em lote
      const response = await api.post<{ results: CollectionResult[] }>('/api/collect', {
        deviceIds,
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao executar coleta em lote');
      }

      return response.data!.results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['collection-history'] });
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
