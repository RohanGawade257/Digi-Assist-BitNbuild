'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { containsSensitiveText, languageNames, locales, type Answer, type Locale, type Source, type Turn, type Preferences } from '@guide/contracts';
import { catalogs } from '../lib/locales';
import { ephemeralAuth, firebaseAuth, firebaseConfigured } from '../lib/firebase';
import { authFailure } from '../lib/auth-errors';
import { api, RequestError } from '../lib/api';
import { SafeContext, type ContextState, type ReviewHandle } from '../components/SafeContext';
import { AnswerAudio, VoiceInput } from '../components/SpeechControls';
import { AccountTools } from '../components/AccountTools';
import { FloatingPanel } from '../components/FloatingPanel';
import { WordsProvider, words } from '../lib/messages';
import { ContextHelp } from '../components/ContextHelp';
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
  const m = words(interfaceLocale), uiLocale = interfaceLocale;
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
  const [messages, setMessages] = useState<{ question: string; locale: Locale; answer: Answer }[]>([]);
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
  const session = useRef<string | null>(null);
  const pending = useRef<{ id: string; abort: AbortController } | null>(null);
  const generation = useRef(0); const composer = useRef<HTMLTextAreaElement>(null); const launcher = useRef<HTMLButtonElement>(null);
  const suppressReveal = useRef(false);
  const conversationLog = useRef<HTMLDivElement>(null), consentInput = useRef<HTMLInputElement>(null), authPanel = useRef<HTMLDetailsElement>(null);
  const t = catalogs[interfaceLocale];
  const voice = useVoiceAssistant({locale:replyLocale,allowed:Boolean(user && verified),cloudAllowed,ensureSession,
    question:(text,signal)=>send({text,signal}),needLogin:()=>setAccountOpen(true),
    command:async command=>{if(command==='end')await end();else if(command==='stop-sharing')contextReview.current?.clear();else if(command==='approve-image')await contextReview.current?.approveByVoice();}
  });
  function activateLanguage(locale:Locale) { setReplyLocale(locale);setInputLocale(locale);setInterfaceLocale(locale);setOnboarded(true);setOpen(true);setPinned(true);setAudio(true);void voice.start(locale); }

  useEffect(() => { document.documentElement.lang = interfaceLocale; document.documentElement.dir = interfaceLocale === 'ur-IN' ? 'rtl' : 'ltr'; }, [interfaceLocale]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), next => { setUser(next); setVerified(next?.emailVerified || false); if (!next) { generation.current++; pending.current?.abort.abort(); pending.current = null; session.current = null; setAnswer(null); setMessages([]); setSource(null); setResetKey(k => k + 1); setPassword(''); setBusy(false); } });
    return unsubscribe;
  }, []);
  useEffect(() => {
    setPrefsReady(false); setCloudAllowed(false); setServiceReady(null);
    if (!user) { setHistory(false); setAudio(false); return; }
    const controller = new AbortController();
    void Promise.all([api<Preferences>('/me', 'GET', undefined, controller.signal), api<{ typed: { configured: boolean }; speech: { cloudInputAllowed: boolean; configured: boolean } }>('/capabilities', 'GET', undefined, controller.signal)]).then(([prefs, caps]) => {
      if (controller.signal.aborted) return;
      // Explicit language choices made before login take precedence over stored defaults.
      setLarge(prefs.textScale > 1); setReader(prefs.screenReaderMode); setHistory(prefs.saveHistory); setAudio(prefs.audioEnabled); setRate(prefs.speechRate); setPinned(prefs.chatPinned); setShortcut(prefs.chatShortcutEnabled); setCloudAllowed(caps.speech.cloudInputAllowed && caps.speech.configured); setServiceReady(caps.typed?.configured ?? null); setPrefsReady(true);
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
      if (action === 'login') { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword(''); }
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
  async function send(spoken?: {text:string;signal:AbortSignal}): Promise<{answer:Answer;sessionId:string}|undefined> {
    const submittedQuestion=(spoken?.text ?? question).trim();
    if(spoken) {setQuestion(spoken.text);setInputMode('voice');}
    if (pending.current || busy || mediaBusy) return;
    setError(''); setCanRetry(false); setEnded(false); setStarted(true);
    if (!submittedQuestion) { setError(m('Type a question first. Your message has not been sent.')); composer.current?.focus(); return; }
    if (!user || !verified) { setError(!user ? m('Sign in before sending. Your question stays here.') : t.verify); setAccountOpen(true); requestAnimationFrame(() => authPanel.current?.querySelector<HTMLElement>('input, button')?.focus()); return; }
    if ((!spoken && !consent) || containsSensitiveText(submittedQuestion)) { setError(t.consentError); consentInput.current?.focus(); return; }
    if (contextState.kind !== 'none' && !contextState.approved) { setError(m('Approve the exact image or safe labels, or remove the source to ask without a screen.')); reviewContext(); if(spoken)throw new RequestError('CONTEXT_REVIEW_REQUIRED'); return; }
    if (task === 'draft-text' && !draftLocale) { setError(t.chooseDraft); return; }
    const marker = ++generation.current;
    const request = { id: crypto.randomUUID(), abort: new AbortController() }; pending.current = request;
    const signal = AbortSignal.any([request.abort.signal, AbortSignal.timeout(100_000), ...(spoken?[spoken.signal]:[])]);
    setBusy(true); setStatus(t.working);
    try {
      const id = await ensureSession(signal);
      const freshSource = await contextReview.current?.fresh(source) ?? null;
      const result = await api<Answer>(`/sessions/${id}/turns`, 'POST', { requestId: request.id, question: submittedQuestion, inputLocale, replyLocale, draftLocale: task === 'draft-text' ? draftLocale : null, taskKind: task, inputMode: spoken?'voice':inputMode, source: freshSource, nonSensitiveConfirmed: true }, signal);
      if (generation.current !== marker || result.requestId !== request.id || result.sourceVersion !== (source?.version ?? null)) return;
      setAnswer(result); setMessages(previous => [...previous, { question: submittedQuestion, locale: inputLocale, answer: result }].slice(-6)); setQuestion(''); setConsent(false); setInputMode('text'); setStatus(m('Answer ready.')); setExpiresAt(Date.now() + 900_000);
      requestAnimationFrame(() => {
        const log = conversationLog.current, latest = log?.lastElementChild;
        if (log && latest) log.scrollTo({ top: latest.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop });
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
    voice.end(); stop(); const id = session.current;
    contextReview.current?.clear();
    session.current = null; setExpiresAt(0); setAnswer(null); setMessages([]); setQuestion(''); setConsent(false); setSource(null); setResetKey(k => k + 1); setError(''); setAuthError(''); setAuthStatus(''); setStatus(''); setEnded(true); setOpen(true);
    if (id) { try { await api(`/sessions/${id}/end`, 'POST'); } catch (err) { if (!(err instanceof RequestError && err.code === 'SESSION_CLOSED')) setError(t.error); } }
    if (logout && firebaseConfigured) { try { await signOut(firebaseAuth()); setEmail(''); } catch { setError(t.error); } }
  }
  function closeChat() { setVoiceEpoch(value => value + 1); setOpen(false); suppressReveal.current = true; launcher.current?.focus(); }
  function focusComposer() { setOpen(true); setEnded(false); requestAnimationFrame(() => composer.current?.focus()); }
  function reviewContext() { setContextOpen(true); requestAnimationFrame(() => document.getElementById('context-title')?.focus()); }
  function chooseStart(kind: 'text' | 'screen' | 'image') { setEnded(false); setStarted(true); if (kind === 'text') focusComposer(); else { setContextOpen(true); if (kind === 'screen') contextReview.current?.share(); else contextReview.current?.chooseFile(); requestAnimationFrame(() => document.getElementById('source-panel')?.scrollIntoView({ block: 'nearest' })); } }
  function example(kind: Turn['taskKind'], text: string) { stop(); setTask(kind); if (kind === 'draft-text' && !draftLocale) setDraftLocale('en-IN'); if (!question.trim()) { setQuestion(words(inputLocale)(text)); setConsent(false); } focusComposer(); }
  const sourceName = contextState.kind === 'none' ? m('No screen context') : contextState.kind === 'screenshot' ? m('Uploaded screenshot') : contextState.kind === 'description' ? m('Text description') : contextState.surface === 'browser' ? m('Shared tab') : contextState.surface === 'window' ? m('Shared window') : contextState.surface === 'monitor' ? m('Shared display') : m('Shared screen');
  const helpTopic = contextOpen ? 'source' : !user ? 'account' : !consent && question.trim() ? 'privacy' : 'chat';
  const helpText = helpTopic === 'source' ? m('Review a cropped or masked image before sending it to Gemini, or choose labels only. Nothing is sent until you ask a question.') : helpTopic === 'account' ? m('You can prepare a question first. Sign in or create an account when you are ready to send it.') : helpTopic === 'privacy' ? m('Leave out names, passwords and personal details. Confirm the privacy checkbox before each message.') : m('Type your question and choose Send, or press Enter. Shift+Enter adds a new line. You can stop a reply or retry without losing your draft.');
  return <WordsProvider locale={interfaceLocale}><div className={large ? 'app large' : 'app'}>
    <a className="skip" href="#main">{m('Skip to content')}</a>
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">d<span>·</span></span><span>Digital Assistant<small>{m('ONE STEP AT A TIME')}</small></span></div><span className="header-note">{m('You’re always in charge.')}</span>{onboarded && <button type="button" className="stop" onClick={() => void end()}>{m('End assistance')}</button>}</header>
    <main id="main">
      {!onboarded ? <div className="onboarding">
        <section className="intro"><span className="eyebrow">{m('YOUR LANGUAGE. YOUR PACE.')}</span><h1>{t.title}</h1><p className="lead">{t.intro}</p><div className="promise"><span className="promise-line">{m('Understand a confusing instruction')}</span><span className="promise-line">{m('Find your next step on a website')}</span><span className="promise-line">{m('Prepare an email you can review')}</span></div><p className="boundary">{m('You stay in control. You make the clicks, check your details, and decide what to send.')}</p></section>
        <section className="card language-card"><h2>{t.choose}</h2><div className="language-grid" role="radiogroup" aria-label={t.choose}>{locales.map(locale=><button type="button" role="radio" aria-checked={replyLocale===locale} className={replyLocale===locale?'language selected':'language'} key={locale} lang={locale} onClick={()=>activateLanguage(locale)} onKeyDown={event=>{if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const choices=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('button'));const index=choices.indexOf(event.currentTarget);choices[(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:choices.length-1))%choices.length]?.focus();}}}>{languageNames[locale]}</button>)}</div><p className="hint" lang={replyLocale}>{voiceCopy[replyLocale].consent}</p><button type="button" className="primary wide" onClick={() => { setOnboarded(true); setStatus(''); }}>{t.continue}<span aria-hidden="true"> →</span></button><p className="hint">{m('You can change these choices at any time. A microphone is never required.')}</p></section>
      </div> : <div className="journey">
        <div className="journey-heading"><div><span className="eyebrow">{m('YOUR SPACE')}</span><h1>{t.question}</h1><p>{m('Choose how to start. You can add a screen later.')}</p></div><button type="button" className="secondary" aria-expanded={settingsOpen} aria-controls="preferences" onClick={() => setSettingsOpen(value => !value)}>{m('Language and comfort')}</button></div>
        {settingsOpen && <section className="card preferences" id="preferences" aria-label={m('Language and comfort')}>
          <div className="two-columns"><LanguageSelect label={t.reply} value={replyLocale} onChange={locale => { voice.pause();if (pending.current) stop(); setReplyLocale(locale);setInputLocale(locale);setInterfaceLocale(locale); }}/><LanguageSelect label={t.interface} value={interfaceLocale} onChange={setInterfaceLocale}/></div>
          <p className="hint">{m('Language changes apply to your next answer. Earlier messages and your draft stay here.')}</p>
          <div className="preference-grid"><label className="check"><input type="checkbox" checked={large} onChange={e => setLarge(e.target.checked)}/>{t.larger}</label><label className="check"><input type="checkbox" checked={reader} onChange={e => setReader(e.target.checked)}/>{t.useReader}</label><label className="check"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)}/>{m('Save new sessions for 30 days (optional)')}</label><label className="check"><input type="checkbox" checked={audio} onChange={e => setAudio(e.target.checked)}/>{m('Enable answer audio')}</label></div>
          <label>{m('Speech speed')}<select value={rate} onChange={e => setRate(Number(e.target.value))}><option value={0.75}>{m('Slower')}</option><option value={1}>{m('Normal')}</option><option value={1.25}>{m('Faster')}</option></select></label>
          <p className="hint">{m('Changing saving applies to the next session.')}{' '}{m('Saved sessions keep only their latest 50 turns.')}</p>
          <label className="check"><input type="checkbox" checked={shortcut} onChange={e => setShortcut(e.target.checked)}/>{m('Alt+Shift+C (this page only)')}</label>
        </section>}
        <details className="start-disclosure" open={!started} onToggle={e => setStarted(!e.currentTarget.open)}><summary>{m('Ways to start')}</summary><div className="start-options" aria-label={m('Ways to start')}>
          <button type="button" className="start-option" onClick={() => chooseStart('screen')}><strong>{m('Share screen')}</strong><span>{m('Choose a tab or window in a supported desktop browser.')}</span></button>
          <button type="button" className="start-option" onClick={() => chooseStart('image')}><strong>{m('Upload screenshot')}</strong><span>{m('Choose an image to preview and review before AI analysis.')}</span></button>
          <button type="button" className="start-option" onClick={() => chooseStart('text')}><strong>{m('Ask a question')}</strong><span>{m('Type or speak. No screen is required.')}</span></button>
        </div></details>
        <div className="journey-grid">
          <div className="conversation-column">
            <div className="source-strip"><p><strong>{sourceName}</strong><span>{contextState.kind === 'none' ? m('Only your question will be sent.') : contextState.approved ? contextState.mode === 'approved-image' ? m('Approved image snapshot will be sent to Gemini with your question.') : m('Safe labels approved. Raw images stay on this device.') : m('Review required. Nothing from this source has been shared.')}</span></p><button type="button" className="text-button" aria-controls="source-panel" aria-expanded={contextOpen} onClick={reviewContext}>{contextState.kind === 'none' ? m('Add or review context') : m('Review source')}</button></div>
            <ContextHelp topic={helpTopic} text={helpText}/>
            <details ref={authPanel} className="card auth-card" open={accountOpen} onToggle={e => setAccountOpen(e.currentTarget.open)}><summary>{user ? verified ? m('Account and sign out') : t.verify : m('Sign in to send your question')}</summary>
              {!user ? <><h2 id="auth-title">{t.signIn}</h2><p>{m('Your account keeps assistance private. Your questions are not saved as history.')}</p>{!firebaseConfigured && <p className="notice">{t.unavailable}</p>}<form onSubmit={e => { e.preventDefault(); void account('login'); }}><div className="two-columns"><label>{t.email}<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>{t.password}<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/></label></div><div className="actions"><button type="submit" className="primary" disabled={authBusy || !firebaseConfigured}>{t.signIn}</button><button type="button" className="secondary" disabled={authBusy || !firebaseConfigured} onClick={e => { if (e.currentTarget.form?.reportValidity()) void account('signup'); }}>{t.signUp}</button><button type="button" className="text-button" disabled={authBusy || !firebaseConfigured || !email} onClick={() => void account('reset')}>{t.reset}</button></div></form></>
              : <>{!verified && <div className="actions"><button type="button" className="secondary" disabled={authBusy} onClick={() => void account('resend')}>{t.resend}</button><button type="button" className="primary" disabled={authBusy} onClick={() => void account('verify')}>{t.checked}</button></div>}<button type="button" className="text-button" onClick={() => void end(true)}>{t.signOut}</button></>}
              <div id="auth-feedback" aria-busy={authBusy}><p role="status" aria-live="polite" aria-atomic="true">{authStatus}</p>{authError && <p className="error" role="alert">{authError}</p>}</div>
            </details>
            {serviceReady === false && <p className="notice">{m('Assistance is temporarily unavailable. Your question is kept here. Try again later or contact the site owner.')}</p>}
            {ended && <section className="notice" role="status"><h2>{m('Assistance ended')}</h2><p>{m('Screen sharing and recording have stopped. Start a new question whenever you are ready.')}</p></section>}
            <FloatingPanel controls={<><button type="button" ref={launcher} className="secondary" aria-expanded={open} aria-controls="chat" onFocus={() => { if (suppressReveal.current) { suppressReveal.current = false; return; } setOpen(true); }} onClick={focusComposer}>{t.open}</button><label className="check"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}/>{t.pin}</label></>} open={open} locale={interfaceLocale} large={large} onOpen={() => setOpen(true)} onClosedReturn={() => { suppressReveal.current = true; launcher.current?.focus(); }}>
              <section className="card chat" id="chat" hidden={!open} aria-labelledby="chat-title" onBlur={e => { if (!pinned && !voice.active && !question && !messages.length && !busy && !mediaBusy && !error && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }} onKeyDown={e => { if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); closeChat(); } }}>
                <div className="section-heading"><h2 id="chat-title">{m('Your conversation')}</h2><button className="text-button" type="button" onClick={closeChat}>{t.close}</button></div>
                <VoiceAssistant voice={voice} locale={replyLocale} onEnd={()=>void end()}/><div className="conversation-log" ref={conversationLog} tabIndex={messages.length ? 0 : undefined} role="region" aria-label={m('Conversation messages')}>
                  {!messages.length && <div className="empty-conversation"><p>{m('Ask one question at a time. I can explain an instruction or help prepare a draft. You decide what to do.')}</p><details className="examples"><summary>{m('Try an example')}</summary><div className="example-list"><button type="button" className="example" onClick={() => example('general-help', 'Help me understand a form.')}>{m('Understand a form')}</button><button type="button" className="example" onClick={() => example('guide-task', 'Help me find a feature on a website.')}>{m('Find a website feature')}</button><button type="button" className="example" onClick={() => example('draft-text', 'Draft an email asking for public instructions.')}>{m('Draft an email')}</button></div></details></div>}
                  {messages.map((item, index) => <article key={item.answer.requestId} className="conversation-turn"><p className="question-bubble" lang={item.locale} dir={item.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{item.question}</p><div className="answer"><h3>{item.answer.status === 'answer' ? m('One step to try') : m('More information is needed')}</h3><p lang={item.answer.explanation.locale} dir={item.answer.explanation.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{item.answer.explanation.text}</p>{item.answer.referencedLabels.length > 0 && <ul>{item.answer.referencedLabels.map(label => <li key={label.id}><bdi>{label.text}</bdi></li>)}</ul>}{item.answer.draft && <><h3>{t.draft}</h3><pre lang={item.answer.draft.locale} dir={item.answer.draft.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{item.answer.draft.text}</pre><button type="button" className="secondary" onClick={() => { void navigator.clipboard.writeText(item.answer.draft!.text).then(() => setStatus(t.copied)).catch(() => setError(t.error)); }}>{t.copy}</button></>}<p className="hint">{item.answer.evidence.some(e => e.kind === 'approved-image') && m('This answer uses your approved image snapshot, not a live screen.')}{' '}{m('No external action has been performed.')}{' '}{item.answer.sourceVersion !== null && m('Review your current screen before following earlier guidance.')}</p>
                    {index === messages.length - 1 && <>{item.answer.status === 'answer' && <button type="button" className="secondary" disabled={busy || Boolean(question.trim())} onClick={() => { setQuestion(words(inputLocale)('I have done the previous step. What should I do next?')); setConsent(false); setStatus(m('Review this follow-up, then send it when ready.')); focusComposer(); }}>{m('I’ve done this')}</button>}{session.current && <AnswerAudio answer={item.answer} sessionId={session.current} enabled={audio && !reader && open && !voice.active} rate={rate} onEnable={reader ? undefined : () => setAudio(true)}/>}</>}
                  </div></article>)}
                </div>
                <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}>
                  <label htmlFor="question">{t.question}</label><textarea ref={composer} id="question" rows={3} maxLength={2000} value={question} lang={inputLocale} dir={inputLocale === 'ur-IN' ? 'rtl' : 'ltr'} aria-describedby="composer-help privacy-help" enterKeyHint="send" onChange={e => { if(voice.active)voice.pause(); if (pending.current) stop(); setInputMode('text'); setQuestion(e.target.value); setConsent(false); setCanRetry(false); setError(''); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); if (!e.repeat) void send(); } }}/>
                  <div className="composer-hints" id="composer-help"><span>{m('Enter: send · Shift+Enter: new line')}</span><span>{question.length}/2000</span></div>
                  <label className="check" id="privacy-help"><input ref={consentInput} type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>{t.safe}</label>
                  {!user ? <p className="hint">{m('Sign in before sending. Your question stays here.')}</p> : !verified ? <p className="hint">{t.verify}</p> : null}
                  <div className="actions"><button type="submit" className="primary" disabled={busy || mediaBusy}>{busy ? t.working : t.send}</button>{busy && <button type="button" className="stop" onClick={stop}>{t.stop}</button>}{canRetry && <button type="button" className="secondary" disabled={busy || mediaBusy} onClick={() => void send()}>{m('Retry')}</button>}</div>
                  <div className="status-area"><p role="status" aria-live="polite" aria-atomic="true">{status}</p>{error && <p className="error" role="alert">{error}</p>}</div>
                </form>
                <details className="task-options"><summary>{m('Question and draft languages')}</summary><fieldset className="task-grid"><legend>{t.task}</legend>{(['general-help', 'guide-task', 'draft-text'] as const).map(kind => <label className={task === kind ? 'task selected' : 'task'} key={kind}><input type="radio" name="task" checked={task === kind} onChange={() => { if (pending.current) stop(); setTask(kind); }}/><strong>{kind === 'general-help' ? t.general : kind === 'guide-task' ? t.guide : t.emailTask}</strong></label>)}</fieldset><div className="two-columns"><LanguageSelect label={t.input} value={inputLocale} onChange={locale => { if (pending.current) stop(); setInputLocale(locale); }}/><LanguageSelect label={t.draft} value={draftLocale} empty onChange={locale => { if (pending.current) stop(); setDraftLocale(locale); }}/></div></details>
                <VoiceInput allowed={Boolean(user && verified && !busy && open && !voice.active)} cloudAllowed={cloudAllowed} locale={inputLocale} ensureSession={ensureSession} onBusy={setMediaBusy} resetKey={resetKey + voiceEpoch} onTranscript={text => { stop(); setInputMode('voice'); setQuestion(previous => previous.trim() ? (previous + '\n' + text).slice(0, 2000) : text); setConsent(false); setStatus(m('Review and correct the transcript, then confirm it is safe before sending.')); focusComposer(); }}/>
              </section>
            </FloatingPanel>
            {idleWarning && <p className="notice" role="status">{m('This session expires after 15 minutes without an answer. Your typed draft stays here; sending after expiry starts a new session.')}</p>}
            {user && <AccountTools key={user.uid + ':' + resetKey} sessionId={session.current} locale={interfaceLocale} onDeleted={() => { void end(); }}/>}
          </div>
          <aside className="source-column"><details id="source-panel" open={contextOpen} onToggle={e => setContextOpen(e.currentTarget.open)}><summary>{m('Screen or text context')}<span className="hint">{sourceName}</span></summary><SafeContext ref={contextReview} onExplainShare={()=>{void voice.announce('share');}} t={t} onChange={changeSource} onState={setContextState} resetKey={resetKey}/></details><p className="hint">{m('Your screen is shared only when you choose it. Text input stays available during sharing.')}</p></aside>
        </div>
      </div>}
    </main><footer className="footer"><span>{m('Made for a more accessible everyday.')}</span><span>English · हिन्दी · বাংলা · मराठी · తెలుగు · தமிழ் · اردو</span></footer>
  </div></WordsProvider>;
}
