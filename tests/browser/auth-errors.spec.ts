import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function openAuth(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.auth-card > summary').click();
  await page.getByLabel('Email address').fill('synthetic@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-fixture-password');
}

test('missing Firebase setup is identified next to account controls for login, signup and reset', async ({ page }) => {
  const calls: string[] = [];
  await page.route('https://identitytoolkit.googleapis.com/**', route => {
    calls.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 400, json: { error: { code: 400, message: 'CONFIGURATION_NOT_FOUND' } } });
  });
  await openAuth(page);
  for (const name of ['Sign in', 'Create account', 'Reset password']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#auth-feedback').getByRole('alert')).toContainText('account setup is incomplete');
    await expect(page.locator('#auth-feedback').getByRole('alert')).not.toContainText('auth/');
  }
  expect(calls).toContain('/v1/accounts:signInWithPassword');
  expect(calls).toContain('/v1/accounts:signUp');
  expect(calls).toContain('/v1/accounts:sendOobCode');
});

test('invalid credentials retain safe guidance without exposing provider message or account data', async ({ page }) => {
  await page.route('https://identitytoolkit.googleapis.com/**', route => route.fulfill({ status: 400, json: { error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS : private-diagnostic-value' } } }));
  await openAuth(page); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#auth-feedback').getByRole('alert')).toBeVisible();
  await expect(page.locator('#auth-feedback')).not.toContainText('private-diagnostic-value');
  await expect(page.locator('#auth-feedback')).not.toContainText('synthetic@example.test');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

test('create account validates required email and password before contacting Firebase', async ({ page }) => {
  let calls = 0;
  await page.route('https://identitytoolkit.googleapis.com/**', route => { calls++; return route.abort(); });
  await openAuth(page); await page.getByLabel('Email address').fill('');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeFocused();
  await page.getByLabel('Email address').fill('synthetic@example.test'); await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  expect(calls).toBe(0);
});

test('failed verification delivery preserves the created account and offers resend', async ({ page }) => {
  const uid = `browser-${randomUUID()}`, now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, email: 'synthetic@example.test', email_verified: false, firebase: { sign_in_provider: 'password' } })}.fixture`;
  await page.route('https://identitytoolkit.googleapis.com/**', route => {
    if (route.request().url().includes(':sendOobCode')) return route.fulfill({ status: 400, json: { error: { code: 400, message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } } });
    return route.fulfill({ json: route.request().url().includes(':lookup') ? { users: [{ localId: uid, email: 'synthetic@example.test', emailVerified: false, passwordHash: 'fixture', providerUserInfo: [{ providerId: 'password', email: 'synthetic@example.test' }] }] } : { localId: uid, email: 'synthetic@example.test', idToken: token, refreshToken: 'fixture', expiresIn: '3600' } });
  });
  await page.route('**/api/v1/**', async route => { const url = new URL(route.request().url()); const response = await route.fetch({ url: `http://127.0.0.1:4101${url.pathname}`, headers: { ...route.request().headers(), authorization: `Bearer ${uid}` } }); await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } }); });
  await openAuth(page);
  const preferencesSaved = page.waitForResponse(response => response.url().endsWith('/me') && response.request().method() === 'PATCH' && response.ok());
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.locator('#auth-feedback').getByRole('status')).toContainText('Your account was created');
  await expect(page.locator('#auth-feedback').getByRole('alert')).toContainText('wait a moment');
  await expect(page.getByRole('button', { name: 'Send verification email', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
  await preferencesSaved;
});
