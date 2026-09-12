'use client';
import { useState } from 'react';
import type { Locale } from '@guide/contracts';
import { useWords } from '../lib/messages';
import { workspaceWords } from '../lib/workspace-copy';

export function HelpGuide({
  locale,
  onOpenPrivacy,
}: {
  locale: Locale;
  onOpenPrivacy?: () => void;
}) {
  const { m } = useWords();
  const w = workspaceWords(locale);
  const [tab, setTab] = useState<'voice' | 'screen' | 'privacy' | 'shortcuts' | 'faq'>('voice');

  return (
    <div className="help-guide">
      {/* Navigation tabs */}
      <div className="help-tab-bar" role="tablist" aria-label={m('Help topics')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'voice'}
          className={`help-tab ${tab === 'voice' ? 'active' : ''}`}
          onClick={() => setTab('voice')}
        >
          🎙️ {m('Voice Guidance')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'screen'}
          className={`help-tab ${tab === 'screen' ? 'active' : ''}`}
          onClick={() => setTab('screen')}
        >
          🖥️ {m('Screen & Images')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'privacy'}
          className={`help-tab ${tab === 'privacy' ? 'active' : ''}`}
          onClick={() => setTab('privacy')}
        >
          🛡️ {m('Privacy & Security')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'shortcuts'}
          className={`help-tab ${tab === 'shortcuts' ? 'active' : ''}`}
          onClick={() => setTab('shortcuts')}
        >
          ⌨️ {m('Shortcuts & Comfort')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'faq'}
          className={`help-tab ${tab === 'faq' ? 'active' : ''}`}
          onClick={() => setTab('faq')}
        >
          ❓ {m('FAQs')}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="help-panel-content">
        {tab === 'voice' && (
          <div role="tabpanel" className="help-pane">
            <h3>🎙️ {m('How to use voice assistance')}</h3>
            <ul className="help-bullet-list">
              <li>
                <strong>{m('Speak in your preferred language:')}</strong>{' '}
                {m('VaaniSetu supports English, Hindi, Bengali, Marathi, Telugu, and Tamil. You can change your language anytime from the settings.')}
              </li>
              <li>
                <strong>{m('Natural speech detection:')}</strong>{' '}
                {m('The voice assistant listens when you speak and automatically pauses when you finish. Voice activity detection happens locally in your browser.')}
              </li>
              <li>
                <strong>{m('Spoken answers:')}</strong>{' '}
                {m('Answers can be read aloud in your language with natural pronunciation. Adjust speech speed in Settings.')}
              </li>
              <li>
                <strong>{m('Microphone is never mandatory:')}</strong>{' '}
                {m('You can type your questions anytime if you prefer not to speak.')}
              </li>
            </ul>
          </div>
        )}

        {tab === 'screen' && (
          <div role="tabpanel" className="help-pane">
            <h3>🖥️ {m('Sharing your screen safely')}</h3>
            <ul className="help-bullet-list">
              <li>
                <strong>{m('When you are stuck:')}</strong>{' '}
                {m('Share a browser tab or window, or upload a screenshot. VaaniSetu looks at visible instructions and points out your next action.')}
              </li>
              <li>
                <strong>{m('You stay in control:')}</strong>{' '}
                {m('VaaniSetu never accesses any screen automatically. Every screenshot requires your explicit review and approval.')}
              </li>
              <li>
                <strong>{m('Continuous task memory:')}</strong>{' '}
                {m('Once you share a screen, follow-up questions continue the same task. You don’t have to repeat your whole problem.')}
              </li>
              <li>
                <strong>{m('Audio tip:')}</strong> {w.echo}
              </li>
            </ul>
          </div>
        )}

        {tab === 'privacy' && (
          <div role="tabpanel" className="help-pane">
            <h3>🛡️ {m('How your privacy is protected')}</h3>
            <ul className="help-bullet-list">
              <li>
                <strong>{m('In-browser privacy firewall:')}</strong>{' '}
                {m('Sensitive screenshot information is protected in your browser before the image is sent for AI assistance.')}
              </li>
              <li>
                <strong>{m('What gets masked:')}</strong>{' '}
                {m('Personal identifiers such as Aadhaar, PAN, phone numbers, emails, OTPs, CVVs, and payment card numbers are locally detected and covered with solid opaque rectangles.')}
              </li>
              <li>
                <strong>{m('Raw details not sent:')}</strong>{' '}
                {m('Raw sensitive screenshot details are not intentionally sent when the privacy sanitizer successfully processes the image.')}
              </li>
              <li>
                <strong>{m('Inspection before send:')}</strong>{' '}
                {m('You always see the sanitized preview before choosing to approve and send it.')}
              </li>
            </ul>
            {onOpenPrivacy && (
              <button type="button" className="text-button" onClick={onOpenPrivacy}>
                {m('View complete privacy architecture')} →
              </button>
            )}
          </div>
        )}

        {tab === 'shortcuts' && (
          <div role="tabpanel" className="help-pane">
            <h3>⌨️ {m('Keyboard navigation & accessibility')}</h3>
            <div className="shortcut-table">
              <div className="shortcut-row">
                <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>
                <span>{m('Toggle assistant chat window')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Enter</kbd>
                <span>{m('Send question or message')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Shift</kbd> + <kbd>Enter</kbd>
                <span>{m('Insert new line in question')}</span>
              </div>
              <div className="shortcut-row">
                <kbd>Esc</kbd>
                <span>{m('Close dialog or chat drawer')}</span>
              </div>
            </div>
            <p className="help-subnote">
              {m('Screen reader mode and large text options are available in Accessibility Settings.')}
            </p>
          </div>
        )}

        {tab === 'faq' && (
          <div role="tabpanel" className="help-pane">
            <h3>❓ {m('Frequently asked questions')}</h3>
            <details className="faq-item">
              <summary><strong>{m('Does VaaniSetu perform clicks on external websites for me?')}</strong></summary>
              <p>{m('No. VaaniSetu is an accessibility guide. It explains exactly what to click and what to fill, but you remain in complete control of your actions and decisions.')}</p>
            </details>
            <details className="faq-item">
              <summary><strong>{m('Are my voice recordings or screenshots saved?')}</strong></summary>
              <p>{m('No raw screenshots or microphone audio recordings are ever stored on our servers. In-memory snapshots are only used to answer your current question and are discarded.')}</p>
            </details>
            <details className="faq-item">
              <summary><strong>{m('What if the website changes while I am talking?')}</strong></summary>
              <p>{m('Simply ask "I clicked it, what next?" or refresh the shared preview so VaaniSetu can inspect the updated page.')}</p>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
