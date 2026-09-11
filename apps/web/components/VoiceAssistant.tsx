'use client';
import type { Locale } from '@guide/contracts';
import copy from '../lib/voice-copy.json';
import { voiceStates, type useVoiceAssistant } from '../lib/use-voice-assistant';
import { workspaceWords } from '../lib/workspace-copy';
export function VoiceAssistant({voice,locale,onEnd}:{voice:ReturnType<typeof useVoiceAssistant>;locale:Locale;onEnd:()=>void}){
 const text=copy[locale];
 return <section className="voice-assistant" aria-labelledby="voice-title" lang={locale} dir={locale==='ur-IN'?'rtl':'ltr'} data-voice-state={voice.state} data-interruption-ms={voice.interruptionMs}>
  <h2 id="voice-title">{text.title}</h2><p role="status" aria-live="polite">{text.states[voiceStates.indexOf(voice.state)]}</p>
  <div className="actions"><button type="button" className="primary" onClick={()=>void (voice.state==='paused'?voice.resume():voice.start())} disabled={voice.active}>{voice.state==='paused'?text.resume:text.start}</button><button type="button" className="secondary" onClick={voice.pause}>{text.pause}</button><button type="button" className="stop" onClick={voice.stopSpeaking}>{text.stop}</button><button type="button" className="stop" aria-label={`${text.title}: ${text.end}`} onClick={onEnd}>{text.end}</button></div>
  <p className="voice-caption" lang={locale}>{voice.caption}</p>{voice.detail&&<p role="alert">{voice.detail}</p>}
  <label>{text.wait}<select value={voice.pauseMs} onChange={event=>voice.setPauseMs(Number(event.target.value))}><option value={2000}>2</option><option value={3500}>3.5</option><option value={5000}>5</option></select></label>
  <details><summary>{text.title}</summary><p>{text.consent}</p><p>{text.commands}</p><p>{workspaceWords(locale).echo}</p></details>
 </section>;
}
