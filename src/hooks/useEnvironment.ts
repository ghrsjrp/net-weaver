import { useQuery } from '@tanstack/react-query';
import { detectSelfHosted, isSelfHosted, getApiUrl } from '@/lib/api/client';

export interface EnvironmentInfo {
  isSelfHosted: boolean;
  apiUrl: string;
  version?: string;
  isLoading: boolean;
}

/**
 * Hook para detectar e cachear o tipo de ambiente
 * Executa uma vez na inicialização e cacheia o resultado
 */
export function useEnvironment() {
  const query = useQuery({
    queryKey: ['environment'],
    queryFn: async () => {
      const selfHosted = await detectSelfHosted();
      
      let version: string | undefined;
      
      if (selfHosted) {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            const data = await response.json();
            version = data.version;
          }
        } catch {
          // Ignorar erros
        }
      }
      
      return {
        isSelfHosted: selfHosted,
        apiUrl: getApiUrl(),
        version,
      };
    },
    staleTime: Infinity, // Nunca refetch automaticamente
    gcTime: Infinity, // Nunca remover do cache
    retry: 1,
  });

  return {
    isSelfHosted: query.data?.isSelfHosted ?? isSelfHosted(),
    apiUrl: query.data?.apiUrl ?? getApiUrl(),
    version: query.data?.version,
    isLoading: query.isLoading,
  };
}

/**
 * Hook síncrono que retorna o cache atual do ambiente
 * Útil quando precisamos do valor imediatamente
 */
export function useEnvironmentSync() {
  return {
    isSelfHosted: isSelfHosted(),
    apiUrl: getApiUrl(),
  };
}
