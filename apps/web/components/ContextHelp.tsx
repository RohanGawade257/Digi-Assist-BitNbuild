'use client';
import { useEffect, useRef, useState } from 'react';
import { useWords } from '../lib/messages';

export function ContextHelp({ topic, text }: { topic: string; text: string }) {
  const { m } = useWords();
  const seen = useRef(new Set<string>());
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (seen.current.has(topic)) return;
    const timer = setTimeout(() => {
      seen.current.add(topic);
      const active = document.activeElement;
      // A hint can always be reopened. Do not interrupt someone already writing.
      if (active?.matches('input, textarea, [contenteditable="true"]')) return;
      setVisible(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [topic]);
  return <div className="context-help">
    <button type="button" className="text-button" aria-expanded={visible} aria-controls="step-help" onClick={() => { seen.current.add(topic); setVisible(value => !value); }}>{m('Help with this step')}</button>
    {visible && <div id="step-help" className="help-note"><p>{text}</p><button type="button" className="text-button" onClick={event => { setVisible(false); (event.currentTarget.closest('.context-help')?.querySelector('button') as HTMLButtonElement)?.focus(); }}>{m('Dismiss help')}</button></div>}
  </div>;
}
