'use client';
import { GlassSurface } from './Glass';
import { useWords } from '../lib/messages';

export function FinalCTA({
  onStartVoice,
  onChooseLanguage,
}: {
  onStartVoice: () => void;
  onChooseLanguage?: () => void;
}) {
  const { m } = useWords();

  return (
    <section className="final-cta-section section-gap" aria-labelledby="cta-heading">
      <GlassSurface className="final-cta-card" as="div">
        <span className="eyebrow">{m('BEGIN NOW')}</span>
        <h2 id="cta-heading">{m('Ready when you are.')}</h2>
        <p className="final-cta-sub">
          {m('Speak naturally. VaaniSetu will guide you from there.')}
        </p>

        <div className="final-cta-actions">
          <button type="button" className="primary final-primary-btn" onClick={onStartVoice}>
            🎙️ {m('Start Voice Assistant')}
          </button>
          {onChooseLanguage && (
            <button type="button" className="secondary final-secondary-btn" onClick={onChooseLanguage}>
              🌐 {m('Choose Language')}
            </button>
          )}
        </div>

        <p className="final-cta-trust">
          {m('No download needed · Runs in your browser · Instant accessibility')}
        </p>
      </GlassSurface>
    </section>
  );
}
