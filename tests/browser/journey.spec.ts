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
  await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
  await expect(page.getByLabel('Assistance language', { exact: true })).toHaveValue('hi-IN');
  await page.locator('.auth-card > summary').click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeEnabled();
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
  await page.getByRole('button', { name: 'Add or review context' }).click();
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
  await page.getByRole('button', { name: 'Add or review context' }).click();
  await page.locator('#screenshot').setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('.context-card').getByRole('alert')).toContainText('Use a PNG');
  // Browser-encoded synthetic image avoids relying on a malformed copied PNG fixture.
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 100; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 100); ctx.fillStyle = '#000'; ctx.fillText('Compose', 20, 50); return canvas.toDataURL('image/png').split(',')[1]!; });
  await page.locator('#screenshot').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('radio', { name: 'Labels only (no image upload)', exact: true }).check();
  await expect(page.locator('.screenshot')).toBeVisible();
  await expect(page.locator('.screenshot')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'End assistance' }).click();
  await expect(page.locator('.screenshot')).toHaveCount(0);
});
test('keyboard chat retains Unicode draft, Escape restores focus, Shift+Enter inserts newline', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  const input = page.locator('#question');
  await input.focus(); await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
  await expect(input).toBeHidden(); await page.getByRole('button', { name: 'Open chat', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(input).toBeFocused();
  await input.fill('हिन्दी اردو'); await input.press('Shift+Enter'); await expect(input).toHaveValue('हिन्दी اردو\n');
  await input.press('Escape'); await expect(page.getByRole('button', { name: 'Open chat' })).toBeFocused(); await expect(input).toBeHidden();
  await page.keyboard.press('Space'); await expect(input).toBeFocused(); await expect(input).toHaveValue('हिन्दी اردو\n');
  await page.getByRole('checkbox', { name: 'Pin visible' }).check(); await page.mouse.move(0, 0); await expect(input).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeEnabled();
});
test('375px workspace reflows and passes automated accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Larger text' }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('synthetic shared frames stay local and changing the frame revokes approval', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => { const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360; const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 640, 360); context.fillStyle = 'black'; context.fillText('Compose', 20, 50); (window as unknown as { captureFixture: HTMLCanvasElement }).captureFixture = canvas; return canvas.captureStream(5); };
  });
  let posts = 0; page.on('request', request => { if (request.method() === 'POST') posts++; });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click(); await page.getByRole('button', { name: /^Share screen/ }).click();
  await page.getByRole('radio', { name: 'Labels only (no image upload)', exact: true }).check();
  await expect(page.locator('.screenshot')).toBeVisible(); await page.getByLabel('Public labels or instructions, one per line').fill('Compose'); await page.getByRole('checkbox', { name: 'Compose', exact: true }).check();
  await page.locator('.context-card').getByRole('checkbox', { name: /I have used only/ }).check(); await page.getByRole('button', { name: 'Approve selected context' }).click(); await expect(page.getByText('Approved: Compose', { exact: true })).toBeVisible();
  await page.evaluate(() => { const canvas = (window as unknown as { captureFixture: HTMLCanvasElement }).captureFixture; canvas.getContext('2d')!.fillRect(0, 0, 200, 100); });
  await expect(page.getByText('Approved: Compose', { exact: true })).toHaveCount(0); await expect(page.locator('.context-card').getByRole('alert')).toContainText('shared view changed'); expect(posts).toBe(0);
  await page.getByRole('button', { name: 'Stop sharing', exact: true }).click(); await expect(page.locator('.screenshot')).toHaveCount(0);
});

test('supported floating chat retains its draft when returned to the main page', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click(); await page.locator('#question').fill('A safe draft');
  const supported = await page.evaluate(() => 'documentPictureInPicture' in window); test.skip(!supported, 'This browser does not expose Document Picture-in-Picture.');
  await page.getByRole('button', { name: 'Open floating chat' }).click();
  await expect(page.getByText('Chat is in the floating window.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { documentPictureInPicture: { window: Window } }).documentPictureInPicture.window.document.querySelector<HTMLTextAreaElement>('#question')?.value)).toBe('A safe draft');
  await page.getByRole('button', { name: 'Return chat to this page' }).click(); await expect(page.locator('#question')).toHaveValue('A safe draft'); await expect(page.getByRole('button', { name: 'Open floating chat' })).toBeFocused();
  await page.getByRole('button', { name: 'Open floating chat' }).click();
  await expect(page.getByText('Chat is in the floating window.', { exact: false })).toBeVisible();
  await page.evaluate(() => {
    const pip = (window as unknown as { documentPictureInPicture: { window: Window } }).documentPictureInPicture.window;
    pip.document.querySelector('#question')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeFocused();
  await expect(page.locator('#question')).toBeHidden();
  await page.keyboard.press('Enter'); await expect(page.locator('#question')).toHaveValue('A safe draft');
});

test('all secondary language controls render at mobile width with Urdu RTL', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
  await page.getByRole('button', { name: 'Add or review context' }).click();
  for (const locale of ['hi-IN', 'bn-IN', 'mr-IN', 'te-IN', 'ta-IN', 'ur-IN']) {
    await page.locator('#preferences select').nth(1).selectOption(locale); await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('.context-card label[for="labels"]')).not.toHaveText('Public labels or instructions, one per line');
    await expect(page.locator('.voice-input > summary')).not.toHaveText('Speak a question');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/urdu-mobile.png', fullPage: true });
});
