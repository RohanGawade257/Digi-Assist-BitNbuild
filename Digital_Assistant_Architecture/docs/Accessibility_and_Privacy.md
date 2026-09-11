# Accessibility and Privacy Implementation

Revision 3. Requirements to implement and test, not verified application behavior.

## Accessible user journey and floating chat

Language selection appears before login. The interaction can enable a short spoken introduction; show Play introduction if playback is blocked. Ask separately whether to change our interface. Never activate the microphone automatically. Localize signup, verification, reset, instructions, and errors; do not read credentials aloud. Use Firebase as the single account authority. [Firebase ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

The dashboard offers Ask by voice, Type a question, Share screen when supported, Upload screenshot, history, and settings. Request permissions only when used. A browser chooser requires user activation: a spoken yes leads to an accessible Start screen sharing button, activated by click or keyboard. Capture permission does not grant remote control. [Screen capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

Implement in-page chat as a nonmodal region with a persistent labeled launcher. Focus on the launcher reveals the panel without moving focus unexpectedly. Enter or Space opens chat and moves focus to the composer. Pointer exit never collapses focused, pinned, typing, unsent-draft, or unread-response states. Escape collapses the panel when appropriate, preserves the draft, and restores launcher focus. Essential stop controls remain available.

Offer Alt+Shift+C as a configurable in-app shortcut, with conflict testing and an off option. It works only while our page or chat window receives keyboard events. Do not claim a global hotkey over unrelated applications. Support native Tab/Shift+Tab navigation, a visible Send button, and Ctrl+Enter or Command+Enter to send. Enter creates a newline; suppress shortcut submission during IME composition.

An explicit Open floating window button may invoke Document Picture-in-Picture, feature-detected in supported desktop browsers. Opening it must happen directly within the user activation handler, before asynchronous work loses activation. Return the chat to the main page when it closes. Otherwise offer side-by-side/in-page chat. The API supports an always-on-top HTML window but has limited browser availability; do not promise click-through translucency, global shortcuts, or positioning control. [Document Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API)

Keep the main page as the session and media owner. Render the same controlled chat state into the floating window and preserve draft and focus when moving it. No second STT/TTS session. On touch devices use explicit expand, close, and pin controls and keep the composer visible above the software keyboard.


## Accessible privacy review and target selection

Default to a safe-label path for supported demo layouts. Local OCR is an optional candidate generator, not a privacy classifier. Do not upload OCR wholesale. Supported fixtures can supply known public labels and instructions independent of values; do not imply that this is DOM access to arbitrary external sites.

For an arbitrary image, exclude uncertain candidates and offer an editable accessible list of safe labels/instructions. Candidates are not automatically selected. Each item needs an ID, readable label, checkbox, and optional preview region. Users review selected content and explicitly send it. A keyboard/screen-reader user must never be required to draw a crop. If safe context cannot be established, accept a non-sensitive description or pause screen-dependent advice.

Provide Review selected text and Read aloud controls. Unreviewed OCR must not reach cloud TTS. Use the user’s screen reader, a confirmed on-device voice, or prebuilt audio for static prompts. Generic browser speech availability does not prove local synthesis. If no local reading path works, disclose that limitation and retain semantic text controls; do not quietly upload private text to provide speech.

Visual users may choose a safe crop and opaque masks locally. Re-encode the result to flatten masks and remove metadata; never upload an image with removable overlay layers. Consent applies to the exact approved payload hash and source version. Server validation is defense in depth and cannot undo a raw upload.

Target selection identifies what “this” refers to; it is separate from privacy consent. A click/tap in our preview maps to normalized coordinates and a proposed label. Offer the same label through keyboard selection. Store selectedTarget as labelId plus optional normalized region and sourceVersion. A selection must not automatically include a neighboring entered value. If two labels overlap or the OCR is uncertain, ask which one the user means.

Any source switch, new screenshot, scrolling/layout change, or relevant page transition invalidates selection and approval. Bind masks, target, question, and result to the same sourceVersion. Clear obsolete selection and ask again; never reuse coordinates across a changed layout. Do not claim visibility into the user’s external clicks.


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

