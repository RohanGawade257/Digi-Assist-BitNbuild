'use client';
import { useEffect, useRef, useState } from 'react';
import { inspectWave, splitText, type Answer, type Locale } from '@guide/contracts';
import { api, authenticatedFetch } from '../lib/api';
import { startRecording } from '../lib/recording';
import { useWords } from '../lib/messages';

export function VoiceInput({ allowed, cloudAllowed, locale, ensureSession, onTranscript, onBusy, resetKey }: { allowed: boolean; cloudAllowed: boolean; locale: Locale; ensureSession: (signal: AbortSignal) => Promise<string>; onTranscript: (text: string) => void; onBusy: (busy: boolean) => void; resetKey: number }) {
  const { m, uiLocale } = useWords();
  const [consent, setConsent] = useState(false), [starting, setStarting] = useState(false), [recording, setRecording] = useState(false), [sending, setSending] = useState(false);
  const [wave, setWave] = useState<Uint8Array | null>(null), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null), capture = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const requestSession = useRef<string | null>(null);
  function discard() { controller.current?.abort(); capture.current?.discard(); capture.current = null; setStarting(false); setRecording(false); setSending(false); setWave(null); setConsent(false); onBusy(false); if (requestSession.current) void api(`/sessions/${requestSession.current}/speech/cancel`, 'POST').catch(() => {}); requestSession.current = null; }
  useEffect(() => { discard(); return () => { controller.current?.abort(); capture.current?.discard(); }; }, [resetKey, locale, allowed, cloudAllowed]); // eslint-disable-line react-hooks/exhaustive-deps
  async function record() {
    discard(); setError(''); const current = new AbortController(); controller.current = current; setStarting(true); onBusy(true);
    try {
      const active = await startRecording(current.signal, bytes => {
        if (current.signal.aborted) return;
        try { inspectWave(bytes); setWave(bytes); }
        catch { setWave(null); setError(m('The recording is too short or could not be read. Record again or type your question.')); }
        setRecording(false); onBusy(false);
      });
      if (current.signal.aborted) { active.discard(); return; }
      capture.current = active; setStarting(false); setRecording(true);
    }
    catch { if (!current.signal.aborted) { setError(m("Microphone unavailable. You can type your question.")); setStarting(false); setRecording(false); onBusy(false); } }
  }
  async function transcribe() {
    if (!wave || !consent || !allowed || !cloudAllowed) return;
    const current = new AbortController(); controller.current = current; setSending(true); onBusy(true); setError('');
    try {
      const id = await ensureSession(current.signal); requestSession.current = id;
      const form = new FormData(); form.set('file', new Blob([new Uint8Array(wave)], { type: 'audio/wav' }), 'recording.wav');
      form.set('metadata', JSON.stringify({ requestId: crypto.randomUUID(), inputLocale: locale, cloudSpeechConsent: true }));
      const response = await authenticatedFetch(`/sessions/${id}/transcriptions`, 'POST', form, current.signal);
      const result = await response.json(); current.signal.throwIfAborted(); onTranscript(result.transcript); setWave(null); setConsent(false);
    } catch { if (!current.signal.aborted) setError(m("Speech could not be understood or shared safely. Record again or type a non-sensitive question.")); }
    finally { if (!current.signal.aborted) { setSending(false); onBusy(false); } }
  }
  return <details className="speech-controls voice-input" lang={uiLocale} onToggle={e => { if (!e.currentTarget.open && (starting || recording || sending)) discard(); }}><summary>{m("Speak a question")}</summary><p className="hint">{m("Record up to 25 seconds locally. Review the transcript in the question box before sending it.")}</p>
    {!cloudAllowed && <p className="hint">{m('Voice input is unavailable for this session. You can type your question.')}</p>}
    <div className="actions"><button type="button" className="secondary" disabled={!allowed || !cloudAllowed || starting || recording || sending} onClick={() => void record()}>{m("Record locally")}</button>{recording && <button type="button" className="stop" onClick={() => capture.current?.stop()}>{m("Finish recording")}</button>}{(starting || recording || sending || wave) && <button type="button" className="text-button" onClick={discard}>{m("Discard / cancel")}</button>}</div>
    <p role="status">{starting ? m('Starting microphone. Allow access in your browser if asked.') : recording ? m("Microphone is recording. It stops after 25 seconds.") : sending ? m("Transcribing…") : wave ? m("Recording ready. Nothing has been uploaded.") : ''}</p>
    {wave && <><label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>{m("I agree to send this non-sensitive recording to Sarvam for transcription. Audio is sent before text can be reviewed.")}</label><button type="button" className="secondary" disabled={!consent || sending} onClick={() => void transcribe()}>{m("Send recording for transcription")}</button></>}{error && <p className="error" role="alert">{error}</p>}
  </details>;
}

export function AnswerAudio({ answer, sessionId, enabled, rate, onEnable }: { answer: Answer; sessionId: string; enabled: boolean; rate: number; onEnable?: () => void }) {
  const { m, uiLocale } = useWords();
  const [segment, setSegment] = useState<'explanation' | 'draft'>('explanation'), [index, setIndex] = useState(0), [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const audio = useRef<HTMLAudioElement>(null), pending = useRef<AbortController | null>(null), cache = useRef(new Map<string, string>());
  const [pace, setPace] = useState(rate);
  const parts = splitText(answer[segment]?.text || '');
  const supported = answer[segment]?.locale !== 'ur-IN';
  function stop() { pending.current?.abort(); audio.current?.pause(); if (audio.current) audio.current.currentTime = 0; setBusy(false); }
  useEffect(() => { if (!enabled) stop(); }, [enabled]);
  useEffect(() => setPace(rate), [rate]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = pace; }, [pace, url]);
  useEffect(() => () => { pending.current?.abort(); for (const value of cache.current.values()) URL.revokeObjectURL(value); cache.current.clear(); }, [answer.requestId]);
  async function play(part = index, section = segment) {
    if (answer[section]?.locale === 'ur-IN') return;
    stop(); setError(''); const controller = new AbortController(); pending.current = controller; setBusy(true);
    try {
      const key = `${section}:${part}`; let next = cache.current.get(key);
      if (!next) { const response = await authenticatedFetch(`/sessions/${sessionId}/turns/${answer.requestId}/audio`, 'POST', JSON.stringify({ segment: section, chunk: part, pace: 1 }), controller.signal, true); const blob = await response.blob(); controller.signal.throwIfAborted(); next = URL.createObjectURL(blob); cache.current.set(key, next); }
      controller.signal.throwIfAborted(); setUrl(next); setIndex(part); setSegment(section);
      if (audio.current) { // The ref owns src: a React src update here would reload media during play().
        if (audio.current.getAttribute('src') !== next) audio.current.src = next; audio.current.playbackRate = pace; await audio.current.play(); }
    } catch { if (!controller.signal.aborted) setError(m("Audio is unavailable. The complete text remains above.")); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="speech-controls" lang={uiLocale}><h3>{m("Listen to this answer")}</h3>{!enabled && onEnable && <button type="button" className="secondary" onClick={onEnable}>{m("Enable answer audio")}</button>}{!supported && <p className="notice">{m("Urdu audio is unavailable from the current speech provider. You can read the Urdu text or select another reply language.")}</p>}<p className="hint">{m("Audio starts only when you choose Play. Native audio controls provide pause, resume and mute.")}</p><label>{m("Read")}<select value={segment} onChange={e => { stop(); setUrl(''); setSegment(e.target.value as typeof segment); setIndex(0); }}><option value="explanation">{m("Guidance")}</option>{answer.draft && <option value="draft">{m("Draft (")}{answer.draft.locale})</option>}</select></label><p>{m("Part")}{' '}{index + 1}{' '}{m("of")}{' '}{parts.length}</p><div className="actions"><button type="button" className="secondary" disabled={!enabled || !supported || busy} onClick={() => void play()}>{m("Play / repeat")}</button><button type="button" className="text-button" disabled={!enabled || !supported || busy || index === 0} onClick={() => void play(index - 1)}>{m("Previous part")}</button><button type="button" className="text-button" disabled={!enabled || !supported || busy || index + 1 >= parts.length} onClick={() => void play(index + 1)}>{m("Next part")}</button><button type="button" className="secondary" disabled={!enabled || !supported} onClick={() => setPace(0.75)}>{m("Speak slower")}</button><button type="button" className="stop" onClick={stop}>{m("Stop audio")}</button></div><audio ref={audio} controls preload="none" aria-label={m("Answer audio")}/><p role="status">{busy ? m("Preparing audio…") : ''}</p>{error && <p role="alert" className="error">{error}</p>}</div>;
}
