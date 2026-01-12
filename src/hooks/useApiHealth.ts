import { useQuery } from '@tanstack/react-query';
import { checkApiHealth, API_URL } from '@/lib/api/client';

export interface ApiHealthStatus {
  isConnected: boolean;
  version?: string;
  apiUrl: string;
  error?: string;
}

/**
 * Hook para verificar status de conexão com a API backend
 */
export function useApiHealth() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: async (): Promise<ApiHealthStatus> => {
      const result = await checkApiHealth();
      return {
        isConnected: result.ok,
        version: result.version,
        apiUrl: API_URL,
        error: result.error,
      };
    },
    refetchInterval: 30000, // Verifica a cada 30 segundos
    retry: 1,
    staleTime: 10000,
  });
}
