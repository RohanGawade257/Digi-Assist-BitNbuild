'use client';
import { useState } from 'react';
import { GlassSurface } from './Glass';
import { useWords } from '../lib/messages';

export function WhyVaaniSetu({ onOpenPrivacy }: { onOpenPrivacy?: () => void }) {
  const { m, uiLocale } = useWords();
  const [showRedacted, setShowRedacted] = useState(true);

  return (
    <section className="why-section" id="why-vaanisetu" aria-labelledby="why-heading">
      <div className="section-header text-center">
        <span className="eyebrow">{m('DESIGNED FOR REAL HUMANS')}</span>
        <h2 id="why-heading">{m('Why VaaniSetu Makes Digital Access Easier')}</h2>
        <p className="lead-sub">
          {m('Navigating government portals, utilities, and online forms shouldn’t require computer expertise. VaaniSetu provides patient, spoken guidance with browser-side privacy.')}
        </p>
      </div>

      <div className="features-grid">
        {/* Card 1: Voice First */}
        <GlassSurface className="feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <h3>{m('Just speak. VaaniSetu listens.')}</h3>
          <p>
            {m('No complicated typing or navigation. Choose your language and talk naturally while VaaniSetu guides you through tasks step-by-step.')}
          </p>
          <div className="feature-badge-row">
            <span className="feature-pill">🎙️ {m('Voice-first input')}</span>
            <span className="feature-pill">🗣️ {m('Spoken audio answers')}</span>
          </div>
        </GlassSurface>

        {/* Card 2: Step-by-Step Guidance */}
        <GlassSurface className="feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <h3>{m('Never wonder what to click next.')}</h3>
          <p>
            {m('VaaniSetu understands your current task and guides you through websites one action at a time without confusing technical jargon.')}
          </p>
          <div className="step-flow-visual" aria-label={m('Guidance flow')}>
            <span className="flow-node">{m('Speak')}</span>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <span className="flow-node">{m('Show')}</span>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <span className="flow-node">{m('Next Step')}</span>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <span className="flow-node highlight">{m('Continue')}</span>
          </div>
        </GlassSurface>

        {/* Card 3: Screen Awareness */}
        <GlassSurface className="feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3>{m("Show your screen when you're stuck.")}</h3>
          <p>
            {m('Share a screenshot or window view. VaaniSetu inspects visible instructions and identifies the exact button or field you need.')}
          </p>
          <p className="feature-subtext">
            ℹ️ {m('VaaniSetu never accesses your screen without your explicit approval.')}
          </p>
        </GlassSurface>

        {/* Card 4: Privacy-First Screenshots (Featured Hero Card) */}
        <GlassSurface className="feature-card feature-card-highlight">
          <div className="feature-header-row">
            <div className="feature-icon privacy-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <span className="tag-privacy">🛡️ {m('Browser-Side Privacy Firewall')}</span>
          </div>
          <h3>{m('Your private details stay protected.')}</h3>
          <p>
            {m('Before a screenshot is sent for AI assistance, VaaniSetu processes it inside your browser to hide sensitive numbers like Aadhaar, PAN, phone, email, OTPs, and payment details.')}
          </p>

          {/* Interactive Before/After Redaction Preview */}
          <div className="privacy-demo-box" role="region" aria-label={m('Interactive privacy preview')}>
            <div className="privacy-demo-controls">
              <span className="demo-label">{m('Demonstration preview:')}</span>
              <div className="demo-toggle-group">
                <button
                  type="button"
                  className={`demo-toggle ${showRedacted ? 'active' : ''}`}
                  onClick={() => setShowRedacted(true)}
                  aria-pressed={showRedacted}
                >
                  🛡️ {m('Protected (Sent to AI)')}
                </button>
                <button
                  type="button"
                  className={`demo-toggle ${!showRedacted ? 'active' : ''}`}
                  onClick={() => setShowRedacted(false)}
                  aria-pressed={!showRedacted}
                >
                  👁️ {m('Simulate Raw')}
                </button>
              </div>
            </div>

            <div className="privacy-demo-card">
              <div className="demo-field">
                <span className="demo-field-name">Aadhaar:</span>
                {showRedacted ? (
                  <span className="demo-redacted-mask" aria-label="Aadhaar protected">[AADHAAR FILLED]</span>
                ) : (
                  <span className="demo-raw-val">1234 5678 9012</span>
                )}
              </div>
              <div className="demo-field">
                <span className="demo-field-name">PAN Card:</span>
                {showRedacted ? (
                  <span className="demo-redacted-mask" aria-label="PAN protected">[PAN FILLED]</span>
                ) : (
                  <span className="demo-raw-val">ABCDE1234F</span>
                )}
              </div>
              <div className="demo-field">
                <span className="demo-field-name">Phone:</span>
                {showRedacted ? (
                  <span className="demo-redacted-mask" aria-label="Phone protected">[PHONE FILLED]</span>
                ) : (
                  <span className="demo-raw-val">+91 9876543210</span>
                )}
              </div>
            </div>

            <p className="demo-notice">
              {showRedacted ? (
                <>✓ {m('Pixels are permanently masked in browser memory before network transmission.')}</>
              ) : (
                <span className="demo-warning">⚠️ {m('Raw personal identifiers are never transmitted without sanitization.')}</span>
              )}
            </p>
          </div>

          {onOpenPrivacy && (
            <button type="button" className="text-button privacy-learn-link" onClick={onOpenPrivacy}>
              {m('Learn how our browser privacy works')} →
            </button>
          )}
        </GlassSurface>

        {/* Card 5: Multilingual Accessibility */}
        <GlassSurface className="feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <h3>{m('Technology in the language you understand.')}</h3>
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

        {/* Card 6: Continuous Assistance */}
        <GlassSurface className="feature-card">
          <div className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h3>{m("It remembers what you're doing.")}</h3>
          <p>
            {m('Voice, text, and shared screenshots remain part of the same task, so VaaniSetu continues from your previous step instead of starting over.')}
          </p>
          <div className="continuity-indicator">
            <span className="continuity-dot active" />
            <span className="continuity-line" />
            <span className="continuity-dot active" />
            <span className="continuity-line" />
            <span className="continuity-dot active" />
            <span className="continuity-label">{m('Contextual Memory Active')}</span>
          </div>
        </GlassSurface>
      </div>
    </section>
  );
}
