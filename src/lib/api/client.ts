/**
 * Cliente HTTP para comunicação com o backend self-hosted
 * Detecta automaticamente se está em ambiente Docker/self-hosted
 */

// Cache para resultado de detecção de ambiente
let selfHostedCache: boolean | null = null;
let apiUrlCache: string | null = null;

/**
 * Verifica se estamos em ambiente self-hosted (Docker/servidor local)
 * Tenta detectar automaticamente baseado em:
 * 1. Variável VITE_SELF_HOSTED definida
 * 2. Variável VITE_API_URL definida
 * 3. Endpoint /api/health respondendo com sucesso
 */
export async function detectSelfHosted(): Promise<boolean> {
  // Retorna cache se já detectado
  if (selfHostedCache !== null) {
    return selfHostedCache;
  }

  // Se variável explícita definida
  if (import.meta.env?.VITE_SELF_HOSTED === 'true') {
    selfHostedCache = true;
    return true;
  }

  // Se VITE_API_URL definida, é self-hosted
  if (import.meta.env?.VITE_API_URL) {
    selfHostedCache = true;
    return true;
  }

  // Tentar detectar via /api/health na origem atual
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('/api/health', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok') {
        selfHostedCache = true;
        apiUrlCache = ''; // Usar origem atual (URLs relativas)
        console.log('[API] Ambiente self-hosted detectado via /api/health');
        return true;
      }
    }
  } catch {
    // Ignorar erros de conexão
  }

  // Não é self-hosted, usar Supabase
  selfHostedCache = false;
  return false;
}

/**
 * Retorna a URL base da API
 * Em self-hosted retorna '' para usar URLs relativas
 */
export function getApiUrl(): string {
  if (apiUrlCache !== null) {
    return apiUrlCache;
  }

  // Se VITE_API_URL definida, usar ela
  if (import.meta.env?.VITE_API_URL) {
    apiUrlCache = import.meta.env.VITE_API_URL;
    return apiUrlCache;
  }

  // Default: URLs relativas (funciona com proxy nginx)
  apiUrlCache = '';
  return '';
}

/**
 * Verifica se é self-hosted de forma síncrona
 * Retorna o cache ou false se ainda não detectado
 */
export function isSelfHosted(): boolean {
  return selfHostedCache === true;
}

/**
 * Força re-detecção do ambiente
 */
export function resetEnvironmentCache(): void {
  selfHostedCache = null;
  apiUrlCache = null;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

/**
 * Cliente HTTP genérico para a API self-hosted
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, headers, ...restOptions } = options;

  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro de conexão com o servidor';
    console.error(`[API] Erro em ${endpoint}:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Métodos HTTP simplificados
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),
};

/**
 * Verifica se a API está acessível
 */
export async function checkApiHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const response = await api.get<{ status: string; version: string }>('/api/health');
    if (response.success && response.data?.status === 'ok') {
      return { ok: true, version: response.data.version };
    }
    return { ok: false, error: response.error || 'API não respondeu corretamente' };
  } catch (error) {
    return { ok: false, error: 'Não foi possível conectar à API' };
  }
}

export default api;
