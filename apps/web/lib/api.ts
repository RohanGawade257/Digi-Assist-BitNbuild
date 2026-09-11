import { firebaseAuth } from './firebase';
const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';
export class RequestError extends Error { constructor(public code: string, public retryAfterMs?: number) { super(code); } }
export async function authenticatedFetch(path: string, method: string, body?: BodyInit, signal?: AbortSignal, json = false) {
  const user = firebaseAuth().currentUser;
  if (!user) throw new RequestError('AUTH_REQUIRED');
  const token = await user.getIdToken(); signal?.throwIfAborted();
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body, signal, cache: 'no-store' });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new RequestError(error.code || 'SERVICE_UNAVAILABLE', error.retryAfterMs); }
  return response;
}
export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(path, method, body !== undefined ? JSON.stringify(body) : undefined, signal, body !== undefined);
  return response.status === 204 ? undefined as T : response.json();
}
