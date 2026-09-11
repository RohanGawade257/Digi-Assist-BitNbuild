// Explicit synthetic-only diagnostic through the real adapter and persistent quota.
const fs=require('node:fs'),path=require('node:path');const {parseEnv}=require('node:util');const {createHash}=require('node:crypto');
const {chromium}=require('@playwright/test');
async function main(){
  if(!process.argv.includes('--run'))return;
  const root=path.resolve(__dirname,'..');Object.assign(process.env,parseEnv(fs.readFileSync(path.join(root,'.env'),'utf8')));process.chdir(path.join(root,'apps/api'));
  const {Configuration}=require('../apps/api/dist/config'),{Database}=require('../apps/api/dist/database'),{Quota}=require('../apps/api/dist/quota'),{Providers}=require('../apps/api/dist/providers');
  const config=new Configuration(),db=new Database(config);const browser=await chromium.launch();const original=global.fetch;
  try{
    const page=await browser.newPage();const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=720;c.height=450;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,720,450);x.fillStyle='black';x.fillRect(0,0,720,90);x.fillStyle='#512080';x.font='bold 32px sans-serif';x.fillText('Press the VIOLET COMPASS',40,220);x.fillText('button to continue.',40,270);return c.toDataURL('image/png').split(',')[1];});
    const sha256=createHash('sha256').update(Buffer.from(data,'base64')).digest('hex');
    global.fetch=async(url,options)=>{const response=await original(url,options);if(String(url).includes('generativelanguage.googleapis.com')){const body=JSON.parse(options.body),raw=await response.clone().json();let parsed;try{parsed=JSON.parse((raw.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join(''));}catch{}
      console.log(JSON.stringify({providerStatus:response.status,finishReason:raw.candidates?.[0]?.finishReason,approvedBytesMatch:createHash('sha256').update(Buffer.from(body.contents[0].parts[0].inlineData.data,'base64')).digest('hex')===sha256,structuredKeys:parsed?Object.keys(parsed):[],syntheticExplanation:parsed?.explanationEn,referencedLabels:parsed?.referencedLabels,observedLabels:parsed?.observedLabels}));}return response;};
    const result=await new Providers(config,new Quota(config,db)).reason('What action does the instruction in this snapshot ask me to take? Quote its button label exactly.',{taskKind:'guide-task',source:{kind:'screenshot',capturedAt:new Date().toISOString(),reviewedLabels:[],selectedTarget:null,approvedImage:{mimeType:'image/png',data,width:720,height:450,sha256,analysisConsent:true}}},AbortSignal.timeout(30000));
    console.log(JSON.stringify({adapterAccepted:true,status:result.status}));
  }catch(error){console.log(JSON.stringify({adapterAccepted:false,code:error.code||'DIAGNOSTIC_FAILED'}));process.exitCode=1;}
  finally{global.fetch=original;await browser.close();await db.onApplicationShutdown();}
}
main().catch(()=>{console.error('Synthetic image diagnostic failed to start.');process.exitCode=1;});
