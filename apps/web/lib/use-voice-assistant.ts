'use client';
import { useEffect, useRef, useState } from 'react';
import { pcmWave, splitText, type Answer, type Locale } from '@guide/contracts';
import type { MicVAD } from '@ricky0123/vad-web';
import { authenticatedFetch, RequestError } from './api';
import copy from './voice-copy.json';
import { voiceCommand, type VoiceCommand } from './voice-commands';

export type VoiceState = 'idle' | 'requesting_permission' | 'listening' | 'finalizing' | 'processing' | 'speaking' | 'paused' | 'error';
export const voiceStates: VoiceState[] = ['idle','requesting_permission','listening','finalizing','processing','speaking','paused','error'];
type Result = { answer: Answer; sessionId: string };
type Options = { locale: Locale; allowed: boolean; cloudAllowed: boolean; ensureSession: (signal: AbortSignal) => Promise<string>; question: (text: string, signal: AbortSignal) => Promise<Result | undefined>; command: (command: VoiceCommand) => Promise<void>; needLogin: () => void };
type Notice = 'intro' | 'unclear' | 'error' | 'review' | 'login' | 'share';
export function useVoiceAssistant(options: Options) {
  const current = useRef(options); current.current = options;
  const [state, setState] = useState<VoiceState>('idle'), [caption, setCaption] = useState(''), [detail, setDetail] = useState('');
  const [pauseMs, setPauseMs] = useState(2000), [rate, setRate] = useState(1);
  const phase = useRef<VoiceState>('idle'), active = useRef(false), epoch = useRef(0), language = useRef<Locale>(options.locale);
  const vad = useRef<MicVAD | null>(null), stream = useRef<MediaStream | null>(null), player = useRef<HTMLAudioElement | null>(null);
  const captureContext = useRef<AudioContext | null>(null);
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
  function pause() { active.current = false; epoch.current++; haltMedia(); void vad.current?.pause(); turnLock.current = false; transition('paused'); }
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
      const done = () => { element.onended = null; element.onerror = null; rejectPlayback.current = null; resolve(); };
      const failed = () => { element.onended = null; element.onerror = null; rejectPlayback.current = null; reject(new Error('PLAYBACK_FAILED')); };
      element.onended = done; element.onerror = failed; rejectPlayback.current = () => { element.onended = null; element.onerror = null; reject(new DOMException('Canceled','AbortError')); };
      void element.play().catch(failed);
    });
    if (marker !== epoch.current) throw new DOMException('Canceled','AbortError');
  }
  async function notice(kind: Notice, marker = epoch.current) { await play(`/voice/${language.current}/${kind}.wav`, copy[language.current][kind], marker); }
  async function listen(marker: number) {
    if (!active.current || marker !== epoch.current) return;
    if (!vad.current) throw new Error('MICROPHONE_NOT_READY');
    turnLock.current = false; startedAt.current = 0;
    vad.current.setOptions({ redemptionMs: pauseValue.current, minSpeechMs: 450, submitUserSpeechOnPause: false });
    await captureContext.current?.resume(); await vad.current.start();
    if(vad.current.errored || captureContext.current?.state!=='running')throw new Error('MICROPHONE_NOT_READY');
    if (marker !== epoch.current || !active.current) { await vad.current.pause(); return; }
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
      await play(url, chunks[chunk]!, marker);
    }
  }
  async function utterance(samples: Float32Array) {
    if (!active.current || phase.current !== 'listening' || turnLock.current) return;
    turnLock.current = true; const marker = epoch.current; transition('finalizing');
    if (maxTimer.current) clearTimeout(maxTimer.current); maxTimer.current = null;
    await vad.current?.pause(); // Stop microphone tracks before cloud work or playback.
    try {
      if (!current.current.allowed) { current.current.needLogin(); await notice('login',marker); active.current = false; transition('paused'); return; }
      if (!current.current.cloudAllowed) throw new RequestError('CLOUD_SPEECH_DISABLED');
      const wave = pcmWave(samples.slice(0, 25 * 16000),16000); samples.fill(0);
      const controller = new AbortController(); pending.current = controller;
      const id = await current.current.ensureSession(controller.signal);
      const form = new FormData(); form.set('file',new Blob([new Uint8Array(wave)],{type:'audio/wav'}),'question.wav');
      form.set('metadata',JSON.stringify({requestId:crypto.randomUUID(),inputLocale:language.current,cloudSpeechConsent:true,automaticConversation:true}));
      transition('processing');
      const response = await authenticatedFetch(`/sessions/${id}/transcriptions`,'POST',form,controller.signal);
      const result = await response.json(); controller.signal.throwIfAborted();
      const text = typeof result.transcript === 'string' ? result.transcript.trim() : '';
      if (!text) throw new RequestError('SPEECH_UNCLEAR');
      setCaption(text);
      const command = voiceCommand(text,language.current);
      if (command) {
        if (command === 'end') { end(); await current.current.command(command); return; }
        if (command === 'repeat' || command === 'slower') {
          if (command === 'slower') { speed.current = .75; setRate(.75); }
          if (last.current) await speakResult(last.current,marker); else await notice('unclear',marker);
        } else await current.current.command(command);
      } else {
        const answered = await current.current.question(text,controller.signal);
        if (!answered) throw new RequestError('CONTEXT_REVIEW_REQUIRED');
        controller.signal.throwIfAborted(); last.current = answered; await speakResult(answered,marker);
      }
      failures.current = 0; await listen(marker);
    } catch (error) {
      if (marker !== epoch.current || !active.current) return;
      const code = error instanceof RequestError ? error.code : error instanceof Error ? error.message : 'VOICE_ERROR';
      const kind: Notice = code === 'SPEECH_UNCLEAR' ? 'unclear' : ['CONTEXT_REVIEW_REQUIRED','CONTEXT_STALE'].includes(code) ? 'review' : 'error';
      setDetail(copy[language.current][kind]);
      try { await notice(kind,marker); } catch { /* Captions and large restart action remain. */ }
      if (marker !== epoch.current) return;
      if ((kind === 'unclear' || kind === 'review') && ++failures.current <= 2) { await listen(marker).catch(() => { active.current=false;transition('error'); }); }
      else { active.current = false; transition('error'); }
    }
  }
  async function start(locale: Locale = current.current.locale) {
    pause(); language.current = locale; const marker = epoch.current; active.current = true; failures.current = 0; setDetail('');
    if (locale === 'ur-IN') { active.current=false; setCaption(copy[locale].unsupported); setDetail(copy[locale].unsupported); transition('error'); return; }
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
      await intro; await unlocked;
      if (marker !== epoch.current) return;
      const old = vad.current; vad.current = null; await old?.destroy().catch(()=>{});
      const { MicVAD } = await import('@ricky0123/vad-web');
      const microphone = async () => {
        const next = stream.current?.active ? stream.current : await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
        if (marker !== epoch.current) { next.getTracks().forEach(track=>track.stop()); throw new DOMException('Canceled','AbortError'); }
        stream.current=next; next.getTracks().forEach(track=>track.addEventListener('ended',()=>{ if (phase.current==='listening' && active.current) { pause();setDetail(copy[language.current].permission); } },{once:true}));return next;
      };
      const detector = await MicVAD.new({audioContext:captureContext.current!,model:'v5',baseAssetPath:'/vad/',onnxWASMBasePath:'/vad/',processorType:'AudioWorklet',startOnLoad:false,
        ortConfig: ort => { ort.env.wasm.numThreads=1; }, getStream:microphone,resumeStream:microphone,
        pauseStream:async input=>{ input.getTracks().forEach(track=>track.stop()); if(stream.current===input)stream.current=null; },
        redemptionMs:pauseValue.current,minSpeechMs:450,preSpeechPadMs:800,positiveSpeechThreshold:.3,negativeSpeechThreshold:.25,submitUserSpeechOnPause:false,
        onSpeechStart:()=>{ startedAt.current=performance.now(); },
        onSpeechRealStart:()=>{ if(maxTimer.current)clearTimeout(maxTimer.current);maxTimer.current=setTimeout(()=>{ if(phase.current==='listening') { setDetail(copy[language.current].unclear);void announce('unclear'); } },25000); },
        onSpeechEnd:samples=>{ void utterance(samples); },
        onVADMisfire:()=>{ if(maxTimer.current)clearTimeout(maxTimer.current);maxTimer.current=null; }
      });
      if (marker !== epoch.current) { await detector.destroy().catch(()=>{}); return; }
      vad.current=detector; await listen(marker);
    } catch (error) {
      if(marker!==epoch.current)return;
      active.current=false;haltMedia();transition('error');
      setDetail(error instanceof DOMException && ['NotAllowedError','NotFoundError','NotReadableError'].includes(error.name) ? copy[locale].permission : copy[locale].error);
    }
  }
  async function resume() {
    if (!vad.current) { await start(); return; }
    active.current=true; failures.current=0;
    // Recreate to avoid retaining permission callbacks from an earlier canceled epoch.
    const old=vad.current;vad.current=null;await old.destroy().catch(()=>{});await start();
  }
  async function announce(kind: Notice) { pause();language.current=current.current.locale; const marker=epoch.current; try { await notice(kind,marker); if(marker===epoch.current)transition('paused'); } catch { if(marker===epoch.current){setCaption(copy[language.current][kind]);transition('error');} } }
  function stopSpeaking() { pause(); }
  useEffect(()=>{ vad.current?.setOptions({redemptionMs:pauseMs}); },[pauseMs]);
  useEffect(()=>{mounted.current=true;return ()=>{ mounted.current=false;active.current=false;epoch.current++;haltMedia();void vad.current?.destroy().catch(()=>{});void captureContext.current?.close().catch(()=>{});for(const url of audioCache.current.values())URL.revokeObjectURL(url); };},[]);
  return {state,caption,detail,pauseMs,setPauseMs,rate,start,resume,pause,end,stopSpeaking,announce,active:!['idle','paused','error'].includes(state)};
}
