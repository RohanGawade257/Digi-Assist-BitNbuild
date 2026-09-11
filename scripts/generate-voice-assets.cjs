// Explicit deployment-time generation of fixed public copy, never arbitrary user text.
const fs=require('node:fs'),path=require('node:path'),{parseEnv}=require('node:util'),{createHash}=require('node:crypto');
async function main(){
 if(!process.argv.includes('--run'))return console.log('Use --run to generate fixed localized Sarvam audio assets with the established account quota.');
 const root=path.resolve(__dirname,'..');Object.assign(process.env,parseEnv(fs.readFileSync(path.join(root,'.env'),'utf8')));process.chdir(path.join(root,'apps/api'));
 const {Configuration}=require('../apps/api/dist/config'),{Database}=require('../apps/api/dist/database'),{Quota}=require('../apps/api/dist/quota'),{Providers}=require('../apps/api/dist/providers');
 const config=new Configuration(),db=new Database(config),provider=new Providers(config,new Quota(config,db));
 const copy=require('../apps/web/lib/voice-copy.json');const target=path.join(root,'apps/web/public/voice');fs.mkdirSync(target,{recursive:true});
 const manifestPath=path.join(target,'manifest.json');const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{};
 const localeArg=process.argv.indexOf('--locale');const languages=localeArg>=0?[process.argv[localeArg+1]]:['hi-IN','en-IN','bn-IN','mr-IN','te-IN'];
 try{for(const locale of languages){if(!require('../packages/contracts/dist').isEnabledLocale(locale))throw Error('Unsupported output language');
   fs.mkdirSync(path.join(target,locale),{recursive:true});
   for(const kind of ['intro','unclear','error','login','review','share','question','screenQuestion','screenConsent']){
    if(process.argv.includes('--kind') && kind!==process.argv[process.argv.indexOf('--kind')+1])continue;
    const text=copy[locale][kind],hash=createHash('sha256').update(text).digest('hex'),key=locale+'/'+kind,output=path.join(target,locale,kind+'.wav');
    if(manifest[key]?.textSha256===hash && fs.existsSync(output))continue;
    let bytes;for(let attempt=0;attempt<2;attempt++){try{bytes=await provider.speak(text,locale,1,AbortSignal.timeout(30000));break;}catch(error){if(attempt||error.code!=='PROVIDER_BUSY')throw error;await new Promise(r=>setTimeout(r,Math.min(65000,error.retryAfterMs||60000)));}}
    fs.writeFileSync(output,bytes);manifest[key]={model:'bulbul:v3',speaker:'shubh',textSha256:hash,audioSha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));console.log(JSON.stringify({locale,asset:kind,generated:true}));
   }
 }}finally{await db.onApplicationShutdown();}
}
main().catch(error=>{console.error(JSON.stringify({voiceAssetGenerationFailed:true,code:error.code||'ASSET_ERROR'}));process.exitCode=1;});
