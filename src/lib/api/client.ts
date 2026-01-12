/**
 * Cliente HTTP para comunicação com o backend self-hosted
 * Configurável via variáveis de ambiente
 */

// URL base da API - pode ser sobrescrita via env
const getApiUrl = (): string => {
  // Primeiro, verifica variável de ambiente do Vite
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback para mesma origem (quando frontend e backend estão no mesmo servidor)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Default para desenvolvimento local
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();

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

  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

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
    const response = await api.get<{ status: string; version: string }>('/health');
    if (response.success && response.data?.status === 'ok') {
      return { ok: true, version: response.data.version };
    }
    return { ok: false, error: response.error || 'API não respondeu corretamente' };
  } catch (error) {
    return { ok: false, error: 'Não foi possível conectar à API' };
  }
}

export default api;
