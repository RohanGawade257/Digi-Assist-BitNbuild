import { getApps, initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
export const firebaseConfigured = Object.values(config).every(Boolean);
export function firebaseAuth() {
  if (!firebaseConfigured) throw new Error('AUTH_NOT_CONFIGURED');
  const auth = getAuth(getApps()[0] || initializeApp(config));
  return auth;
}
export async function ephemeralAuth() { const auth = firebaseAuth(); await setPersistence(auth, inMemoryPersistence); return auth; }
