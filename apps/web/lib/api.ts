import { firebaseAuth } from './firebase';

export function getApiBaseUrl(): string {
  let raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  // If in browser on a production domain (not localhost) and raw is missing or localhost:
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    if (!raw || raw.includes('localhost') || raw.includes('127.0.0.1')) {
      raw = 'https://vaanisetu-multilingual-voice-assistance.onrender.com/api/v1';
    }
  }
  if (!raw) {
    raw = 'http://localhost:3001/api/v1';
  }
  raw = raw.replace(/\/+$/, '');
  if (!raw.endsWith('/api/v1')) {
    raw = `${raw}/api/v1`;
  }
  return raw;
}

export class RequestError extends Error {
  constructor(public code: string, public retryAfterMs?: number, public stage?: string) {
    super(code);
    this.name = 'RequestError';
  }
}

export async function authenticatedFetch(path: string, method: string, body?: BodyInit, signal?: AbortSignal, json = false) {
  const user = firebaseAuth().currentUser;
  if (!user) {
    console.warn('[VOICE ERROR][auth] No authenticated user found before calling', path);
    throw new RequestError('AUTH_REQUIRED', undefined, 'auth');
  }
  let token: string;
  try {
    token = await user.getIdToken();
  } catch (err) {
    console.error('[VOICE ERROR][auth] Failed to retrieve Firebase ID token:', err);
    throw new RequestError('AUTH_TOKEN_FAILED', undefined, 'auth');
  }
  signal?.throwIfAborted();

  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  console.info(`[VOICE] API request starting: ${method} ${fullUrl}`);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json ? { 'Content-Type': 'application/json' } : {})
      },
      body,
      signal,
      cache: 'no-store'
    });
  } catch (netErr) {
    console.error(`[VOICE ERROR][upload] fetch failed for ${method} ${fullUrl}:`, netErr);
    throw new RequestError('NETWORK_ERROR', undefined, 'upload');
  }

  console.info(`[VOICE] API request finished: ${method} ${fullUrl} -> HTTP ${response.status}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorCode = (errorData as { code?: string }).code || `HTTP_${response.status}`;
    console.error(`[VOICE ERROR][api] ${method} ${fullUrl} failed with code ${errorCode}:`, errorData);
    throw new RequestError(errorCode, (errorData as { retryAfterMs?: number }).retryAfterMs, 'api');
  }
  return response;
}

export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(path, method, body !== undefined ? JSON.stringify(body) : undefined, signal, body !== undefined);
  return response.status === 204 ? undefined as T : response.json();
}
