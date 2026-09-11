# Fresh capture and compact controller update

Implemented Capture current screen and send through a shared page/PiP function that passes newly captured PNG bytes directly to submission, with a new capture ID/timestamp and matching thumbnail. Localized source/session consent is revocable; strict privacy gates sending. No question is required. Optional frozen review/crop/mask remains under More options; no old masks are reused by fresh capture. Chat starts closed; the dedicated PiP requests 360x340. Consent and answer speech share the existing microphone/controller.

Focused evidence: five capture browser checks pass (two distinct current frames, exact submitted bytes, duplicate lock, image-only request, compact no-scroll layout, page/PiP state, capture-failure retry, revoke/stop cancellation, source-change consent invalidation and optional frozen review). API consent/overview checks and Gemini adapter/PNG checks pass; adapter tests intercept provider HTTP and are not a live Gemini run. Browser audio interruption passed at 5.8ms from confirmed detection to pause, with playback echo rejected, one new submission and late callbacks ignored. All five retained translated conversation/draft checks pass. Five fixed localized consent clips were generated using real Sarvam. Types, production web build and documentation checks pass. Physical microphone/native-app focus and whole-display capture inclusion remain unverified. Prior evidence below is historical; the default exact-review journey is superseded by consented on-demand capture.

---
# Focused PiP and interruption update

Implemented persistent Document PiP review/chat, frozen snapshot approval, compact controls, localized interruption status, local neural barge-in and five-language gating. Tests use real browser playback/PiP with synthetic media and provider fixtures. The final interruption run measured 0.4ms from confirmed speech to the browser pause/cancellation call (an earlier run measured 12.2ms); this excludes speech confirmation and physical latency. Seven seconds of injected playback echo did not interrupt, the new utterance submitted once, late callbacks stayed canceled, and introduction interruption/stop passed. Five translated conversations, Send/Enter/Shift/IME/retry and the language contract regression pass. Styled Chromium PiP API checks pass: 595px content at 350x640 without default scrolling; exact preview bytes, frozen crop, refreshed consent, two-column/narrow chat, side swap, high contrast, minimize/restore, close/reopen with one capture, End cleanup, activation fallback and failed image-request recovery. Keyboard/touch protection, pin and the slower-pause/voice-error recovery checks also pass. Types, production builds and docs checks pass.

Physical microphones, acoustic echo, native-app focus, whole-display inclusion and human review remain unverified. No new live provider run or broad audit is claimed. README/context describe current behavior; the material below is historical and includes superseded seven-language/no-barge-in behavior.

---
# Implementation progress

Voice correction implemented: language activation, real static Sarvam onboarding, local Silero VAD, automatic turns, captions/playback/resumption and exact-image voice confirmation. Real Hindi, English, Bengali, Marathi and Telugu synthetic speech + approved-image journeys passed STT/Gemini/TTS twice and track cleanup. Tamil's chain runs but latest accuracy check failed (uncut source WAV also misrecognized); Urdu output is unsupported. Fixed upstream408 replay/duplicate409 failures using504 and bounded longer generation deadlines; repaired Bengali speech thresholds and repeat-command spelling. Seven final focused voice/typing tests pass, plus prior permission-denial and timeout unit checks; types/builds/docs pass. Local cloud input was explicitly enabled. Physical microphone/native-app background and human language review remain unverified. The older release table below is the image-slice baseline.

Updated 2026-09-11 for the approved-image slice. Fixed denominator:12 release requirements. R01-R10 implemented with the user-accepted Urdu audio limitation; full release verification remains1/12 (R01). R11 now has real English image/Gemini and Sarvam WAV evidence, with remaining combinations open. Human review is not replaced by fixtures.

| ID | Requirement | Status | Evidence / remaining gate |
|---|---|---|---|
| R01 | Workspace, configuration, Docker, tests | verified | Frozen web/API builds, local operation readiness, core/Mongo/browser checks |
| R02 | Firebase auth, verification/reset, ownership | implemented_unverified | Real synthetic password login, protected preferences200 and exact account/data cleanup pass; normal email delivery pending |
| R03 | Language before login, accessible interface | implemented_unverified | Seven catalogs, local spoken intro, RTL/reflow/axe; native and screen-reader review pending |
| R04 | Typed assistant and independent drafts | implemented_unverified | Send/Enter/IME/retry, conversation continuity, fixture locales/drafts; real English grounded image answer passes |
| R05 | Image/label review, masking and approval | implemented_unverified | Exact cropped/masked PNG, explicit consent/hash/source version, real Gemini recognition without manual labels; human visual-review evaluation pending |
| R06 | Speech, translation and playback | implemented_unverified | Real Sarvam answer WAV200; playback race repaired and automated playback progress passes; real translation/STT and native listening pending |
| R07 | Desktop capture, freshness, cancellation | implemented_unverified | Changed synthetic frame revokes approval; local pre-send check, denied/late capture and End cleanup pass; physical review pending |
| R08 | Keyboard/touch floating chat and IME | implemented_unverified | Chromium PiP, focus, pin, draft preservation, IME/mobile pass; physical assistive testing pending |
| R09 | History, deletion, expiry, feedback | implemented_unverified | Real Mongo lifecycle, browser history/feedback and synthetic live account/data deletion pass; human review pending |
| R10 | Grounding, privacy, quotas, recovery | implemented_unverified | Full PNG/consent/auth/body limits, no persisted image, v3 per-API quotas, atomic migration/cooldowns, failure/retry pass; production reliability evaluation pending |
| R11 | Live integration and demo combinations | in_progress | Real Firebase -> approved synthetic image -> Gemini200 -> Sarvam WAV200; other language/speech-input combinations pending |
| R12 | Native language, screen readers, participants | not_started | People/devices required; see docs/evaluation.md |

## Latest checks

- 23 core tests pass, including PNG metadata/raster/hash limits, source consent binding and Gemini image token budgeting independent of base64 size.
- 12 nested real-Mongo scenarios plus parent pass (13 entries): ownership, unapproved/stale images,3MiB HTTP envelope, no saved image payloads, independent Sarvam budgets, lifecycle, deduplication and speech.
- Full32 browser tests pass in45.6 seconds with no retries/skips/failures. Includes exact preview bytes/crop/mask, approval changes, failure/Retry, real playback progress with fixture audio and preserved labels-only/voice/translation/chat paths.
- Typecheck and frozen Docker builds pass;202 localized literal keys covered and generated OpenAPI current.
- Local configuration probe: no problems, no pending policies, all four API operations configured; valid Firebase Admin JSON. A local probe never claims live provider verification.

## Live evidence and repairs

The real synthetic browser journey recognized VIOLET COMPASS from a720x450 approved cropped/masked screenshot. The distinctive phrase was not supplied as a manual label or in the question. Gemini returned200 with grounded guidance. Sarvam returned200 and a4.096-second valid WAV. Temporary Firebase users and owned data were removed after every completed run; only intentional UID tombstones may remain.

The first Gemini response mixed visible text into referencedLabels (reserved for IDs); prompt/schema now separate observed text and IDs without removing ID validation. Some later provider attempts timed out or returned a deduplication409. Errors retain the draft and explicit Retry; canceled work can still have incurred upstream usage. Visual inspection found a src/play race after audio loading; ref ownership of the audio source and stronger playback assertions repair it. The strengthened final live run returned200 on its first attempt with exactly one outgoing turn, matching approved preview bytes/hash, a2.133333-second Sarvam WAV and positive playback progress without a UI error. Cleanup passed. Full evidence is in docs/validation.md.

Quota configuration is resolved: user-confirmed Gemini3.5 Flash Lite15RPM/250000TPM/500RPD; Sarvam free/Starter translate60RPM, REST STT60RPM and Bulbulv3 TTS30RPM. Sarvam TPM/RPD are explicitly unpublished, without fabricated numbers. Provider/API readiness is independent, template remains unverified, no global policy verification flag. Gemini3 image reservations use documented image token allocation plus conservative text/output allowance, not base64 byte count.

Runtime: http://localhost:3000, API3001, Docker Mongo27018. Unrelated27017 and user data preserved. Next release work: real translation/STT combinations, native/screen-reader/physical-device review and normal signup/verification/reset email delivery. Keep Urdu text and the accepted explicit Urdu-audio limitation. No public deployment or whole-project release-completion claim.
