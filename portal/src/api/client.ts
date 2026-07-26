import { useAuthStore } from '../store/authStore.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** For multipart uploads — when set, `body` is ignored and Content-Type is left for the
   * browser to set (with the correct multipart boundary). */
  formData?: FormData;
  skipAuth?: boolean;
}

async function rawFetch(path: string, options: RequestOptions = {}) {
  const { accessToken } = useAuthStore.getState();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.formData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken && !options.skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
  });

  return res;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await rawFetch('/api/auth/refresh', { method: 'POST', skipAuth: true });
        if (!res.ok) return false;
        const data = await res.json();
        useAuthStore.getState().setSession(data.user, data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, options);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401) {
      useAuthStore.getState().clearSession();
    }
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
