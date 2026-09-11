import { pcmWave } from '@guide/contracts';
export async function startRecording(signal: AbortSignal, ready: (wave: Uint8Array) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
  if (signal.aborted) { stream.getTracks().forEach(t => t.stop()); signal.throwIfAborted(); }
  const context = new AudioContext(); const chunks: Float32Array[] = []; let finished = false;
  const cleanup = () => { stream.getTracks().forEach(t => t.stop()); void context.close().catch(() => {}); signal.removeEventListener('abort', discard); };
  const discard = () => { finished = true; chunks.length = 0; cleanup(); };
  signal.addEventListener('abort', discard, { once: true });
  try {
    await context.audioWorklet.addModule('/pcm-worklet.js'); signal.throwIfAborted();
    const node = new AudioWorkletNode(context, 'guide-recorder');
    node.port.onmessage = event => {
      if (finished) return;
      if (event.data === 'done') {
        finished = true;
        const all = new Float32Array(chunks.reduce((sum, c) => sum + c.length, 0)); let offset = 0;
        for (const c of chunks) { all.set(c, offset); offset += c.length; }
        const bytes = pcmWave(all, context.sampleRate); all.fill(0); chunks.length = 0; cleanup(); ready(bytes);
      } else if (event.data instanceof Float32Array) chunks.push(event.data);
    };
    context.createMediaStreamSource(stream).connect(node); node.connect(context.destination); await context.resume();
    return { stop: () => node.port.postMessage('stop'), discard };
  } catch (error) { discard(); throw error; }
}
