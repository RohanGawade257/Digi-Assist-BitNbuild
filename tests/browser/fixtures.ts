import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
export async function login(page: Page) {
  const uid = `browser-${randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, email: 'synthetic@example.test', email_verified: true, firebase: { sign_in_provider: 'password' } })}.fixture`;
  // Firebase REST fixtures are browser test intercepts, never app configuration or a production bypass.
  await page.route('https://identitytoolkit.googleapis.com/**', route => route.fulfill({ json: route.request().url().includes(':lookup') ? { users: [{ localId: uid, email: 'synthetic@example.test', emailVerified: true, passwordHash: 'fixture', providerUserInfo: [{ providerId: 'password', email: 'synthetic@example.test' }] }] } : { localId: uid, email: 'synthetic@example.test', idToken: token, refreshToken: 'fixture', expiresIn: '3600', registered: true } }));
  await page.route('**/api/v1/**', async route => { const url = new URL(route.request().url()); const response = await route.fetch({ url: `http://127.0.0.1:4101${url.pathname}`, headers: { ...route.request().headers(), authorization: `Bearer ${uid}` } }); await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.auth-card > summary').click();
  const preferencesSaved = page.waitForResponse(response => response.url().endsWith('/me') && response.request().method() === 'PATCH' && response.ok());
  await page.getByLabel('Email address').fill('synthetic@example.test'); await page.getByLabel('Password', { exact: true }).fill('synthetic-fixture-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await preferencesSaved;
}
