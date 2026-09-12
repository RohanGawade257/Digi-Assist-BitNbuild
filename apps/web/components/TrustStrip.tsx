'use client';
import { useWords } from '../lib/messages';

export function TrustStrip() {
  const { m } = useWords();

  const items = [
    {
      icon: '🎙️',
      title: m('Voice First'),
      desc: m('No typing required'),
    },
    {
      icon: '🌐',
      title: m('Multilingual'),
      desc: m('6 Indian languages'),
    },
    {
      icon: '🖥️',
      title: m('Screen Aware'),
      desc: m('Guidance where you look'),
    },
    {
      icon: '🛡️',
      title: m('Privacy Protected'),
      desc: m('Processed in browser'),
    },
  ];

  return (
    <div className="trust-strip-wrapper" role="region" aria-label={m('Product guarantees')}>
      <div className="trust-strip">
        {items.map((item, idx) => (
          <div key={idx} className="trust-strip-item">
            <span className="trust-icon" aria-hidden="true">{item.icon}</span>
            <div className="trust-text">
              <span className="trust-title">{item.title}</span>
              <span className="trust-desc">{item.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
