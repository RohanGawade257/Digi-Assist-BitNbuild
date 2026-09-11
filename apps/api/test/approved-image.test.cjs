const { test }=require('node:test');const assert=require('node:assert/strict');
const { createHash,randomUUID }=require('node:crypto');
const { sourceSchema,approvalPayload,MAX_APPROVED_IMAGE_BYTES }=require('@guide/contracts');
const { validateApprovedImage }=require('../dist/approved-image');
const { Providers }=require('../dist/providers');const { Assistant }=require('../dist/assistant');
const { operationReady,quotaPolicyV3Schema }=require('../dist/config');const { imageSource,png,chunk }=require('./image-fixture.cjs');
test('approved PNG requires explicit consent and binds the exact raster to its source version',async()=>{
  const source=imageSource();assert.ok(sourceSchema.safeParse(source).success);validateApprovedImage(source.approvedImage);
  for(const bad of [{userReviewed:false},{contextMode:'reviewed-labels'},{approvedImage:{...source.approvedImage,analysisConsent:false}},{approvedImage:{...source.approvedImage,mimeType:'image/svg+xml'}}])assert.equal(sourceSchema.safeParse({...source,...bad}).success,false);
  for(const bad of [{width:30},{data:png(21,10).toString('base64')},{data:Buffer.alloc(MAX_APPROVED_IMAGE_BYTES+1).toString('base64')}])assert.throws(()=>validateApprovedImage({...source.approvedImage,...bad}),error=>error.code==='INVALID_IMAGE');
  const malformed=png().subarray(0,40);assert.throws(()=>validateApprovedImage({...source.approvedImage,data:malformed.toString('base64'),sha256:createHash('sha256').update(malformed).digest('hex')}));
  for(const metadata of [chunk('tEXt',Buffer.from('hidden text')),chunk('gAMA',Buffer.from('not a four-byte gamma value'))]) {
    const raw=png(),bad=Buffer.concat([raw.subarray(0,33),metadata,raw.subarray(33)]);
    assert.throws(()=>validateApprovedImage({...source.approvedImage,data:bad.toString('base64'),sha256:createHash('sha256').update(bad).digest('hex')}),error=>error.code==='INVALID_IMAGE');
  }
  let called=false;const assistant=new Assistant({problems:[]},{},{translate:()=>{called=true;}});
  await assert.rejects(assistant.turn('owner','session',{requestId:randomUUID(),question:'What is shown?',inputLocale:'en-IN',replyLocale:'en-IN',draftLocale:null,taskKind:'guide-task',inputMode:'text',source:{...source,version:2},nonSensitiveConfirmed:true}),error=>error.code==='CONTEXT_REVIEW_REQUIRED');assert.equal(called,false);
});
test('actual Gemini adapter sends only the approved PNG as inlineData and uses snapshot grounding',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});let body, reserved;
  global.fetch=async(_url,options)=>{body=JSON.parse(options.body);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({status:'answer',explanationEn:'Press VIOLET COMPASS.',draftEn:null,referencedLabels:[],observedLabels:['VIOLET COMPASS'],requiresFreshContext:false,completionBasis:'not_completed'})}]}}]});};
  const source=imageSource();const provider=new Providers({model:'gemini-3.5-flash-lite'},{scheduled:async(_provider,bound)=>{reserved=bound;return {secret:'fixture'};}});
  const result=await provider.reason('Read this instruction',{taskKind:'guide-task',source},new AbortController().signal);
  assert.equal(result.observedLabels[0],'VIOLET COMPASS');assert.deepEqual(body.contents[0].parts[0],{inlineData:{mimeType:'image/png',data:source.approvedImage.data}});
  const prompt=JSON.parse(body.contents[0].parts[1].text);assert.deepEqual(prompt.labels,[]);assert.equal(prompt.imageIsSnapshot,true);assert.ok(!body.contents[0].parts[1].text.includes(source.approvedImage.data));
  assert.match(body.systemInstruction.parts[0].text,/not a live screen/);
  const firstBound=reserved;
  // Encoding size is not Gemini 3 image token cost. API byte/raster validation is
  // tested separately; the adapter budget must not count base64 as text tokens.
  await provider.reason('Read this instruction',{taskKind:'guide-task',source:{...source,approvedImage:{...source.approvedImage,data:Buffer.alloc(300000).toString('base64')}}},new AbortController().signal);
  assert.equal(reserved,firstBound);assert.ok(reserved<250000 && reserved>2240);
});
test('per-API policy distinguishes unpublished and unverified without blocking independent Gemini readiness',()=>{
  const unpublished={status:'unpublished',evidence:'Published per-API table does not list this metric'};
  const limits={rpm:{status:'verified',value:30,evidence:'Verified Starter TTS policy'},tpm:unpublished,rpd:unpublished};
  assert.ok(quotaPolicyV3Schema.safeParse({schemaVersion:3,groups:[{id:'s',provider:'sarvam',apis:[{operation:'speak',verified:true,limits}]}]}).success);
  assert.equal(quotaPolicyV3Schema.safeParse({schemaVersion:3,groups:[{id:'s',provider:'sarvam',apis:[{operation:'speak',verified:true,limits:{...limits,tpm:{status:'unpublished',value:100}}}]}]}).success,false);
  const config={problems:[],model:'fixture',slots:{gemini:[{group:'g'}],sarvam:[{group:'s'}]},groups:[{id:'g',provider:'gemini',operation:'generate',rpm:15,tpm:250000,rpd:500},{id:'s',provider:'sarvam',operation:'speak',rpm:30}]};
  assert.equal(operationReady(config,'gemini','generate'),true);assert.equal(operationReady(config,'sarvam','translate'),false);assert.equal(operationReady(config,'sarvam','speak'),true);
  assert.equal(operationReady({...config,slots:{...config.slots,gemini:[{group:'pending-primary'},{group:'g'}]}},'gemini','generate'),false);
});
