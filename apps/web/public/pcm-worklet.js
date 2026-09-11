// Runs locally in the audio rendering thread. Outputs silence; never sends network data.
class GuideRecorder extends AudioWorkletProcessor {
  constructor() {
    super(); this.samples = new Float32Array(4096); this.used = 0; this.total = 0; this.stopped = false;
    this.port.onmessage = event => { if (event.data === 'stop') this.finish(); };
  }
  flush() { if (this.used) this.port.postMessage(this.samples.slice(0, this.used)); this.used = 0; }
  finish() { if (this.stopped) return; this.stopped = true; this.flush(); this.port.postMessage('done'); }
  process(inputs) {
    if (this.stopped) return false;
    const input = inputs[0]?.[0];
    if (input) for (const sample of input) {
      if (this.total >= sampleRate * 25) { this.finish(); return false; }
      this.samples[this.used++] = sample; this.total++;
      if (this.used === this.samples.length) this.flush();
    }
    return true;
  }
}
registerProcessor('guide-recorder', GuideRecorder);
