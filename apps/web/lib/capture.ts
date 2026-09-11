export type LocalCapture = { stream: MediaStream; video: HTMLVideoElement; stop: () => void; frame: () => Promise<{ blob: Blob; hash: string; captureId:string; capturedAt:string }> };
export async function startCapture(signal: AbortSignal): Promise<LocalCapture> {
  signal.throwIfAborted();
  // Source changes go through our picker again so consent is reconfirmed.
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, surfaceSwitching:'exclude' } as DisplayMediaStreamOptions & {surfaceSwitching:'exclude'});
  if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); signal.throwIfAborted(); }
  const video = document.createElement('video'); video.muted = true; video.srcObject = stream;
  const stop = () => { signal.removeEventListener('abort', stop); stream.getTracks().forEach(track => track.stop()); video.pause(); video.srcObject = null; };
  signal.addEventListener('abort', stop, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const aborted = () => { cleanup(); reject(new DOMException('Canceled', 'AbortError')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('CAPTURE_UNAVAILABLE')); }, 8000);
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', aborted); };
      signal.addEventListener('abort', aborted, { once: true });
      video.play().then(() => { cleanup(); resolve(); }, error => { cleanup(); reject(error); });
    });
    signal.throwIfAborted();
  } catch (error) { stop(); throw error; }
  return { stream, video, stop, frame: async () => {
    if (signal.aborted || stream.getVideoTracks()[0]?.readyState !== 'live' || stream.getVideoTracks()[0]?.muted || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('CAPTURE_ENDED');
    const captureId=crypto.randomUUID(),capturedAt=new Date().toISOString();
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('CAPTURE_UNAVAILABLE');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('CAPTURE_UNAVAILABLE')), 'image/png'));
    canvas.width = 0; canvas.height = 0;
    signal.throwIfAborted();if(stream.getVideoTracks()[0]?.readyState!=='live')throw new Error('CAPTURE_ENDED');
    return { blob, captureId,capturedAt,hash: `${video.videoWidth}:${video.videoHeight}:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}` };
  } };
}
