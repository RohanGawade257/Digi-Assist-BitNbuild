// Portable PCM WAV validation: duration is calculated from bytes, never trusted from the client.
export function inspectWave(bytes: Uint8Array, maxSeconds = 25) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) throw new Error('INVALID_AUDIO');
  let format: { channels: number; sampleRate: number; block: number } | undefined;
  let data: Uint8Array | undefined;
  let offset = 12;
  for (; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true); const end = offset + 8 + size;
    if (end > bytes.length) throw new Error('INVALID_AUDIO');
    if (tag(offset) === 'fmt ') {
      if (format || size < 16 || view.getUint16(offset + 8, true) !== 1 || view.getUint16(offset + 22, true) !== 16) throw new Error('INVALID_AUDIO');
      const channels = view.getUint16(offset + 10, true), sampleRate = view.getUint32(offset + 12, true), block = view.getUint16(offset + 20, true);
      if (![1, 2].includes(channels) || sampleRate < 8000 || sampleRate > 48000 || block !== channels * 2 || view.getUint32(offset + 16, true) !== sampleRate * block) throw new Error('INVALID_AUDIO');
      format = { channels, sampleRate, block };
    }
    if (tag(offset) === 'data') { if (data) throw new Error('INVALID_AUDIO'); data = bytes.subarray(offset + 8, end); }
    offset = end + (size % 2);
  }
  if (offset !== bytes.length || !format || !data || data.length < format.block || data.length % format.block) throw new Error('INVALID_AUDIO');
  const seconds = data.length / (format.sampleRate * format.block);
  if (seconds > maxSeconds || seconds < 0.1) throw new Error('INVALID_AUDIO');
  return { ...format, seconds, data };
}

export function joinWaves(parts: Uint8Array[], maxSeconds = 240) {
  if (!parts.length) throw new Error('INVALID_AUDIO');
  const waves = parts.map(part => inspectWave(part, maxSeconds)), format = waves[0];
  if (!format) throw new Error('INVALID_AUDIO');
  if (waves.some(w => w.channels !== format.channels || w.sampleRate !== format.sampleRate) || waves.reduce((sum, w) => sum + w.seconds, 0) > maxSeconds) throw new Error('INVALID_AUDIO');
  const total = waves.reduce((sum, wave) => sum + wave.data.length, 0);
  const result = new Uint8Array(44 + total); result.set(pcmWave(new Float32Array(0), format.sampleRate));
  const view = new DataView(result.buffer); view.setUint32(4, result.length - 8, true); view.setUint16(22, format.channels, true); view.setUint32(28, format.sampleRate * format.block, true); view.setUint16(32, format.block, true); view.setUint32(40, total, true);
  let offset = 44; for (const wave of waves) { result.set(wave.data, offset); offset += wave.data.length; }
  return result;
}

export function pcmWave(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2); const v = new DataView(out.buffer);
  const tag = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i); };
  tag(0, 'RIFF'); v.setUint32(4, out.length - 8, true); tag(8, 'WAVE'); tag(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const value = Math.max(-1, Math.min(1, samples[i] || 0)); v.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true); }
  return out;
}

export function splitText(text: string, max = 1800): string[] {
  const pieces: string[] = []; let remaining = text;
  while (remaining.length > max) {
    let cut = Math.max(remaining.lastIndexOf('\n', max), remaining.lastIndexOf('।', max), remaining.lastIndexOf('. ', max), remaining.lastIndexOf('؟', max));
    if (cut < max / 2) cut = remaining.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    else cut = Math.min(max, cut + 1);
    // Never split a Unicode surrogate pair.
    if (remaining.charCodeAt(cut - 1) >= 0xd800 && remaining.charCodeAt(cut - 1) <= 0xdbff) cut--;
    pieces.push(remaining.slice(0, cut)); remaining = remaining.slice(cut);
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}
