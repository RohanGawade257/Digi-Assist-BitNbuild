// Read-only diagnostics. Never creates users, signs in, sends email, or prints credentials.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const names = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'];
function safeCode(value) { return typeof value === 'string' && /^[A-Z][A-Z_]{1,79}$/.test(value.split(' : ')[0]) ? value.split(' : ')[0] : 'UNCLASSIFIED_ERROR'; }
async function readJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  const data = await response.json();
  return { response, data };
}
async function main() {
  const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const fields = Object.fromEntries(names.map(name => [name, { present: Boolean(env[name]), trimmed: env[name] === env[name]?.trim() }]));
  let admin;
  try { admin = JSON.parse(fs.readFileSync(path.resolve(root, 'apps/api', env.GOOGLE_APPLICATION_CREDENTIALS || '../../secrets/firebase-admin.json'), 'utf8')); } catch {}
  console.log(JSON.stringify({ local: { fields, serverAndWebProjectMatch: Boolean(env.FIREBASE_PROJECT_ID) && env.FIREBASE_PROJECT_ID === env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, adminAndWebProjectMatch: Boolean(admin?.project_id) && admin.project_id === env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, defaultAuthDomainMatchesProject: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN === `${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`, apiKeyFormatValid: /^AIza[\w-]{35}$/.test(env.NEXT_PUBLIC_FIREBASE_API_KEY || ''), webAppIdFormatValid: /^1:\d+:web:[a-f\d]+$/i.test(env.NEXT_PUBLIC_FIREBASE_APP_ID || '') } }, null, 2));
  try {
    const origin = 'http://127.0.0.1:3000';
    const html = await (await fetch(origin, { signal: AbortSignal.timeout(10000) })).text();
    const urls = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => new URL(match[1], origin)).filter(url => url.origin === origin))];
    const bundles = (await Promise.all(urls.map(async url => (await fetch(url, { signal: AbortSignal.timeout(10000) })).text()))).join('\n');
    const serverOnly = Object.entries(env).filter(([name, value]) => /^(GEMINI_API_KEY_\d+|SARVAM_API_KEY_\d+|MONGODB_URI|MONGO_ROOT_PASSWORD)$/.test(name) && value);
    if (admin?.private_key) serverOnly.push(['FIREBASE_ADMIN_PRIVATE_KEY', admin.private_key]);
    const served = `${html}\n${bundles}`;
    console.log(JSON.stringify({ runningWeb: { reachable: true, bundledFieldsMatchEnv: Object.fromEntries(names.map(name => [name, Boolean(env[name]) && bundles.includes(JSON.stringify(env[name]))])), serverSecretsChecked: serverOnly.length, serverSecretsAbsent: serverOnly.every(([, value]) => !served.includes(value) && !served.includes(JSON.stringify(value).slice(1, -1))) } }, null, 2));
  } catch { console.log(JSON.stringify({ runningWeb: { reachable: false } })); }
  if (!process.argv.includes('--remote')) return;
  if (!env.NEXT_PUBLIC_FIREBASE_API_KEY || !env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error('MISSING_PUBLIC_CONFIG');
  try {
    const url = new URL('https://identitytoolkit.googleapis.com/v1/projects');
    url.searchParams.set('key', env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const { response, data } = await readJson(url);
    console.log(JSON.stringify({ firebasePublicConfig: { status: response.status, error: response.ok ? undefined : safeCode(data.error?.message), projectMatches: response.ok ? (String(data.projectId) === env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || String(data.projectId) === env.NEXT_PUBLIC_FIREBASE_APP_ID?.split(':')[1]) : undefined, localhostAuthorized: data.authorizedDomains?.includes('localhost'), loopbackAuthorized: data.authorizedDomains?.includes('127.0.0.1') } }, null, 2));
  } catch { console.log(JSON.stringify({ firebasePublicConfig: { error: 'REQUEST_FAILED' } })); }
  if (!admin?.private_key || admin.project_id !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
  const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
  const { cert } = apiRequire('firebase-admin/app');
  try {
    const token = await cert(admin).getAccessToken();
    const { response, data } = await readJson(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(admin.project_id)}/config`, { Authorization: `Bearer ${token.access_token}` });
    console.log(JSON.stringify({ firebaseAdminConfig: { status: response.status, error: response.ok ? undefined : safeCode(data.error?.status), emailPasswordEnabled: response.ok ? Boolean(data.signIn?.email?.enabled && data.signIn?.email?.passwordRequired) : undefined, emailProviderEnabled: response.ok ? Boolean(data.signIn?.email?.enabled) : undefined, localhostAuthorized: data.authorizedDomains?.includes('localhost'), loopbackAuthorized: data.authorizedDomains?.includes('127.0.0.1') } }, null, 2));
  } catch { console.log(JSON.stringify({ firebaseAdminConfig: { error: 'REQUEST_FAILED' } })); }
}
main().catch(() => { console.error('Firebase diagnostics could not complete. Check the local .env and running website. No credential values were printed.'); process.exitCode = 1; });
