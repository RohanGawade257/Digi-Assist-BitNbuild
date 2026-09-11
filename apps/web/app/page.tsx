'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { containsSensitiveText, languageNames, enabledLocales as locales, type Answer, type Locale, type Source, type Turn, type Preferences } from '@guide/contracts';
import { catalogs } from '../lib/locales';
import { ephemeralAuth, firebaseAuth, firebaseConfigured } from '../lib/firebase';
import { authFailure } from '../lib/auth-errors';
import { api, RequestError } from '../lib/api';
import { SafeContext, type ContextState, type ReviewHandle } from '../components/SafeContext';
import { AnswerAudio, VoiceInput } from '../components/SpeechControls';
import { AccountTools } from '../components/AccountTools';
import { FloatingPanel, type FloatingHandle } from '../components/FloatingPanel';
import { workspaceWords } from '../lib/workspace-copy';
import {captureWords} from '../lib/capture-copy';
import { WordsProvider, words } from '../lib/messages';
import { Dialog } from '../components/Dialog';
import { AssistantVisual } from '../components/AssistantVisual';
import { designWords } from '../lib/design-copy';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { useVoiceAssistant } from '../lib/use-voice-assistant';
import voiceCopy from '../lib/voice-copy.json';

function LanguageSelect({ label, value, onChange, empty = false }: { label: string; value: string; onChange: (v: Locale) => void; empty?: boolean }) {
  const id = useId();
  return <div><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value as Locale)}>{empty && <option value="">—</option>}{locales.map(l => <option key={l} value={l} lang={l}>{languageNames[l]}</option>)}</select></div>;
}
export default function Home() {
  const [replyLocale, setReplyLocale] = useState<Locale>('en-IN');
  const [interfaceLocale, setInterfaceLocale] = useState<Locale>('en-IN');
  const m = words(interfaceLocale), uiLocale = interfaceLocale, d=designWords(interfaceLocale);
  const [secondary,setSecondary]=useState<'history'|'account'|'feedback'|'help'|null>(null);
  const [inputLocale, setInputLocale] = useState<Locale>('en-IN');
  const [draftLocale, setDraftLocale] = useState<Locale | ''>('');
  const [onboarded, setOnboarded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(''), [authStatus, setAuthStatus] = useState('');
  const [accountOpen, setAccountOpen] = useState(false), [contextOpen, setContextOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [contextState, setContextState] = useState<ContextState>({ kind: 'none', approved: false });
  const [messages, setMessages] = useState<{ question: string; locale: Locale; answer: Answer; interrupted?:boolean }[]>([]);
  const [canRetry, setCanRetry] = useState(false), [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false), [voiceEpoch, setVoiceEpoch] = useState(0);
  const [question, setQuestion] = useState(''); const [task, setTask] = useState<Turn['taskKind']>('general-help');
  const [consent, setConsent] = useState(false); const [source, setSource] = useState<Source | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const [open, setOpen] = useState(true); const [pinned, setPinned] = useState(false);
  const [large, setLarge] = useState(false); const [reader, setReader] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [shortcut, setShortcut] = useState(false);
  const [history, setHistory] = useState(false), [audio, setAudio] = useState(false), [rate, setRate] = useState(1);
  const [prefsReady, setPrefsReady] = useState(false), [cloudAllowed, setCloudAllowed] = useState(false), [mediaBusy, setMediaBusy] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text'), [expiresAt, setExpiresAt] = useState(0), [idleWarning, setIdleWarning] = useState(false);
  const creating = useRef<Promise<string> | null>(null);
  const contextReview = useRef<ReviewHandle>(null);
  const floatingPanel=useRef<FloatingHandle>(null);
  const [screenAllowed,setScreenAllowed]=useState(false),[capturing,setCapturing]=useState(false),[captureRetry,setCaptureRetry]=useState(false);
  const capturePending=useRef<AbortController|null>(null),captureLifetime=useRef<AbortController|null>(null);
  const session = useRef<string | null>(null);
  const pending = useRef<{ id: string; abort: AbortController } | null>(null);
  const generation = useRef(0); const composer = useRef<HTMLTextAreaElement>(null); const launcher = useRef<HTMLButtonElement>(null);
  const suppressReveal = useRef(false);
  const conversationLog = useRef<HTMLDivElement>(null), consentInput = useRef<HTMLInputElement>(null), authPanel = useRef<HTMLDivElement>(null);
  const t = catalogs[interfaceLocale];
  const voice = useVoiceAssistant({locale:replyLocale,allowed:Boolean(user && verified),cloudAllowed,ensureSession,
    interrupted:id=>{if(capturePending.current)cancelCapture();else if(pending.current)stop();if(id)setMessages(previous=>previous.map(item=>item.answer.requestId===id?{...item,interrupted:true}:item));},
    question:(text,signal)=>send({text,signal}),needLogin:()=>setAccountOpen(true),
    command:async command=>{if(command==='end')await end();else if(command==='stop-sharing')contextReview.current?.clear();else if(command==='approve-image')await contextReview.current?.approveByVoice();}
  });
  function activateLanguage(locale:Locale) { setReplyLocale(locale);setInputLocale(locale);setInterfaceLocale(locale);setOnboarded(true);setPinned(true);setAudio(true);void voice.start(locale); }

  useEffect(() => { document.documentElement.lang = interfaceLocale; document.documentElement.dir = interfaceLocale === 'ur-IN' ? 'rtl' : 'ltr'; }, [interfaceLocale]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), next => { setUser(next); setVerified(next?.emailVerified || false); if (!next) { generation.current++; pending.current?.abort.abort(); pending.current = null; session.current = null; setAnswer(null); setMessages([]); setSource(null); setResetKey(k => k + 1); setPassword(''); setBusy(false); } });
    return unsubscribe;
  }, []);
  useEffect(() => {
    setPrefsReady(false); setCloudAllowed(false);setScreenAllowed(false); setServiceReady(null);
    if (!user) { setHistory(false); setAudio(false); return; }
    const controller = new AbortController();
    void Promise.all([api<Preferences>('/me', 'GET', undefined, controller.signal), api<{ screenshot:{onDemandCaptureAllowed:boolean}; typed: { configured: boolean }; speech: { cloudInputAllowed: boolean; configured: boolean } }>('/capabilities', 'GET', undefined, controller.signal)]).then(([prefs, caps]) => {
      if (controller.signal.aborted) return;
      // Explicit language choices made before login take precedence over stored defaults.
      setScreenAllowed(caps.screenshot.onDemandCaptureAllowed);setLarge(prefs.textScale > 1); setReader(prefs.screenReaderMode); setHistory(prefs.saveHistory); setAudio(prefs.audioEnabled); setRate(prefs.speechRate); setPinned(prefs.chatPinned); setShortcut(prefs.chatShortcutEnabled); setCloudAllowed(caps.speech.cloudInputAllowed && caps.speech.configured); setServiceReady(caps.typed?.configured ?? null); setPrefsReady(true);
    }).catch(() => { if (!controller.signal.aborted) setError(m("Settings could not be loaded. Your current choices still work for this visit.")); });
    return () => controller.abort();
  }, [user]);
  useEffect(() => {
    if (!prefsReady || !user) return;
    const controller = new AbortController(); const timer = setTimeout(() => { void api('/me', 'PATCH', { replyLocale, interfaceLocale, textScale: large ? 1.2 : 1, screenReaderMode: reader, saveHistory: history, audioEnabled: audio, speechRate: rate, chatPinned: pinned, chatShortcutEnabled: shortcut }, controller.signal).catch(() => { if (!controller.signal.aborted) setError(m("Settings were not saved. Try changing the setting again.")); }); }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [prefsReady, user, replyLocale, interfaceLocale, large, reader, history, audio, rate, pinned, shortcut]);
  useEffect(() => { const check = () => setIdleWarning(expiresAt > 0 && Date.now() > expiresAt - 120_000); const timer = setInterval(check, 15_000); check(); return () => clearInterval(timer); }, [expiresAt]);
  async function ensureSession(signal: AbortSignal) {
    if (session.current && Date.now() < expiresAt) return session.current;
    if (!creating.current) {
      const marker = generation.current;
      creating.current = api<{ id: string; expiresAt: string }>('/sessions', 'POST', { historyEnabled: history }, signal).then(created => {
        if (signal.aborted || marker !== generation.current) { void api(`/sessions/${created.id}`, 'DELETE').catch(() => {}); throw new DOMException('Canceled', 'AbortError'); }
        session.current = created.id; setExpiresAt(Date.parse(created.expiresAt)); return created.id;
      }).finally(() => { creating.current = null; });
    }
    return creating.current;
  }
  function stop() {
    generation.current++;
    const current = pending.current;
    if (current) {
      current.abort.abort();
      if (session.current) void api(`/sessions/${session.current}/turns/${current.id}/cancel`, 'POST').catch(() => {});
    }
    pending.current = null; setBusy(false); setCanRetry(false); setStatus(t.stopped);
  }
  const changeSource = useCallback((next: Source | null) => {
    generation.current++; pending.current?.abort.abort(); pending.current = null;
    setBusy(false); setCanRetry(false); setSource(next);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (shortcut && e.altKey && e.shiftKey && e.code === 'KeyC' && !e.isComposing) { e.preventDefault(); setOpen(true); requestAnimationFrame(() => composer.current?.focus()); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [shortcut]);
  useEffect(() => () => pending.current?.abort.abort(), []);
  async function account(action: 'login' | 'signup' | 'reset' | 'resend' | 'verify') {
    if (authBusy) return;
    setAuthError(''); setAuthStatus(''); setAuthBusy(true);
    try {
      const auth = await ephemeralAuth(); auth.languageCode = interfaceLocale.split('-')[0] || 'en';
      if (action === 'login') { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword('');setAccountOpen(false); }
      if (action === 'signup') {
        const created = await createUserWithEmailAndPassword(auth, email.trim(), password); setPassword('');
        try { await sendEmailVerification(created.user); setAuthStatus(t.sent); }
        catch (error) { setAuthStatus(m("Your account was created, but the verification email was not sent. Use the verification email button to try again.")); throw error; }
      }
      if (action === 'reset') { await sendPasswordResetEmail(auth, email.trim()); setAuthStatus(t.sent); }
      if (action === 'resend' && auth.currentUser) { await sendEmailVerification(auth.currentUser); setAuthStatus(t.sent); }
      if (action === 'verify' && auth.currentUser) { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); setVerified(auth.currentUser.emailVerified); setAuthStatus(auth.currentUser.emailVerified ? t.idle : t.verify); }
    } catch (error) {
      const failure = authFailure(error);
      const message = !firebaseConfigured ? t.unavailable : failure.kind === 'setup'
        ? m("Sign-in is unavailable because account setup is incomplete. Please contact the site owner.")
        : failure.kind === 'retry' ? m("Sign-in could not finish. Check your connection and wait a moment before trying again.") : t.accountHelp;
      setAuthError(message);
    }
    finally { setAuthBusy(false); }
  }
  function cancelCapture(){
    captureLifetime.current?.abort();captureLifetime.current=null;
    if(capturePending.current){capturePending.current.abort();capturePending.current=null;stop();setCapturing(false);}
  }
  async function captureAndSend(spoken?:{text:string;signal:AbortSignal}):Promise<{answer:Answer;sessionId:string}|undefined>{
    if(capturePending.current||pending.current||busy||mediaBusy)return;
    const controller=new AbortController();capturePending.current=controller;
    captureLifetime.current?.abort();captureLifetime.current=controller;
    const signal=AbortSignal.any([controller.signal,...(spoken?[spoken.signal]:[])]);
    setCapturing(true);setCaptureRetry(true);setError('');setCanRetry(false);
    try{
      const fresh=await contextReview.current!.takeFresh(signal);signal.throwIfAborted();
      const result=await send(spoken,fresh,signal);signal.throwIfAborted();
      if(result&&!spoken)void voice.answer(result,signal);
      return result;
    }catch(error){if(!signal.aborted){setError(captureWords(interfaceLocale).failed);setCanRetry(true);}}
    finally{if(capturePending.current===controller){capturePending.current=null;setCapturing(false);}}
  }
  async function send(spoken?: {text:string;signal:AbortSignal}, approvedSource?:Source, captureSignal?:AbortSignal): Promise<{answer:Answer;sessionId:string}|undefined> {
    if(!approvedSource && contextState.kind==='desktop' && contextState.captureMode==='instant')return captureAndSend(spoken);
    const submittedQuestion=(spoken?.text ?? question).trim();
    const screenOverview=Boolean(approvedSource?.approvedImage && !submittedQuestion);
    if(spoken) {setQuestion(spoken.text);setInputMode('voice');}
    if (pending.current || busy || mediaBusy || (capturePending.current&&!approvedSource)) return;
    setError(''); setCanRetry(false);setCaptureRetry(Boolean(approvedSource?.screenConsent)); setEnded(false); setStarted(true);
    if (!submittedQuestion && !screenOverview) { setError(m('Type a question first. Your message has not been sent.')); composer.current?.focus(); return; }
    if (!user || !verified) { setError(!user ? m('Sign in before sending. Your question stays here.') : t.verify); setAccountOpen(true); requestAnimationFrame(() => authPanel.current?.querySelector<HTMLElement>('input, button')?.focus()); return; }
    if ((!spoken && !consent && !approvedSource) || containsSensitiveText(submittedQuestion)) { setError(t.consentError); consentInput.current?.focus(); return; }
    if (!approvedSource && contextState.kind !== 'none' && !contextState.approved) { setError(m('Approve the exact image or safe labels, or remove the source to ask without a screen.')); reviewContext(); if(spoken)throw new RequestError('CONTEXT_REVIEW_REQUIRED'); return; }
    if (!screenOverview && task === 'draft-text' && !draftLocale) { setError(t.chooseDraft); return; }
    const marker = ++generation.current;
    const request = { id: crypto.randomUUID(), abort: new AbortController() }; pending.current = request;
    const signal = AbortSignal.any([request.abort.signal, AbortSignal.timeout(100_000), ...(spoken?[spoken.signal]:[]),...(captureSignal?[captureSignal]:[])]);
    setBusy(true); setStatus(t.working);
    try {
      const id = await ensureSession(signal);
      const freshSource = approvedSource || await contextReview.current?.fresh(source) || null;
      const result = await api<Answer>(`/sessions/${id}/turns`, 'POST', { requestId: request.id, question: submittedQuestion, screenOverview, inputLocale, replyLocale, draftLocale: !screenOverview && task === 'draft-text' ? draftLocale : null, taskKind: screenOverview?'general-help':task, inputMode: spoken?'voice':inputMode, source: freshSource, nonSensitiveConfirmed: true }, signal);
      if (generation.current !== marker || result.requestId !== request.id || result.sourceVersion !== (freshSource?.version ?? null)) return;
      setAnswer(result); setMessages(previous => [...previous, { question: submittedQuestion||captureWords(inputLocale).question, locale: inputLocale, answer: result }].slice(-6)); setQuestion(''); setConsent(false); setInputMode('text'); setStatus(m('Answer ready.')); setExpiresAt(Date.now() + 900_000);
      requestAnimationFrame(() => {
        const log = conversationLog.current, latest = log?.lastElementChild;
        if (log && latest && log.scrollHeight-log.scrollTop-log.clientHeight<180) log.scrollTo({ top: latest.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop });
      });
      return {answer:result,sessionId:id};
    } catch (err) {
      if (generation.current !== marker) {if(spoken)throw err;return;}
      const code = err instanceof RequestError ? err.code : err instanceof Error ? err.message : '';
      if (code === 'SESSION_CLOSED') { session.current = null; setExpiresAt(0); }
      if (['AUTH_REQUIRED', 'AUTH_INVALID', 'EMAIL_UNVERIFIED'].includes(code)) setAccountOpen(true);
      if (['CONTEXT_STALE', 'CONTEXT_REVIEW_REQUIRED'].includes(code)) reviewContext();
      setError(code === 'TRANSLATION_UNAVAILABLE' ? m('Translation is unavailable. Choose English for question, assistance and draft to use image analysis now.') : code === 'SERVICE_UNAVAILABLE' ? m('Assistance is temporarily unavailable. Your question is kept here. Try again later or contact the site owner.')
        : ['PROVIDER_BUSY', 'QUOTA_EXCEEDED', 'TURN_IN_PROGRESS'].includes(code) ? m('The service is busy. Your question is kept here. Wait a moment, then choose Retry.')
        : ['CONTEXT_STALE', 'CONTEXT_REVIEW_REQUIRED'].includes(code) ? m('The source needs another review. Your question is kept here.')
        : code === 'PRIVACY_REVIEW_REQUIRED' ? t.consentError : t.error);
      setCanRetry(true); setStatus(''); if(spoken)throw err;
    } finally { if (generation.current === marker) { pending.current = null; setBusy(false); } }
  }
  async function end(logout = false) {
    cancelCapture();
    voice.end(); stop(); const id = session.current;
    contextReview.current?.clear();
    session.current = null; setExpiresAt(0); setAnswer(null); setMessages([]); setQuestion(''); setConsent(false); setSource(null); setResetKey(k => k + 1); setError(''); setAuthError(''); setAuthStatus(''); setStatus(''); setEnded(true); setOpen(false);
    if (id) { try { await api(`/sessions/${id}/end`, 'POST'); } catch (err) { if (!(err instanceof RequestError && err.code === 'SESSION_CLOSED')) setError(t.error); } }
    if (logout && firebaseConfigured) { try { await signOut(firebaseAuth()); setEmail(''); } catch { setError(t.error); } }
  }
  function closeChat() { setVoiceEpoch(value => value + 1); setOpen(false); suppressReveal.current = true; launcher.current?.focus(); }
  function focusComposer() { setOpen(true); setEnded(false); requestAnimationFrame(() => composer.current?.focus()); }
  function reviewContext() { setContextOpen(true);floatingPanel.current?.review();requestAnimationFrame(() => document.getElementById('context-title')?.focus()); }
  function chooseStart(kind: 'text' | 'screen' | 'image') { setEnded(false); setStarted(true); if (kind === 'text') focusComposer(); else { setContextOpen(true); if (kind === 'screen') contextReview.current?.share(); else contextReview.current?.chooseFile(); requestAnimationFrame(() => document.getElementById('source-panel')?.scrollIntoView({ block: 'nearest' })); } }
  function example(kind: Turn['taskKind'], text: string) { stop(); setTask(kind); if (kind === 'draft-text' && !draftLocale) setDraftLocale('en-IN'); if (!question.trim()) { setQuestion(words(inputLocale)(text)); setConsent(false); } focusComposer(); }
  const sourceName = contextState.kind === 'none' ? m('No screen context') : contextState.kind === 'screenshot' ? m('Uploaded screenshot') : contextState.kind === 'description' ? m('Text description') : contextState.surface === 'browser' ? m('Shared tab') : contextState.surface === 'window' ? m('Shared window') : contextState.surface === 'monitor' ? m('Shared display') : m('Shared screen');
  const helpTopic = contextOpen ? 'source' : !user ? 'account' : !consent && question.trim() ? 'privacy' : 'chat';
  const helpText = helpTopic === 'source' ? captureWords(interfaceLocale).consent : helpTopic === 'account' ? m('You can prepare a question first. Sign in or create an account when you are ready to send it.') : helpTopic === 'privacy' ? m('Leave out names, passwords and personal details. Confirm the privacy checkbox before each message.') : m('Type your question and choose Send, or press Enter. Shift+Enter adds a new line. You can stop a reply or retry without losing your draft.');
  return <WordsProvider locale={interfaceLocale}><div className={large ? 'app large' : 'app'}>
    <a className="skip" href="#main">{m('Skip to content')}</a>
    <header className="topbar"><a href="#main" className="brand"><span className="brand-mark" aria-hidden="true">d<span>·</span></span><span>Digital Assistant<small>{m('ONE STEP AT A TIME')}</small></span></a><nav aria-label={d.settings}><button type="button" className="nav-button" onClick={()=>setSettingsOpen(true)}>{d.language}</button>{onboarded&&<><button type="button" className="nav-button" onClick={()=>setSettingsOpen(true)}>{d.accessibility}</button>{user&&<button type="button" className="nav-button" onClick={()=>setSecondary('history')}>{d.history}</button>}</>}<button type="button" className="nav-button" onClick={()=>setSecondary('help')}>{d.help}</button><button type="button" className="secondary" onClick={()=>setAccountOpen(true)}>{user?d.account:t.signIn}</button>{onboarded&&!ended&&<button type="button" className="stop" onClick={()=>void end()}>{m('End assistance')}</button>}</nav></header>
    <Dialog open={settingsOpen} title={d.language+' · '+d.accessibility} closeLabel={d.close} onClose={()=>setSettingsOpen(false)}>        <section className="card preferences" id="preferences" aria-label={m('Language and comfort')}>
          <div className="two-columns"><LanguageSelect label={t.reply} value={replyLocale} onChange={locale => { voice.pause();if (pending.current) stop(); setReplyLocale(locale);setInputLocale(locale);setInterfaceLocale(locale); }}/><LanguageSelect label={t.interface} value={interfaceLocale} onChange={setInterfaceLocale}/></div>
          <p className="hint">{m('Language changes apply to your next answer. Earlier messages and your draft stay here.')}</p>
          <div className="preference-grid"><label className="check"><input type="checkbox" checked={large} onChange={e => setLarge(e.target.checked)}/>{t.larger}</label><label className="check"><input type="checkbox" checked={reader} onChange={e => setReader(e.target.checked)}/>{t.useReader}</label><label className="check"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)}/>{m('Save new sessions for 30 days (optional)')}</label><label className="check"><input type="checkbox" checked={audio} onChange={e => setAudio(e.target.checked)}/>{m('Enable answer audio')}</label></div>
          <label>{m('Speech speed')}<select value={rate} onChange={e => setRate(Number(e.target.value))}><option value={0.75}>{m('Slower')}</option><option value={1}>{m('Normal')}</option><option value={1.25}>{m('Faster')}</option></select></label>
          <p className="hint">{m('Changing saving applies to the next session.')}{' '}{m('Saved sessions keep only their latest 50 turns.')}</p>
          <label className="check"><input type="checkbox" checked={shortcut} onChange={e => setShortcut(e.target.checked)}/>{m('Alt+Shift+C (this page only)')}</label>
        </section>
</Dialog>
    <Dialog open={accountOpen} title={user?d.account:t.signIn} closeLabel={d.close} onClose={()=>setAccountOpen(false)}><div ref={authPanel} className="auth-card">              {!user ? <><p>{m('Your account keeps assistance private. Your questions are not saved as history.')}</p>{!firebaseConfigured && <p className="notice">{t.unavailable}</p>}<form onSubmit={e => { e.preventDefault(); void account('login'); }}><div className="two-columns"><label>{t.email}<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>{t.password}<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/></label></div><div className="actions"><button type="submit" className="primary" disabled={authBusy || !firebaseConfigured}>{t.signIn}</button><button type="button" className="secondary" disabled={authBusy || !firebaseConfigured} onClick={e => { if (e.currentTarget.form?.reportValidity()) void account('signup'); }}>{t.signUp}</button><button type="button" className="text-button" disabled={authBusy || !firebaseConfigured || !email} onClick={() => void account('reset')}>{t.reset}</button></div></form></>
              : <>{!verified && <div className="actions"><button type="button" className="secondary" disabled={authBusy} onClick={() => void account('resend')}>{t.resend}</button><button type="button" className="primary" disabled={authBusy} onClick={() => void account('verify')}>{t.checked}</button></div>}<div className="account-actions"><button type="button" className="secondary" onClick={()=>{setAccountOpen(false);setSecondary('account');}}>{d.account} · {d.settings}</button><button type="button" className="text-button" onClick={() => {setAccountOpen(false);void end(true);}}>{t.signOut}</button></div></>}
              <div id="auth-feedback" aria-busy={authBusy}><p role="status" aria-live="polite" aria-atomic="true">{authStatus}</p>{authError && <p className="error" role="alert">{authError}</p>}</div>
            </div>
</Dialog>
    <Dialog open={secondary!==null} title={secondary?d[secondary]:d.help} closeLabel={d.close} onClose={()=>setSecondary(null)}>{secondary==='help'?<><p>{helpText}</p><p>{workspaceWords(interfaceLocale).occlusion}</p><p>{workspaceWords(interfaceLocale).echo}</p></>:user&&secondary&&<AccountTools mode={secondary} sessionId={session.current} locale={interfaceLocale} onDeleted={()=>{setSecondary(null);void end();}}/>}</Dialog>
    <main id="main">
      {!onboarded ? <div className="onboarding">
        <section className="intro"><span className="eyebrow">{m('YOUR LANGUAGE. YOUR PACE.')}</span><h1>{d.hero}</h1><p className="lead">{t.intro}</p><AssistantVisual/><p className="boundary">{m('You stay in control. You make the clicks, check your details, and decide what to send.')}</p></section>
        <section className="card language-card"><h2>{t.choose}</h2><div className="language-grid" role="radiogroup" aria-label={t.choose}>{locales.map(locale=><button type="button" role="radio" aria-checked={replyLocale===locale} className={replyLocale===locale?'language selected':'language'} key={locale} lang={locale} onClick={()=>activateLanguage(locale)} onKeyDown={event=>{if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const choices=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('button'));const index=choices.indexOf(event.currentTarget);choices[(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:choices.length-1))%choices.length]?.focus();}}}>{languageNames[locale]}</button>)}</div><p className="hint" lang={replyLocale}>{voiceCopy[replyLocale].consent}</p><button type="button" className="primary wide" onClick={() => { setOnboarded(true); setStatus(''); }}>{t.continue}<span aria-hidden="true"> →</span></button><p className="hint">{m('You can change these choices at any time. A microphone is never required.')}</p></section>
      </div> : <div className={`journey ${ended?'session-ended':''}`}>
        <div className="journey-heading"><div><span className="eyebrow">{m('YOUR SPACE')}</span><h1>{ended?m('Assistance ended'):d.welcome}</h1><p>{ended?m('Screen sharing and recording have stopped. Start a new question whenever you are ready.'):d.choose}</p></div>{ended&&<div className="actions"><button type="button" className="primary" onClick={()=>{setEnded(false);setStarted(false);focusComposer();}}>{d.again}</button>{user&&<button type="button" className="text-button" onClick={()=>setSecondary('feedback')}>{d.feedback}</button>}</div>}</div>
        <section className="start-disclosure" hidden={ended || contextState.kind!=='none'}><div className="start-options" aria-label={m('Ways to start')}>
          <button type="button" className="start-option" onClick={() => chooseStart('screen')}><strong>{m('Share screen')}</strong><span>{m('Choose a tab or window in a supported desktop browser.')}</span></button>
          <button type="button" className="start-option" onClick={() => chooseStart('image')}><strong>{m('Upload screenshot')}</strong><span>{m('Choose an image to preview and review before AI analysis.')}</span></button>
          <button type="button" className="start-option" onClick={() => chooseStart('text')}><strong>{m('Ask a question')}</strong><span>{m('Type or speak. No screen is required.')}</span></button>
        </div></section>
        <div className="journey-grid" hidden={ended}>
          <div className="conversation-column">
            {serviceReady === false && <p className="notice">{m('Assistance is temporarily unavailable. Your question is kept here. Try again later or contact the site owner.')}</p>}
            <FloatingPanel ref={floatingPanel} review={<SafeContext ref={contextReview} compact question={question} onApproveAnswer={async approved=>{const result=await send(undefined,approved);if(result)await voice.answer(result);}} screenAllowed={screenAllowed} screenMessage={!user?m('Sign in before sending. Your question stays here.'):!verified?t.verify:serviceReady===null?t.working:serviceReady===false?m('Assistance is temporarily unavailable. Your question is kept here. Try again later or contact the site owner.'):undefined} busy={capturing||busy} onCapture={()=>void captureAndSend()} onRevoke={cancelCapture} onExplainConsent={()=>{void voice.explainConsent();}} onShared={()=>floatingPanel.current?.afterShare()} onExplainShare={()=>{void voice.explainConsent('share');}} t={t} onChange={changeSource} onState={setContextState} resetKey={resetKey}/>} needsReview={contextState.kind!=='none'&&!contextState.approved} question={question} error={error} caption={voice.caption} recovery={captureRetry&&canRetry?<button type="button" className="secondary" disabled={capturing||busy} onClick={()=>void captureAndSend()}>{captureWords(interfaceLocale).retry}</button>:null} ended={ended} onStopSpeaking={voice.stopSpeaking} voiceState={voice.state} onPause={()=>{if(['idle','paused','error'].includes(voice.state))void voice.resume();else voice.pause();}} onEnd={()=>void end()} sourceStatus={sourceName} onShare={()=>chooseStart('screen')} onCloseChat={()=>setOpen(false)} controls={<><button type="button" ref={launcher} className="secondary" aria-expanded={open} aria-controls="chat"  onClick={focusComposer}>{t.open}</button><label className="check"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}/>{t.pin}</label></>} open={open} locale={interfaceLocale} large={large} onOpen={() => setOpen(true)} onClosedReturn={()=>{}}>
              <section className="card chat" id="chat" hidden={!open} aria-labelledby="chat-title" onKeyDown={e => { if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); closeChat(); } }}>
                <div className="section-heading"><h2 id="chat-title">{m('Your conversation')}</h2><button className="text-button" type="button" onClick={closeChat}>{t.close}</button></div>
                <VoiceAssistant voice={voice} locale={replyLocale} onEnd={()=>void end()}/><div className="conversation-log" ref={conversationLog} tabIndex={messages.length ? 0 : undefined} role="region" aria-label={m('Conversation messages')}>
                  {!messages.length && <div className="empty-conversation"><p>{m('Ask one question at a time. I can explain an instruction or help prepare a draft. You decide what to do.')}</p><details className="examples"><summary>{m('Try an example')}</summary><div className="example-list"><button type="button" className="example" onClick={() => example('general-help', 'Help me understand a form.')}>{m('Understand a form')}</button><button type="button" className="example" onClick={() => example('guide-task', 'Help me find a feature on a website.')}>{m('Find a website feature')}</button><button type="button" className="example" onClick={() => example('draft-text', 'Draft an email asking for public instructions.')}>{m('Draft an email')}</button></div></details></div>}
                  {messages.map((item, index) => <article key={item.answer.requestId} className="conversation-turn"><p className="question-bubble" lang={item.locale} dir={item.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{item.question}</p><div className="answer">{item.interrupted&&<p role="status">{workspaceWords(interfaceLocale).interrupted}</p>}<h3>{item.answer.status === 'answer' ? m('One step to try') : m('More information is needed')}</h3><p lang={item.answer.explanation.locale} dir={item.answer.explanation.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{item.answer.explanation.text}</p>{item.answer.referencedLabels.length > 0 && <ul>{item.answer.referencedLabels.map(label => <li key={label.id}><bdi>{label.text}</bdi></li>)}</ul>}{item.answer.draft && <><h3>{t.draft}</h3><pre lang={item.answer.draft.locale} dir={item.answer.draft.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{item.answer.draft.text}</pre><button type="button" className="secondary" onClick={() => { void navigator.clipboard.writeText(item.answer.draft!.text).then(() => setStatus(t.copied)).catch(() => setError(t.error)); }}>{t.copy}</button></>}<p className="hint">{item.answer.evidence.some(e => e.kind === 'approved-image') && m('This answer uses your approved image snapshot, not a live screen.')}{' '}{m('No external action has been performed.')}{' '}{item.answer.sourceVersion !== null && m('Review your current screen before following earlier guidance.')}</p>
                    {index === messages.length - 1 && <>{item.answer.status === 'answer' && <button type="button" className="secondary" disabled={busy || Boolean(question.trim())} onClick={() => { setQuestion(words(inputLocale)('I have done the previous step. What should I do next?')); setConsent(false); setStatus(m('Review this follow-up, then send it when ready.')); focusComposer(); }}>{m('I’ve done this')}</button>}{session.current && <AnswerAudio answer={item.answer} sessionId={session.current} enabled={audio && !reader && open && !voice.active} rate={rate} onEnable={reader ? undefined : () => setAudio(true)}/>}</>}
                  </div></article>)}
                </div>
                <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}>
                  <label htmlFor="question">{t.question}</label><textarea ref={composer} id="question" rows={3} maxLength={2000} value={question} lang={inputLocale} dir={inputLocale === 'ur-IN' ? 'rtl' : 'ltr'} aria-describedby="composer-help privacy-help" enterKeyHint="send" onChange={e => { if(voice.active)voice.pause(); if(capturePending.current)cancelCapture();else if (pending.current) stop(); setInputMode('text'); setQuestion(e.target.value); setConsent(false); setCanRetry(false); setError(''); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); if (!e.repeat) void send(); } }}/>
                  <div className="composer-hints" id="composer-help"><span>{m('Enter: send · Shift+Enter: new line')}</span><span>{question.length}/2000</span></div>
                  <label className="check" id="privacy-help"><input ref={consentInput} type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>{t.safe}</label>
                  {!user ? <p className="hint">{m('Sign in before sending. Your question stays here.')}</p> : !verified ? <p className="hint">{t.verify}</p> : null}
                  <div className="actions"><button type="submit" className="primary" disabled={busy || mediaBusy}>{busy ? t.working : t.send}</button>{busy && <button type="button" className="stop" onClick={stop}>{t.stop}</button>}{canRetry && <button type="button" className="secondary" disabled={busy || mediaBusy} onClick={()=>{if(captureRetry)void captureAndSend();else void send();}}>{captureRetry?captureWords(interfaceLocale).retry:source?.approvedImage?captureWords(interfaceLocale).reviewRetry:m('Retry')}</button>}</div>
                  <div className="status-area"><p role="status" aria-live="polite" aria-atomic="true">{status}</p>{error && <p className="error" role="alert">{error}</p>}</div>
                </form>
                <details className="task-options"><summary>{m('Question and draft languages')}</summary><fieldset className="task-grid"><legend>{t.task}</legend>{(['general-help', 'guide-task', 'draft-text'] as const).map(kind => <label className={task === kind ? 'task selected' : 'task'} key={kind}><input type="radio" name="task" checked={task === kind} onChange={() => { if (pending.current) stop(); setTask(kind); }}/><strong>{kind === 'general-help' ? t.general : kind === 'guide-task' ? t.guide : t.emailTask}</strong></label>)}</fieldset><div className="two-columns"><LanguageSelect label={t.input} value={inputLocale} onChange={locale => { if (pending.current) stop(); setInputLocale(locale); }}/><LanguageSelect label={t.draft} value={draftLocale} empty onChange={locale => { if (pending.current) stop(); setDraftLocale(locale); }}/></div></details>
                <VoiceInput allowed={Boolean(user && verified && !busy && open && !voice.active)} cloudAllowed={cloudAllowed} locale={inputLocale} ensureSession={ensureSession} onBusy={setMediaBusy} resetKey={resetKey + voiceEpoch} onTranscript={text => { stop(); setInputMode('voice'); setQuestion(previous => previous.trim() ? (previous + '\n' + text).slice(0, 2000) : text); setConsent(false); setStatus(m('Review and correct the transcript, then confirm it is safe before sending.')); focusComposer(); }}/>
              </section>
            </FloatingPanel>
            {idleWarning && <p className="notice" role="status">{m('This session expires after 15 minutes without an answer. Your typed draft stays here; sending after expiry starts a new session.')}</p>}

          </div>

        </div>
      </div>}
    {!onboarded&&<section className="feature-strip"><article><b>01</b><h2>{d.voice}</h2><p>{m('YOUR LANGUAGE. YOUR PACE.')}</p></article><article><b>02</b><h2>{d.visual}</h2><p>{m('You’re always in charge.')}</p></article><article><b>03</b><h2>{d.typing}</h2><p>{m('Type or speak. No screen is required.')}</p></article></section>}</main><footer className="footer"><span>{m('Made for a more accessible everyday.')}</span><span>{locales.map(locale=>languageNames[locale]).join(' / ')}</span></footer>
  </div></WordsProvider>;
}
