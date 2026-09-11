// Real provider chain with synthetic spoken WAV input, never the user's microphone.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util'),{randomUUID,randomBytes}=require('node:crypto'),{createRequire}=require('node:module');
const {chromium}=require('@playwright/test');const root=path.resolve(__dirname,'..'),apiRequire=createRequire(path.join(root,'apps/api/package.json'));
const copy=require('../apps/web/lib/voice-copy.json');
async function main(){
 if(!process.argv.includes('--run'))return console.log('Use --run --locale hi-IN for real Firebase/Sarvam/Gemini with synthetic spoken input and exact test-account cleanup.');
 const localeIndex=process.argv.indexOf('--locale');const locale=localeIndex<0?'hi-IN':process.argv[localeIndex+1];assert.ok(copy[locale]);
 assert.equal(fs.existsSync(path.join(root,'secrets/live-voice-check.json')),false,'Pending legacy synthetic account cleanup');
 const manifestPath=path.join(root,`secrets/live-voice-${locale}-check.json`);assert.equal(fs.existsSync(manifestPath),false,'Pending synthetic account cleanup');
 const env=parseEnv(fs.readFileSync(path.join(root,'.env'),'utf8')),credential=JSON.parse(fs.readFileSync(path.resolve(root,'apps/api',env.GOOGLE_APPLICATION_CREDENTIALS||'../../secrets/firebase-admin.json'),'utf8'));
 const {initializeApp,cert,deleteApp}=apiRequire('firebase-admin/app'),{getAuth}=apiRequire('firebase-admin/auth');
 const admin=initializeApp({credential:cert(credential)},'voice-'+randomUUID()),auth=getAuth(admin),uid='guide-voice-'+randomUUID().replaceAll('-',''),email=uid+'@example.test',password='Aa9!'+randomBytes(24).toString('base64url');
 let browser,page,bearer,created=false,ownedRemoved=true,identityRemoved=false,stage='create-account';
 const report={locale,verified:false,syntheticSpokenInput:true,physicalMicrophoneVerified:false,operatingSystemBackgroundVerified:false,transcriptions:[],turnStatuses:[],audioStatuses:[]};
 fs.writeFileSync(manifestPath,JSON.stringify({uid,purpose:'synthetic-real-voice-check'}));
 try{
  await auth.createUser({uid,email,password,emailVerified:true});created=true;
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(20000);
  // Observes real playback without changing it. The microphone source is a local synthetic WAV generator.
  await page.addInitScript(()=>{
   window.voiceFrames=0;window.voiceEnergy=0;window.voiceContexts=[];const OriginalContext=window.AudioContext;window.AudioContext=class extends OriginalContext{constructor(...args){super(...args);window.voiceContexts.push(this);}};
   const OriginalWorklet=window.AudioWorkletNode;window.AudioWorkletNode=class extends OriginalWorklet{constructor(...args){super(...args);this.port.addEventListener('message',event=>{if(event.data?.data instanceof ArrayBuffer){window.voiceFrames++;const frame=new Float32Array(event.data.data);let sum=0;for(const value of frame)sum+=value*value;window.voiceEnergy=Math.max(window.voiceEnergy,Math.sqrt(sum/frame.length));}});}};
   const originalPlay=HTMLMediaElement.prototype.play;
   window.voicePlayback=[];HTMLMediaElement.prototype.play=function(){window.voicePlayback.push({url:this.src,element:this});return originalPlay.call(this);};
   window.voiceTracks=[];window.injectQuestion=async(url)=>{
    const context=window.voiceInputContext;if(!context)throw Error('No listening microphone');
    const buffer=await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const source=context.createBufferSource();source.buffer=buffer;source.connect(window.voiceInputDestination);source.start();return buffer.duration;
   };
   navigator.mediaDevices.getUserMedia=async()=>{
    const context=new AudioContext(),destination=context.createMediaStreamDestination();await context.resume();
    window.voiceInputContext=context;window.voiceInputDestination=destination;window.voiceTracks.push(...destination.stream.getTracks());
    // A zero-valued running source provides actual silent input until a test utterance is injected.
    const oscillator=context.createOscillator(),gain=context.createGain();gain.gain.value=0;oscillator.connect(gain).connect(destination);oscillator.start();
    return destination.stream;
   };
   navigator.mediaDevices.getDisplayMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,640,360);x.fillStyle='black';x.font='bold 26px sans-serif';x.fillText('Press the VIOLET COMPASS',25,150);x.fillText('button to continue.',25,195);const stream=c.captureStream(5);window.voiceTracks.push(...stream.getTracks());return stream;};
  });
  await page.route('https://identitytoolkit.googleapis.com/**/accounts:sendOobCode*',route=>route.abort());
  page.on('request',req=>{if(req.url().startsWith('http://localhost:3001/api/v1/')&&req.headers().authorization){const token=req.headers().authorization.slice(7);try{if(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub===uid){bearer=token;ownedRemoved=false;}}catch{}}});
  page.on('response',response=>{if(response.url().endsWith('/transcriptions'))report.transcriptions.push(response.status());if(response.url().endsWith('/turns'))report.turnStatuses.push(response.status());if(response.url().endsWith('/audio'))report.audioStatuses.push(response.status());});
  report.syntheticTranscripts=[];page.on('response',async response=>{if(response.url().endsWith('/transcriptions')&&response.ok()){const data=await response.json().catch(()=>null);if(data)report.syntheticTranscripts.push(data.transcript);}});
  report.turnRequests=[];report.networkFailures=[];
  page.on('request',req=>{if(req.url().endsWith('/turns')&&req.method()==='POST')report.turnRequests.push({id:req.postDataJSON()?.requestId,time:Date.now()});});
  page.on('requestfailed',req=>{if(req.url().includes('/api/v1/'))report.networkFailures.push({path:new URL(req.url()).pathname.split('/').at(-1),error:req.failure()?.errorText});});
  stage='language-activation';await page.goto('http://localhost:3000');await page.locator(`button[role=radio][lang="${locale}"]`).click();
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
  if(locale==='ur-IN'){await page.locator('[data-voice-state=error]').waitFor();report.status='failed-unsupported-sarvam-tts';return;}
  await page.waitForFunction(()=>window.voicePlayback.some(item=>item.url.includes('/intro.wav')&&item.element.currentTime>0));report.automaticLocalizedIntro=true;
  stage='real-login';await page.locator('.auth-card > summary').click();await page.locator('.auth-card input[type=email]').fill(email);await page.locator('.auth-card input[type=password]').fill(password);
  const prefs=page.waitForResponse(r=>r.url().endsWith('/me')&&r.request().method()==='PATCH');await page.locator('.auth-card button[type=submit]').click();assert.equal((await prefs).status(),200);
  stage='listening-after-intro';await page.locator('[data-voice-state=listening]').waitFor({timeout:70000});
  // Neither silence nor generated stationary background noise should create a cloud request.
  await page.waitForTimeout(2600);assert.equal(report.transcriptions.length,0);report.silenceOnlyRejected=true;
  await page.evaluate(()=>{const c=window.voiceInputContext,b=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.025;const s=c.createBufferSource();s.buffer=b;s.connect(window.voiceInputDestination);s.start();});
  await page.waitForTimeout(5500);assert.equal(report.transcriptions.length,0);report.syntheticNoiseRejected=true;
  stage='first-spoken-turn';const first=page.waitForResponse(r=>r.url().endsWith('/turns'),{timeout:110000});await page.evaluate(url=>window.injectQuestion(url),`/voice/${locale}/question.wav`);
  const firstResponse=await first;const firstAnswer=await firstResponse.json();if(firstResponse.status()!==200)report.providerError=firstAnswer.code;assert.equal(firstResponse.status(),200);assert.equal(firstAnswer.explanation.locale,locale);
  await page.locator('[data-voice-state=listening]').waitFor({timeout:65000});assert.equal(report.transcriptions.length,1);assert.equal(report.turnStatuses.length,1);assert.ok(report.audioStatuses.length>0&&report.audioStatuses.every(status=>status===200));
  report.firstAnswer=firstAnswer.explanation.text;report.firstAnswerStatus=firstAnswer.status;report.automaticResume=true;report.exactlyOneFirstSubmission=true;
  console.log(JSON.stringify({locale,completed:'first-spoken-turn',automaticResume:true}));
  assert.ok(await page.evaluate(()=>window.voicePlayback.some(item=>item.url.startsWith('blob:')&&item.element.currentTime>0)));
  stage='approved-image-followup';await page.locator('.voice-assistant button.secondary').click();
  // Start the actual browser capture implementation with a synthetic screen stream.
  await page.locator('.start-disclosure > summary').click();await page.locator('.start-option').first().click();await page.locator('.approved-image-preview').waitFor();
  const reviewConsent=page.locator('.context-card input[type=checkbox]').filter({visible:true});await reviewConsent.check();await page.locator('.context-card button.primary').click();
  await page.locator('.voice-assistant button.primary').click();await page.locator('[data-voice-state=listening]').waitFor({timeout:70000});
  // Another browser application owns foreground focus while the assistant processes microphone audio.
  const other=await browser.newPage();await other.goto('about:blank');await other.bringToFront();
  const next=page.waitForResponse(r=>r.url().endsWith('/turns'),{timeout:110000});await page.evaluate(url=>window.injectQuestion(url),`/voice/${locale}/screenQuestion.wav`);
  const nextResponse=await next;assert.equal(nextResponse.status(),200);const body=nextResponse.request().postDataJSON();assert.equal(body.source.contextMode,'approved-image');assert.equal(body.source.reviewedLabels.length,0);
  const nextAnswer=await nextResponse.json();report.imageAnswer=nextAnswer.explanation.text;assert.match(nextAnswer.explanation.text,/VIOLET COMPASS/i);report.approvedImageFollowup=true;report.otherBrowserWindowFocusVerified=true;
  await page.locator('[data-voice-state=listening]').waitFor({timeout:70000});
  stage='end-and-cleanup';await page.bringToFront();await page.locator('.topbar button.stop').click();await page.waitForFunction(()=>window.voiceTracks.every(track=>track.readyState==='ended'));
  report.allTracksStopped=true;report.verified=true;report.status='verified-synthetic-browser-loop';
 }catch(error){report.captureMetrics=await page?.evaluate(()=>({frames:window.voiceFrames,maxRms:window.voiceEnergy,contexts:window.voiceContexts.map(c=>({state:c.state,time:c.currentTime}))})).catch(()=>null);report.voiceState=await page?.locator('[data-voice-state]').getAttribute('data-voice-state').catch(()=>null);report.voiceDetail=await page?.locator('.voice-assistant [role=alert]').allTextContents().catch(()=>[]);report.failedAt=stage;report.status='failed';report.failure=error.code||error.name||'CHECK_FAILED';process.exitCode=1;}
 finally{
  await browser?.close();if(created&&bearer){try{const r=await fetch('http://localhost:3001/api/v1/me',{method:'DELETE',headers:{Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(20000)});ownedRemoved=r.status===204;}catch{ownedRemoved=false;}}
  if(created){try{await auth.deleteUser(uid);identityRemoved=true;}catch(error){identityRemoved=error.code==='auth/user-not-found';}}else identityRemoved=true;
  await deleteApp(admin);report.temporaryIdentityRemoved=identityRemoved;report.temporaryOwnedDataRemoved=ownedRemoved;
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,`test-results/live-voice-${locale}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(identityRemoved&&ownedRemoved)fs.unlinkSync(manifestPath);else process.exitCode=1;
 }
}
main().catch(()=>{console.error('Voice check could not start; inspect local configuration or the pending cleanup manifest. No secrets printed.');process.exitCode=1;});
