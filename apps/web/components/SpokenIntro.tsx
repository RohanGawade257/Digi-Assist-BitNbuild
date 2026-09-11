'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@guide/contracts';
import { useWords } from '../lib/messages';

export function SpokenIntro({ locale, text }: { locale: Locale; text: string }) {
  const { m } = useWords();
  const [skipped, setSkipped] = useState(false), [speaking, setSpeaking] = useState(false), [unavailable, setUnavailable] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    setSpeaking(false); setUnavailable(false);
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoice(synth.getVoices().find(item => item.localService && item.lang.replace('_', '-').split('-')[0] === locale.split('-')[0]) || null);
    update(); synth.addEventListener('voiceschanged', update);
    return () => { synth.cancel(); synth.removeEventListener('voiceschanged', update); };
  }, [locale]);
  function stop() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setSpeaking(false); }
  function play() {
    stop();
    if (!voice) { setUnavailable(true); return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.voice = voice; utterance.lang = locale; utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => { setSpeaking(false); setUnavailable(true); };
    setSpeaking(true); window.speechSynthesis.speak(utterance);
  }
  return skipped ? null : <div className="spoken-intro"><p className="hint" lang={locale} dir={locale === 'ur-IN' ? 'rtl' : 'ltr'}>{text}</p><div className="actions"><button type="button" className="secondary" onClick={speaking ? stop : play}>{speaking ? m('Stop introduction') : m('Listen to introduction')}</button><button type="button" className="text-button" onClick={() => { stop(); setSkipped(true); }}>{m('Skip introduction')}</button></div>{unavailable && <p role="status" className="hint">{m('A voice for this language is not available on this device. Read the introduction above or continue.')}</p>}</div>;
}
