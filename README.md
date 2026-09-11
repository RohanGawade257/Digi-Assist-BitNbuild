# Digital Assistant

An accessible multilingual guide to unfamiliar websites, forms, registration and email drafting. It helps older adults, people facing language or digital-literacy barriers, and people with disabilities. The user performs all external actions.

The voice journey connects language activation, spoken onboarding, local speech detection, automatic Sarvam/Gemini turns, captions, answer audio and listening resumption. Approved-image follow-ups run only after exact image consent. Real synthetic browser/provider journeys passed in Hindi, English, Bengali, Marathi and Telugu. Tamil's provider chain runs, but its latest accuracy check failed; Urdu speech output remains unavailable. Physical microphones, native-app focus and human language quality still need verification. See [progress](progress.md), [handoff](context.md), [validation](docs/validation.md), [API](docs/api.md), and [OpenAPI](docs/openapi.json). Fixtures alone are **not** live-provider evidence.

## What is implemented

- Activating a language selects the interface/input/reply locale, plays its pregenerated Sarvam introduction, requests microphone permission and then listens. Focus alone does not activate voice. Start voice assistant is the retry action; Continue keeps typing available.
- Enter and Send use the same guarded submission path; Shift+Enter inserts a newline, IME confirms composition, and failures keep the draft with Retry. Contextual Help appears once per step, stays dismissible, and never steals focus.
- Language selection before login; English, Hindi, Bengali, Marathi, Telugu, Tamil and Urdu interface/text paths, including Urdu RTL. Input, interface, assistance and draft languages remain independent.
- Firebase email/password login, signup, verification/reset and memory-only browser authentication. Firebase Admin validates identity/revocation; Mongo queries enforce ownership.
- Gemini structured guidance with Sarvam translation through English; Hindi assistance can accompany an English email draft. Exact reviewed labels are protected during translation.
- Local screenshot preview and desktop capture with two explicit modes: approved-image analysis, or manually reviewed labels only. Crop and solid masking run locally; numeric area fields provide a keyboard alternative to dragging. The exact final preview is hashed and approved separately. Shared-view changes revoke approval; sending performs another local freshness check.
- Voice mode uses self-hosted Silero VAD locally: 800 ms leading audio, minimum 450 ms speech, a default 2-second silence interval adjustable to 3.5 or 5 seconds, and a 25-second cap. It submits once after speech, stops microphone tracks during processing/playback, speaks the owned answer and resumes listening. No barge-in or continuous cloud streaming is claimed. Manual recording with editable transcript review remains available.
- Voice activation discloses automatic Sarvam transcription and Gemini questions. Exact image approval stays separate. Answer playback has captions, repeat, slower, pause and End controls; typing pauses active voice. Urdu retains the explicit speech-output limitation.
- Keyboard/touch chat, pin, Escape/focus return, Unicode/IME guard and supported Document Picture-in-Picture with preserved drafts. Other browsers use the in-page panel beside the external website.
- Saved preferences; history off by default. Optional saved sessions retain their latest 50 turns for 30 days. End preserves opted-in history; Delete erases it. Optional feedback starts with no rating selected, works after End assistance, requires consent and expires after 90 days. Account deletion requires recent authentication and removes Firebase identity and owned application data.
- Bounded provider streams/deadlines, cancellation, persistent turn/transcription deduplication, shared atomic Mongo quotas, bounded queue/retries and same-account credential replacement.

**Accepted limitation:** Sarvam Bulbul v3 does not list Urdu speech output. Urdu text remains supported; Urdu audio is disabled before billing. Tamil also needs an accuracy repair or native validation: Sarvam misrecognized the short synthetic question even without VAD cutting it. [Sarvam's supported TTS languages](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/how-to/set-the-language).

No external clicking, submission, payments or email sending occurs. Official-rule questions receive an explicit evidence limitation. No raw screenshot, unreviewed OCR or recording is persisted.

## Repository

- `apps/web`: Next.js UI, Firebase client, capture/recording and localized controls.
- `apps/api`: NestJS, Firebase Admin, Mongo, sessions, quotas and provider adapters.
- `packages/contracts`: strict shared schemas, label protection and media validation.
- `config`, `docker`, `compose.yaml`: local deployment and quota template.
- `tests/browser`, `apps/api/test`: Playwright/axe, core and Mongo integration tests.
- `scripts/export-openapi.cjs`, `scripts/localize-ui.cjs`: contract/copy consistency checks.

Git branch is `main`; user work is preserved. Credentials, root `.env`, local quota policy, build outputs and test traces are ignored. Dependencies and container bases are pinned; the lockfile is reproducible.

## Start with Docker (PowerShell)

Docker Desktop must be running Linux containers. Setup preserves existing configuration and generates only local Mongo credentials.

```powershell
powershell -NoProfile -File scripts/setup-local.ps1
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Website: **http://localhost:3000**. API health: **http://localhost:3001/api/v1/health**. Readiness: **http://localhost:3001/api/v1/ready**. Project MongoDB: **127.0.0.1:27018**; an unrelated service on 27017 is preserved.

Readiness requires Mongo, identity and the Gemini operation policy. Sarvam translation, transcription and speech output expose independent readiness flags and stay gated if their own policies are pending; they do not block English Gemini-only questions. Use `docker compose down` to stop while retaining data; adding `-v` deletes the database volume. Do not print full `docker compose config` to shared logs because it expands secrets.

## Configuration

Edit the ignored root `.env` and `config/quota-policy.json` locally. Server keys must never use a `NEXT_PUBLIC_` name.

1. Enable Firebase Email/Password and authorize localhost. Set the four public Firebase fields in `.env.example`. Verification/reset emails are initiated only through the account UI.
2. Put the matching Admin JSON at `secrets/firebase-admin.json` and set `FIREBASE_PROJECT_ID`. Compose mounts it read-only. Host paths resolve from `apps/api`.
3. Set a supported `GEMINI_MODEL` and `GEMINI_API_KEY_1`. Slots 2–4 are optional.
4. Set `SARVAM_API_KEY_1`; slots 2–3 are optional. Implemented models are `sarvam-translate:v1`, `saaras:v3` and `bulbul:v3` (speaker `shubh`). STT/TTS choices are fixed to the validated adapter contracts.
5. Use quota schema v3 from `config/quota-policy.example.json`: each account group has separate API operations and per-metric statuses. `verified` requires a positive value and evidence; `unpublished` requires evidence and has no invented value; `unverified` keeps that API gated. A verified RPM cap is required. Mark each operation verified only after establishing its applicable policy. Keys on one account share that operation budget; secondary identities never evade a cap. Legacy v2 remains readable.
6. Cloud microphone upload defaults off: `STRICT_PRIVACY_MODE=true`. This local instance now uses `false` with the user's explicit approval. In-app voice activation consent or manual recording-upload consent remains mandatory; image approval is separate.
7. Rebuild/restart with `docker compose up --build -d`. Public Firebase configuration is embedded in the web build.

Current setup: Firebase Admin and provider credentials validate. The user confirmed Gemini 3.5 Flash Lite at 15 RPM, 250000 TPM and 500 RPD. Sarvam free tier is treated as Starter: translation 60 RPM, REST transcription 60 RPM and Bulbul v3 30 RPM. Its REST TPM/RPD values are unpublished, not guessed or claimed unlimited. Policies and cooldowns are per API; each account's keys share them. These values are recorded only in the ignored local policy, not pre-verified in the template. [Sarvam rate-limit table](https://docs.sarvam.ai/api/getting-started/ratelimits).

```powershell
pnpm --filter @guide/api probe:local
```

This command reports configuration validity without network requests or secrets. `probe:config` additionally authenticates to Google's official model-metadata endpoint; it does not generate content. Those metadata/configuration probes and real password login/protected API access have passed. Signup verification-email delivery remains unverified. See `docs/validation.md` for generation results; metadata alone is not generation evidence.

### Login / registration troubleshooting

The earlier Firebase setup failure is resolved. Latest remote checks return HTTP200, Email/Password is enabled, and localhost is authorized. All four public Firebase fields match the running web bundle; server/web/Admin projects agree. Real browser password sign-in and the protected preferences API passed using a temporary synthetic account, which was then removed with its owned data. No verification or reset email was sent.

Use **http://localhost:3000**. The current Firebase authorized-domain list includes localhost, but not 127.0.0.1. If failures recur, check Authentication -> Sign-in method -> Email/Password in the project named by NEXT_PUBLIC_FIREBASE_PROJECT_ID, then compare that project's web app configuration with the four public fields in .env. Rebuild web after public environment changes. [Firebase password-auth setup](https://firebase.google.com/docs/auth/web/password-auth).

```powershell
node scripts/probe-firebase.cjs
node scripts/probe-firebase.cjs --remote
```

The first command compares local configuration and the running bundle and checks configured server secrets are absent from served HTML/JavaScript. The remote option also reads Google's public/Admin Auth configuration. Both print safe flags only; neither creates users, sends mail or changes settings.

Localized errors appear beside account controls. Signup validates the form before requesting Firebase; if account creation succeeds but email delivery fails, a resend path remains. Extension contentscript.js warnings and this app's deliberately disabled camera permission are separate from Firebase HTTP400 responses.

An opt-in developer check, `node scripts/check-live-auth.cjs --run`, creates a unique preverified synthetic account, signs in through the real browser/Firebase path and exercises the real API. It cleans up only that test identity and its owned data; a UID-only deletion tombstone may remain. It sends no email and does not verify normal signup/email delivery. Do not use it for real user accounts.

## Host development and checks

Tested host: Node22.20.0, pnpm10.30.3. Containers: Node24.13.0 and Mongo8.0.20, pinned by digest. Baseline majors: Next16, React19, Nest11, Firebase12, Admin14, Mongo driver7, TypeScript5.9.

```powershell
pnpm install --frozen-lockfile
docker compose up -d mongo
docker compose stop api web
pnpm dev
```

The web loads root public environment values; API development compiles on startup and needs a restart after API changes. Docker and host development cannot both occupy ports3000/3001.

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
pnpm check:docs
pnpm audit --prod
```

Browser tests need local Mongo and either the running Docker web or a host production build. They start an isolated fixture API on4101; Firebase REST responses and AI are explicit test doubles. No production auth bypass or fake-answer mode exists. Tests create unique `guide_test_*` databases and delete only their own database. Playwright teardown also performs cleanup on Windows. Use `pnpm docs:api` after shared schema changes.

Latest results (2026-09-11): **20 core tests, ten real-Mongo scenarios plus parent, and 30 browser tests pass**. The browser suite covers all four text/voice and screenshot/shared-view combinations. Production dependency audit: **zero known vulnerabilities**. TypeScript, production builds, API/copy consistency checks and container smoke checks pass. `docs/validation.md` records the evidence and test isolation. Automated axe checks do not establish screen-reader or native-language quality.

Run `node scripts/check-live-image.cjs --run` for an opt-in real synthetic screenshot/Gemini/Sarvam check with exact temporary-account cleanup. Run it after browser tests, because Playwright replaces test-results. This sends only its generated synthetic image and question, never user media or emails.

For reproducible visual captures, run `node scripts/inspect-ui.cjs` against the running website. It saves desktop, enlarged mobile and Urdu mobile images under ignored `test-results/inspection/`, and reports mobile overflow without using an account or provider.

## Privacy, recovery and limits

Default-off content lives in browser memory and a bounded six-turn server cache with 15-minute idle expiry. Idle warnings preserve typed drafts. Account-deletion tombstones contain only the Firebase UID and deletion flag to block late writes. Saved content and feedback are owner-filtered and expiry-checked before Mongo TTL cleanup.

Screenshots support PNG/JPEG/WebP under5MiB/12MP, with header checks before decoding. Desktop frames are sampled locally; dynamic pages may require frequent review. The browser normalizes approved images to metadata-free PNG (at most 1600 pixels per side); the API permits at most 2 MiB, 2048 pixels per side and 4 MP, checks full PNG structure/raster/hash, and authenticates before parsing the 3 MiB turn envelope. The preview is exactly the bytes sent through Gemini inlineData. Image and source-version changes require fresh approval. Images are not saved in app history or logs. Masking does not guarantee privacy: inspect the final image yourself. If visual review is difficult, select labels only or remove the source and type a public instruction. No automatic uploads or continuous cloud streaming occur; analysis runs only on questions. Every image is a snapshot, never a live view.

Canceling discards late results but cannot guarantee an upstream request was unbilled. A reused turn/transcription ID fails safely. Queue wait is bounded to15 seconds. Translation/generation calls allow45 seconds within a90-second turn; speech calls allow20 seconds within a30-second operation. Upstream timeouts use504 rather than408 to prevent automatic POST replay. Deployment supports one API replica because cancellation/context are process-local.

Human screen-reader testing, native listening, physical capture/microphone devices, signup/email delivery, remaining live translation/STT combinations, and representative-user evaluation remain open. There is no public deployment. Production hardening such as minimal runtime images, HTTPS, restricted Mongo credentials and backup policy must be completed before public hosting.
