import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

type RetriableRequest = InternalAxiosRequestConfig & { sessionRetry?: boolean };
let refreshRequest: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (!refreshRequest) {
    refreshRequest = axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function fetchWithSession(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = () => fetch(input, { ...init, credentials: 'include' });
  const response = await request();
  if (response.status !== 401) return response;

  await refreshSession();
  return request();
}

api.interceptors.response.use(response => response, async (error: AxiosError) => {
  const config = error.config as RetriableRequest | undefined;
  const url = config?.url || '';
  const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/logout', '/auth/refresh'].some(path => url.includes(path));
  if (error.response?.status !== 401 || !config || config.sessionRetry || isAuthEndpoint) return Promise.reject(error);

  config.sessionRetry = true;
  try {
    await refreshSession();
    return await api.request(config);
  } catch {
    return Promise.reject(error);
  }
});

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || 'Unable to reach the server. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
