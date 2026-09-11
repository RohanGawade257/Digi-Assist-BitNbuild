'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { containsSensitiveText, languageNames, locales, type Answer, type Locale, type Source, type Turn } from '@guide/contracts';
import { catalogs } from '../lib/locales';
import { ephemeralAuth, firebaseAuth, firebaseConfigured } from '../lib/firebase';
import { api, RequestError } from '../lib/api';
import { SafeContext } from '../components/SafeContext';

function LanguageSelect({ label, value, onChange, empty = false }: { label: string; value: string; onChange: (v: Locale) => void; empty?: boolean }) {
  const id = useId();
  return <div><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value as Locale)}>{empty && <option value="">—</option>}{locales.map(l => <option key={l} value={l} lang={l}>{languageNames[l]}</option>)}</select></div>;
}
export default function Home() {
  const [replyLocale, setReplyLocale] = useState<Locale>('en-IN');
  const [interfaceLocale, setInterfaceLocale] = useState<Locale>('en-IN');
  const [inputLocale, setInputLocale] = useState<Locale>('en-IN');
  const [draftLocale, setDraftLocale] = useState<Locale | ''>('');
  const [onboarded, setOnboarded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [question, setQuestion] = useState(''); const [task, setTask] = useState<Turn['taskKind']>('general-help');
  const [consent, setConsent] = useState(false); const [source, setSource] = useState<Source | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const [open, setOpen] = useState(true); const [pinned, setPinned] = useState(false);
  const [large, setLarge] = useState(false); const [reader, setReader] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [shortcut, setShortcut] = useState(false);
  const session = useRef<string | null>(null);
  const pending = useRef<{ id: string; abort: AbortController } | null>(null);
  const generation = useRef(0); const composer = useRef<HTMLTextAreaElement>(null); const launcher = useRef<HTMLButtonElement>(null);
  const suppressReveal = useRef(false);
  const t = catalogs[interfaceLocale];
  useEffect(() => { document.documentElement.lang = interfaceLocale; document.documentElement.dir = interfaceLocale === 'ur-IN' ? 'rtl' : 'ltr'; }, [interfaceLocale]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), next => { setUser(next); setVerified(next?.emailVerified || false); if (!next) { generation.current++; pending.current?.abort.abort(); pending.current = null; session.current = null; setAnswer(null); setSource(null); setResetKey(k => k + 1); setQuestion(''); setPassword(''); setBusy(false); } });
    return unsubscribe;
  }, []);
  function stop() {
    generation.current++;
    const current = pending.current;
    if (current) {
      current.abort.abort();
      if (session.current) void api(`/sessions/${session.current}/turns/${current.id}/cancel`, 'POST').catch(() => {});
    }
    pending.current = null; setBusy(false); setStatus(t.stopped);
  }
  const changeSource = useCallback((next: Source | null) => {
    generation.current++; pending.current?.abort.abort(); pending.current = null;
    setBusy(false); setAnswer(null); setSource(next);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (shortcut && e.altKey && e.shiftKey && e.code === 'KeyC' && !e.isComposing) { e.preventDefault(); setOpen(true); requestAnimationFrame(() => composer.current?.focus()); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [shortcut]);
  useEffect(() => () => pending.current?.abort.abort(), []);
  async function account(action: 'login' | 'signup' | 'reset' | 'resend' | 'verify') {
    setError(''); setStatus(''); setAuthBusy(true);
    try {
      const auth = await ephemeralAuth(); auth.languageCode = interfaceLocale.split('-')[0] || 'en';
      if (action === 'login') { await signInWithEmailAndPassword(auth, email, password); setPassword(''); }
      if (action === 'signup') { const created = await createUserWithEmailAndPassword(auth, email, password); setPassword(''); await sendEmailVerification(created.user); setStatus(t.sent); }
      if (action === 'reset') { await sendPasswordResetEmail(auth, email); setStatus(t.sent); }
      if (action === 'resend' && auth.currentUser) { await sendEmailVerification(auth.currentUser); setStatus(t.sent); }
      if (action === 'verify' && auth.currentUser) { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); setVerified(auth.currentUser.emailVerified); setStatus(auth.currentUser.emailVerified ? t.idle : t.verify); }
    } catch { setError(firebaseConfigured ? t.accountHelp : t.unavailable); }
    finally { setAuthBusy(false); }
  }
  async function send() {
    if (pending.current || busy) return;
    setError('');
    if (!user || !verified) { setError(t.verify); return; }
    if (!consent || containsSensitiveText(question)) { setError(t.consentError); return; }
    if (!question.trim()) { composer.current?.focus(); return; }
    if (task === 'draft-text' && !draftLocale) { setError(t.chooseDraft); return; }
    const marker = ++generation.current;
    const request = { id: crypto.randomUUID(), abort: new AbortController() }; pending.current = request;
    setBusy(true); setAnswer(null); setStatus(t.working);
    try {
      if (!session.current) { const created = await api<{ id: string }>('/sessions', 'POST', { historyEnabled: false }, request.abort.signal); if (generation.current !== marker) { void api(`/sessions/${created.id}`, 'DELETE').catch(() => {}); return; } session.current = created.id; }
      const result = await api<Answer>(`/sessions/${session.current}/turns`, 'POST', { requestId: request.id, question, inputLocale, replyLocale, draftLocale: task === 'draft-text' ? draftLocale : null, taskKind: task, inputMode: 'text', source, nonSensitiveConfirmed: true }, request.abort.signal);
      if (generation.current !== marker || result.requestId !== request.id || result.sourceVersion !== (source?.version ?? null)) return;
      setAnswer(result); setStatus(t.idle);
    } catch (err) {
      if (generation.current !== marker) return;
      if (err instanceof RequestError && err.code === 'SESSION_CLOSED') session.current = null;
      setError(err instanceof RequestError && err.code === 'SERVICE_UNAVAILABLE' ? t.unavailable : err instanceof RequestError && err.code === 'PRIVACY_REVIEW_REQUIRED' ? t.consentError : t.error); setStatus('');
    } finally { if (generation.current === marker) { pending.current = null; setBusy(false); } }
  }
  async function end(logout = false) {
    stop(); const id = session.current;
    session.current = null; setAnswer(null); setQuestion(''); setConsent(false); setSource(null); setResetKey(k => k + 1);
    if (id) { try { await api(`/sessions/${id}`, 'DELETE'); } catch { setError(t.error); } }
    if (logout && firebaseConfigured) { try { await signOut(firebaseAuth()); setEmail(''); } catch { setError(t.error); } }
  }
  function closeChat() { setOpen(false); suppressReveal.current = true; launcher.current?.focus(); }
  return <div className={large ? 'app large' : 'app'}>
    <a className="skip" href="#main">Skip to content</a>
    <header className="topbar"><a className="brand" href="/" aria-label="Digital Assistant home"><span className="brand-mark" aria-hidden="true">d<span>·</span></span><span>Digital Assistant<small>ONE STEP AT A TIME</small></span></a><span className="header-note" lang="en">A helping hand for everyday online tasks</span><span className="tag" lang="en">Early build</span></header>
    <main id="main">
      {!onboarded ? <div className="onboarding">
        <section className="intro"><span className="eyebrow" lang="en">YOUR LANGUAGE. YOUR PACE.</span><h1>{t.title}</h1><p className="lead">{t.intro}</p><div className="promise" lang="en"><span className="promise-line">Understand a confusing instruction</span><span className="promise-line">Find your next step on a website</span><span className="promise-line">Prepare an email you can review</span></div><p className="boundary" lang="en">You stay in control. You make the clicks, check your details, and decide what to send.</p></section>
        <section className="card language-card"><span className="eyebrow" lang="en">LET’S MAKE THIS COMFORTABLE</span><h2>{t.choose}</h2><fieldset className="language-grid"><legend className="sr-only">{t.choose}</legend>{locales.map(locale => <label key={locale} className={replyLocale === locale ? 'language selected' : 'language'}><input type="radio" name="language" checked={replyLocale === locale} value={locale} onChange={() => { setReplyLocale(locale); setInputLocale(locale); }}/><span lang={locale} dir={locale === 'ur-IN' ? 'rtl' : 'ltr'}>{languageNames[locale]}</span><span className="radio-dot" aria-hidden="true"/></label>)}</fieldset><LanguageSelect label={t.interface} value={interfaceLocale} onChange={setInterfaceLocale}/><button className="primary wide" onClick={() => { setOnboarded(true); setStatus(''); }}>{t.continue}<span aria-hidden="true"> →</span></button><p className="hint" lang="en">You can change these choices at any time. A microphone is never required.</p></section>
      </div> : <div className="workspace">
        <aside className="sidebar"><span className="eyebrow" lang="en">YOUR SPACE</span><h2>{t.reply}</h2><LanguageSelect label={t.reply} value={replyLocale} onChange={l => { stop(); setReplyLocale(l); }}/><LanguageSelect label={t.interface} value={interfaceLocale} onChange={setInterfaceLocale}/><label className="check"><input type="checkbox" checked={large} onChange={e => setLarge(e.target.checked)}/>{t.larger}</label><label className="check"><input type="checkbox" checked={reader} onChange={e => setReader(e.target.checked)}/>{t.useReader}</label><p className="hint">{t.noHistory}</p><button className="text-button" onClick={() => setOnboarded(false)}>{t.back}</button>{user && <button className="text-button" onClick={() => void end(true)}>{t.signOut}</button>}<div className="sidebar-note" lang="en">A guide beside you.<br/>You’re always in charge.</div></aside>
        <div className="main-column"><span className="eyebrow" lang="en">LET’S TAKE IT ONE STEP AT A TIME</span><h1>{t.welcome}</h1>
          {!user && <section className="card auth-card" aria-labelledby="auth-title"><h2 id="auth-title">{t.signIn}</h2><p lang="en">Your account keeps assistance private. Your questions are not saved as history.</p>{!firebaseConfigured && <p className="notice">{t.unavailable}</p>}<form onSubmit={e => { e.preventDefault(); void account('login'); }}><div className="two-columns"><label>{t.email}<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>{t.password}<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/></label></div><div className="actions"><button className="primary" disabled={authBusy || !firebaseConfigured}>{t.signIn}</button><button type="button" className="secondary" disabled={authBusy || !firebaseConfigured} onClick={() => void account('signup')}>{t.signUp}</button><button type="button" className="text-button" disabled={authBusy || !firebaseConfigured || !email} onClick={() => void account('reset')}>{t.reset}</button></div></form></section>}
          {user && !verified && <section className="card"><h2>{t.verify}</h2><div className="actions"><button className="secondary" disabled={authBusy} onClick={() => void account('resend')}>{t.resend}</button><button className="primary" disabled={authBusy} onClick={() => void account('verify')}>{t.checked}</button></div></section>}
          <section className="card"><div className="section-heading"><span className="step-number" aria-hidden="true">01</span><h2>{t.task}</h2></div><fieldset className="task-grid"><legend className="sr-only">{t.task}</legend>{(['general-help', 'guide-task', 'draft-text'] as const).map((kind, index) => <label className={task === kind ? 'task selected' : 'task'} key={kind}><input type="radio" name="task" checked={task === kind} onChange={() => { stop(); setAnswer(null); setTask(kind); }}/><span className="task-symbol" aria-hidden="true">{['?', '↗', '≡'][index]}</span><strong>{kind === 'general-help' ? t.general : kind === 'guide-task' ? t.guide : t.emailTask}</strong></label>)}</fieldset></section>
          <SafeContext t={t} onChange={changeSource} resetKey={resetKey}/>
          <div className="chat-toolbar"><button ref={launcher} className="secondary" aria-expanded={open} aria-controls="chat" onFocus={() => { if (suppressReveal.current) { suppressReveal.current = false; return; } setOpen(true); }} onClick={() => { setOpen(true); requestAnimationFrame(() => composer.current?.focus()); }}>{t.open}</button><label className="check"><input type="checkbox" checked={shortcut} onChange={e => setShortcut(e.target.checked)}/><span lang="en">Alt+Shift+C (this page only)</span></label></div>
          {open && <section className="card chat" id="chat" aria-labelledby="chat-title" onBlur={e => { if (!pinned && !question && !answer && !busy && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }} onKeyDown={e => { if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); closeChat(); } }}><div className="section-heading"><span className="step-number" aria-hidden="true">03</span><h2 id="chat-title">{t.question}</h2><button className="text-button" type="button" onClick={closeChat}>{t.close}</button></div><div className="two-columns"><LanguageSelect label={t.input} value={inputLocale} onChange={l => { stop(); setInputLocale(l); }}/>{task === 'draft-text' && <LanguageSelect label={t.draft} value={draftLocale} empty onChange={l => { stop(); setDraftLocale(l); }}/>}</div><form onSubmit={e => { e.preventDefault(); void send(); }}><label htmlFor="question">{t.question}</label><textarea ref={composer} id="question" rows={4} maxLength={2000} value={question} lang={inputLocale} dir={inputLocale === 'ur-IN' ? 'rtl' : 'ltr'} onChange={e => { if (pending.current) stop(); setAnswer(null); setQuestion(e.target.value); setConsent(false); }} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); void send(); } }}/><div className="composer-hints"><span lang="en">Enter: new line · Ctrl/⌘+Enter: send</span><span>{question.length}/2000</span></div><label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>{t.safe}</label><div className="actions"><button className="primary" disabled={busy || !user || !verified || !question.trim() || !consent}>{t.send}<span aria-hidden="true"> ↗</span></button><label className="check"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}/>{t.pin}</label></div></form></section>}
          <div className="status-area"><p role="status" aria-live="polite" aria-atomic="true">{status || t.idle}</p>{busy && <button className="stop" onClick={stop}>{t.stop}</button>}{error && <p className="error" role="alert">{error}</p>}</div>
          {answer && <section className="card answer" aria-labelledby="answer-title"><span className="eyebrow" lang="en">YOUR GUIDANCE</span><h2 id="answer-title" lang="en">One step to try</h2><p lang={answer.explanation.locale} dir={answer.explanation.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{answer.explanation.text}</p>{answer.referencedLabels.length > 0 && <ul>{answer.referencedLabels.map(l => <li key={l.id}><bdi>{l.text}</bdi></li>)}</ul>}{answer.draft && <><h3>{t.draft}</h3><pre lang={answer.draft.locale} dir={answer.draft.locale === 'ur-IN' ? 'rtl' : 'ltr'}>{answer.draft.text}</pre><button className="secondary" onClick={() => { void navigator.clipboard.writeText(answer.draft!.text).then(() => setStatus(t.copied)).catch(() => setError(t.error)); }}>{t.copy}</button></>}<p className="hint" lang="en">Based on {answer.evidence[0]?.kind.replaceAll('-', ' ')}. No external action has been performed. {answer.requiresFreshContext && 'Review a new view before continuing.'}</p></section>}
          <div className="session-footer"><span>{t.noHistory}</span><button className="text-button" onClick={() => void end()}>{t.end}</button></div>
        </div></div>}
    </main><footer className="footer" lang="en"><span>Made for a more accessible everyday.</span><span>English · हिन्दी · বাংলা · मराठी · తెలుగు · தமிழ் · اردو</span></footer>
  </div>;
}
