// Opt-in live check: temporary synthetic Firebase user, real browser/password/API path, exact-user cleanup.
// Only an explicitly approved synthetic crop/mask is sent to the real Gemini endpoint. No email, real personal data, or credential logging.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { initializeApp, cert, deleteApp } = apiRequire('firebase-admin/app');
const { getAuth } = apiRequire('firebase-admin/auth');

async function main() {
  if (!process.argv.includes('--run')) { console.log('Use --run to create one temporary synthetic Firebase user, check real login/API handling, then delete that user and owned app data. No email is sent.'); return; }
  const manifest = path.join(root, 'secrets/live-image-check.json');
  if (fs.existsSync(manifest)) throw new Error('PREVIOUS_CHECK_NEEDS_REVIEW');
  const env = parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  const credential = JSON.parse(fs.readFileSync(path.resolve(root, 'apps/api', env.GOOGLE_APPLICATION_CREDENTIALS || '../../secrets/firebase-admin.json'), 'utf8'));
  assert.equal(credential.project_id, env.FIREBASE_PROJECT_ID); assert.equal(credential.project_id, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const app = initializeApp({ credential: cert(credential), projectId: credential.project_id }, 'image-live-' + randomUUID());
  const auth = getAuth(app), uid = 'guide-sprint-' + randomUUID().replaceAll('-', '');
  const email = uid + '@example.test', password = 'Aa9!' + randomBytes(24).toString('base64url');
  let browser, bearer, created = false, appDataRemoved = true, firebaseRemoved = false, stage = 'create-temporary-user';
  fs.writeFileSync(manifest, JSON.stringify({ uid, purpose: 'temporary-approved-image-check' }));
  try {
    await auth.createUser({ uid, email, password, emailVerified: true }); created = true;
    stage = 'browser-login'; browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(15000);
    await page.route('https://identitytoolkit.googleapis.com/**/accounts:sendOobCode*', route => route.abort());
    page.on('request', request => {
      if (request.url().startsWith('http://localhost:3001/api/v1/') && request.headers().authorization) {
        const token = request.headers().authorization.slice(7);
        try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub === uid) { bearer = token; appDataRemoved = false; } } catch {}
      }
    });
    await page.goto('http://localhost:3000'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('#question').fill('Explain the public registration instructions');
    await page.locator('.auth-card > summary').click(); await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
    const preferences = page.waitForResponse(response => response.url().endsWith('/me') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const prefs = await preferences; assert.equal(prefs.status(), 200); assert.equal(await page.locator('#question').inputValue(), 'Explain the public registration instructions');
    console.log(JSON.stringify({ realFirebasePasswordLogin: true, realProtectedPreferences: 200, preLoginDraftPreserved: true }));
    stage = 'prepare-synthetic-image';
    const synthetic = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 450;
      const c = canvas.getContext('2d'); c.fillStyle = 'white'; c.fillRect(0,0,800,450);
      c.fillStyle = '#111'; c.font = '24px sans-serif'; c.fillText('SYNTHETIC PRIVATE NOTE - MASK THIS HEADER',20,50);
      c.fillStyle = '#512080'; c.font = 'bold 32px sans-serif'; c.fillText('Press the VIOLET COMPASS',40,220); c.fillText('button to continue.',40,270);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByRole('button',{name:'Add or review context',exact:true}).click();
    await page.locator('#screenshot').setInputFiles({name:'synthetic-instruction.png',mimeType:'image/png',buffer:Buffer.from(synthetic,'base64')});
    await page.locator('.approved-image-preview').waitFor();
    const coordinates = page.locator('.image-coordinates input');
    await coordinates.nth(3).fill('20'); await page.getByRole('button',{name:'Mask area',exact:true}).click();
    await page.getByRole('button',{name:'Mask area',exact:true}).waitFor();
    await coordinates.nth(2).fill('90'); await page.getByRole('button',{name:'Crop to area',exact:true}).click();
    const imageConsent=page.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.',exact:true});
    await imageConsent.check(); const approvedPreview=await page.locator('.approved-image-preview').getAttribute('src'); await page.getByRole('button',{name:'Approve this image',exact:true}).click();
    await page.getByText('Image approved. Send a question to analyze this snapshot.',{exact:true}).waitFor();
    await page.locator('#question').fill('What action does the instruction in this snapshot ask me to take? Quote its button label exactly.');
    await page.locator('.chat').getByRole('checkbox',{name:/I have used only/}).check();
    let submitted; let outgoingTurns=0;
    page.on('request', request => {if (/\/sessions\/[^/]+\/turns$/.test(new URL(request.url()).pathname) && request.method()==='POST') {outgoingTurns++;submitted=request.postDataJSON();}});
    const answer=page.waitForResponse(response=>/\/sessions\/[^/]+\/turns$/.test(new URL(response.url()).pathname) && response.request().method()==='POST',{timeout:50000});
    stage='real-gemini-image-analysis'; await page.locator('#question').press('Enter'); let response=await answer;
    let result=await response.json(); const attemptStatuses=[response.status()];
    if(!response.ok() && ['REQUEST_ALREADY_USED','TURN_TIMEOUT','PROVIDER_INVALID_RESPONSE','PROVIDER_UNAVAILABLE'].includes(result.code)) {
      assert.equal(await page.locator('#question').inputValue(),'What action does the instruction in this snapshot ask me to take? Quote its button label exactly.');
      const retry=page.waitForResponse(r=>/\/sessions\/[^/]+\/turns$/.test(new URL(r.url()).pathname) && r.request().method()==='POST',{timeout:50000});
      await page.getByRole('button',{name:'Retry',exact:true}).click(); response=await retry; result=await response.json(); attemptStatuses.push(response.status());
    }
    if(response.status()!==200){ console.log(JSON.stringify({realImageStatus:response.status(),code:result.code,outgoingTurns})); throw Error('LIVE_IMAGE_FAILED'); }
    assert.equal(submitted.source.contextMode,'approved-image'); assert.deepEqual(submitted.source.reviewedLabels,[]);
    assert.equal(submitted.source.approvedImage.width,720); assert.equal(submitted.source.approvedImage.height,450);
    assert.equal(submitted.source.approvedImage.analysisConsent,true);
    assert.equal(submitted.source.approvedImage.data,approvedPreview.split(',')[1]);
    assert.equal(submitted.source.approvedImage.sha256,createHash('sha256').update(Buffer.from(submitted.source.approvedImage.data,'base64')).digest('hex'));
    assert.match(result.explanation.text,/violet compass/i); assert.equal(result.evidence[0].kind,'approved-image');
    await page.locator('.answer').waitFor();
    const report={realFirebasePasswordLogin:true,realGeminiImageStatus:200,attemptStatuses,outgoingTurns,distinctiveInstructionRecognized:true,manuallyEnteredLabels:0,approvedImageWidth:720,approvedImageHeight:450,approvedImageChangedFromOriginal:submitted.source.approvedImage.data!==synthetic,answer:result.explanation.text,approvedBytesMatchPreview:true,liveSpeechVerified:false};
    stage='real-sarvam-answer-audio';
    const enable=page.getByRole('button',{name:'Enable answer audio',exact:true});if(await enable.count())await enable.click();
    const spoken=page.waitForResponse(response=>response.url().endsWith('/audio') && response.request().method()==='POST',{timeout:40000});
    await page.getByRole('button',{name:'Play / repeat',exact:true}).click();const speechResponse=await spoken;
    report.realSpeechStatus=speechResponse.status();assert.equal(speechResponse.status(),200);
    await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);report.audioDurationSeconds=await page.locator('audio').evaluate(audio=>audio.duration);assert.ok(report.audioDurationSeconds>0);await page.waitForFunction(()=>document.querySelector('audio')?.currentTime>0); assert.equal(await page.locator('.speech-controls [role=alert]').count(),0); report.liveSpeechVerified=true;
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true}); fs.writeFileSync(path.join(root,'test-results/live-image-result.json'),JSON.stringify(report,null,2));
    await page.screenshot({path:path.join(root,'test-results/live-image-answer.png'),fullPage:true});
    console.log(JSON.stringify(report));

  } catch { console.log(JSON.stringify({ checkFailedAt: stage })); process.exitCode = 1; }
  finally {
    // Close the browser before cleanup so it cannot schedule another preferences write.
    await browser?.close();
    if (created && bearer) {
      try { const result = await fetch('http://localhost:3001/api/v1/me', { method: 'DELETE', headers: { Authorization: 'Bearer ' + bearer }, signal: AbortSignal.timeout(20000) }); appDataRemoved = result.status === 204; } catch { appDataRemoved = false; }
    }
    if (created) {
      try { await auth.deleteUser(uid); firebaseRemoved = true; } catch (error) { firebaseRemoved = error.code === 'auth/user-not-found'; }
    } else firebaseRemoved = true;
    await deleteApp(app);
    console.log(JSON.stringify({ temporaryFirebaseUserRemoved: firebaseRemoved, temporaryOwnedDataRemoved: appDataRemoved, uidOnlyDeletionTombstoneMayRemain: Boolean(bearer && appDataRemoved) }));
    if (firebaseRemoved && appDataRemoved) fs.unlinkSync(manifest);
    else { console.error('Review secrets/live-image-check.json for the exact temporary test UID requiring cleanup.'); process.exitCode = 1; }
  }
}
main().catch(() => { console.error('Live auth check did not start. Check local Firebase configuration or the pending test manifest; no credentials were printed.'); process.exitCode = 1; });
