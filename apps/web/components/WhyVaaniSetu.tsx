'use client';
import { GlassSurface } from './Glass';
import { useWords } from '../lib/messages';

export function WhyVaaniSetu() {
  const { m } = useWords();

  return (
    <section className="why-section section-gap" id="why-vaanisetu" aria-labelledby="why-heading">
      <div className="section-header text-center">
        <span className="eyebrow">{m('DESIGNED FOR REAL HUMANS')}</span>
        <h2 id="why-heading">{m('Why VaaniSetu Makes Digital Access Easier')}</h2>
        <p className="lead-sub">
          {m('Navigating government portals, utilities, and online forms shouldn’t require computer expertise.')}
        </p>
      </div>

      {/* 3-Column Equal Grid */}
      <div className="why-grid-3">
        {/* Card 1: Just speak */}
        <GlassSurface className="feature-card" as="article">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <h3>{m('Just speak. VaaniSetu listens.')}</h3>
          <p>
            {m('No complicated typing or navigation. Choose your language and talk naturally while VaaniSetu guides you through tasks step-by-step.')}
          </p>
          <div className="card-footer-pill">
            <span>🎙️ {m('Voice-first input')}</span>
          </div>
        </GlassSurface>

        {/* Card 2: Never wonder */}
        <GlassSurface className="feature-card" as="article">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <h3>{m('Never wonder what to click next.')}</h3>
          <p>
            {m('VaaniSetu understands your current task and guides you through websites one action at a time without confusing technical jargon.')}
          </p>
          <div className="card-footer-pill">
            <span>👣 {m('One action at a time')}</span>
          </div>
        </GlassSurface>

        {/* Card 3: Show your screen */}
        <GlassSurface className="feature-card" as="article">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3>{m("Show your screen when you're stuck.")}</h3>
          <p>
            {m('Share a screenshot or window view. VaaniSetu inspects visible instructions and identifies the exact button or field you need.')}
          </p>
          <div className="card-footer-pill">
            <span>🖥️ {m('With your explicit approval')}</span>
          </div>
        </GlassSurface>
      </div>

      {/* Balanced 2-Column Supporting Feature Band */}
      <div className="feature-duo-grid">
        {/* Left: Multilingual Access */}
        <GlassSurface className="duo-card" as="article">
          <div className="duo-header">
            <div className="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div>
              <span className="duo-tag">{m('Multilingual Access')}</span>
              <h3>{m('Technology in the language you understand.')}</h3>
            </div>
          </div>
          <p>
            {m('Speak in your preferred language and receive simple, conversational guidance instead of struggling through complex English interfaces.')}
          </p>
          <div className="language-badge-cloud" aria-label={m('Supported languages')}>
            <span>English</span>
            <span>हिन्दी</span>
            <span>বাংলা</span>
            <span>मराठी</span>
            <span>తెలుగు</span>
            <span>தமிழ்</span>
          </div>
        </GlassSurface>

        {/* Right: Contextual Memory */}
        <GlassSurface className="duo-card" as="article">
          <div className="duo-header">
            <div className="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div>
              <span className="duo-tag">{m('Contextual Memory')}</span>
              <h3>{m("It remembers what you're doing.")}</h3>
            </div>
          </div>
          <p>
            {m('Voice, text, and shared screenshots remain part of the same task, so VaaniSetu continues from your previous step instead of starting over.')}
          </p>
          <div className="continuity-indicator">
            <span className="continuity-dot active" />
            <span className="continuity-line" />
            <span className="continuity-dot active" />
            <span className="continuity-line" />
            <span className="continuity-dot active" />
            <span className="continuity-label">{m('Step Memory Active')}</span>
          </div>
        </GlassSurface>
      </div>
    </section>
  );
}
