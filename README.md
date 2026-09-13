# VaaniSetu — Voice-First Digital Access Assistant

> A multilingual, voice-first accessibility layer that allows people who cannot comfortably read, type, navigate complicated websites, or understand English interfaces to access digital information simply by talking.

VaaniSetu provides an accessible, voice-guided companion for navigating unfamiliar websites, forms, public portals, and drafting communications. It acts as an intelligent assistant with speech interaction, smart screen analysis via Document Picture-in-Picture, and privacy-preserving approval flows.

Currently supported languages: **Hindi (हिन्दी), English, Bengali (বাংলা), Marathi (मराठी), and Telugu (తెలుగు)**.

---

## Project Links And Submission Checklist

- **Live website:** [VaaniSetu](https://digi-assist-bit-nbuild-web-pi.vercel.app/)
- **Public repository:** Set the GitHub repository visibility to **Public** before submission.
- **Unstop submission:** Enter the public GitHub repository URL in Unstop's designated GitHub field.
- **Team submission:** The team leader or any team member may submit the repository link.
- **Source code:** Application code is in `apps/`, shared contracts are in `packages/contracts`, and tests are in `tests/` and `apps/api/test/`.
- **Secrets:** Never commit passwords, API keys, Firebase Admin credentials, private keys, `.env` files, generated builds, or test artifacts. Local environment files and `secrets/` are excluded by `.gitignore`.

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| Web application | Next.js 16, React 19, TypeScript |
| Backend API | NestJS 11, Express 5, TypeScript |
| Authentication | Firebase Authentication and Firebase Admin |
| Database | MongoDB 8 through the MongoDB Node.js driver |
| AI and speech | Google Gemini for guidance and vision; Sarvam AI for translation, speech-to-text, and text-to-speech |
| Browser capabilities | Document Picture-in-Picture, screen capture, Web Audio, and client-side VAD |
| Testing and tooling | Playwright, axe-core, Node test runner, pnpm, and Docker Compose |

## What This Project Does

VaaniSetu helps people understand and complete unfamiliar digital tasks using voice or typed questions in supported Indian languages. Users can request step-by-step guidance, upload a screenshot or share a supported desktop source, and review responses before taking actions themselves. The assistant does not click, submit forms, make payments, or send email on the user's behalf.

## 🚀 Quickstart: Run Locally in 5 Minutes (Beginner Guide)

Follow these step-by-step instructions if you have just cloned the repository and want to run it on your machine.

### 📋 Prerequisites

Before starting, make sure you have the following installed:
1. **Node.js**: Version `22.20.0` or higher ([Download Node.js](https://nodejs.org/))
2. **pnpm**: Version `10.x` or higher  
   *If you don't have pnpm installed, run:*
   ```bash
   npm install -g pnpm
   ```
3. **Docker & Docker Desktop** (Recommended for running MongoDB easily): ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/))  
   *Ensure Docker Desktop is open and running.*
4. **Git**

---

### Step 1: Clone and Navigate to the Repository

```bash
git clone <YOUR-REPOSITORY-URL>
cd bitNbuild
```

---

### Step 2: Install Dependencies

Install all dependencies across the monorepo using `pnpm`:

```bash
pnpm install
```

---

### Step 3: Configure Environment Variables

Create your local `.env` file by copying the template:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **macOS / Linux (Bash):**
  ```bash
  cp .env.example .env
  ```

Now, open the newly created `.env` file in your code editor (e.g., VS Code). You will configure three main services:

#### 1. Google Gemini AI (Required for answering questions & vision analysis)
- Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
- Fill in:
  ```env
  GEMINI_MODEL=gemini-2.5-flash
  GEMINI_API_KEY_1=your_gemini_api_key_here
  ```

#### 2. Sarvam AI (Required for Indian language translation, Speech-to-Text & Text-to-Speech)
- Obtain an API key from the [Sarvam AI Dashboard](https://dashboard.sarvam.ai/).
- Fill in:
  ```env
  SARVAM_API_KEY_1=your_sarvam_api_key_here
  ```

#### 3. Firebase Authentication (Required for private user accounts & sessions)
- Create a project on [Firebase Console](https://console.firebase.google.com/).
- Enable **Email/Password** authentication under *Authentication > Sign-in method*.
- In *Project Settings > General*, create a Web App and copy the configuration into your `.env`:
  ```env
  FIREBASE_PROJECT_ID=your-project-id
  NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
  NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
  ```
- In *Project Settings > Service accounts*, click **Generate new private key**, and save the downloaded JSON file as:
  ```
  secrets/firebase-admin.json
  ```

#### 4. MongoDB Credentials
- Run the setup helper to generate a secure local Mongo password and update your `.env`:
  ```powershell
  powershell -NoProfile -File scripts/setup-local.ps1
  ```
  *(Or manually set `MONGO_ROOT_PASSWORD` and `MONGODB_URI` inside `.env`).*

---

### Step 4: Start MongoDB Database

The easiest way to start MongoDB with all required configurations is via Docker:

```bash
docker compose up -d mongo
```
*This launches MongoDB on port `27018` in the background.*

---

### Step 5: Start the Development Server

Start both the Web Frontend and the Backend API simultaneously:

```bash
pnpm dev
```

This command will:
1. Automatically build shared contract packages (`@guide/contracts`).
2. Start the **Next.js Web Frontend** on [http://localhost:3000](http://localhost:3000).
3. Start the **NestJS Backend API** on [http://localhost:3001](http://localhost:3001).

---

### Step 6: Open the Application in Your Browser

1. Open **Google Chrome** (or Edge/Brave) and visit:
   ```
   http://localhost:3000
   ```
2. Verify backend health by checking:
   ```
   http://localhost:3001/api/v1/health
   ```
3. Select your preferred language (Hindi, English, Marathi, Bengali, or Telugu) and click **Continue** to start testing the voice assistant or screen sharing!

---

### 🛠️ Common Useful Commands

| Task | Command |
| :--- | :--- |
| **Start full project (Web + API)** | `pnpm dev` |
| **Start Web frontend only** | `pnpm --filter @guide/web dev` |
| **Start Backend API only** | `pnpm --filter @guide/api dev` |
| **Build for production** | `pnpm build` |
| **Run TypeScript typecheck** | `pnpm typecheck` |
| **Run test suite** | `pnpm test` |
| **Stop background MongoDB** | `docker compose down` |

---

### ❓ Troubleshooting FAQ

- **Port already in use error (`EADDRINUSE: 3000` or `3001`)**:  
  Make sure you don't have another dev server or container running. If Docker has web/api containers running, stop them with:
  ```bash
  docker compose stop api web
  ```
- **MongoDB connection failed**:  
  Ensure Docker Desktop is running and execute `docker compose up -d mongo`. Check that the port `27018` matches what's configured in your `.env`.
- **Microphone / Voice input not working**:  
  Ensure your browser has granted microphone permission to `http://localhost:3000`. Chrome blocks microphone access if the site is not localhost or HTTPS.
- **Floating assistant window (PiP) not appearing**:  
  The floating window uses Chrome's Document Picture-in-Picture API. Use Google Chrome or a Chromium browser version 116+ on desktop.

---

## What is implemented

- Activating a language selects the interface/input/reply locale, plays its pregenerated Sarvam introduction, requests microphone permission and then listens. Focus alone does not activate voice. Start voice assistant is the retry action; Continue keeps typing available.
- Enter and Send use the same guarded submission path; Shift+Enter inserts a newline, IME confirms composition, and failures keep the draft with Retry. Contextual Help appears once per step, stays dismissible, and never steals focus.
- Five-language selection before login. Input, interface, assistance and draft languages remain independently configurable; retired catalogs remain only for historical compatibility.
- Firebase email/password login, signup, verification/reset and memory-only browser authentication. Firebase Admin validates identity/revocation; Mongo queries enforce ownership.
- Gemini structured guidance with Sarvam translation through English; Hindi assistance can accompany an English email draft. Exact reviewed labels are protected during translation.
- Capture current screen and send reads a fresh frame on every activation after revocable, localized session/source consent. No question is required: image-only requests return an overview and a localized follow-up. Optional Review before sending and uploads retain exact-image review and approval. Frozen crops survive background pixel changes; refreshing or editing clears approval. Approved images are always described as snapshots. Label-only sources retain their separate freshness checks and text-only alternative.
- One self-hosted neural VAD stays active during playback, with browser echo cancellation/noise suppression and local playback-reference correlation. Confirmed speech pauses audio, invalidates late work, preserves 800 ms of pre-roll and submits once after approximately 2 seconds of silence (adjustable). Local PCM is transient. Stop speaking and localized stop commands remain available; speaker echo may require headphones.
- Voice activation discloses automatic Sarvam transcription and Gemini questions. Screen-sending consent and optional exact-image approval stay separate. Captions, repeat, slower, pause, typed input and End remain available.
- One portal-backed PiP window: Compact by default, automatically docks to the bottom-right corner of the desktop, auto-expands to comfortable height when chat is opened, and snaps back down to compact size when chat is closed. Pin, minimize, high contrast and reduced motion are supported. Closing returns controls and drafts to the page; End stops capture, microphone and playback.
- Liquid glassmorphic aesthetic with ambient background refraction orbs, text shimmer animations, and floating card physics.
- Custom 404 page (`/_not-found`) matching the glassmorphic brand aesthetic with multilingual navigation.
- Saved preferences; history off by default. Optional saved sessions retain their latest 50 turns for 30 days. End preserves opted-in history; Delete erases it. Optional feedback starts with no rating selected, works after End assistance, requires consent and expires after 90 days. Account deletion requires recent authentication and removes Firebase identity and owned application data.
- Bounded provider streams/deadlines, cancellation, persistent turn/transcription deduplication, shared atomic Mongo quotas, bounded queue/retries and same-account credential replacement.

**Version limitation:** Tamil and Urdu are disabled across the current language choices and new AI/speech requests. Historical catalog data is retained. Re-enabling either language needs a separate accuracy/support decision.

No external clicking, submission, payments or email sending occurs. Official-rule questions receive an explicit evidence limitation. No raw screenshot, unreviewed OCR or recording is persisted.

## Repository Structure

- `apps/web`: Next.js UI, Firebase client, capture/recording, glassmorphism design and localized controls.
- `apps/api`: NestJS, Firebase Admin, Mongo, sessions, quotas and provider adapters.
- `packages/contracts`: strict shared schemas, label protection and media validation.
- `config`, `docker`, `compose.yaml`: local deployment and quota template.
- `tests/browser`, `apps/api/test`: Playwright/axe, core and Mongo integration tests.
- `scripts/export-openapi.cjs`, `scripts/localize-ui.cjs`: contract/copy consistency checks.

Git branch is `main`; user work is preserved. Credentials, root `.env`, local quota policy, build outputs and test traces are ignored. Dependencies and container bases are pinned; the lockfile is reproducible.

## Start with Docker (Full Container Stack)

Docker Desktop must be running Linux containers. Setup preserves existing configuration and generates only local Mongo credentials.

```powershell
powershell -NoProfile -File scripts/setup-local.ps1
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Website: **http://localhost:3000**. API health: **http://localhost:3001/api/v1/health**. Readiness: **http://localhost:3001/api/v1/ready**. Project MongoDB: **127.0.0.1:27018**; an unrelated service on 27017 is preserved.

Readiness requires Mongo, identity and the Gemini operation policy. Sarvam translation, transcription and speech output expose independent readiness flags and stay gated if their own policies are pending; they do not block English Gemini-only questions. Use `docker compose down` to stop while retaining data; adding `-v` deletes the database volume. Do not print full `docker compose config` to shared logs because it expands secrets.

## Advanced Configuration & Quotas

Edit the ignored root `.env` and `config/quota-policy.json` locally. Server keys must never use a `NEXT_PUBLIC_` name.

1. Enable Firebase Email/Password and authorize localhost. Set the four public Firebase fields in `.env.example`. Verification/reset emails are initiated only through the account UI.
2. Put the matching Admin JSON at `secrets/firebase-admin.json` and set `FIREBASE_PROJECT_ID`. Compose mounts it read-only. Host paths resolve from `apps/api`.
3. Set a supported `GEMINI_MODEL` and `GEMINI_API_KEY_1`. Slots 2–4 are optional.
4. Set `SARVAM_API_KEY_1`; slots 2–3 are optional. Implemented models are `sarvam-translate:v1`, `saaras:v3` and `bulbul:v3` (speaker `shubh`). STT/TTS choices are fixed to the validated adapter contracts.
5. Use quota schema v3 from `config/quota-policy.example.json`: each account group has separate API operations and per-metric statuses. `verified` requires a positive value and evidence; `unpublished` requires evidence and has no invented value; `unverified` keeps that API gated. A verified RPM cap is required. Mark each operation verified only after establishing its applicable policy. Keys on one account share that operation budget; secondary identities never evade a cap. Legacy v2 remains readable.
6. Cloud microphone upload defaults off: `STRICT_PRIVACY_MODE=true`. This local instance uses `false` with explicit approval. In-app voice activation consent or manual recording-upload consent remains mandatory; image approval is separate.
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
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
pnpm check:docs
pnpm audit --prod
```

Browser tests need local Mongo and either the running Docker web or a host production build. They start an isolated fixture API on 4101; Firebase REST responses and AI are explicit test doubles. No production auth bypass or fake-answer mode exists. Tests create unique `guide_test_*` databases and delete only their own database. Playwright teardown also performs cleanup on Windows. Use `pnpm docs:api` after shared schema changes.

Current focused results are in progress.md; use `pnpm exec playwright test tests/browser/capture-send.spec.ts --workers=1 --output=test-results/capture-focused`. Earlier full-suite/provider evidence in docs/validation.md predates the compact workspace and is historical, not a claim that the old suite was rerun. Automated checks do not establish physical microphone, native-app focus, screen-reader or human language quality.

Run `node scripts/check-live-image.cjs --run` for an opt-in real synthetic screenshot/Gemini/Sarvam check with exact temporary-account cleanup. Run it after browser tests, because Playwright replaces test-results. This sends only its generated synthetic image and question, never user media or emails.

The focused PiP test saves its synthetic compact preview as `test-results/floating-compact.png`. Older inspection/live harnesses use the previous review layout and retired language choices; update their selectors before reusing them.

## Privacy, recovery and limits

Default-off content lives in browser memory and a bounded six-turn server cache with 15-minute idle expiry. Idle warnings preserve typed drafts. Account-deletion tombstones contain only the Firebase UID and deletion flag to block late writes. Saved content and feedback are owner-filtered and expiry-checked before Mongo TTL cleanup.

Screenshots support PNG/JPEG/WebP under 5 MiB / 12 MP, with header checks before decoding. On-demand desktop captures read the active sharing video directly, with a new capture ID and timestamp; cached thumbnails and old crops/masks are never capture inputs. Review mode samples changes locally without resetting its frozen crop. The browser normalizes approved images to metadata-free PNG (at most 1600 pixels per side); the API permits at most 2 MiB, 2048 pixels per side and 4 MP, checks full PNG structure/raster/hash, and authenticates before parsing the 3 MiB turn envelope. The preview is exactly the bytes sent through Gemini inlineData. Review-mode image edits/refresh require fresh approval; default capture consent is revoked when sharing ends or the source changes. Strict privacy disables on-demand sending. Images are not saved in app history or logs. Masking does not guarantee privacy: inspect the final image yourself. If visual review is difficult, select labels only or remove the source and type a public instruction. No background uploads or continuous cloud streaming occur; analysis runs on Capture and send or submitted questions. Every image is a snapshot, never a live view.

Canceling discards late results but cannot guarantee an upstream request was unbilled. A reused turn/transcription ID fails safely. Queue wait is bounded to 15 seconds. Translation/generation calls allow 45 seconds within a 90-second turn; speech calls allow 20 seconds within a 30-second operation. Upstream timeouts use 504 rather than 408 to prevent automatic POST replay. Deployment supports one API replica because cancellation/context are process-local.

Human screen-reader testing, native listening, physical capture/microphone devices, signup/email delivery, remaining live translation/STT combinations, and representative-user evaluation remain open. There is no public deployment. Production hardening such as minimal runtime images, HTTPS, restricted Mongo credentials and backup policy must be completed before public hosting.
