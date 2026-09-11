import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test('Send and Enter each submit exactly one request; rapid and repeated Enter cannot duplicate it', async ({ page }) => {
  await login(page);
  const requests: Record<string, unknown>[] = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/turns')) requests.push(request.postDataJSON()); });
  await page.locator('#question').fill('Explain the public registration instructions');
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.locator('.answer')).toHaveCount(1); await expect(page.locator('#question')).toHaveValue('');
  await page.locator('#question').fill('Wait for my next instruction');
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.locator('#question').press('Enter'); await page.locator('#question').press('Enter');
  await page.locator('#question').dispatchEvent('keydown', { key: 'Enter', repeat: true });
  await expect(page.getByRole('button', { name: 'Stop answer', exact: true })).toBeVisible();
  await expect(page.locator('.answer')).toHaveCount(2);
  expect(requests).toHaveLength(2); expect(requests[0]!.nonSensitiveConfirmed).toBe(true);
  expect(requests[0]!.requestId).not.toBe(requests[1]!.requestId);
  await expect(page.locator('#question')).toHaveValue('');
});

test('blank and composing messages keep focus; Shift+Enter adds a line and Enter sends after composition', async ({ page }) => {
  await login(page); let requests = 0;
  page.on('request', request => { if (request.url().endsWith('/turns')) requests++; });
  await page.locator('#question').focus(); await page.locator('#question').press('Enter');
  await expect(page.locator('#question')).toBeFocused(); await expect(page.locator('.composer').getByRole('alert')).toContainText('Type a question first');
  await page.locator('#question').fill('हिन्दी اردو'); await page.locator('#question').press('Shift+Enter');
  await expect(page.locator('#question')).toHaveValue('हिन्दी اردو\n');
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  await page.locator('#question').dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
  await page.waitForTimeout(100); expect(requests).toBe(0);
  await page.locator('#question').press('Enter'); await expect(page.locator('.answer')).toHaveCount(1); expect(requests).toBe(1);
});

test('a failed request retains the draft and Retry uses the same submission path', async ({ page }) => {
  await login(page); let attempts = 0;
  await page.route('**/sessions/*/turns', route => { attempts++; return attempts === 1 ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, json: { code: 'SERVICE_UNAVAILABLE' } }) : route.fallback(); });
  const text = 'Explain the public registration instructions'; await page.locator('#question').fill(text);
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check(); await page.locator('#question').press('Enter');
  await expect(page.locator('.composer').getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.locator('#question')).toHaveValue(text); await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.answer')).toHaveCount(1); expect(attempts).toBe(2); await expect(page.locator('#question')).toHaveValue('');
});

test('language changes and closing chat retain the conversation and current draft', async ({ page }) => {
  await login(page); await page.locator('#question').fill('Explain a public instruction');
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check(); await page.locator('#question').press('Enter');
  await expect(page.locator('.answer')).toHaveCount(1); const previousAnswer = await page.locator('.answer').innerText();
  await page.locator('#question').fill('A follow-up draft'); await page.locator('#question').press('Escape');
  await expect(page.locator('#question')).toBeHidden(); await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeFocused();
  await page.keyboard.press('Space'); await expect(page.locator('#question')).toBeFocused(); await expect(page.locator('#question')).toHaveValue('A follow-up draft');
  await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
  await page.getByLabel('Assistance language', { exact: true }).selectOption('hi-IN');
  await page.getByLabel('Language for these controls', { exact: true }).selectOption('ur-IN');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); await expect(page.locator('#question')).toHaveValue('A follow-up draft');
  await expect(page.locator('.answer p[lang="en-IN"]').first()).toBeVisible();
  expect(previousAnswer).toContain((await page.locator('.answer p[lang="en-IN"]').first().innerText()));
});

test('context help does not interrupt typing, stays dismissed, and can be reopened', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('#question').fill('My draft stays here'); await page.waitForTimeout(2200);
  await expect(page.locator('#question')).toBeFocused(); await expect(page.locator('#step-help')).toHaveCount(0);
  await page.getByRole('button', { name: 'Help with this step', exact: true }).click(); await expect(page.locator('#step-help')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss help', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Help with this step', exact: true })).toBeFocused();
  await page.waitForTimeout(2200); await expect(page.locator('#step-help')).toHaveCount(0);
  await page.getByRole('button', { name: 'Help with this step', exact: true }).click(); await expect(page.locator('#step-help')).toBeVisible();
  await expect(page.locator('#question')).toHaveValue('My draft stays here');
});

test('screen sharing denial explains alternatives and preserves the typed question', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getDisplayMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.locator('#question').fill('My safe question');
  await page.getByRole('button', { name: /^Share screen/ }).click();
  await expect(page.locator('.context-card').getByRole('alert')).toContainText('Screen sharing was not started');
  await expect(page.locator('#question')).toHaveValue('My safe question'); await expect(page.locator('.source-strip')).toContainText('No screen context');
});

test('ending while the browser share chooser is pending stops a late granted stream', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () => new Promise<MediaStream>(resolve => {
      (window as unknown as { finishShare: () => void }).finishShare = () => {
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180; canvas.getContext('2d')!.fillRect(0, 0, 320, 180);
        const stream = canvas.captureStream(5); (window as unknown as { lateTrack: MediaStreamTrack }).lateTrack = stream.getTracks()[0]!; resolve(stream);
      };
    });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /^Share screen/ }).click(); await page.getByRole('button', { name: 'End assistance', exact: true }).click();
  await page.evaluate(() => (window as unknown as { finishShare: () => void }).finishShare());
  await expect.poll(() => page.evaluate(() => (window as unknown as { lateTrack: MediaStreamTrack }).lateTrack.readyState)).toBe('ended');
  await expect(page.locator('.screenshot')).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Assistance ended', exact: true })).toBeVisible();
});

test('spoken introduction is optional, preserves visible selected-language text and has no cloud fallback', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [] }); });
  let posts = 0; page.on('request', request => { if (request.method() === 'POST') posts++; });
  await page.goto('/'); await page.getByRole('radio', { name: 'हिन्दी', exact: true }).check();
  await expect(page.locator('.spoken-intro p[lang="hi-IN"]')).toBeVisible();
  await page.getByRole('button', { name: 'Listen to introduction', exact: true }).click();
  await expect(page.locator('.spoken-intro').getByRole('status')).toContainText('not available on this device');
  await page.getByRole('button', { name: 'Skip introduction', exact: true }).click(); await expect(page.locator('.spoken-intro')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await expect(page.locator('#question')).toBeVisible(); expect(posts).toBe(0);
});

test('End assistance stops screen and microphone tracks and permits neutral optional feedback', async ({ page }) => {
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = []; (window as unknown as { sprintTracks: MediaStreamTrack[] }).sprintTracks = tracks;
    navigator.mediaDevices.getDisplayMedia = async () => { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180; canvas.getContext('2d')!.fillRect(0, 0, 320, 180); const stream = canvas.captureStream(5); tracks.push(...stream.getTracks()); return stream; };
    navigator.mediaDevices.getUserMedia = async () => { const audio = new AudioContext(), tone = audio.createOscillator(), out = audio.createMediaStreamDestination(); tone.connect(out); tone.start(); await audio.resume(); tracks.push(...out.stream.getTracks()); out.stream.getTracks()[0]!.addEventListener('ended', () => { tone.stop(); void audio.close(); }); return out.stream; };
  });
  await login(page); await page.getByRole('button', { name: /^Share screen/ }).click(); await expect(page.locator('.approved-image-preview')).toBeVisible();
  await page.locator('.voice-input > summary').click(); await page.getByRole('button', { name: 'Record locally', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish recording', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'End assistance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assistance ended', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { sprintTracks: MediaStreamTrack[] }).sprintTracks.map(track => track.readyState))).toEqual(['ended', 'ended']);
  await expect(page.locator('.screenshot')).toHaveCount(0); await expect(page.locator('#question')).toHaveValue('');
  await page.getByText('Saved history, feedback and account', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save feedback', exact: true })).toBeDisabled();
  await page.locator('select').filter({ has: page.locator('option[value="not-helpful"]') }).selectOption('not-helpful');
  await page.getByRole('checkbox', { name: 'Save this feedback for up to 90 days.', exact: true }).check();
  await page.getByRole('button', { name: 'Save feedback', exact: true }).click(); await expect(page.getByText('Feedback saved.', { exact: true })).toBeVisible();
});
