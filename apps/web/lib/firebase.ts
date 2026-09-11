import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
export const firebaseConfigured = Object.values(config).every(Boolean);
export function firebaseAuth() {
  if (!firebaseConfigured) throw new Error('AUTH_NOT_CONFIGURED');
  const app = getApps()[0] || initializeApp(config);
  try { return initializeAuth(app, { persistence: inMemoryPersistence }); }
  catch (error) { if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(app); throw error; }
}
export async function ephemeralAuth() { return firebaseAuth(); }
