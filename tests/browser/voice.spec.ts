import { test, expect, type Page } from '@playwright/test';
import { login } from './fixtures';
import { voiceCommand } from '../../apps/web/lib/voice-commands';

test('spoken approval requires an exact command, never an embedded or negated phrase', () => {
  expect(voiceCommand('Approve this image.', 'en-IN')).toBe('approve-image');
  expect(voiceCommand('इस तस्वीर को मंज़ूरी दें।', 'hi-IN')).toBe('approve-image');
  expect(voiceCommand('আবার বলুন', 'bn-IN')).toBe('repeat');
  expect(voiceCommand('Do not approve this image', 'en-IN')).toBeUndefined();
  expect(voiceCommand('The page says approve this image', 'en-IN')).toBeUndefined();
});
async function syntheticMicrophone(page: Page) {
  await page.addInitScript(() => {
    const state = window as any; state.inputTracks=[];
    navigator.mediaDevices.getUserMedia=async()=>{
      const c=new AudioContext(),out=c.createMediaStreamDestination();await c.resume();state.inputContext=c;state.inputDestination=out;state.inputTracks.push(...out.stream.getTracks());
      const tone=c.createOscillator(),gain=c.createGain();gain.gain.value=0;tone.connect(gain).connect(out);tone.start();return out.stream;
    };
    state.injectSpeech=async()=>{const c=state.inputContext as AudioContext;const bytes=await(await fetch('/voice/en-IN/question.wav')).arrayBuffer();const buffer=await c.decodeAudioData(bytes),source=c.createBufferSource();source.buffer=buffer;source.connect(state.inputDestination);source.start();return buffer.duration;};
  });
}

test('language focus does not start audio; Hindi activation localizes and handles microphone denial',async({page})=>{
  await page.addInitScript(()=>{(window as any).micRequests=0;navigator.mediaDevices.getUserMedia=async()=>{(window as any).micRequests++;throw new DOMException('Denied','NotAllowedError');};});
  await page.goto('/');const hindi=page.getByRole('radio',{name:'हिन्दी',exact:true});await hindi.focus();await page.waitForTimeout(250);
  expect(await page.evaluate(()=>(window as any).micRequests)).toBe(0);
  await hindi.press('Enter');await expect(page.locator('html')).toHaveAttribute('lang','hi-IN');await expect(page.locator('[data-voice-state=error]')).toBeVisible();
  await expect(page.locator('.voice-assistant [role=alert]')).toContainText('माइक्रोफ़ोन');
  await expect(page.getByRole('button',{name:'आवाज़ सहायक शुरू करें',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).micRequests)).toBe(1);
});

test('local speech detection honors a slower pause, submits once, keeps capture during playback, and resumes',async({page})=>{
  test.setTimeout(120000);await syntheticMicrophone(page);await login(page);
  let transcriptions=0,turns=0;page.on('request',req=>{if(req.url().endsWith('/transcriptions'))transcriptions++;if(req.url().endsWith('/turns'))turns++;});
  await page.locator('.voice-settings').click();await page.locator('.voice-assistant select').selectOption('5000');await page.locator('.app-dialog[open] > header button').click();await page.locator('.voice-assistant button.primary').click();
  await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:55000});
  await page.waitForTimeout(2500);expect(transcriptions).toBe(0);
  const duration=await page.evaluate(()=>(window as any).injectSpeech());await page.waitForTimeout(duration*1000+2800);expect(transcriptions).toBe(0);
  await page.evaluate(()=>(window as any).injectSpeech());
  await expect.poll(()=>transcriptions,{timeout:20000}).toBe(1);
  expect(await page.evaluate(()=>(window as any).inputTracks.some((track:MediaStreamTrack)=>track.readyState==='live'))).toBe(true);
  await expect(page.locator('.answer')).toHaveCount(1,{timeout:20000});
  await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:15000});
  expect(turns).toBe(1);await page.waitForTimeout(5500);expect(transcriptions).toBe(1);
  await page.locator('.voice-assistant > .actions button.secondary').click();await expect(page.locator('[data-voice-state=paused]')).toBeVisible();
  await page.locator('.voice-assistant button.primary').click();await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:35000});await page.locator('.voice-assistant > .actions button.secondary').click();await page.locator('#question').fill('A typed alternative');await expect(page.locator('#question')).toHaveValue('A typed alternative');
  const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;expect(await page.evaluate(()=>(window as any).inputTracks.every((track:MediaStreamTrack)=>track.readyState==='ended'))).toBe(true);
});

test('voice provider failure speaks one recovery and pauses without retrying forever',async({page})=>{
  test.setTimeout(100000);await syntheticMicrophone(page);await login(page);let attempts=0;
  await page.route('**/transcriptions',route=>{attempts++;return route.fulfill({status:503,json:{code:'SERVICE_UNAVAILABLE'}});});
  await page.locator('.voice-assistant button.primary').click();await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:55000});
  await page.evaluate(()=>(window as any).injectSpeech());await expect(page.locator('[data-voice-state=error]')).toBeVisible({timeout:30000});
  expect(attempts).toBe(1);await page.waitForTimeout(3000);expect(attempts).toBe(1);await expect(page.locator('.voice-assistant button.primary')).toBeEnabled();
});

test('voice approval sends no image; an edited snapshot needs spoken review before a question',async({page})=>{
  test.setTimeout(90000);await syntheticMicrophone(page);
  // Accelerate static notices only; actual neural VAD still consumes normal-time PCM.
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.playbackRate=4;return play.call(this);};});
  await login(page);await page.getByRole('button',{name:'Add or review context'}).click();
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=200;c.getContext('2d')!.fillRect(0,0,400,200);return c.toDataURL().split(',')[1]!;});
  await page.locator('#screenshot').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.'})).toBeEnabled();
  let transcriptions=0,turns=0;
  page.on('request',req=>{if(req.url().endsWith('/turns'))turns++;});
  await page.route('**/transcriptions',route=>route.fulfill({json:{transcript:++transcriptions===1?'approve this image':'What should I press?',locale:'en-IN',requiresCorrectionReview:false}}));
  await page.locator('.voice-assistant button.primary').click();await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:20000});
  await page.evaluate(()=>(window as any).injectSpeech());
  await expect(page.getByText('Image approved. Send a question to analyze this snapshot.',{exact:true})).toBeVisible({timeout:15000});expect(turns).toBe(0);
  await page.locator('.image-coordinates input').nth(2).fill('50');
  await expect(page.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.'})).not.toBeChecked();
  await page.evaluate(()=>(window as any).injectSpeech());
  await expect(page.locator('.voice-caption')).toContainText('The screen needs your review',{timeout:15000});
  expect(turns).toBe(0);await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:20000});
  const ended=page.waitForResponse(response=>response.url().endsWith('/end'));
  await page.locator('.topbar button.stop').click();expect((await ended).status()).toBe(204);
});
