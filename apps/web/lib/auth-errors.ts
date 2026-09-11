// Only fixed public error codes are shown. Firebase messages/customData may contain user data.
const setupCodes = new Set(['auth/configuration-not-found', 'auth/operation-not-allowed', 'auth/invalid-api-key', 'auth/app-not-authorized', 'auth/unauthorized-domain']);
const retryCodes = new Set(['auth/too-many-requests', 'auth/network-request-failed']);
export function authFailure(error: unknown): { kind: 'setup' | 'retry' | 'details'; code?: string } {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && setupCodes.has(code)) return { kind: 'setup', code };
  if (typeof code === 'string' && retryCodes.has(code)) return { kind: 'retry', code };
  return { kind: 'details' };
}
