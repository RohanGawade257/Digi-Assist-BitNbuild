import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { login } from './fixtures';

const consent = 'I reviewed this exact image and agree to send it to Gemini for AI analysis.';
async function upload(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200;
    const x = c.getContext('2d')!; x.fillStyle = 'white'; x.fillRect(0, 0, 400, 200);
    x.fillStyle = 'black'; x.font = '20px sans-serif'; x.fillText('SYNTHETIC HEADER', 10, 30); x.fillText('VIOLET COMPASS', 10, 130);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('#screenshot').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await expect(page.locator('.approved-image-preview')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: consent, exact: true })).toBeEnabled();
  return data;
}
async function approve(page: Page) {
  await page.getByRole('checkbox', { name: consent, exact: true }).check();
  await page.getByRole('button', { name: 'Approve this image', exact: true }).click();
  await expect(page.getByText('Image approved. Send a question to analyze this snapshot.', { exact: true })).toBeVisible();
}

test('exact local crop and mask require approval; failed image request retains draft and retries', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Add or review context' }).click();
  const original = await upload(page); let attempts = 0; const bodies: any[] = [];
  await page.route('**/turns', async route => {
    attempts++; bodies.push(route.request().postDataJSON());
    if (attempts === 1) await route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE' } });
    else await route.fallback();
  });
  await page.locator('#question').fill('Read the instruction in this snapshot');
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.locator('#question').press('Enter'); expect(attempts).toBe(0);
  await expect(page.getByRole('button', { name: 'Approve this image', exact: true })).toBeDisabled();
  const area = page.locator('.image-coordinates input');
  await area.nth(3).fill('25'); await page.getByRole('button', { name: 'Mask area', exact: true }).click();
  await expect(area.nth(3)).toHaveValue('100'); await area.nth(2).fill('75');
  await page.getByRole('button', { name: 'Crop to area', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: consent, exact: true })).toBeEnabled();
  const preview = await page.locator('.approved-image-preview').getAttribute('src');
  const pixels = await page.locator('.approved-image-preview').evaluate(async element => {
    const image = element as HTMLImageElement; await image.decode(); const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
    const x = c.getContext('2d')!; x.drawImage(image, 0, 0); return { width: c.width, height: c.height, masked: Array.from(x.getImageData(20, 20, 1, 1).data) };
  });
  expect(pixels).toEqual({ width: 300, height: 200, masked: [0, 0, 0, 255] });
  await approve(page); expect(attempts).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#question').press('Enter');
  await expect(page.locator('.composer').getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.locator('#question')).toHaveValue('Read the instruction in this snapshot');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.answer')).toHaveCount(1); expect(attempts).toBe(2);
  const sent = bodies[1].source.approvedImage;
  expect(sent.data).toBe(preview!.split(',')[1]); expect(sent.data).not.toBe(original);
  expect(sent.sha256).toBe(createHash('sha256').update(Buffer.from(sent.data, 'base64')).digest('hex'));
  expect(sent.analysisConsent).toBe(true); expect(bodies[1].source.reviewedLabels).toEqual([]);
  // This is a UI/HTTP regression with explicit provider doubles; live image proof is a separate opt-in script.
  await page.getByRole('button', { name: 'Review source', exact: true }).click();
  await area.nth(2).fill('50'); await expect(page.getByRole('checkbox', { name: consent, exact: true })).not.toBeChecked();
  await page.locator('#question').fill('Read again'); await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.getByRole('button', { name: 'Send question' }).click(); expect(attempts).toBe(2);
  await upload(page); await expect(page.getByRole('checkbox', { name: consent, exact: true })).not.toBeChecked();
});

test('changed shared frame revokes image approval and requires a refreshed approved snapshot', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 200; c.getContext('2d')!.fillRect(0, 0, 400, 200);
      (window as unknown as { visualFrame: HTMLCanvasElement }).visualFrame = c; return c.captureStream(5);
    };
  });
  await login(page); let turns = 0; page.on('request', req => { if (req.url().endsWith('/turns')) turns++; });
  await page.getByRole('button', { name: /^Share screen/ }).click(); await approve(page); expect(turns).toBe(0);
  await page.evaluate(() => { const c = (window as unknown as { visualFrame: HTMLCanvasElement }).visualFrame; c.getContext('2d')!.clearRect(0, 0, 50, 50); });
  await expect(page.getByText('Image approved. Send a question to analyze this snapshot.', { exact: true })).toHaveCount(0);
  await page.locator('#question').fill('What is shown?'); await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.locator('#question').press('Enter'); expect(turns).toBe(0);
  await page.getByRole('button', { name: 'Refresh shared preview', exact: true }).click(); await approve(page);
  await page.locator('#question').press('Enter'); await expect(page.locator('.answer')).toHaveCount(1); expect(turns).toBe(1);
});
