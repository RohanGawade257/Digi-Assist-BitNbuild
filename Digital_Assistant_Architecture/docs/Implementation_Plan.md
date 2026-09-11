# Implementation and Acceptance Plan

Revision 3. Website first; no native work before website gates pass.

## User evaluation and build sequence

Recruit a consenting formative sample, ideally 3–5 people covering older age, limited English/digital confidence, blind/low-vision access and keyboard/limited-motor needs, with overlap allowed. Do not collect diagnoses. Use synthetic tasks and accessible consent; recording needs separate agreement. If representative participants cannot be recruited, document the missing validation and technical checks performed.

Use three core tasks: explain and complete a registration step; draft an English email with Hindi guidance; locate an unfamiliar feature from a mobile screenshot. Include safe-label privacy review and keyboard floating chat. Record independent, assisted, or incomplete outcome, time, errors, clarification count, assistance needed, and optional ease/confidence feedback. A small demo sample is not population-wide proof. Never invent impact percentages.

| Hours | Delivery focus and exit evidence |
| --- | --- |
| 0–4 | Scaffold and lock dependencies; Docker boot; Firebase/Mongo connection; actual provider and seven-language capability probes. |
| 4–10 | Localized onboarding/auth; typed chat; screenshot path; keyboard and screen-reader skeleton. |
| 10–16 | Safe-label review, target selection, source versions, Gemini schema and evidence checks. |
| 16–24 | Sarvam pipeline, correction, protected labels, separate draft language, speech/mute controls. |
| 24–31 | Desktop capture, freshness, one-step guide, keyboard/touch floating chat and fallback. |
| 31–36 | History/delete/feedback, quota grouping, cancellation, ownership and recovery tests. |
| 36–42 | Real HTTPS mobile and desktop checks; seven-language listening; representative user sessions where available. |
| 42–48 | Repair blockers, repeat demo, report observed results, finalize README and organizer-required submission. |

If behind, cut decorative motion, extra demo websites, and advanced floating-window polish before safe review, keyboard access, source freshness, stop controls, or ownership. A failed language remains an unmet seven-language requirement. Do not mark the project fully complete because one Hindi demonstration works.

Check the official Track 1 Task 3 brief for required technologies, deliverables, deployment and judging criteria. The intended alignment is accessible digital task guidance; this document does not independently verify an unseen challenge statement.


## Accessibility and security release gates

Target WCAG 2.2 AA and test manually alongside automated checks. Project defaults are comfortable text near 18 px, controls about 44 by 44 CSS px or larger, strong visible focus, 4.5:1 normal-text contrast, 200% enlargement and narrow-width reflow. These design defaults do not imply that every value is a WCAG minimum. Respect reduced motion and do not rely on color, hover, sound, or spatial directions alone. [WCAG implementation reference](https://www.w3.org/WAI/WCAG22/quickref/)

Use localized accessible names, semantic headings/landmarks, correct lang and Urdu direction, and isolated English label spans. Announce important status once through a polite live region. Avoid duplicate automatic TTS over a screen reader; offer screenReaderMode. Use tap-to-start/tap-to-stop voice recording, not a sustained keypress requirement. Silence, unclear speech, and ambiguous targets require localized clarification; a provider language-confidence score is not proof of transcript accuracy.

| Gate | Required evidence before claiming completion |
| --- | --- |
| Keyboard and touch | Entire journey without mouse or speech; focus-open chat, send/IME behavior, pin, escape, stop, privacy review, mobile keyboard and zoom. |
| Screen readers | NVDA with desktop browser and TalkBack on Android screenshot journey; add VoiceOver testing where available and record unavailable combinations. |
| Seven languages | Actual STT, translation, TTS and human listening for each locale, mixed English labels, errors, noise, silence and mid-session switch. Urdu is not silently downgraded. |
| Privacy | Synthetic names, IDs, email values and notifications absent from outgoing context, logs and storage; no raw OCR sent for spoken review. |
| Ownership | User A cannot read, modify, delete, submit turns to, or replay user B’s audio/session. Expired/deleted records remain inaccessible. |
| Grounding | Wrong screen, ambiguous target, missing official rule, conflicting source and prompt injection produce safe clarification/limitation. |
| Quotas | Four same-group Gemini keys share one budget; three Sarvam slots respect grouping; simulated 429, invalid keys and exhaustion recover. |
| Lifecycle | Stopped tracks, stale frames, duplicate send, timeout, source change, logout and deletion cannot produce late misleading speech or persistence. |

Measure stage timing, queue delay, capture age, sanitized bytes, clarification, retries, and task outcome with non-content telemetry. Report p50/p95, sample count, actual models/accounts, and test conditions. Initial planning targets are visible progress within 300 ms, text replies roughly 2–6 seconds and multilingual voice roughly 5–12 seconds under light load; these are not measured promises.


## Future client upgrade path

Retain versioned API contracts, Firebase identity, preferences, locale catalogs, protected labels, privacy rules, task state, and quota orchestration. Capture adapters and accessible UI remain platform-specific. Reuse shared logic rather than attempting to reuse desktop DOM controls on a phone.

A future React Native client can use Expo development builds with custom native modules. Android capture needs native MediaProjection consent and lifecycle handling; iOS requires separate platform capture integration and testing. Neither responsive CSS nor an installed website grants whole-phone capture. Native screen capture must still pass through local privacy review before cloud processing.

An optional browser extension can later extract permitted structured labels and offer in-page bilingual translation and chat on supported sites. It must exclude entered values and private text outside input boxes. Screen-sharing permission alone does not enable changing the actual external website language. The current website offers translated guidance or a companion view.

Before broader deployment, improve accessible safe extraction, test third-party website barriers, validate real-user data terms, and add approved-reference freshness workflows. On-device recognition/read-back is a separate capability with explicit tests. Add shared queue infrastructure and horizontal scaling only when demand requires them. Starting a native spike is not equivalent to publishing a reviewed app-store release.

### Reference and implementation status

The inline sources support browser, identity, quota, accessibility, and provider boundaries. Model access, codec support, browser behavior, and language quality still require actual-account/device tests. Use official documentation during implementation, including Next.js deployment, NestJS, Docker Compose readiness, MongoDB TTL, Expo custom native code, and Android MediaProjection. Pin validated versions in the repository and record test results there.

This deliverable closes the planning gaps. The next milestone is a runnable website satisfying the release gates, not a claim that those gates have already passed.
