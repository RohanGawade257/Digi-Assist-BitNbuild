import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {login} from './fixtures';
import {SpeechDetector,PlaybackEchoGuard} from '../../apps/web/lib/speech-detector';
import {turnSchema,transcriptionSchema,enabledLocales} from '@guide/contracts';
import {voiceCommand} from '../../apps/web/lib/voice-commands';

test('this version offers five languages and rejects disabled transcription inputs',async({page})=>{
 await page.goto('/');await expect(page.getByRole('radio')).toHaveCount(5);
 for(const inputLocale of ['ta-IN','ur-IN',...enabledLocales]){
  const enabled=enabledLocales.includes(inputLocale as typeof enabledLocales[number]);
  expect(transcriptionSchema.safeParse({requestId:crypto.randomUUID(),inputLocale,cloudSpeechConsent:true}).success).toBe(enabled);
  expect(turnSchema.safeParse({requestId:crypto.randomUUID(),inputLocale,replyLocale:inputLocale,draftLocale:null,question:'Explain a public label',taskKind:'general-help',inputMode:'text',source:null,nonSensitiveConfirmed:true}).success).toBe(enabled);
 }
 expect(voiceCommand('stop','en-IN')).toBe('stop');
 expect(enabledLocales).toHaveLength(5);
});

test('five retained languages keep translated conversations and drafts',async({page})=>{
 await login(page);await page.getByRole('button',{name:'Open chat',exact:true}).click();
 for(const [index,locale] of enabledLocales.entries()){
  await page.locator('.topbar nav button').first().click();await page.locator('#preferences select').first().selectOption(locale);await page.locator('.app-dialog[open] > header button').click();await page.locator('.floating-toolbar button[aria-controls=chat]').click();
  await page.locator('#question').fill('Explain a public instruction');await page.locator('.composer input[type=checkbox]').check();
  await page.locator('#question').press('Enter');await expect(page.locator('.conversation-turn')).toHaveCount(index+1);
  await expect(page.locator('.conversation-turn').last().locator(`.answer p[lang="${locale}"]`).first()).toBeVisible();
 }
 await page.locator('#question').fill('Keep this draft');await page.locator('.topbar nav button').first().click();await page.locator('#preferences select').first().selectOption('en-IN');await page.locator('.app-dialog[open] > header button').click();await expect(page.locator('#question')).toHaveValue('Keep this draft');
});

test('consumed share activation offers one explicit floating-window action',async({page,context})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'userActivation',{value:{isActive:false}});navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d')!.fillRect(0,0,320,180);return canvas.captureStream(2);};});
 await login(page);await page.getByRole('button',{name:'Share screen',exact:false}).first().click();
 await expect(page.locator('.floating-toolbar [role=status]')).toHaveText('Open floating assistant');expect(context.pages()).toHaveLength(1);
 const opened=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const pip=await opened;await expect(pip.locator('.approval-workspace')).toHaveAttribute('data-outside','true');
 await pip.getByRole('button',{name:'End assistance',exact:true}).first().click();await expect(page.locator('.approval-workspace')).toHaveAttribute('data-outside','false');
});
test('local detector preserves pre-roll, rejects echo and emits one completed utterance',()=>{
 let confirms=0;const results:Float32Array[]=[];const detector=new SpeechDetector({pauseMs:()=>2000,confirm:()=>confirms++,complete:a=>results.push(a),tooLong:()=>{throw Error('unexpected limit');}});
 const frame=new Float32Array(512).fill(.1);
 for(let i=0;i<30;i++)detector.feed(frame,.01,false);
 for(let i=0;i<20;i++)detector.feed(frame,.99,true);
 expect(confirms).toBe(0);
 for(let i=0;i<20;i++)detector.feed(frame,.99,false);
 for(let i=0;i<40;i++)detector.feed(frame,.01,false);
 for(let i=0;i<10;i++)detector.feed(frame,.99,false);
 expect(results).toHaveLength(0);
 for(let i=0;i<70;i++)detector.feed(frame,.01,false);
 expect(confirms).toBe(1);expect(results).toHaveLength(1);expect(results[0]!.length).toBeGreaterThan(16000*3);
 detector.clear();
 const beginnings:Float32Array[]=[];const leading=new SpeechDetector({pauseMs:()=>2000,confirm:()=>{},complete:a=>beginnings.push(a),tooLong:()=>{}});
 // This distinctive first-word PCM precedes the neural positive decision.
 for(let i=0;i<24;i++)leading.feed(new Float32Array(512).fill((i+1)/100),.01,false);
 for(let i=0;i<12;i++)leading.feed(frame,.99,false);
 for(let i=0;i<63;i++)leading.feed(new Float32Array(512),0,false);
 expect(beginnings).toHaveLength(1);expect(beginnings[0]![0]).toBeCloseTo(.01);expect(beginnings[0]![23*512]).toBeCloseTo(.24);
 const echo=new PlaybackEchoGuard();echo.reference=Float32Array.from({length:16000},(_,i)=>Math.sin(i*.17)+Math.sin(i*.051));
 let matched=false;for(let i=0;i<5;i++)matched=echo.matches(echo.reference.slice(i*512,(i+1)*512),((i+1)*512)/16000);
 expect(matched).toBe(true);echo.clear();expect(echo.reference).toBeNull();
});

test('introduction can be interrupted and stop is a control command',async({page})=>{
 test.setTimeout(45000);await microphone(page);await login(page);let stt=0,turns=0;
 await page.route('**/transcriptions',route=>{stt++;return route.fulfill({json:{transcript:'stop',locale:'en-IN',requiresCorrectionReview:false}});});
 page.on('request',r=>{if(r.url().endsWith('/turns'))turns++;});
 await page.locator('.voice-assistant button.primary').click();await expect(page.locator('[data-voice-state=speaking]')).toBeVisible({timeout:15000});
 await page.evaluate(()=>(window as any).inject('/voice/en-IN/question.wav'));
 await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:2500});
 await expect.poll(()=>stt,{timeout:15000}).toBe(1);await page.waitForTimeout(1500);expect(turns).toBe(0);expect(stt).toBe(1);
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;expect(await page.evaluate(()=>(window as any).track.readyState)).toBe('ended');
});

test('real PiP owns frozen review, refresh, approval and chat without duplicating capture',async({page,context})=>{
 await page.addInitScript(()=>{(window as any).captureCount=0;navigator.mediaDevices.getDisplayMedia=async()=>{(window as any).captureCount++;const c=document.createElement('canvas');c.width=600;c.height=320;const x=c.getContext('2d')!;x.fillStyle='white';x.fillRect(0,0,600,320);x.fillStyle='black';x.font='24px sans-serif';x.fillText('Press VIOLET COMPASS',30,120);(window as any).sharedCanvas=c;const stream=c.captureStream(5);(window as any).sharedTrack=stream.getTracks()[0];return stream;};});
 await login(page);await page.locator('#question').fill('Read this instruction');
 const pipEvent=context.waitForEvent('page');await page.getByRole('button',{name:'Share screen',exact:false}).first().click();const pip=await pipEvent;
 await expect(pip.locator('.approval-workspace')).toHaveAttribute('data-outside','true');
 await pip.setViewportSize({width:350,height:640});
 await expect(pip.locator('.approval-workspace')).toHaveCSS('border-radius','18px');
 await expect(pip.locator('.approved-image-preview')).toBeVisible();
 await pip.screenshot({path:'test-results/floating-compact.png'});
 console.log('Compact native PiP dimensions',await pip.evaluate(()=>({width:innerWidth,height:innerHeight,content:document.body.scrollHeight})));
 expect(await pip.evaluate(()=>document.body.scrollHeight)).toBeLessThanOrEqual(640);
 await pip.getByRole('button',{name:'Edit',exact:true}).click();const area=pip.locator('.image-coordinates input');await area.nth(2).fill('75');await pip.getByRole('button',{name:'Crop to area',exact:true}).click();
 await expect.poll(()=>pip.locator('.approved-image-preview').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBe(450);
 const cropped=await pip.locator('.approved-image-preview').getAttribute('src');
 await page.evaluate(()=>{const c=(window as any).sharedCanvas as HTMLCanvasElement;c.getContext('2d')!.fillRect(0,0,25,25);});
 await expect(pip.locator('.snapshot-status')).toHaveText('Screen changed');expect(await pip.locator('.approved-image-preview').getAttribute('src')).toBe(cropped);
 await pip.getByRole('button',{name:'Chat',exact:true}).first().click();await expect(pip.locator('#question')).toHaveValue('Read this instruction');
 await pip.setViewportSize({width:740,height:640});await expect(pip.locator('.workspace-review')).toBeVisible();await expect(pip.locator('.workspace-chat')).toBeVisible();
 await pip.locator('.workspace-options summary').click();await pip.getByRole('button',{name:'Swap sides',exact:true}).click();await expect(pip.locator('.approval-workspace')).toHaveClass(/review-left/);
 await pip.getByRole('checkbox',{name:'High contrast',exact:true}).check();await expect(pip.locator('.approval-workspace')).toHaveCSS('background-color','rgb(255, 255, 255)');await pip.locator('.workspace-options summary').click();
 await pip.setViewportSize({width:350,height:640});
 await pip.getByRole('button',{name:'Close chat',exact:true}).first().click();expect(await pip.locator('.approved-image-preview').getAttribute('src')).toBe(cropped);
 await pip.getByRole('button',{name:'Refresh screenshot',exact:true}).click();await expect(pip.locator('.approved-image-preview')).not.toHaveAttribute('src',cropped!);
 await expect(pip.getByRole('button',{name:'Approve and answer'})).toBeDisabled();
 await pip.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.'}).check();
 const preview=await pip.locator('.approved-image-preview').getAttribute('src');const sent=page.waitForRequest(r=>r.url().endsWith('/turns'));
 await pip.getByRole('button',{name:'Approve and answer'}).click();const body=(await sent).postDataJSON();expect(body.source.approvedImage.data).toBe(preview!.split(',')[1]);expect(body.source.kind).toBe('screenshot');
 await expect(pip.locator('.snapshot-status')).toHaveText('Approved snapshot');
 if(await pip.getByRole('button',{name:'Edit',exact:true}).getAttribute('aria-expanded')==='true')await pip.getByRole('button',{name:'Edit',exact:true}).click();
 await pip.getByRole('button',{name:'Pin controls'}).click();await expect(pip.getByRole('button',{name:'Minimize',exact:true})).toBeDisabled();await pip.getByRole('button',{name:'Pin controls'}).click();
 await pip.getByRole('button',{name:'Minimize',exact:true}).click();await pip.getByRole('button',{name:/Expand assistant/}).click();
 await pip.locator('.workspace-options summary').focus();await expect(pip.locator('.approval-workspace')).toHaveClass(/protected/);
 await pip.locator('.workspace-header').dispatchEvent('pointerdown',{pointerType:'touch'});await expect(pip.locator('.approval-workspace')).toHaveClass(/protected/);
 await pip.getByRole('button',{name:'Chat',exact:true}).first().click();await pip.locator('#question').fill('Read the refreshed instruction');await pip.getByRole('button',{name:'Close chat',exact:true}).first().click();
 await pip.getByRole('button',{name:'Refresh screenshot',exact:true}).click();await expect(pip.getByRole('button',{name:'Approve and answer'})).toBeDisabled();
 await expect(pip.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.'})).not.toBeChecked();
 await pip.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.'}).check();
 await page.route('**/sessions/*/turns',route=>route.fulfill({status:503,json:{code:'SERVICE_UNAVAILABLE'}}));
 await pip.getByRole('button',{name:'Approve and answer'}).click();await expect(pip.locator('.approval-workspace > div > .error')).toBeVisible();
 await expect(pip.locator('.queued-question')).toContainText('Read the refreshed instruction');
 await pip.getByRole('button',{name:'Pin controls'}).click();await expect(pip.getByRole('button',{name:'Minimize',exact:true})).toBeDisabled();
 await pip.evaluate(()=>window.close());await expect(page.locator('.approval-workspace')).toHaveAttribute('data-outside','false');
 await expect(page.locator('.floating-toolbar')).toContainText('Assistance continues');
 const again=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const reopened=await again;
 expect(await page.evaluate(()=>(window as any).captureCount)).toBe(1);
 const end=page.waitForResponse(r=>r.url().endsWith('/end'));await reopened.getByRole('button',{name:'End assistance',exact:true}).first().click();await end;
 expect(await page.evaluate(()=>(window as any).sharedTrack.readyState)).toBe('ended');
});

async function microphone(page:Page){await page.addInitScript(()=>{
 const state=window as any;state.streamCount=0;state.plays=[];
 navigator.mediaDevices.getUserMedia=async()=>{state.streamCount++;const c=new AudioContext(),out=c.createMediaStreamDestination();await c.resume();state.input=c;state.out=out;state.track=out.stream.getTracks()[0];const zero=c.createOscillator(),gain=c.createGain();gain.gain.value=0;zero.connect(gain).connect(out);zero.start();return out.stream;};
 state.inject=async(url:string)=>{const c=state.input as AudioContext,buffer=await c.decodeAudioData(await(await fetch(url)).arrayBuffer()),source=c.createBufferSource();source.buffer=buffer;source.connect(state.out);source.start();return buffer.duration;};
 const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){state.plays.push(this);return original.call(this);};
});}

test('speech interrupts actual audio, residual playback does not self-interrupt, and new utterance sends once',async({page})=>{
 test.setTimeout(110000);await microphone(page);await login(page);await page.getByRole('button',{name:'Open chat',exact:true}).click();let stt=0,turns=0;
 await page.route('**/transcriptions',route=>{stt++;return route.fulfill({json:{transcript:stt===1?'Explain a draft':'What does save mean?',locale:'en-IN',requiresCorrectionReview:false}});});
 const clip=readFileSync('apps/web/public/voice/en-IN/intro.wav');await page.route('**/audio',route=>route.fulfill({contentType:'audio/wav',body:clip}));
 page.on('request',r=>{if(r.url().endsWith('/turns'))turns++;});
 await page.locator('.voice-assistant button.primary').click();await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:45000});
 await page.evaluate(()=>(window as any).inject('/voice/en-IN/question.wav'));
 await page.waitForFunction(()=>(window as any).plays.some((a:HTMLAudioElement)=>a.src.startsWith('blob:')&&!a.paused&&a.currentTime>.1));
 await page.evaluate(()=>{const s=window as any,a=s.plays.findLast((a:HTMLAudioElement)=>a.src.startsWith('blob:'));s.interruptedAudio=a;s.oldEnded=a.onended;const source=s.input.createMediaStreamSource(a.captureStream()),gain=s.input.createGain();gain.gain.value=.2;source.connect(gain).connect(s.out);s.echo=source;});
 await page.waitForTimeout(7000);expect(stt).toBe(1);await expect(page.locator('[data-voice-state=speaking]')).toBeVisible();
 await page.evaluate(()=>(window as any).inject('/voice/en-IN/screenQuestion.wav'));
 await expect(page.locator('[data-voice-state=listening]')).toBeVisible({timeout:2500});
 expect(await page.evaluate(()=>(window as any).interruptedAudio.paused)).toBe(true);
 const interruptionMs=Number(await page.locator('.voice-assistant').getAttribute('data-interruption-ms'));expect(interruptionMs).toBeLessThan(300);console.log('Synthetic confirmed-speech to pause milliseconds',interruptionMs);
 await expect(page.locator('.conversation-turn').first().getByText('Playback interrupted — this answer was not fully heard.',{exact:true})).toBeVisible();
 await page.evaluate(()=>(window as any).oldEnded?.());
 await expect.poll(()=>stt,{timeout:15000}).toBe(2);await expect.poll(()=>turns,{timeout:15000}).toBe(2);await page.waitForTimeout(1500);expect(stt).toBe(2);
 expect(await page.evaluate(()=>(window as any).streamCount)).toBe(1);
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;expect(await page.evaluate(()=>(window as any).track.readyState)).toBe('ended');
});
