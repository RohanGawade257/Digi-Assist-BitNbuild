import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('language precedes login; interface is independent; onboarding passes automated axe checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little guidance. A lot more confidence.' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  await page.getByRole('radio', { name: 'हिन्दी', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-IN');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Assistance language', { exact: true })).toHaveValue('hi-IN');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeDisabled();
});
test('all seven interface paths render including Urdu RTL', async ({ page }) => {
  await page.goto('/');
  for (const locale of ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'te-IN', 'ta-IN', 'ur-IN']) {
    await page.locator('select').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ur-IN' ? 'rtl' : 'ltr');
    await expect(page.locator('.primary')).not.toBeEmpty();
  }
});
test('review and approval are separate; source edits invalidate approval without any upload', async ({ page }) => {
  let outgoing = 0;
  page.on('request', req => { if (req.method() === 'POST') outgoing++; });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Public labels or instructions, one per line').fill('Compose\nAttach files');
  await page.getByRole('checkbox', { name: 'Compose', exact: true }).check();
  await page.getByLabel('Which label do you mean?').selectOption('label_1');
  await expect(page.getByRole('button', { name: 'Approve selected context' })).toBeDisabled();
  await page.locator('.context-card').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.getByRole('button', { name: 'Approve selected context' }).click();
  await expect(page.getByText('Approved: Compose', { exact: true })).toBeVisible();
  await page.getByLabel('Public labels or instructions, one per line').fill('Next');
  await expect(page.getByText('Approved: Compose', { exact: true })).toHaveCount(0);
  expect(outgoing).toBe(0);
});
test('screenshot bytes stay local; invalid image rejected and session clear releases preview', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#screenshot').setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('.context-card').getByRole('alert')).toContainText('Use a PNG');
  // Browser-encoded synthetic image avoids relying on a malformed copied PNG fixture.
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 100; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 100); ctx.fillStyle = '#000'; ctx.fillText('Compose', 20, 50); return canvas.toDataURL('image/png').split(',')[1]!; });
  await page.locator('#screenshot').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('.screenshot')).toBeVisible();
  await expect(page.locator('.screenshot')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'End and clear session' }).click();
  await expect(page.locator('.screenshot')).toHaveCount(0);
});
test('keyboard chat retains Unicode draft, Escape restores focus, Enter inserts newline', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  const input = page.locator('#question');
  await input.fill('हिन्दी اردو'); await input.press('Enter'); await expect(input).toHaveValue('हिन्दी اردو\n');
  await input.press('Escape'); await expect(page.getByRole('button', { name: 'Open chat' })).toBeFocused(); await expect(input).toHaveCount(0);
  await page.keyboard.press('Space'); await expect(input).toBeFocused(); await expect(input).toHaveValue('हिन्दी اردو\n');
  await page.getByRole('checkbox', { name: 'Pin visible' }).check(); await page.mouse.move(0, 0); await expect(input).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeDisabled();
});
test('375px workspace reflows and passes automated accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox', { name: 'Larger text' }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
