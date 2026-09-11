const { deflateSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { approvalPayload } = require('@guide/contracts');
function chunk(type, data) {
  const name = Buffer.from(type), content = Buffer.concat([name, data]); let crc = 0xffffffff;
  for (const byte of content) { crc ^= byte; for (let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);content.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;
}
function png(width=20,height=10) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((width*3+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}
function imageSource(version=1) {
  const bytes=png();const approvedImage={mimeType:'image/png',data:bytes.toString('base64'),width:20,height:10,sha256:createHash('sha256').update(bytes).digest('hex'),analysisConsent:true};
  const source={kind:'screenshot',version,capturedAt:new Date().toISOString(),contextMode:'approved-image',approvedImage,reviewedLabels:[],selectedTarget:null,userReviewed:true};
  source.sanitizedHash=createHash('sha256').update(approvalPayload(source)).digest('hex');return source;
}
module.exports={png,imageSource,chunk};
