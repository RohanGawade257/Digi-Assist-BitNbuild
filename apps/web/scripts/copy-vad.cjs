const fs=require('node:fs'),path=require('node:path');
const vad=path.dirname(require.resolve('@ricky0123/vad-web'));
const ort=path.dirname(require.resolve('onnxruntime-web/wasm',{paths:[vad]}));
const target=path.resolve(__dirname,'../public/vad');fs.mkdirSync(target,{recursive:true});
for(const name of ['vad.worklet.bundle.min.js','silero_vad_v5.onnx'])fs.copyFileSync(path.join(vad,name),path.join(target,name));
for(const name of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])fs.copyFileSync(path.join(ort,name),path.join(target,name));
console.log('Local VAD assets prepared. No audio leaves the browser for speech detection.');
