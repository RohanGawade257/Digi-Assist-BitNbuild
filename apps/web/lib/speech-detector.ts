// Local neural-VAD segmentation. No audio is persisted or sent by this class.
export class SpeechDetector {
  private pre: Float32Array[] = [];
  private frames: Float32Array[] = [];
  private speech = 0;
  private silence = 0;
  private confirmed = false;
  constructor(private options: { pauseMs: () => number; confirm: () => void; complete: (audio: Float32Array) => void; tooLong: () => void }) {}
  clear() { for (const frame of [...this.pre, ...this.frames]) frame.fill(0); this.pre=[];this.frames=[];this.speech=0;this.silence=0;this.confirmed=false; }
  feed(input: Float32Array, probability: number, echo: boolean) {
    const frame=echo?new Float32Array(input.length):input.slice(), ms=input.length/16;
    const positive=!echo && probability>=.3;
    if (!this.frames.length) {
      if (!positive) { this.pre.push(frame);while(this.pre.length*ms>800)this.pre.shift()?.fill(0);return; }
      this.frames=this.pre;this.pre=[];
    }
    this.frames.push(frame);
    if(positive){this.speech+=ms;this.silence=0;}else if(echo || probability<.25)this.silence+=ms;
    if(!this.confirmed && this.speech>=320){this.confirmed=true;this.options.confirm();}
    if(this.frames.length*ms>=25000){this.clear();this.options.tooLong();return;}
    if(this.silence>=this.options.pauseMs()) {
      const accepted=this.confirmed;
      const audio=new Float32Array(this.frames.reduce((sum,item)=>sum+item.length,0));let offset=0;
      for(const item of this.frames){audio.set(item,offset);offset+=item.length;}
      this.clear();if(accepted)this.options.complete(audio);else audio.fill(0);
    }
  }
}

// Compare recent microphone PCM to the locally decoded playback reference.
// AEC does the main acoustic work; this rejects highly correlated residual echo.
export class PlaybackEchoGuard {
  private recent: Float32Array[]=[];
  reference: Float32Array | null=null;
  clear(){for(const item of this.recent)item.fill(0);this.recent=[];this.reference?.fill(0);this.reference=null;}
  matches(frame:Float32Array, playbackSeconds:number,rate=1) {
    this.recent.push(frame.slice());while(this.recent.length>5)this.recent.shift()?.fill(0);
    const reference=this.reference;if(!reference || this.recent.length<3)return false;
    const samples=new Float32Array(this.recent.length*frame.length);this.recent.forEach((item,i)=>samples.set(item,i*frame.length));
    let energy=0;for(let i=0;i<samples.length;i+=4)energy+=samples[i]!**2;if(energy<1e-7)return false;
    const referenceLength=Math.ceil(samples.length*rate),end=Math.round(playbackSeconds*16000)-referenceLength;
    // Browser/device render and capture latency varies; never infer hidden speech.
    for(let start=Math.max(0,end-9600);start<=Math.min(reference.length-referenceLength,end+1600);start+=8){
      let dot=0,other=0;for(let i=0;i<samples.length;i+=4){const value=reference[start+Math.round(i*rate)]!;dot+=samples[i]!*value;other+=value*value;}
      if(other>1e-7 && Math.abs(dot)/Math.sqrt(energy*other)>.72)return true;
    }
    return false;
  }
}
