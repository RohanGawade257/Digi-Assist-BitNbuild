import {test,expect,type Page} from '@playwright/test';
import {login} from './fixtures';
const consent='When I press Capture and send, send a fresh image of my shared screen to Gemini. It may include visible personal information.';
async function setup(page:Page){
 await page.addInitScript(()=>{
  const state=window as any;state.captureCount=0;state.failCapture=false;
  Object.defineProperty(navigator,'userActivation',{value:{isActive:false}});
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.tagName==='VIDEO')state.captureVideo=this;return play.call(this);};
  const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(state.failCapture&&args[0] instanceof HTMLVideoElement)throw Error('Synthetic capture failure');return (draw as any).apply(this,args);};
  navigator.mediaDevices.getDisplayMedia=async()=>{
   state.captureCount++;const canvas=document.createElement('canvas');canvas.width=480;canvas.height=240;state.canvas=canvas;
   const paint=(color:string,text:string)=>{const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,480,240);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText(text,20,100);};paint('red','FIRST FRAME: VIOLET COMPASS');
   const stream=canvas.captureStream(30);state.track=stream.getVideoTracks()[0];
   state.paint=async()=>{paint('blue','SECOND FRAME: GOLDEN LADDER');await new Promise<void>(resolve=>state.captureVideo.requestVideoFrameCallback(()=>resolve()));};
   return stream;
  };
 });
 await login(page);await page.getByRole('button',{name:'Share screen',exact:false}).first().click();await expect(page.getByRole('checkbox',{name:consent,exact:true})).toBeVisible();
}
async function pixel(page:Page,data:string){return page.evaluate(async data=>{const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return Array.from(ctx.getImageData(1,1,1,1).data);},data);}

test('changed capture source revokes consent before uploading',async({page})=>{
 await setup(page);let requests=0;page.on('request',r=>{if(r.url().endsWith('/turns'))requests++;});
 await page.getByRole('checkbox',{name:consent,exact:true}).click();
 await page.evaluate(()=>{const track=(window as any).track;track.getSettings=()=>({displaySurface:'window',deviceId:'different-source'});});
 await page.getByRole('button',{name:'Capture current screen and send',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:consent,exact:true})).toBeVisible();expect(requests).toBe(0);
 await page.locator('.topbar button.stop').click();
});

test('fresh PiP and main-page capture sends distinct current bytes with no question or Refresh',async({page,context})=>{
 await setup(page);const requests:any[]=[];page.on('request',r=>{if(r.url().endsWith('/turns'))requests.push(r.postDataJSON());});
 expect(requests).toHaveLength(0);const opened=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const pip=await opened;await pip.setViewportSize({width:390,height:480});
 await expect(pip.locator('.workspace-chat')).toBeHidden();await pip.getByRole('checkbox',{name:consent,exact:true}).click();
 await expect(pip.getByRole('button',{name:'Capture current screen and send',exact:true})).toBeEnabled();
 expect(await pip.evaluate(()=>document.body.scrollHeight)).toBeLessThanOrEqual(480);await pip.screenshot({path:'test-results/capture-compact.png'});
 await pip.getByRole('button',{name:'Capture current screen and send',exact:true}).dblclick();await expect.poll(()=>requests.length).toBe(1);
 await expect(pip.locator('.conversation-turn')).toHaveCount(1);expect(requests[0].question).toBe('');expect(requests[0].screenOverview).toBe(true);expect(requests[0].source.userReviewed).toBe(false);
 expect(await pixel(page,requests[0].source.approvedImage.data)).toEqual([255,0,0,255]);
 await page.evaluate(()=>(window as any).paint());await pip.getByRole('button',{name:'Capture current screen and send',exact:true}).click();await expect.poll(()=>requests.length).toBe(2);await expect(pip.locator('.conversation-turn')).toHaveCount(2);
 expect(await pixel(page,requests[1].source.approvedImage.data)).toEqual([0,0,255,255]);expect(requests[1].source.captureId).not.toBe(requests[0].source.captureId);expect(requests[1].source.capturedAt).not.toBe(requests[0].source.capturedAt);
 expect(requests[1].source.screenConsent.sourceId).toBe(requests[0].source.screenConsent.sourceId);
 await expect(pip.locator('.captured-image-preview')).toHaveAttribute('src',`data:image/png;base64,${requests[1].source.approvedImage.data}`);
 await pip.getByRole('button',{name:'Chat',exact:true}).first().click();await pip.locator('#question').fill('Explain the current instruction');await pip.getByRole('button',{name:'Close chat',exact:true}).first().click();
 await pip.evaluate(()=>window.close());await page.getByRole('button',{name:'Capture current screen and send',exact:true}).click();await expect.poll(()=>requests.length).toBe(3);expect(requests[2].question).toBe('Explain the current instruction');await expect(page.locator('.conversation-turn')).toHaveCount(3);
 expect(await page.evaluate(()=>(window as any).captureCount)).toBe(1);
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;
});

test('capture failure cannot reuse an old image; retry explicitly captures again',async({page})=>{
 await setup(page);await page.getByRole('checkbox',{name:consent,exact:true}).click();let requests=0;page.on('request',r=>{if(r.url().endsWith('/turns'))requests++;});
 await page.getByRole('button',{name:'Capture current screen and send',exact:true}).click();await expect.poll(()=>requests).toBe(1);await expect(page.locator('.conversation-turn')).toHaveCount(1);
 await page.evaluate(()=>(window as any).failCapture=true);await page.getByRole('button',{name:'Capture current screen and send',exact:true}).click();
 await expect(page.locator('.capture-error:visible, .composer:visible')).toContainText('No older image will be substituted');expect(requests).toBe(1);await expect(page.getByRole('button',{name:'Capture current screen and send',exact:true})).toBeEnabled();
 await page.evaluate(()=>{(window as any).failCapture=false;return (window as any).paint();});await page.locator('.capture-error:visible, .composer:visible').getByRole('button',{name:'Retry: capture a new image'}).click();await expect.poll(()=>requests).toBe(2);await expect(page.locator('.conversation-turn')).toHaveCount(2);
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;
});

test('revocation and stopping sharing cancel pending images and ignore late answers',async({page})=>{
 await setup(page);await page.getByRole('checkbox',{name:consent,exact:true}).click();let requests=0;
 await page.route('**/sessions/*/turns',async route=>{requests++;const body=route.request().postDataJSON();await new Promise(r=>setTimeout(r,700));try{await route.fulfill({json:{requestId:body.requestId,sourceVersion:body.source.version,status:'answer',explanation:{locale:'en-IN',text:'Old answer must not appear'},draft:null,referencedLabels:[],evidence:[{kind:'approved-image'}],requiresFreshContext:false,completionBasis:'not_completed'}});}catch{/* An aborted route is expected. */}});
 await page.getByRole('button',{name:'Capture current screen and send',exact:true}).click();await expect.poll(()=>requests).toBe(1);await page.getByRole('button',{name:'Change / revoke',exact:true}).click();await page.waitForTimeout(900);
 await expect(page.locator('.conversation-turn')).toHaveCount(0);await expect(page.getByRole('checkbox',{name:consent,exact:true})).not.toBeChecked();
 await page.getByRole('checkbox',{name:consent,exact:true}).click();await page.getByRole('button',{name:'Capture current screen and send',exact:true}).click();await expect.poll(()=>requests).toBe(2);await page.locator('.capture-stop').click();await page.waitForTimeout(900);await expect(page.locator('.conversation-turn')).toHaveCount(0);
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;
});

test('optional review freezes fresh pixels and preserves exact-image approval',async({page})=>{
 await setup(page);await page.locator('.source-options > summary').click();await page.getByRole('radio',{name:'Review before sending',exact:true}).check();
 await expect(page.locator('.approved-image-preview')).toBeVisible();const frozen=await page.locator('.approved-image-preview').getAttribute('src');await page.evaluate(()=>(window as any).paint());await expect(page.locator('.approved-image-preview')).toHaveAttribute('src',frozen!);
 await page.getByRole('checkbox',{name:'I reviewed this exact image and agree to send it to Gemini for AI analysis.'}).check();const sent=page.waitForRequest(r=>r.url().endsWith('/turns'));await page.getByRole('button',{name:'Approve and answer',exact:true}).click();const body=(await sent).postDataJSON();expect(body.source.userReviewed).toBe(true);expect(body.source.screenConsent).toBeUndefined();expect(body.source.approvedImage.data).toBe(frozen!.split(',')[1]);await expect(page.locator('.conversation-turn')).toHaveCount(1);
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;
});
