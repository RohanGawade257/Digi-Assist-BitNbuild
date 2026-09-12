import {MAX_APPROVED_IMAGE_BYTES,approvalPayload,imageDimensions,type Source} from '@guide/contracts';
import type {LocalCapture} from './capture';
import { sanitizeScreenshot, isSanitized } from './privacy';

// Read the sharing video on every invocation. No thumbnail, editor state, or old mask is input.
// PRIVACY: Raw frame is NEVER sent to network. Sanitization occurs BEFORE any base64/network path.
export async function captureSource(capture:LocalCapture,version:number,consent:NonNullable<Source['screenConsent']>,signal:AbortSignal):Promise<Source>{
 signal.throwIfAborted();const frame=await capture.frame();signal.throwIfAborted();
 if(frame.blob.type!=='image/png'||frame.blob.size>MAX_APPROVED_IMAGE_BYTES)throw new Error('INVALID_CAPTURE');

 // ─── PRIVACY FIREWALL: sanitize BEFORE any network-bound conversion ───
 console.info('[PRIVACY] Sanitizing instant-capture screenshot…');
 const sanitizationResult = await sanitizeScreenshot(frame.blob);
 signal.throwIfAborted();

 if (!isSanitized(sanitizationResult)) {
   // FAIL CLOSED: do NOT send the raw screenshot
   console.error('[PRIVACY] Sanitization failed — blocking upload');
   throw new Error('PRIVACY_SANITIZATION_FAILED');
 }

 // Use the sanitized blob instead of the raw frame
 const sanitizedBlob = sanitizationResult.blob;
 if(sanitizedBlob.size>MAX_APPROVED_IMAGE_BYTES)throw new Error('INVALID_CAPTURE');

 const bytes=new Uint8Array(await sanitizedBlob.arrayBuffer()),dimensions=imageDimensions(bytes,'image/png');
 const digest=async(value:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),b=>b.toString(16).padStart(2,'0')).join('');
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const source:Source={kind:'screenshot',version,capturedAt:frame.capturedAt,captureId:frame.captureId,screenConsent:{...consent},contextMode:'approved-image',reviewedLabels:[],selectedTarget:null,userReviewed:false,sanitizedHash:'',approvedImage:{mimeType:'image/png',data:btoa(binary),width:dimensions.width,height:dimensions.height,sha256:await digest(bytes),analysisConsent:true}};
 source.sanitizedHash=await digest(new TextEncoder().encode(approvalPayload(source)));signal.throwIfAborted();return source;
}
