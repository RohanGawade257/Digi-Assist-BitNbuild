# Digital Assistant Architecture

Revision 3 • 11 September 2026 • Implementation blueprint

Build a responsive multilingual digital assistant with Next.js, NestJS, MongoDB, Firebase Authentication, Gemini, Sarvam, and Docker. This document translates the agreed user workflow into implementation contracts for a 48-hour website build. Read it alongside Project_Overview.md revision 3. It supersedes conflicting guidance in the earlier architecture ZIP; that ZIP remains a historical starter kit.

The primary audiences are older adults, people who find English or digital instructions difficult to understand, and people with disabilities, including blind users, people with low vision, and people with limited motor control. The assistant explains unfamiliar websites, registrations, forms, email composition, and navigation. PAN registration is one example, not its identity.

Status: requirements and proposed design. No application, live provider integration, seven-language quality, deployment, or accessibility outcome is claimed as verified by this document. The user identifies the challenge as Track 1 Task 3, Inclusive Digital Services. Obtain the official organizer brief before asserting exact rubric compliance.

## 1 Scope and priorities

The website provides spoken and typed assistance, desktop capture where supported, screenshot upload on desktop and mobile, optional sanitized history, and neutral feedback. It guides one step at a time; users enter their own information and perform external actions. It does not click, submit, send email, accept declarations, solve CAPTCHAs, or make payments.

The first accessible path must work without visual cropping: locally reviewed labels/instructions, keyboard controls, screen-reader semantics, and safe spoken guidance. A website cannot make every third-party page accessible or inspect another tab’s DOM through capture permission. Independently completing arbitrary sites as a blind user remains an outcome to test, not a current guarantee.

| Agreed gap | Implementation decision |
| --- | --- |
| Primary audiences | Treat age, language/literacy, vision, and motor-access barriers as first-class design requirements; do not collect diagnoses. |
| Accessible privacy review | Selectable safe-label list and spoken review; no mandatory crop gesture or cloud reading of raw OCR. |
| Meaning of this field | Preview selection plus equivalent keyboard label list; bind both to a source version. |
| Guidance versus draft language | Separate replyLocale, interfaceLocale, and draftLocale. |
| Knowledge boundaries | Evidence-bearing answers; official dated references for rules, otherwise clarification or limitation. |
| Accessibility impact | Consenting representative user sessions with independent/assisted/incomplete outcomes. |
| Floating chat | Focus reveals in-page chat; keyboard/touch activation opens it; no hover-only control. |

Keep all seven agreed languages: English, Hindi, Bengali, Marathi, Telugu, Tamil, and Urdu. This preserves the prior selection, not a newly verified population ranking. Native mobile capture and extension-based page translation are future work. Do not start them until the website gates pass.

## 2 Stack and module ownership

Use one TypeScript monorepo and a modular API. Choose compatible stable package patches at scaffold time, pin them in a pnpm lockfile, and pin container images. Existing major-version targets are Next.js 16, NestJS 11, Node.js 24 LTS, and MongoDB 8; confirm compatibility before installation. These are implementation targets, not claims of current benchmark superiority.

| Layer | Selected implementation |
| --- | --- |
| Website | Next.js App Router and React; Tailwind, accessible components, next-intl locale catalogs. |
| State | Small Zustand store for volatile conversation/media state; TanStack Query for remote records. Never persist media or transcripts through store middleware. |
| API | NestJS with Express; versioned REST endpoints and fetch-readable server-sent events for progress. |
| Identity | Firebase email/password, verification and reset; Firebase Admin verifies ID tokens in the API. |
| Data | MongoDB official Node driver; owner-filtered records, expiry and bounded quota metadata. |
| AI services | Gemini for English reasoning and approved images; Sarvam for transcription, translation and speech. |
| Local media | getDisplayMedia, MediaRecorder, Canvas, Tesseract.js worker for optional local OCR. |
| Delivery | Docker Compose, one API replica initially, HTTPS reverse proxy in deployment. |
| Verification | Shared-logic tests, API integration tests, Playwright and axe, plus manual accessibility and native-language checks. |

Keep apps/web responsible for capture, accessible privacy review, preview selection, chat, Firebase client flow, and audio playback. Keep apps/api modules for auth, sessions, assistant orchestration, providers, speech, privacy, feedback, and health. Providers never run directly from the browser.

Use packages/contracts for runtime-validated request/event schemas, packages/assistant-core for label and task rules, packages/api-client for authenticated transport, and packages/locales for reviewed messages. Shared packages must not depend on browser DOM or filesystem APIs. Avoid duplicating assistant orchestration in Next.js route handlers and NestJS.

Do not introduce microservices, Kubernetes, a vector database, or an agent framework for the first build. A small curated reference registry is sufficient for the demo. Mongo-backed reservations and a bounded single-instance queue avoid needing Redis initially; shared queue/cancellation infrastructure is required before multiple API replicas.

## 3 Trust boundaries and data flow

The local browser receives the raw capture or screenshot. It creates approved context before upload. The API authenticates each request, validates ownership and input bounds, orchestrates providers, validates the result, and returns matching text and optional audio. MongoDB holds only permitted application records. Firebase is the password authority.

| Boundary | Data permitted across it | Data excluded |
| --- | --- | --- |
| Browser to API | Approved labels or safe crop, sanitized question, locale and source metadata; consented voice separately. | Raw screens, unreviewed OCR and private values in screen context. |
| API to Gemini | Safe English question, relevant approved context, bounded sanitized history and evidence. | Identity values, secrets, arbitrary full screens and hidden page data. |
| API to Sarvam | Consented recording for STT; sanitized text for translation and final-answer TTS. | Unreviewed OCR for accessibility narration; persistent recordings. |
| API to MongoDB | Preferences, opted-in sanitized history, consented feedback, metadata-only request and quota records. | Media, credentials, auth tokens and personal form entries. |

There are two separate privacy decisions. Screen context must be excluded/reviewed locally before transfer. Cloud speech necessarily sends the user’s recording to Sarvam before transcript redaction; explain this and obtain consent. In strict mode, cloud recording is disabled and typed assistance remains. On-device STT is future work.

For the unpaid Gemini demonstration, use synthetic data and public non-sensitive instructions. User approval alone does not make prohibited or private content suitable for upload. Validate service terms and data handling before using real personal records. [Gemini service terms](https://ai.google.dev/gemini-api/terms)

Use one active image, one microphone recorder, one playback owner, and one active answer per user/session. Moving chat must not create duplicate capture or speech pipelines. On logout or session end, stop local tracks, revoke object URLs, clear media buffers and volatile context, and invalidate pending replies.

## 4 Accessible user journey and floating chat

Language selection appears before login. The interaction can enable a short spoken introduction; show Play introduction if playback is blocked. Ask separately whether to change our interface. Never activate the microphone automatically. Localize signup, verification, reset, instructions, and errors; do not read credentials aloud. Use Firebase as the single account authority. [Firebase ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

The dashboard offers Ask by voice, Type a question, Share screen when supported, Upload screenshot, history, and settings. Request permissions only when used. A browser chooser requires user activation: a spoken yes leads to an accessible Start screen sharing button, activated by click or keyboard. Capture permission does not grant remote control. [Screen capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

Implement in-page chat as a nonmodal region with a persistent labeled launcher. Focus on the launcher reveals the panel without moving focus unexpectedly. Enter or Space opens chat and moves focus to the composer. Pointer exit never collapses focused, pinned, typing, unsent-draft, or unread-response states. Escape collapses the panel when appropriate, preserves the draft, and restores launcher focus. Essential stop controls remain available.

Offer Alt+Shift+C as a configurable in-app shortcut, with conflict testing and an off option. It works only while our page or chat window receives keyboard events. Do not claim a global hotkey over unrelated applications. Support native Tab/Shift+Tab navigation, a visible Send button, and Ctrl+Enter or Command+Enter to send. Enter creates a newline; suppress shortcut submission during IME composition.

An explicit Open floating window button may invoke Document Picture-in-Picture, feature-detected in supported desktop browsers. Opening it must happen directly within the user activation handler, before asynchronous work loses activation. Return the chat to the main page when it closes. Otherwise offer side-by-side/in-page chat. The API supports an always-on-top HTML window but has limited browser availability; do not promise click-through translucency, global shortcuts, or positioning control. [Document Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API)

Keep the main page as the session and media owner. Render the same controlled chat state into the floating window and preserve draft and focus when moving it. No second STT/TTS session. On touch devices use explicit expand, close, and pin controls and keep the composer visible above the software keyboard.

## 5 Accessible privacy review and target selection

Default to a safe-label path for supported demo layouts. Local OCR is an optional candidate generator, not a privacy classifier. Do not upload OCR wholesale. Supported fixtures can supply known public labels and instructions independent of values; do not imply that this is DOM access to arbitrary external sites.

For an arbitrary image, exclude uncertain candidates and offer an editable accessible list of safe labels/instructions. Candidates are not automatically selected. Each item needs an ID, readable label, checkbox, and optional preview region. Users review selected content and explicitly send it. A keyboard/screen-reader user must never be required to draw a crop. If safe context cannot be established, accept a non-sensitive description or pause screen-dependent advice.

Provide Review selected text and Read aloud controls. Unreviewed OCR must not reach cloud TTS. Use the user’s screen reader, a confirmed on-device voice, or prebuilt audio for static prompts. Generic browser speech availability does not prove local synthesis. If no local reading path works, disclose that limitation and retain semantic text controls; do not quietly upload private text to provide speech.

Visual users may choose a safe crop and opaque masks locally. Re-encode the result to flatten masks and remove metadata; never upload an image with removable overlay layers. Consent applies to the exact approved payload hash and source version. Server validation is defense in depth and cannot undo a raw upload.

Target selection identifies what “this” refers to; it is separate from privacy consent. A click/tap in our preview maps to normalized coordinates and a proposed label. Offer the same label through keyboard selection. Store selectedTarget as labelId plus optional normalized region and sourceVersion. A selection must not automatically include a neighboring entered value. If two labels overlap or the OCR is uncertain, ask which one the user means.

Any source switch, new screenshot, scrolling/layout change, or relevant page transition invalidates selection and approval. Bind masks, target, question, and result to the same sourceVersion. Clear obsolete selection and ask again; never reuse coordinates across a changed layout. Do not claim visibility into the user’s external clicks.

## 6 Capture and turn lifecycle

Define a CaptureSource adapter with capabilities, start, snapshot, and stop. Implement desktop capture and uploaded screenshot now. Future native adapters supply the same approved-context envelope. Feature detection controls the UI; mobile currently receives screenshot assistance, not whole-phone capture.

For desktop capture, ask for video only, keep the stream local, and inspect small preview frames at a target of about one per second. This is local change detection, not continuous cloud inference. Background throttling can prevent that rate. A meaningful change marks context dirty. On a question or confirmed next step, request a fresh decoded frame; if freshness cannot be established, ask for a new view and stop claiming live context.

For screenshot mode, label the context as an uploaded image with its timestamp. Never imply that it reflects later navigation. Limit input to PNG/JPEG/WebP, 5 MiB and 12 megapixels, checked from decoded dimensions and signatures. Reject SVG, remote image URLs, empty images, and excessive dimensions. Output crops should remain readable; target longest side 1600 px only when text remains legible.

| State group | Required states and transitions |
| --- | --- |
| Context | None, capturing, review required, approved, stale, stopped. Track ended immediately invalidates live context. |
| Turn | Idle, queued, processing, clarification, answered, canceled, failed. Exactly one active logical turn per user. |
| Microphone | Off, permission requested, recording, transcribing, paused. No hidden persistent recording. |
| Playback | Muted, ready, playing, stopped, failed. Failure retains readable answer text. |

The primary sequence is choose language, authenticate, choose input/context, review safe context, ask, clarify or answer, perform one action, confirm readiness, refresh if changed, and finish. General drafting may skip capture entirely. User confirmation is not evidence that excluded input values are correct.

Use requestId plus sourceVersion to discard obsolete responses. Stop/cancel aborts local work and pending provider stages; upstream processing may already be billable. Stop sharing releases tracks immediately without waiting for feedback or server success. Ending a session also stops recording/playback and clears its image. Closing only the floating panel preserves the session in the dashboard.

## 7 Language processing and grounded answers

Represent inputLocale, replyLocale, interfaceLocale, and draftLocale separately. Support en-IN, hi-IN, bn-IN, mr-IN, te-IN, ta-IN, and ur-IN in provider adapters, mapping to each API’s actual supported codes. Unicode typing and mixed English labels are required. Ask about ambiguous romanized input instead of silently switching reply language.

Voice turns perform consented STT, transcript correction/clarification, text privacy filtering, English translation when needed, one Gemini answer call, output translation, and optional TTS. Typed or muted turns skip unused stages. English-to-English turns skip translation. Wording cleanup belongs in the answer call; avoid a separate paid rephrasing request. Typical non-English voice input can require five provider calls before retries.

Use stable label IDs and segmented answers. Translate prose, then restore protected labels deterministically and validate them. Captions preserve exact screen labels such as Contact Details or Compose; speech uses a tested pronunciation representation. Never alter a label to match an imagined button. Localized common error/permission prompts should use reviewed catalogs and cached non-sensitive audio.

For drafting, ask the desired draft language when not specified and retain it within the task. If Hindi guidance and an English email are requested, Gemini’s English draft remains English while explanationEn is translated to Hindi. For other draft languages, translate the draft separately to draftLocale. Provide separate Copy draft and Read draft actions; do not speak the draft in the wrong language by routing it through replyLocale. Use placeholders for excluded names, addresses, or dates; the user reviews and sends manually.

Require structured output fields: status, taskKind, observedContext, explanationEn, draftEn when requested, nextStep, referencedLabels, evidenceIds, requiresFreshContext, and completionBasis. Allowed status values are answer, clarify, and insufficient_context. CompletionBasis is user_reported, observed_safe_confirmation, or not_completed. Validate schemas and evidence before displaying or speaking; never stream unchecked model tokens.

Each answer states its basis: approved context, user description, reviewed reference, or draft. Rules about eligibility, charges, deadlines, or declarations require a relevant official source with title, URL, checkedAt, applicable task/jurisdiction, and approved excerpt. A small bundled registry covers demo rules; arbitrary live browsing is not part of this build. Missing, stale, or conflicting references yield a limitation. Page text is untrusted data and cannot change system rules or trigger actions.

Sarvam remains selected. Starting model targets are saaras:v3 STT, sarvam-translate:v1 translation, and bulbul:v3 TTS, all configurable and subject to actual-account checks. Do not substitute a model merely because an alias sounds newer. Test seven-language STT, translation, speech, errors, mixed labels, and Urdu RTL/TTS before claiming complete coverage. [Sarvam STT](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe), [translation](https://docs.sarvam.ai/api-reference/text/translate-text), [TTS](https://docs.sarvam.ai/api-reference/text-to-speech/convert)

## 8 API contracts and cancellation

Use /api/v1, HTTPS, JSON for normal records, and multipart for a turn with one approved image. Require a Firebase bearer token and derive uid server-side. Email verification gates provider-consuming operations; account help and verification recovery remain available. Every nested resource query must enforce ownerUid. Return safe errors containing code, messageKey, requestId, and retryAfterMs when applicable.

| Method and path under /api/v1 | Contract |
| --- | --- |
| GET /health and /ready | Liveness and DB/config readiness; no billable provider probes. |
| GET and PATCH /me | Preferences, including interface/reply language, speech, accessibility and history settings. |
| POST and GET /sessions | Create a session or list opted-in history with pagination. |
| GET and DELETE /sessions/:id | Owner-only view or deletion; deletion blocks late writes. |
| POST /sessions/:id/transcriptions | Bounded audio plus explicit cloud-speech consent; returns editable transcript. |
| POST /sessions/:id/turns | Sanitized question, locale/draft settings, source and target metadata, optional approved image. |
| POST /sessions/:id/turns/:requestId/cancel | Cancel pending work; client also aborts and ignores late results. |
| POST /sessions/:id/turns/:requestId/audio | Generate/replay validated answer or draft segment in its correct locale. |
| POST /sessions/:id/end | Mark ended; browser independently releases its media tracks. |
| POST /feedback and DELETE /me | Consented sanitized feedback; recent-auth account deletion workflow. |

Turn metadata includes requestId, question, inputLocale, replyLocale, draftLocale if relevant, inputMode, taskKind and audioReply. source may be null for general help. Otherwise include kind, version, capturedAt, sanitizedHash, contextMode, reviewedLabels, selectedTarget, and userReviewed. No raw OCR or remote URL. userReviewed records consent, not a privacy guarantee.

Initial bounds: question 2,000 characters; recording 25 seconds with manual start/stop and timer; one active turn/user; queue maximum 20 and queue wait 15 seconds. Start a separate execution deadline on dequeue, initially 30 seconds, with per-call timeouts capped by the remaining deadline. Thus the total wait can reach 45 seconds; communicate queue and processing separately. Tune with measurements.

Use fetch streaming for accepted, progress, clarification, answer, audio_available, error, and done events. Buffer and validate final output before answer delivery. Each event carries requestId and sourceVersion. Authenticated audio uses a short-lived binary response, not a public storage URL. Cache replay locally for the active session only.

Enforce idempotency with a unique ownerUid/requestId and payload fingerprint. Same ID with a different payload returns 409. Reconnect does not automatically replay a billable request. Check session status and ownership again before saving a reply. Canceled/deleted sessions must not be recreated by provider completion.

## 9 Credentials and quota behavior

Provide four Gemini slots and three Sarvam slots. Require one usable credential per selected provider; allow empty secondary slots. Assign every slot an explicit quota-group ID and treat unknown grouping conservatively as shared. Secrets exist only in the server environment or mounted secrets, never in frontend bundles, logs, database documents, or exported configuration.

Gemini limits are associated with the project, not individual API keys. Multiple keys in one project share allowance. Application caps must be based on the actual provider dashboard; four keys are not a promise of four times the capacity. [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

Default routing is primary with permitted failover. Reserve capacity atomically for group, model and operation before calling a provider. Healthy-key rotation within a group may be supported operationally, but it must not reset that group’s budget. Confirm Sarvam account/quota scope with the actual account. Never cycle identities to evade access or allowance restrictions.

| Provider result | Scheduler behavior |
| --- | --- |
| Bad request | Return validation failure; no key rotation. |
| Invalid credential | Disable that slot and use a legitimate configured replacement if available. |
| Policy, region or permission denial | Surface configuration/access failure; do not evade through another identity. |
| Temporary 429 | Cool down the entire affected group, honor Retry-After, bounded jittered retry. |
| Daily or billing exhaustion | Mark group unavailable until reset/operator action; same-group keys cannot solve it. |
| Network error or 5xx | Retry only within permitted remaining time and attempt budget. |
| No eligible capacity | Localized busy message with retry hint; preserve the question and draft. |

Cap each provider operation at two attempts total and cap extra retries across a turn at two. Stop launching stages after cancellation or deadline expiry. Do not repeat an already successful STT or answer stage just because TTS failed. Track non-secret slot IDs, usage, cooldown and error category only.

Persist metadata-only quota reservations to survive restart. Use conservative reservation estimates and reconcile actual usage when available. Queue ordering should be fair across users, with one active lease per user and per-user abuse limits. Routine screen changes must never create provider traffic. Additional paid capacity or an approved quota increase is the scaling route.

## 10 MongoDB identity and retention

Firebase is the only password and verification authority. Do not store password hashes or implement an unrelated custom JWT password system. Firebase ID tokens supply JWT-based API authentication; signature/issuer/audience/expiry are verified by Firebase Admin, with revocation/recent-auth checks for sensitive actions. Refresh verification state after the user verifies email.

| Collection | Required fields and indexes |
| --- | --- |
| users | Unique firebaseUid; reply/interface locale, speech rate, mute, screenReaderMode, text scale, chat pin/shortcut settings, saveHistory, onboardingVersion, timestamps. |
| sessions | ownerUid, status, taskKind, draftLocale, latestSourceVersion, sanitized title/summary, historyEnabled, expiresAt; ownerUid/updatedAt index and TTL. |
| messages | ownerUid, sessionId, requestId, role, sanitized text/draft, locales, evidence IDs, completionBasis, expiresAt; unique ownerUid/requestId/role and owner/session/date index. |
| feedback | ownerUid, optional sessionId, safe text/rating, locale, saveConsentAt, expiresAt; owner/date and TTL indexes. |
| requestRecords | ownerUid, requestId, fingerprint, status, leaseUntil, optional result reference, expiresAt; unique owner/request and TTL. |
| quotaWindows | groupId, model, operation, windowStart, reserved requests/tokens, expiresAt; unique group/model/operation/window and TTL. |
| providerHealth | groupId, slotId, state, reasonCode, retryAt; unique group/slot/operation. No key values. |

History defaults off. Unsaved transcript content remains in bounded volatile memory and expires at session end or 15 minutes idle; warn before discarding an active user’s unsent local draft. Metadata-only session/lease records may exist without conversation content. Opted-in sanitized history defaults to 30 days and consented feedback to 90 days. Request deduplication metadata lasts 24 hours. These are proposed product policies to display, not hidden defaults.

Raw screenshots and audio are not stored. Drop temporary buffers at request completion/cancellation and revoke local URLs at session end. Do not log questions, OCR, email bodies, credentials, or form values. Disable telemetry/session replay capture for sensitive panels and media routes. Do not cache authenticated API/media responses through a service worker.

Enforce expiry in every query; TTL deletion is asynchronous. On deletion, mark the session inaccessible first, cancel work, then delete owned content so late writes cannot revive it. Account deletion requires recent authentication and a retryable job covering MongoDB and Firebase. A partial failure remains pending and blocks normal access. Document backup retention; never promise immediate deletion from every backup without implementing it.

Use conditional updates and unique indexes for leases/reservations in the single-replica build. Do not assume multi-document transactions on a standalone development Mongo container. If transactions become necessary, deploy a replica set. No database transaction makes an external AI call exactly once.

## 11 Docker and README implementation contract

Docker is the normal development path. The implementation repository must include apps/web, apps/api, shared packages, pnpm-workspace.yaml, a committed lockfile, .env.example, Compose configuration, Dockerfiles, and a README. Existing ZIP templates do not contain a finished app; reconcile them with this revision before claiming they run.

Compose should start web, API, and authenticated MongoDB with a named data volume. Development endpoints are web localhost:3000 and API localhost:3001. Inside containers use the service name mongo for the database, not localhost. The browser uses the externally reachable API origin. A same-origin HTTPS proxy with /api forwarding simplifies production CORS and streaming.

Use frozen dependency installs and health-based startup ordering. Production images use multi-stage builds, minimal runtime output and non-root users. Keep the database private in deployment; bind development DB access to localhost only if needed. Mount Firebase Admin credentials read-only, and pass provider secrets only to the API. Never COPY .env or credential JSON into an image. Persisting a local volume is not a backup strategy.

The README must document prerequisites, Firebase email/password configuration and authorized domains, secret setup, model availability checks, startup/shutdown, data persistence, synthetic seed data, testing, troubleshooting, and known limits. Give exact repository-verified commands only after implementation. Planned commands are docker compose up --build, docker compose logs -f api, and docker compose down; validate them against final service names. Explain that deleting volumes destroys local data; do not include volume deletion in normal shutdown.

Include a smoke sequence: start services; check readiness; sign in and verify email; ask a typed safe question; upload a synthetic screenshot; test voice; exercise keyboard chat; delete history; stop sharing. Provider diagnostics should be explicit authenticated/operator actions with synthetic content and no secrets in output, not billable readiness probes.

Phone testing needs trusted HTTPS; a phone’s localhost is not the developer laptop. Explain unsupported desktop capture on mobile and offer upload immediately. For quota errors check provider project/group limits, not the number of keys. For unreadable capture ask for a clearer approved view rather than repeatedly billing the model.

## 12 Environment configuration contract

Create a real .env.example using the following blank credential slots. The syntax is a proposed configuration contract, not a tested deployment. Load public Firebase configuration separately from API secrets. Never expose GEMINI_API_KEY or SARVAM_API_KEY through NEXT_PUBLIC variables. Mount the Firebase Admin file at the path below in the API container.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-admin.json
REQUIRE_EMAIL_VERIFIED=true
MONGO_DATABASE=digital_assistant
MONGO_ROOT_USERNAME=guide_admin
MONGO_ROOT_PASSWORD=
MONGODB_URI=
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_API_KEY_4=
GEMINI_QUOTA_GROUP_1=gemini-project-main
GEMINI_QUOTA_GROUP_2=gemini-project-main
GEMINI_QUOTA_GROUP_3=gemini-project-main
GEMINI_QUOTA_GROUP_4=gemini-project-main
GEMINI_MODEL=
GEMINI_FALLBACK_MODEL=
SARVAM_API_KEY_1=
SARVAM_API_KEY_2=
SARVAM_API_KEY_3=
SARVAM_QUOTA_GROUP_1=sarvam-account-main
SARVAM_QUOTA_GROUP_2=sarvam-account-main
SARVAM_QUOTA_GROUP_3=sarvam-account-main
SARVAM_STT_MODEL=saaras:v3
SARVAM_TRANSLATION_MODEL=sarvam-translate:v1
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=shubh
```

Set MONGODB_URI to the actual restricted application connection string; development root credentials are only for local setup. Keep all slots sharing an account/project in the same quota group. Select a stable image-capable Gemini model available in the actual account. A fallback model is disabled until quality and access checks pass.

### Runtime defaults to implement

The following are application caps and policies, not provider allowances or measured performance. Validate environment values at startup and fail readiness if required credentials, origins, or quota policy are missing.

```env
PORT=3001
API_ALLOWED_ORIGINS=http://localhost:3000
KEY_ROUTING_MODE=primary-failover
PROVIDER_MAX_ATTEMPTS=2
TURN_MAX_EXTRA_RETRIES=2
PROVIDER_TIMEOUT_MS=20000
TURN_EXECUTION_DEADLINE_MS=30000
MAX_ACTIVE_TURNS_PER_USER=1
MAX_QUEUED_TURNS=20
QUEUE_TIMEOUT_MS=15000
GEMINI_APP_RPM_CAP=5
SARVAM_APP_RPM_CAP=10
QUOTA_POLICY_PATH=/app/config/quota-policy.json
CLOUD_SPEECH_ENABLED=true
STRICT_PRIVACY_MODE=false
SCREEN_CONTEXT_MODE=reviewed-labels-or-crop
PERSIST_RAW_MEDIA=false
HISTORY_DEFAULT_ENABLED=false
HISTORY_RETENTION_DAYS=30
FEEDBACK_RETENTION_DAYS=90
VOLATILE_SESSION_IDLE_MINUTES=15
CAPTURE_SAMPLE_INTERVAL_MS=1000
MAX_IMAGE_BYTES=5242880
MAX_IMAGE_PIXELS=12000000
MAX_AUDIO_SECONDS=25
LOG_LEVEL=info
```

Store per-user accessibility and language preferences in application records, not global environment values. Strict privacy disables cloud microphone upload regardless of an old consent flag. CLOUD_SPEECH_ENABLED permits the feature; it does not replace individual consent. Changing the old TURN_DEADLINE_MS template to TURN_EXECUTION_DEADLINE_MS is deliberate: queue wait and execution now have explicit separate budgets.

## 13 Accessibility and security release gates

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

## 14 User evaluation and build sequence

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

## 15 Future client upgrade path

Retain versioned API contracts, Firebase identity, preferences, locale catalogs, protected labels, privacy rules, task state, and quota orchestration. Capture adapters and accessible UI remain platform-specific. Reuse shared logic rather than attempting to reuse desktop DOM controls on a phone.

A future React Native client can use Expo development builds with custom native modules. Android capture needs native MediaProjection consent and lifecycle handling; iOS requires separate platform capture integration and testing. Neither responsive CSS nor an installed website grants whole-phone capture. Native screen capture must still pass through local privacy review before cloud processing.

An optional browser extension can later extract permitted structured labels and offer in-page bilingual translation and chat on supported sites. It must exclude entered values and private text outside input boxes. Screen-sharing permission alone does not enable changing the actual external website language. The current website offers translated guidance or a companion view.

Before broader deployment, improve accessible safe extraction, test third-party website barriers, validate real-user data terms, and add approved-reference freshness workflows. On-device recognition/read-back is a separate capability with explicit tests. Add shared queue infrastructure and horizontal scaling only when demand requires them. Starting a native spike is not equivalent to publishing a reviewed app-store release.

### Reference and implementation status

The inline sources support browser, identity, quota, accessibility, and provider boundaries. Model access, codec support, browser behavior, and language quality still require actual-account/device tests. Use official documentation during implementation, including Next.js deployment, NestJS, Docker Compose readiness, MongoDB TTL, Expo custom native code, and Android MediaProjection. Pin validated versions in the repository and record test results there.

This deliverable closes the planning gaps. The next milestone is a runnable website satisfying the release gates, not a claim that those gates have already passed.
