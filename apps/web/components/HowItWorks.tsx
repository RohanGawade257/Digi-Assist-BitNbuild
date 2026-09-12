'use client';
import { GlassSurface } from './Glass';
import { useWords } from '../lib/messages';

export function HowItWorks() {
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
    <section className="how-it-works-section section-gap" id="how-it-works" aria-labelledby="how-heading">
      <div className="section-header text-center">
        <span className="eyebrow">{m('SIMPLE 5-STEP JOURNEY')}</span>
        <h2 id="how-heading">{m('How VaaniSetu Works')}</h2>
        <p className="lead-sub">
          {m('No technical knowledge required. Just talk, share when needed, and follow one clear action at a time.')}
        </p>
      </div>

      {/* Connected Timeline Track */}
      <div className="timeline-container">
        <div className="timeline-progress-bar" aria-hidden="true" />
        <div className="timeline-steps">
          {steps.map((step) => (
            <GlassSurface key={step.num} className="timeline-step-node" as="div">
              <div className="step-badge-circle">
                <span className="step-icon" aria-hidden="true">{step.icon}</span>
                <span className="step-num">{step.num}</span>
              </div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </GlassSurface>
          ))}
        </div>
      </div>
    </section>
  );
}
