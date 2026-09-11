# Release evaluation template — not yet performed

Use consenting participants where available, ideally 3–5 covering older age, limited English/digital confidence, blindness/low vision and keyboard/limited-motor access, with overlap allowed. Do not collect diagnoses. Use accessible consent and synthetic tasks. Recording needs separate consent; no recordings are required.

| Task | Success condition | Required checks |
|---|---|---|
| Registration guidance | User understands one public instruction and chooses the next action | Safe labels, ambiguous target, no invented fields or personal-value verification |
| English email with Hindi guidance | Explanation remains Hindi and draft remains English; user reviews/copies it | Independent locales, no sending, placeholders instead of personal values |
| Mobile screenshot navigation | User identifies a public label from an uploaded screenshot | Local review, no raw image upload, static-view limitation, keyboard/screen-reader alternative |

Record participant code (not name), task, independent/assisted/incomplete, elapsed time, errors, clarification count, help needed and optional ease/confidence feedback. Do not calculate population-wide impact from a small demo.

Technical matrix: NVDA + desktop Chromium, TalkBack + Android screenshot journey, VoiceOver where available; keyboard-only, touch, 200% text enlargement, 375px reflow, reduced motion; all seven text languages with mixed English labels. Speech/capture implementations now pass automated fixture checks. Native listening still needs real account audio, not mocked evidence. Evaluate the six supported output languages; the user accepted an explicit Urdu-audio limitation, so record Urdu speech as unavailable rather than passed. Urdu text still requires review. Record each unavailable combination explicitly.

Current result: no representative participants, manual screen-reader sessions or native-language listening performed. Chromium/axe results are in validation.md.
