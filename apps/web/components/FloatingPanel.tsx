'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '@guide/contracts';
import { useWords } from '../lib/messages';
import voiceCopy from '../lib/voice-copy.json';
type PipApi = { requestWindow: (options: { width: number; height: number }) => Promise<Window> };

export function FloatingPanel({ children, controls, open, locale, large, onOpen, onClosedReturn }: { children: ReactNode; controls?: ReactNode; open: boolean; locale: Locale; large: boolean; onOpen: () => void; onClosedReturn: () => void }) {
  const { m, uiLocale } = useWords();
  const place = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), floating = useRef<Window | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null), [supported, setSupported] = useState(false), [outside, setOutside] = useState(false), [error, setError] = useState('');
  const latest = useRef({ open, onClosedReturn }); latest.current = { open, onClosedReturn };
  useEffect(() => { const element = document.createElement('div'); place.current?.append(element); setHost(element); setSupported('documentPictureInPicture' in window); return () => { floating.current?.close(); element.remove(); }; }, []);
  useEffect(() => { if (host) { host.lang = locale; host.dir = locale === 'ur-IN' ? 'rtl' : 'ltr'; host.className = large ? 'app large' : 'app'; } }, [host, locale, large]);
  useEffect(() => { if (!open) floating.current?.close(); }, [open]);
  function restore() { if (host) place.current?.append(host); setOutside(false); floating.current = null; window.focus(); if (latest.current.open) trigger.current?.focus(); else latest.current.onClosedReturn(); }
  async function toggle() {
    if (floating.current) { floating.current.close(); return; }
    if (!host) return; setError('');
    try {
      // Keep this call directly within the user's click, before any other await.
      const api = (window as unknown as { documentPictureInPicture: PipApi }).documentPictureInPicture;
      const next = await api.requestWindow({ width: 480, height: 700 });
      floating.current = next; next.document.title = 'Digital Assistant'; next.document.documentElement.lang = locale; next.document.documentElement.dir = host.dir;
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(sheet => next.document.head.append(sheet.cloneNode(true)));
      next.document.body.style.padding = '12px'; next.document.body.append(host); setOutside(true); onOpen();
      next.addEventListener('pagehide', restore, { once: true });
      setTimeout(() => host.querySelector('textarea')?.focus(), 0);
    } catch { setError(m("The floating window could not open. Keep this page beside your other window.")); }
  }
  return <><p className="hint" lang={locale}>{voiceCopy[locale].floating}</p><div className="actions floating-toolbar" lang={uiLocale}>{controls}{supported ? <button ref={trigger} type="button" className="secondary" onClick={() => void toggle()}>{outside ? m("Return chat to this page") : m("Open floating chat")}</button> : <p className="hint">{m("Keep this page beside the website you are using. A floating window is offered only in supported desktop browsers.")}</p>}{outside && <p role="status">{m("Chat is in the floating window. Screen review stays on this page.")}</p>}{error && <p role="alert">{error}</p>}</div><div ref={place}/>{host ? createPortal(children, host) : children}</>;
}
