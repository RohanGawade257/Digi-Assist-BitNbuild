'use client';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { useWords } from '../lib/messages';

export function PrivacyExplainerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { m } = useWords();
  const [techOpen, setTechOpen] = useState(false);

  return (
    <Dialog
      open={open}
      title={m('How We Protect Your Screenshots')}
      closeLabel={m('Close')}
      onClose={onClose}
    >
      <div className="privacy-modal-content">
        <div className="privacy-badge-banner">
          <span className="shield-icon" aria-hidden="true">🛡️</span>
          <div>
            <strong>{m('In-Browser Privacy Protection')}</strong>
            <p>{m('Sensitive screenshot information is protected in your browser before the image is sent for AI assistance.')}</p>
          </div>
        </div>

        <ol className="privacy-steps-list">
          <li>
            <strong>1. {m('Screenshot remains on your device initially')}</strong>
            <p>{m('When you share or upload a screenshot, no image data leaves your browser until you choose to approve it.')}</p>
          </li>
          <li>
            <strong>2. {m('Local privacy scanning')}</strong>
            <p>{m('A privacy engine running directly on your device examines the screenshot to find sensitive details.')}</p>
          </li>
          <li>
            <strong>3. {m('Sensitive identifiers are masked where detected')}</strong>
            <p>{m('Personal identifiers such as Aadhaar, PAN, phone numbers, email addresses, OTPs, and payment card numbers are detected and covered.')}</p>
          </li>
          <li>
            <strong>4. {m('A new protected image is generated')}</strong>
            <p>{m('Sensitive pixels are permanently overwritten in canvas memory with dark opaque labels (such as [AADHAAR FILLED]). Raw sensitive details are not intentionally sent when the privacy sanitizer successfully processes the image.')}</p>
          </li>
          <li>
            <strong>5. {m('Protected image used for AI guidance')}</strong>
            <p>{m('Gemini visual AI receives only the sanitized image so it can see which fields are filled without ever seeing your private values.')}</p>
          </li>
        </ol>

        <div className="privacy-advice-box">
          <span className="advice-icon" aria-hidden="true">💡</span>
          <p>
            <strong>{m('User Advice:')}</strong>{' '}
            {m('We recommend checking the protected preview before sending screenshots containing highly sensitive information. You can also crop or manually cover additional areas using the image editor.')}
          </p>
        </div>

        <details className="technical-details-toggle" open={techOpen} onToggle={e => setTechOpen(e.currentTarget.open)}>
          <summary>
            <span>⚙️ {m('Technical Architecture (For Evaluators & Engineers)')}</span>
          </summary>
          <div className="technical-details-body">
            <p>
              {m('Privacy processing uses client-side browser technologies and pixel-level redaction before the screenshot enters the AI workflow.')}
            </p>
            <ul>
              <li><strong>OCR Engine:</strong> Tesseract.js WebAssembly executing inside a browser Web Worker on device CPU.</li>
              <li><strong>Zero Cloud OCR:</strong> No remote vision or third-party cloud OCR APIs are called. No image pixels leave the device during recognition.</li>
              <li><strong>Detection:</strong> Multi-word line assembly, regular expression classifiers, Luhn card checksum algorithm, and spatial proximity bounding-box association for contextual labels (CVV, OTP, MPIN, Account Number).</li>
              <li><strong>Pixel Destruction:</strong> Irreversible <code>CanvasRenderingContext2D</code> opaque fill rects overwrite original bitmap data. The raw canvas is garbage collected immediately after export.</li>
              <li><strong>Fail-Closed Gate:</strong> If OCR or canvas export fails, execution throws <code>PRIVACY_SANITIZATION_FAILED</code>, completely preventing network transmission of the raw screenshot.</li>
              <li><strong>Integrity:</strong> Sanitized payload is cryptographically bound via SHA-256 hash matching backend turn verification.</li>
            </ul>
          </div>
        </details>

        <div className="privacy-modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            {m('Got it, thanks')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
