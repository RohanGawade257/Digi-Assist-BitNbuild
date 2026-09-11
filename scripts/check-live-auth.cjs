// Opt-in live check: temporary synthetic Firebase user, real browser/password/API path, exact-user cleanup.
// No verification/reset email, raw capture, real personal data, or credential logging.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { randomUUID, randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { initializeApp, cert, deleteApp } = apiRequire('firebase-admin/app');
const { getAuth } = apiRequire('firebase-admin/auth');

async function main() {
  if (!process.argv.includes('--run')) { console.log('Use --run to create one temporary synthetic Firebase user, check real login/API handling, then delete that user and owned app data. No email is sent.'); return; }
  const manifest = path.join(root, 'secrets/live-auth-check.json');
  if (fs.existsSync(manifest)) throw new Error('PREVIOUS_CHECK_NEEDS_REVIEW');
  const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const credential = JSON.parse(fs.readFileSync(path.resolve(root, 'apps/api', env.GOOGLE_APPLICATION_CREDENTIALS || '../../secrets/firebase-admin.json'), 'utf8'));
  assert.equal(credential.project_id, env.FIREBASE_PROJECT_ID); assert.equal(credential.project_id, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const app = initializeApp({ credential: cert(credential), projectId: credential.project_id }, 'sprint-live-' + randomUUID());
  const auth = getAuth(app), uid = 'guide-sprint-' + randomUUID().replaceAll('-', '');
  const email = uid + '@example.test', password = 'Aa9!' + randomBytes(24).toString('base64url');
  let browser, bearer, created = false, appDataRemoved = true, firebaseRemoved = false, stage = 'create-temporary-user';
  fs.writeFileSync(manifest, JSON.stringify({ uid, purpose: 'temporary-auth-sprint-check' }));
  try {
    await auth.createUser({ uid, email, password, emailVerified: true }); created = true;
    stage = 'browser-login'; browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(15000);
    await page.route('https://identitytoolkit.googleapis.com/**/accounts:sendOobCode*', route => route.abort());
    page.on('request', request => {
      if (request.url().startsWith('http://localhost:3001/api/v1/') && request.headers().authorization) {
        const token = request.headers().authorization.slice(7);
        try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub === uid) { bearer = token; appDataRemoved = false; } } catch {}
      }
    });
    await page.goto('http://localhost:3000'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('#question').fill('Explain the public registration instructions');
    await page.locator('.auth-card > summary').click(); await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
    const preferences = page.waitForResponse(response => response.url().endsWith('/me') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const prefs = await preferences; assert.equal(prefs.status(), 200); assert.equal(await page.locator('#question').inputValue(), 'Explain the public registration instructions');
    console.log(JSON.stringify({ realFirebasePasswordLogin: true, realProtectedPreferences: 200, preLoginDraftPreserved: true }));
    stage = 'real-question-path';
    await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
    const answer = page.waitForResponse(response => /\/sessions\/[^/]+\/turns$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST', { timeout: 50000 });
    await page.locator('#question').press('Enter'); const response = await answer;
    if (response.status() === 503) {
      const body = await response.json(); assert.equal(body.code, 'SERVICE_UNAVAILABLE');
      await page.locator('.composer').getByRole('alert').waitFor(); assert.equal(await page.locator('#question').inputValue(), 'Explain the public registration instructions');
      assert.equal(await page.getByRole('button', { name: 'Retry', exact: true }).isVisible(), true);
      console.log(JSON.stringify({ realTurnStatus: 503, errorCode: 'SERVICE_UNAVAILABLE', draftPreserved: true, retryVisible: true, liveGenerationVerified: false }));
    } else {
      assert.equal(response.status(), 200); await page.locator('.answer').waitFor();
      console.log(JSON.stringify({ realTurnStatus: 200, liveGenerationVerified: true }));
    }
  } catch { console.log(JSON.stringify({ checkFailedAt: stage })); process.exitCode = 1; }
  finally {
    // Close the browser before cleanup so it cannot schedule another preferences write.
    await browser?.close();
    if (created && bearer) {
      try { const result = await fetch('http://localhost:3001/api/v1/me', { method: 'DELETE', headers: { Authorization: 'Bearer ' + bearer }, signal: AbortSignal.timeout(20000) }); appDataRemoved = result.status === 204; } catch { appDataRemoved = false; }
    }
    if (created) {
      try { await auth.deleteUser(uid); firebaseRemoved = true; } catch (error) { firebaseRemoved = error.code === 'auth/user-not-found'; }
    } else firebaseRemoved = true;
    await deleteApp(app);
    console.log(JSON.stringify({ temporaryFirebaseUserRemoved: firebaseRemoved, temporaryOwnedDataRemoved: appDataRemoved, uidOnlyDeletionTombstoneMayRemain: Boolean(bearer && appDataRemoved) }));
    if (firebaseRemoved && appDataRemoved) fs.unlinkSync(manifest);
    else { console.error('Review secrets/live-auth-check.json for the exact temporary test UID requiring cleanup.'); process.exitCode = 1; }
  }
}
main().catch(() => { console.error('Live auth check did not start. Check local Firebase configuration or the pending test manifest; no credentials were printed.'); process.exitCode = 1; });
