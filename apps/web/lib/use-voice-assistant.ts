'use client';
import { useEffect, useRef, useState } from 'react';
import { pcmWave, splitText, isEnabledLocale, type Answer, type Locale } from '@guide/contracts';
import type { MicVAD } from '@ricky0123/vad-web';
import { authenticatedFetch, RequestError } from './api';
import copy from './voice-copy.json';
import { voiceCommand, type VoiceCommand } from './voice-commands';
import { SpeechDetector, PlaybackEchoGuard } from './speech-detector';

export type VoiceState = 'idle' | 'requesting_permission' | 'listening' | 'finalizing' | 'processing' | 'speaking' | 'paused' | 'error';
export const voiceStates: VoiceState[] = ['idle','requesting_permission','listening','finalizing','processing','speaking','paused','error'];
type Result = { answer: Answer; sessionId: string };
type Options = { locale: Locale; allowed: boolean; cloudAllowed: boolean; ensureSession: (signal: AbortSignal) => Promise<string>; question: (text: string, signal: AbortSignal) => Promise<Result | undefined>; command: (command: VoiceCommand) => Promise<void>; needLogin: () => void; interrupted?: (requestId?:string) => void };
type Notice = 'intro' | 'unclear' | 'error' | 'review' | 'login' | 'share' | 'screenConsent';
export function useVoiceAssistant(options: Options) {
  const current = useRef(options); current.current = options;
  const [state, setState] = useState<VoiceState>('idle'), [caption, setCaption] = useState(''), [detail, setDetail] = useState('');
  const [pauseMs, setPauseMs] = useState(2000), [rate, setRate] = useState(1);
  const phase = useRef<VoiceState>('idle'), active = useRef(false), epoch = useRef(0), language = useRef<Locale>(options.locale);
  const vad = useRef<MicVAD | null>(null), stream = useRef<MediaStream | null>(null), player = useRef<HTMLAudioElement | null>(null);
  const captureContext = useRef<AudioContext | null>(null);
  const captureRun=useRef(0), detector=useRef<SpeechDetector|null>(null), echo=useRef(new PlaybackEchoGuard());
  const [interruptionMs,setInterruptionMs]=useState<number|null>(null);
  const audibleRequest=useRef<string|undefined>(undefined), heardUntil=useRef(0);
  const pending = useRef<AbortController | null>(null), maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<Result | null>(null), audioCache = useRef(new Map<string,string>()), rejectPlayback = useRef<(() => void) | null>(null);
  const turnLock = useRef(false), startedAt = useRef(0), failures = useRef(0), mounted = useRef(true);
  const pauseValue = useRef(pauseMs); pauseValue.current = pauseMs;
  const speed = useRef(rate); speed.current = rate;
  function transition(next: VoiceState) { phase.current = next; if (mounted.current) setState(next); }
  function haltMedia() {
    if (maxTimer.current) clearTimeout(maxTimer.current); maxTimer.current = null;
    pending.current?.abort(); pending.current = null;
    player.current?.pause(); rejectPlayback.current?.(); rejectPlayback.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }
  function pause() { active.current = false; epoch.current++;captureRun.current++; haltMedia();detector.current?.clear();echo.current.clear(); void vad.current?.pause(); turnLock.current = false; transition('paused'); }
  function interruptPlayback() {
    const confirmedAt=performance.now();
    if(!active.current)return;
    if(phase.current==='listening'){current.current.interrupted?.();return;}
    if(!['speaking','processing','finalizing'].includes(phase.current))return;
    const interruptedId=phase.current==='speaking'?audibleRequest.current:undefined;
    epoch.current++;pending.current?.abort();pending.current=null;
    player.current?.pause();rejectPlayback.current?.();rejectPlayback.current=null;
    // Aborting this HTTP request propagates through the API's disconnect signal.
    // A delayed session-wide cancel could instead cancel the next utterance.
    current.current.interrupted?.(interruptedId);
    turnLock.current=false;transition('listening');setDetail('');
    setInterruptionMs(performance.now()-confirmedAt);
  }
  function end() {
    pause(); const old = vad.current; vad.current = null; void old?.destroy().catch(()=>{});
    void captureContext.current?.close().catch(()=>{}); captureContext.current=null;
    for (const url of audioCache.current.values()) URL.revokeObjectURL(url); audioCache.current.clear(); last.current = null;
    setCaption(''); setDetail(''); transition('idle');
  }
  async function play(url: string, text: string, marker: number) {
    if (marker !== epoch.current) throw new DOMException('Canceled','AbortError');
    const element = player.current ||= new Audio();
    setCaption(text); transition('speaking'); element.src = url; element.playbackRate = speed.current;
    await new Promise<void>((resolve,reject) => {
      const done = () => { if(marker!==epoch.current)return; heardUntil.current=performance.now()+600;element.onended = null; element.onerror = null; rejectPlayback.current = null; resolve(); };
      const failed = () => { if(marker!==epoch.current)return;element.onended = null; element.onerror = null; rejectPlayback.current = null; reject(new Error('PLAYBACK_FAILED')); };
      element.onended = done; element.onerror = failed; rejectPlayback.current = () => { element.onended = null; element.onerror = null; reject(new DOMException('Canceled','AbortError')); };
      void element.play().catch(failed);
    });
    if (marker !== epoch.current) throw new DOMException('Canceled','AbortError');
  }
  async function prepareReference(url:string,marker:number,signal?:AbortSignal){
    const bytes=await(await fetch(url,{signal})).arrayBuffer();
    const decoded=await captureContext.current!.decodeAudioData(bytes);
    const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),reference=offline.createBufferSource();reference.buffer=decoded;reference.connect(offline.destination);reference.start();
    const rendered=await offline.startRendering();signal?.throwIfAborted();
    if(marker!==epoch.current)throw new DOMException('Canceled','AbortError');
    echo.current.clear();echo.current.reference=rendered.getChannelData(0).slice();
  }
  async function notice(kind: Notice, marker = epoch.current) { const url=`/voice/${language.current}/${kind}.wav`;if(vad.current?.listening && active.current)await prepareReference(url,marker);audibleRequest.current=undefined;await play(url, copy[language.current][kind], marker); }
  async function listen(marker: number) {
    if (!active.current || marker !== epoch.current) return;
    if (!vad.current) throw new Error('MICROPHONE_NOT_READY');
    turnLock.current = false; startedAt.current = 0;
    vad.current.setOptions({ redemptionMs: pauseValue.current, minSpeechMs: 450, submitUserSpeechOnPause: false });
    await captureContext.current?.resume(); if(!vad.current.listening)await vad.current.start();
    if(vad.current.errored || captureContext.current?.state!=='running')throw new Error('MICROPHONE_NOT_READY');
    // A stale turn must never pause the microphone now owned by its successor.
    if (marker !== epoch.current || !active.current) return;
    transition('listening'); setDetail('');
  }
  async function speakResult(result: Result, marker: number) {
    const controller = new AbortController(); pending.current = controller;
    const chunks = splitText(result.answer.explanation.text);
    for (let chunk = 0; chunk < chunks.length; chunk++) {
      const key = `${result.answer.requestId}:${chunk}`; let url = audioCache.current.get(key);
      if (!url) {
        const response = await authenticatedFetch(`/sessions/${result.sessionId}/turns/${result.answer.requestId}/audio`, 'POST', JSON.stringify({ segment:'explanation',chunk,pace:1 }), controller.signal, true);
        const blob = await response.blob(); controller.signal.throwIfAborted(); url = URL.createObjectURL(blob); audioCache.current.set(key,url);
      }
      controller.signal.throwIfAborted();if(marker!==epoch.current)throw new DOMException('Canceled','AbortError');
      await prepareReference(url,marker,controller.signal);
      audibleRequest.current=result.answer.requestId;await play(url, chunks[chunk]!, marker);audibleRequest.current=undefined;
    }
  }
  async function utterance(samples: Float32Array) {
    if (!active.current || phase.current !== 'listening' || turnLock.current) {samples.fill(0);return;}
    turnLock.current = true; const marker = epoch.current; transition('finalizing');
    if (maxTimer.current) clearTimeout(maxTimer.current); maxTimer.current = null;
    
    const sampleCount = samples.length;
    const durationMs = Math.round((sampleCount / 16000) * 1000);
    console.info(`[VOICE] speech-end`);
    console.info(`[VOICE] samples received: ${sampleCount}`);
    console.info(`[VOICE] audio duration: ${durationMs} ms`);

    // Keep the one local detector running; a new confirmed utterance cancels this turn.
    try {
      if (!current.current.allowed) {
        console.warn('[VOICE ERROR][auth] User not authenticated or unverified');
        current.current.needLogin();
        await notice('login',marker);
        active.current = false;
        transition('paused');
        return;
      }
      if (!current.current.cloudAllowed) {
        console.warn('[VOICE ERROR][configuration] Cloud speech input is disabled or not yet ready');
        throw new RequestError('CLOUD_SPEECH_DISABLED', undefined, 'configuration');
      }
      const wave = pcmWave(samples.slice(0, 25 * 16000),16000); samples.fill(0);
      const audioBlob = new Blob([new Uint8Array(wave)],{type:'audio/wav'});
      console.info(`[VOICE] blob size: ${audioBlob.size} bytes`);
      const controller = new AbortController(); pending.current = controller;
      
      console.info('[VOICE] ensuring session before upload');
      const id = await current.current.ensureSession(controller.signal);
      const form = new FormData(); form.set('file',audioBlob,'question.wav');
      form.set('metadata',JSON.stringify({requestId:crypto.randomUUID(),inputLocale:language.current,cloudSpeechConsent:true,automaticConversation:true}));
      transition('processing');
      console.info(`[VOICE] upload starting`, {
        endpoint: `/sessions/${id}/transcriptions`,
        blobSize: audioBlob.size,
        mimeType: 'audio/wav'
      });
      const response = await authenticatedFetch(`/sessions/${id}/transcriptions`,'POST',form,controller.signal);
      console.info(`[VOICE] response status: ${response.status}`);
      const result = await response.json(); controller.signal.throwIfAborted();
      const text = typeof result.transcript === 'string' ? result.transcript.trim() : '';
      if (!text) {
        console.warn('[VOICE ERROR][transcription] Received empty transcript from STT');
        throw new RequestError('SPEECH_UNCLEAR', undefined, 'transcription');
      }
      console.info(`[VOICE] transcription received: "${text}"`);
      setCaption(text);
      const command = voiceCommand(text,language.current);
      if (command) {
        console.info(`[VOICE] recognized voice command: ${command}`);
        if (command === 'stop') { transition('listening');turnLock.current=false;return; }
        if (command === 'end') { end(); await current.current.command(command); return; }
        if (command === 'repeat' || command === 'slower') {
          if (command === 'slower') { speed.current = .75; setRate(.75); }
          if (last.current) await speakResult(last.current,marker); else await notice('unclear',marker);
        } else await current.current.command(command);
      } else {
        console.info('[VOICE] processing query with AI assistant');
        const answered = await current.current.question(text,controller.signal);
        if (!answered) {
          console.warn('[VOICE ERROR][query] Context review required or no response from assistant');
          throw new RequestError('CONTEXT_REVIEW_REQUIRED', undefined, 'query');
        }
        controller.signal.throwIfAborted(); last.current = answered;
        console.info('[VOICE] playing assistant response');
        await speakResult(answered,marker);
      }
      failures.current = 0;
      console.info('[VOICE] processing finished');
      await listen(marker);
      console.info('[VOICE] listening resumed');
    } catch (error) {
      if (marker !== epoch.current || !active.current) return;
      const code = error instanceof RequestError ? error.code : error instanceof Error ? error.message : 'VOICE_ERROR';
      const stage = error instanceof RequestError ? (error.stage || 'pipeline') : 'pipeline';
      console.error(`[VOICE ERROR][${stage}]`, error);
      const kind: Notice = code === 'SPEECH_UNCLEAR' ? 'unclear' : ['CONTEXT_REVIEW_REQUIRED','CONTEXT_STALE'].includes(code) ? 'review' : 'error';
      setDetail(copy[language.current][kind]);
      try { await notice(kind,marker); } catch { /* Captions and large restart action remain. */ }
      if (marker !== epoch.current) return;
      if ((kind === 'unclear' || kind === 'review') && ++failures.current <= 2) {
        console.info('[VOICE] auto-recovering and resuming listening after notice');
        await listen(marker).catch(() => { pause();transition('error'); });
      }
      else { pause();transition('error'); }
    }
  }
  async function start(locale: Locale = current.current.locale) {
    pause(); language.current = locale; const marker = epoch.current; active.current = true; failures.current = 0; setDetail('');
    if (!isEnabledLocale(locale)) { active.current=false; setCaption(copy[locale].unsupported); setDetail(copy[locale].unsupported); transition('error'); return; }
    const captureMarker=captureRun.current;
    captureContext.current ||= new AudioContext();
    const unlocked = captureContext.current.resume(); unlocked.catch(()=>{});
    // play() and microphone request originate in the explicit language/button action.
    const intro = notice('intro',marker); intro.catch(() => {});
    transition('requesting_permission');
    const permission = navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
    permission.catch(() => {});
    try {
      const acquired = await permission;
      if (marker !== epoch.current) { acquired.getTracks().forEach(track=>track.stop()); return; }
      stream.current = acquired;
      await unlocked;
      if (marker !== epoch.current) return;
      const old = vad.current; vad.current = null; await old?.destroy().catch(()=>{});
      const { MicVAD } = await import('@ricky0123/vad-web');
      const microphone = async () => {
        const next = stream.current?.active ? stream.current : await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
        if (captureMarker !== captureRun.current) { next.getTracks().forEach(track=>track.stop()); throw new DOMException('Canceled','AbortError'); }
        stream.current=next; next.getTracks().forEach(track=>track.addEventListener('ended',()=>{ if (phase.current==='listening' && active.current) { pause();setDetail(copy[language.current].permission); } },{once:true}));return next;
      };
      detector.current=new SpeechDetector({pauseMs:()=>pauseValue.current,confirm:interruptPlayback,complete:samples=>{void utterance(samples);},tooLong:()=>{void announce('unclear');}});
      const mic = await MicVAD.new({audioContext:captureContext.current!,model:'v5',baseAssetPath:'/vad/',onnxWASMBasePath:'/vad/',processorType:'AudioWorklet',startOnLoad:false,
        ortConfig: ort => { ort.env.wasm.numThreads=1; }, getStream:microphone,resumeStream:microphone,
        pauseStream:async input=>{ input.getTracks().forEach(track=>track.stop()); if(stream.current===input)stream.current=null; },
        redemptionMs:pauseValue.current,minSpeechMs:450,preSpeechPadMs:800,positiveSpeechThreshold:.3,negativeSpeechThreshold:.25,submitUserSpeechOnPause:false,
        onFrameProcessed:(probabilities,frame)=>{if(!active.current)return;const playing=Boolean(player.current && (!player.current.paused || performance.now()<heardUntil.current));const residual=playing && echo.current.matches(frame,player.current!.currentTime,player.current!.playbackRate);detector.current?.feed(frame,probabilities.isSpeech,residual);},
        onSpeechEnd:samples=>{samples.fill(0);}
      });
      if (marker !== epoch.current) { await mic.destroy().catch(()=>{}); return; }
      vad.current=mic;
      await prepareReference(`/voice/${language.current}/intro.wav`,marker);
      await mic.start();if(mic.errored)throw new Error('MICROPHONE_NOT_READY');
      if(marker!==epoch.current)return;
      if(player.current && !player.current.paused)transition('speaking');
      await intro;await listen(marker);
    } catch (error) {
      if(marker!==epoch.current)return;
      active.current=false;haltMedia();transition('error');
      setDetail(error instanceof DOMException && ['NotAllowedError','NotFoundError','NotReadableError'].includes(error.name) ? copy[locale].permission : copy[locale].error);
    }
  }
  async function resume() {
    if (!vad.current || vad.current.errored) { await start(); return; }
    active.current=true; failures.current=0; setDetail('');
    const marker = ++epoch.current;
    try {
      await listen(marker);
      console.info('[VOICE] listening resumed from existing VAD');
    } catch {
      await start();
    }
  }
  async function announce(kind: Notice) { pause();language.current=current.current.locale; const marker=epoch.current; try { await notice(kind,marker); if(marker===epoch.current)transition('paused'); } catch { if(marker===epoch.current){setCaption(copy[language.current][kind]);transition('error');} } }
  function stopSpeaking() { if(active.current && ['speaking','processing'].includes(phase.current))interruptPlayback();else pause(); }
  function cancelOutput(){epoch.current++;pending.current?.abort();player.current?.pause();rejectPlayback.current?.();rejectPlayback.current=null;turnLock.current=false;transition(active.current?'listening':'paused');}
  async function answer(result:Result,signal?:AbortSignal){
    cancelOutput();language.current=current.current.locale;
    const marker=epoch.current;const canceled=()=>{if(marker===epoch.current)cancelOutput();};signal?.addEventListener('abort',canceled,{once:true});
    try{signal?.throwIfAborted();captureContext.current ||= new AudioContext();await captureContext.current.resume();signal?.throwIfAborted();if(marker!==epoch.current)return;last.current=result;await speakResult(result,marker);if(active.current&&vad.current)await listen(marker);else if(marker===epoch.current)transition('paused');}
    catch{if(marker===epoch.current){pause();transition('error');}}
    finally{signal?.removeEventListener('abort',canceled);}
  }
  async function explainConsent(kind:Notice='screenConsent'){
    cancelOutput();language.current=current.current.locale;const marker=epoch.current;
    try{captureContext.current ||= new AudioContext();await captureContext.current.resume();if(marker!==epoch.current)return;await notice(kind,marker);if(active.current&&vad.current)await listen(marker);else if(marker===epoch.current)transition('paused');}
    catch{if(marker===epoch.current){setCaption(copy[language.current][kind]);transition(active.current?'listening':'paused');}}
  }
  useEffect(()=>{ vad.current?.setOptions({redemptionMs:pauseMs}); },[pauseMs]);
  useEffect(()=>{mounted.current=true;return ()=>{ mounted.current=false;active.current=false;epoch.current++;captureRun.current++;haltMedia();detector.current?.clear();echo.current.clear();void vad.current?.destroy().catch(()=>{});void captureContext.current?.close().catch(()=>{});for(const url of audioCache.current.values())URL.revokeObjectURL(url); };},[]);
  return {state,caption,detail,pauseMs,setPauseMs,rate,start,resume,pause,end,stopSpeaking,announce,answer,explainConsent,cancelOutput,interruptionMs,active:!['idle','paused','error'].includes(state)};
}
