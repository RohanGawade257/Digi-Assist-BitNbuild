'use client';
import { useState } from 'react';
import { GlassSurface } from './Glass';
import { useWords } from '../lib/messages';

export function PrivacyShowcase({ onOpenPrivacy }: { onOpenPrivacy?: () => void }) {
  const { m } = useWords();
  const [showRedacted, setShowRedacted] = useState(true);

  return (
    <section className="privacy-section section-gap" id="privacy" aria-labelledby="privacy-heading">
      <div className="privacy-showcase-grid">
        {/* Left column: 45% storytelling */}
        <div className="privacy-narrative">
          <span className="eyebrow">{m('PRIVACY BEFORE AI')}</span>
          <h2 id="privacy-heading">{m('Your private details stay protected.')}</h2>
          <p className="lead-sub">
            {m('Sensitive screenshot information is processed directly in your browser and masked before the protected image is sent for AI assistance.')}
          </p>
          
          <div className="privacy-guarantees">
            <div className="guarantee-item">
              <span className="guarantee-icon" aria-hidden="true">🔒</span>
              <div>
                <strong>{m('In-Browser OCR Scanning')}</strong>
                <p>{m('Text recognition runs on your device CPU. Raw screenshots are never sent to remote OCR services.')}</p>
              </div>
            </div>
            <div className="guarantee-item">
              <span className="guarantee-icon" aria-hidden="true">🛡️</span>
              <div>
                <strong>{m('Irreversible Pixel Masking')}</strong>
                <p>{m('Aadhaar, PAN, phone numbers, email, OTPs, and payment card numbers are permanently overwritten.')}</p>
              </div>
            </div>
          </div>

          <div className="privacy-actions">
            {onOpenPrivacy && (
              <button type="button" className="secondary privacy-learn-btn" onClick={onOpenPrivacy}>
                🛡️ {m('Learn how privacy works')} →
              </button>
            )}
          </div>
        </div>

        {/* Right column: 55% visual interactive demonstration */}
        <GlassSurface className="privacy-visual-card" as="div">
          <div className="privacy-pipeline-strip" aria-label={m('Privacy pipeline')}>
            <div className="pipeline-step">
              <span className="pipeline-dot" />
              <span>{m('Screenshot')}</span>
            </div>
            <span className="pipeline-arrow" aria-hidden="true">→</span>
            <div className="pipeline-step highlight">
              <span className="pipeline-dot active" />
              <span>{m('Local Protection')}</span>
            </div>
            <span className="pipeline-arrow" aria-hidden="true">→</span>
            <div className="pipeline-step">
              <span className="pipeline-dot" />
              <span>{m('Safe Image')}</span>
            </div>
            <span className="pipeline-arrow" aria-hidden="true">→</span>
            <div className="pipeline-step">
              <span className="pipeline-dot" />
              <span>{m('AI Guidance')}</span>
            </div>
          </div>

          <div className="demo-header">
            <span className="demo-title">{m('Live Simulation Preview')}</span>
            <div className="demo-toggle-group" role="group" aria-label={m('Toggle privacy view')}>
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

          <div className="demo-screen-mockup">
            <div className="mockup-bar">
              <span className="mockup-dot red" />
              <span className="mockup-dot yellow" />
              <span className="mockup-dot green" />
              <span className="mockup-url">gov-portal.example/service/apply</span>
            </div>

            <div className="mockup-form">
              <div className="mockup-field">
                <span className="mockup-label">Aadhaar Number:</span>
                <div className="mockup-value">
                  {showRedacted ? (
                    <span className="sanitized-overlay">[AADHAAR FILLED]</span>
                  ) : (
                    <span className="raw-exposed">1234 5678 9012</span>
                  )}
                </div>
              </div>

              <div className="mockup-field">
                <span className="mockup-label">PAN Number:</span>
                <div className="mockup-value">
                  {showRedacted ? (
                    <span className="sanitized-overlay">[PAN FILLED]</span>
                  ) : (
                    <span className="raw-exposed">ABCDE1234F</span>
                  )}
                </div>
              </div>

              <div className="mockup-field">
                <span className="mockup-label">Mobile Number:</span>
                <div className="mockup-value">
                  {showRedacted ? (
                    <span className="sanitized-overlay">[PHONE FILLED]</span>
                  ) : (
                    <span className="raw-exposed">+91 9876543210</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="mockup-status-note">
            {showRedacted ? (
              <span className="status-success">✓ {m('Pixels are permanently masked in browser memory before network transmission.')}</span>
            ) : (
              <span className="status-caution">⚠️ {m('Raw personal identifiers are never transmitted without sanitization.')}</span>
            )}
          </p>
        </GlassSurface>
      </div>
    </section>
  );
}
