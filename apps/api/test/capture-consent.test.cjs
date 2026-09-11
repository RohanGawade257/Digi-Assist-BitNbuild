const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const {sourceSchema,turnSchema,approvalPayload}=require('@guide/contracts');
const {imageSource}=require('./image-fixture.cjs');const {Assistant}=require('../dist/assistant');
function source(){const image=imageSource();image.userReviewed=false;image.captureId=randomUUID();image.screenConsent={mode:'on-demand',sourceId:randomUUID(),grantedAt:image.capturedAt};image.sanitizedHash=createHash('sha256').update(approvalPayload(image)).digest('hex');return image;}
function turn(image=source()){return {requestId:randomUUID(),question:'',screenOverview:true,inputLocale:'en-IN',replyLocale:'hi-IN',draftLocale:null,taskKind:'general-help',inputMode:'text',nonSensitiveConfirmed:true,source:image};}
test('on-demand capture needs distinct consent, binds capture identity and respects strict privacy',async()=>{
 const image=source();assert.equal(sourceSchema.safeParse(image).success,true);assert.equal(turnSchema.safeParse(turn(image)).success,true);
 for(const bad of [{screenConsent:undefined},{captureId:undefined},{userReviewed:true},{screenConsent:{...image.screenConsent,mode:'automatic'}}])assert.equal(sourceSchema.safeParse({...image,...bad}).success,false);
 assert.equal(turnSchema.safeParse({...turn(),source:null}).success,false);assert.equal(turnSchema.safeParse({...turn(),screenOverview:false}).success,false);
 const strict=new Assistant({strictPrivacy:true,problems:[]},{},{});await assert.rejects(strict.turn('owner','session',turn()),e=>e.code==='CLOUD_SCREEN_DISABLED');
 const changed={...image,captureId:randomUUID()};await assert.rejects(new Assistant({strictPrivacy:false,problems:[]},{},{}).turn('owner','session',turn(changed)),e=>e.code==='CONTEXT_REVIEW_REQUIRED');
});
test('image-only requests ask for a grounded overview and translate its follow-up',async()=>{
 let prompt;const translations=[];const sessions={source:async()=>{},claim:async()=>{},recent:async()=>[],finish:async()=>{}};
 const providers={reason:async question=>{prompt=question;return {status:'answer',explanationEn:'This appears to be a form. What would you like help with?',draftEn:null,referencedLabels:[],observedLabels:[],requiresFreshContext:false,completionBasis:'not_completed'};},translate:async(text,from,to)=>{translations.push({text,from,to});return 'localized overview';}};
 const answer=await new Assistant({strictPrivacy:false,problems:[]},sessions,providers).turn('owner','session',turn());assert.match(prompt,/Briefly describe/);assert.match(prompt,/What would you like help with/);assert.equal(translations.length,1);assert.equal(translations[0].to,'hi-IN');assert.equal(answer.explanation.text,'localized overview');
});
