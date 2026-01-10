import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase.functions.invoke('ssh-collector', {
        body: { deviceId, collectionTypes },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao executar coleta');
      }

      return data as CollectionResult;
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
  const collectDevice = useCollectDevice();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceIds: string[]) => {
      const results: CollectionResult[] = [];
      
      for (const deviceId of deviceIds) {
        try {
          const result = await collectDevice.mutateAsync({ deviceId });
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
  });
}
