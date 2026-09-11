import { test, expect, type Page } from '@playwright/test';
import { login } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

async function send(page: Page, question: string) { await page.locator('#question').fill(question); await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check(); await page.getByRole('button', { name: 'Send question' }).click(); }

test('authenticated typed journey covers all seven reply languages and independent English draft', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
  for (const locale of ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'te-IN', 'ta-IN', 'ur-IN']) {
    await page.getByLabel('Assistance language', { exact: true }).selectOption(locale);
    await send(page, 'Explain the registration instructions');
    await expect(page.locator(`.answer p[lang="${locale}"]`).first()).toBeVisible();
  }
  await page.getByLabel('Assistance language', { exact: true }).selectOption('hi-IN');
  await page.locator('.task-options > summary').click(); await page.getByRole('radio', { name: 'Prepare a draft' }).check();
  await page.getByLabel('Draft language', { exact: true }).selectOption('en-IN'); await send(page, 'Draft an email asking for public instructions');
  await expect(page.locator('.answer pre[lang="en-IN"]')).toContainText('Dear [recipient]'); await expect(page.locator('.answer p[lang="hi-IN"]').last()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('editing an in-flight question rejects its old answer and IME Enter does not submit', async ({ page }) => {
  await login(page); await send(page, 'Wait for my next instruction');
  await page.locator('#question').fill('A revised safe question');
  await page.waitForTimeout(3200); await expect(page.locator('.answer')).toHaveCount(0);
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check();
  let turns = 0; page.on('request', req => { if (req.url().endsWith('/turns')) turns++; });
  await page.locator('#question').dispatchEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, keyCode: 229 });
  await page.waitForTimeout(100); expect(turns).toBe(0);
  await page.getByRole('button', { name: 'Send question' }).click(); await expect(page.locator('.answer')).toBeVisible();
});

test('opt-in history saves a session, supports review and deletes it', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Language and comfort', exact: true }).click(); await page.getByRole('checkbox', { name: 'Save new sessions for 30 days (optional)' }).check();
  await send(page, 'Explain safe registration'); await expect(page.locator('.answer')).toBeVisible();
  await page.getByRole('button', { name: 'End assistance' }).click();
  await page.getByText('Saved history, feedback and account', { exact: true }).click();
  await page.getByRole('button', { name: 'Refresh saved sessions' }).click();
  await expect(page.getByRole('button', { name: 'Delete saved session', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete saved session', exact: true }).click(); await expect(page.getByRole('button', { name: 'Delete saved session', exact: true })).toHaveCount(0);
});

test('local synthetic microphone requires upload consent, transcript review and reuses audio on repeat', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      await new Promise<void>(resolve => { (window as unknown as { grantMicrophone: () => void }).grantMicrophone = resolve; });
      const context = new AudioContext(); const tone = context.createOscillator(); tone.frequency.value = 440; const output = context.createMediaStreamDestination(); tone.connect(output); tone.start(); await context.resume(); output.stream.getTracks()[0]!.addEventListener('ended', () => { tone.stop(); void context.close(); }); return output.stream;
    };
  });
  await login(page); await page.getByRole('button', { name: 'Language and comfort', exact: true }).click(); await page.getByRole('checkbox', { name: 'Enable answer audio' }).check(); await page.locator('.voice-input > summary').click();
  let uploads = 0, speech = 0; page.on('request', request => { if (request.url().endsWith('/transcriptions')) uploads++; if (request.url().endsWith('/audio')) speech++; });
  await page.getByRole('button', { name: 'Record locally', exact: true }).click();
  await expect(page.getByText('Starting microphone.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish recording', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { grantMicrophone: () => void }).grantMicrophone());
  await expect(page.getByText('Microphone is recording.', { exact: false })).toBeVisible();
  await page.waitForTimeout(800); await page.getByRole('button', { name: 'Finish recording' }).click();
  await expect(page.getByRole('button', { name: 'Send recording for transcription' })).toBeDisabled(); expect(uploads).toBe(0);
  await page.getByRole('checkbox', { name: /I agree to send this non-sensitive recording/ }).check();
  await page.getByRole('button', { name: 'Send recording for transcription' }).click();
  await expect(page.locator('#question')).toHaveValue('Explain the public registration instructions'); await expect(page.locator('.chat').getByRole('checkbox', { name: /I have used only/ })).not.toBeChecked(); expect(uploads).toBe(1);
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check(); await page.getByRole('button', { name: 'Send question' }).click(); await expect(page.locator('.answer')).toBeVisible();
  await page.getByRole('button', { name: 'Play / repeat' }).click(); await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await expect(page.locator('.speech-controls [role=alert]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop audio' }).click(); await page.getByRole('button', { name: 'Play / repeat' }).click(); expect(speech).toBe(1);
  await page.getByRole('button', { name: 'End assistance' }).click(); await expect(page.locator('audio')).toHaveCount(0);
});

for (const inputMode of ['text', 'voice'] as const) for (const kind of ['screenshot', 'desktop'] as const) test(`${inputMode} with ${kind} sends only reviewed labels to the same task pipeline`, async ({ page }) => {
  if (kind === 'screenshot') await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => { const c = document.createElement('canvas'); c.width = 400; c.height = 180; c.getContext('2d')!.fillRect(0, 0, 400, 180); return c.captureStream(5); };
    navigator.mediaDevices.getUserMedia = async () => { const c = new AudioContext(); const tone = c.createOscillator(); const output = c.createMediaStreamDestination(); tone.connect(output); tone.start(); await c.resume(); return output.stream; };
  });
  await login(page);
  await page.getByRole('button', { name: 'Add or review context' }).click();
  if (kind === 'desktop') await page.getByRole('button', { name: 'Share a desktop view' }).click();
  else {
    const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 180; return canvas.toDataURL('image/png').split(',')[1]!; });
    await page.locator('#screenshot').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  }
  await page.getByRole('radio', { name: 'Labels only (no image upload)', exact: true }).check();
  await expect(page.locator('.screenshot')).toBeVisible();
  await page.getByLabel('Public labels or instructions, one per line').fill('Attach files'); await page.getByRole('checkbox', { name: 'Attach files', exact: true }).check(); await page.getByLabel('Which label do you mean?').selectOption('label_1');
  if (kind === 'screenshot') {
    await page.locator('.preview-target').scrollIntoViewIfNeeded();
    const box = await page.locator('.preview-target').boundingBox(); await page.locator('.preview-target').click({ position: { x: box!.width * 0.1, y: box!.height * 0.1 } });
    await expect(page.locator('.target-region')).toBeVisible();
  }
  await page.locator('.context-card').getByRole('checkbox', { name: /I have used only/ }).check(); await page.getByRole('button', { name: 'Approve selected context' }).click(); await expect(page.getByText('Approved: Attach files', { exact: true })).toBeVisible();
  if (inputMode === 'voice') {
    await page.locator('.voice-input > summary').click();
    await page.getByRole('button', { name: 'Record locally', exact: true }).click();
    await expect(page.getByText('Microphone is recording. It stops after 25 seconds.', { exact: true })).toBeVisible();
    await page.waitForTimeout(800); await page.getByRole('button', { name: 'Finish recording' }).click();
    await page.getByRole('checkbox', { name: /I agree to send this non-sensitive recording/ }).check(); await page.getByRole('button', { name: 'Send recording for transcription' }).click(); await expect(page.locator('#question')).not.toBeEmpty();
  } else await page.locator('#question').fill('Explain the attachment instruction');
  const request = page.waitForRequest(req => req.url().endsWith('/turns') && req.method() === 'POST');
  await page.locator('.chat').getByRole('checkbox', { name: /I have used only/ }).check(); await page.getByRole('button', { name: 'Send question' }).click();
  const body = (await request).postDataJSON(); expect(body.inputMode).toBe(inputMode); expect(body.source.kind).toBe(kind); expect(body.source.reviewedLabels).toEqual([{ id: 'label_1', text: 'Attach files' }]); expect(body.source.selectedTarget.labelId).toBe('label_1'); expect(body.source.rawImage).toBeUndefined();
  if (kind === 'screenshot') { expect(body.source.selectedTarget.normalizedRegion.x).toBeCloseTo(0.075, 1); expect(body.source.selectedTarget.normalizedRegion.y).toBeCloseTo(0.075, 1); }
  await expect(page.locator('.answer')).toBeVisible();
  if (kind === 'screenshot') {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    expect(await page.locator('.conversation-log').evaluate(log => {
      const text = log.querySelector('.answer > p')?.getBoundingClientRect(), bounds = log.getBoundingClientRect();
      return Boolean(text && text.top >= bounds.top && text.bottom <= bounds.bottom);
    })).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/mobile-${inputMode}-screenshot-answer.png`, fullPage: true });
  }
  const ended = page.waitForResponse(response => response.url().endsWith('/end')); await page.getByRole('button', { name: 'End assistance' }).click(); expect((await ended).status()).toBe(204);
});
