'use client';
import { GlassSurface } from './Glass';
import { useWords } from '../lib/messages';

export function HowItWorks({ onStartVoice }: { onStartVoice?: () => void }) {
  const { m } = useWords();

  const steps = [
    {
      num: '01',
      title: m('Speak'),
      desc: m('Tell VaaniSetu what you want to do in your natural voice.'),
      icon: '🎙️',
    },
    {
      num: '02',
      title: m('Show'),
      desc: m('Share the current screen or screenshot if you need visual guidance.'),
      icon: '🖥️',
    },
    {
      num: '03',
      title: m('Protect'),
      desc: m('Sensitive screenshot details are locally hidden in your browser.'),
      icon: '🛡️',
    },
    {
      num: '04',
      title: m('Guide'),
      desc: m('VaaniSetu tells you the next action to take in simple words.'),
      icon: '💡',
    },
    {
      num: '05',
      title: m('Continue'),
      desc: m('It remembers your entire task as you progress through the website.'),
      icon: '🔄',
    },
  ];

  return (
    <section className="how-it-works-section" id="how-it-works" aria-labelledby="how-heading">
      <div className="section-header text-center">
        <span className="eyebrow">{m('SIMPLE 5-STEP JOURNEY')}</span>
        <h2 id="how-heading">{m('How VaaniSetu Works')}</h2>
        <p className="lead-sub">
          {m('No technical knowledge required. Just talk, share when needed, and follow one clear action at a time.')}
        </p>
      </div>

      <div className="stepper-track">
        {steps.map((step, idx) => (
          <GlassSurface key={step.num} className="step-card" as="div">
            <div className="step-badge-row">
              <span className="step-number">{step.num}</span>
              <span className="step-icon" aria-hidden="true">{step.icon}</span>
            </div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-desc">{step.desc}</p>
            {idx < steps.length - 1 && (
              <div className="step-connector" aria-hidden="true">
                <span className="connector-dot" />
              </div>
            )}
          </GlassSurface>
        ))}
      </div>

      {onStartVoice && (
        <div className="how-it-works-action">
          <button type="button" className="primary start-voice-btn" onClick={onStartVoice}>
            🎙️ {m('Try Speaking to VaaniSetu')} →
          </button>
        </div>
      )}
    </section>
  );
}
