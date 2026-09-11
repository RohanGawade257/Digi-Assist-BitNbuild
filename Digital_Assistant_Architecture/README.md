# Digital Assistant — Architecture Kit

Revision 3 • 11 September 2026. Updated to match the current overview and architecture document.

A general multilingual guide to unfamiliar digital tasks: registrations, forms, email drafting, website navigation, and understanding instructions or errors. Built for the planned 48-hour Inclusive Digital Services hackathon entry. PAN is one example, not the product's scope.

## What this package is

An implementation-ready system design and configuration kit. It includes researched stack decisions, component and sequence diagrams, workflow rules, MongoDB design, API contracts, environment slots, Docker infrastructure, application Docker templates, and a build/test plan.

It is **not a completed website or working AI backend**. There are no Next.js/NestJS application sources or dependency lockfile yet. The base Compose file starts MongoDB only. Application templates become usable after agents implement the prescribed workspace. No live AI calls or deployments were performed.

## Recommended stack

Next.js 16 + React + TypeScript for the website; NestJS 11 for the versioned API; MongoDB for sanitized app data; Firebase Authentication for email/password, email verification, reset, and JWT identity; Gemini for vision/reasoning; Sarvam for STT, translation, and TTS. Docker runs local dependencies and, once implemented, application containers. Future mobile uses React Native/Expo development builds with native capture modules.

See [System Design](docs/System_Design.md) for the rationale, alternatives, sources, and limits. The stack is chosen for this team's skills and scope rather than claimed as universally best.

## Read in this order

1. [Project Overview](Project_Overview.md): complete product workflow and primary audiences.
2. [Architecture DOCX](Digital_Assistant_Architecture.docx): current implementation blueprint.
3. [System Design](docs/System_Design.md): full architecture, capture/privacy rules, provider routing, future mobile.
4. [Database Design](docs/Database_Design.md): ownership, fields, indexes, expiry, deletion.
5. [API Contracts](docs/API_Contracts.md): endpoints, payloads, stream events, scheduler rules.
6. [48-Hour Implementation Plan](docs/Implementation_Plan.md): sequence and acceptance gates.
7. [.env.example](.env.example): all credential slots and policy knobs.
8. [Validation status](VALIDATION.md): what was checked and what remains untested.

## Credentials to prepare

| Configuration | Required preparation |
| --- | --- |
| GEMINI_API_KEY_1 through GEMINI_API_KEY_4 | Four available slots; at least one valid key. Keys sharing a project share quota. |
| GEMINI_MODEL | Stable image-capable model actually enabled in your project; intentionally not guessed here. |
| SARVAM_API_KEY_1 through SARVAM_API_KEY_3 | Three slots; at least one valid key. Verify account-level quota behavior. |
| MONGODB_URI | Local Docker connection for development or managed Mongo connection for deployment. |
| Firebase web config | API key, auth domain, project ID, app ID from the Firebase project. |
| Firebase Admin JSON | Server-only credential file from the matching project, stored outside git. |

Credential acquisition: [Gemini keys](https://aistudio.google.com/api-keys), [Sarvam dashboard](https://dashboard.sarvam.ai/), [Firebase console](https://console.firebase.google.com/), [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).

Enable Email/Password in Firebase Authentication, configure verification/reset templates and authorized domains, and use its account-management flow. Google sign-in is not required. Custom SMTP is not required for this choice. Do not create a second independent MongoDB password store or reset system. The API verifies Firebase JWTs.

Do not paste real keys into chat, source files, public logs, or frontend variables. Only the Firebase public client config is browser-facing. The API container gets secret credentials; the web container gets an explicit public allowlist.

## Start the provided infrastructure

Host prerequisite: Docker Engine with Compose, or Docker Desktop. Windows users can use Docker Desktop's supported Linux-container setup. Node, pnpm, MongoDB, and Python need not be installed manually to run the provided infrastructure.

PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env and replace the development Mongo password and matching URI.
docker compose config --quiet
docker compose up -d mongo
docker compose ps
```

Bash:

```bash
cp .env.example .env
# Edit .env before starting.
docker compose config --quiet
docker compose up -d mongo
docker compose ps
```

Do not run plain `docker compose config` in shared logs: it can print resolved secrets. `--quiet` validates without printing the full configuration.

The Mongo port is bound to localhost only. The API in Docker uses hostname mongo; a host-side tool uses localhost. Local root credentials are for development; create a restricted application user for real deployment. Initialization credentials apply when the volume is first created; editing .env later does not automatically change an existing database password.

Stop containers while retaining data:

```bash
docker compose down
```

Removing the named volume deletes local data. Do not add `-v` unless you intentionally want a destructive database reset.

## Full application startup after implementation

The build agent must first create apps/web (@guide/web), apps/api (@guide/api), shared packages, root pnpm workspace, package manifests, and pnpm-lock.yaml. Define each app's dev script and bind development servers to 0.0.0.0 inside the container. Nest readiness must match /api/v1/ready and liveness /api/v1/health; these are the unauthenticated health exceptions.

Use the chosen Node container to install/freeze dependencies rather than requiring host Node. The provided Dockerfile expects a lockfile already generated; it intentionally fails rather than inventing dependencies. Exact package versions and the tested image digest must be recorded in the implementation's README.

Save Firebase Admin credentials locally as secrets/firebase-admin.json. Set the corresponding web/admin project values and model names in .env. The template mounts that JSON read-only at /run/secrets/firebase-admin.json.

Copy config/quota-policy.example.json to config/quota-policy.json, fill verified provider limits and match configured group/model names. Unknown limits are not unlimited. The API template mounts this file read-only and must fail readiness until configuration is valid. See [Quota configuration](config/README.md).

Then, after application code exists:

```bash
docker compose -f compose.yaml -f docker/compose.app.template.yaml config --quiet
docker compose -f compose.yaml -f docker/compose.app.template.yaml up --build
```

This template uses development scripts for iteration. Before public deployment create multi-stage production Dockerfiles, frozen installation, non-root runtime, minimal artifacts, TLS proxy, explicit production origins, private database networking, backup policy, and stream-compatible proxy timeouts. Do not publish the dev template as production.

Docker does not eliminate provider billing, external credentials, domain/TLS configuration, or browser permission dialogs. Mobile microphone testing needs trusted HTTPS; a plain LAN IP is not localhost on the phone.

## Product workflow to preserve

- Language selection before login; independent reply, UI, and task draft languages. Hindi guidance can accompany an English email draft.
- English, Hindi, Bengali, Marathi, Telugu, Tamil, Urdu throughout onboarding and recovery.
- Voice or Unicode typed chat, including mixed English labels.
- Desktop sharing or screenshot upload; mobile uses screenshot upload in v1.
- Accessible safe-label checklist and optional local crop; nonvisual review before cloud transfer. Raw OCR must never be sent to cloud TTS for review.
- Fresh source validation, English processing, grounded short answer, translated reply with original field labels.
- General help and email drafts without forcing a screenshot; no automatic email sending.
- One-step guided mode, wait for user confirmation, clarify unclear questions.
- Chat available during sharing; focus reveals it, Enter/Space opens it, typing/pin keeps it visible, and Escape preserves drafts. Optional supported-browser Picture-in-Picture has a side-by-side fallback; shortcuts are not global across unrelated apps.
- Optional sanitized history, delete controls, neutral feedback, clear stop/mute controls.
- No whole-phone sharing, arbitrary external-page translation, remote clicks, or hover-only invisible controls promised by the website.

## Quotas and cost

Four Gemini keys and three Sarvam keys are configuration capacity, not guaranteed independent quota. Configure quota-group IDs correctly. Cool down the group on 429, honor Retry-After, cap retries, queue within a bound, and show localized recovery when all eligible groups are unavailable. Do not multiply free quota through identity cycling.

A translated voice turn may use five provider calls. Reuse reviewed onboarding audio, avoid constant cloud screen analysis, and skip translation/STT/TTS where unnecessary. Actual provider model limits must be read from the account before setting capacity.

## Known limits and live checks

- Generic automatic screenshot masking is not reliable enough for an absolute privacy claim. The default is reviewed narrow context or label-only text, with fail-closed behavior.
- Sarvam cloud STT receives audio; strict privacy mode must disable cloud voice until on-device recognition is available.
- Gemini unpaid terms disallow sensitive/personal submissions. Use synthetic/non-sensitive demonstrations and review data handling before real-user deployment.
- Seven-language quality, especially Urdu TTS with the selected model/account, needs live verification.
- Background browser throttling means 1 Hz local sampling is a target, not a freshness guarantee.
- Document Picture-in-Picture has limited browser availability and no guaranteed translucent OS window behavior.
- No claim of current-internet knowledge unless a verified source was actually retrieved.

## Validation and delivery

Follow the gates in Implementation_Plan.md. Add measured results only after running the app with configured services. Required demonstrations cover registration, email assistance, unfamiliar navigation, and mobile screenshots. Preserve a concise known-limitations section rather than masking failed functionality with canned success messages.

## Revision 3 implementation guidance

Primary audiences are older adults, people who struggle with English/reading/digital tasks, and people with disabilities including blindness, low vision and limited motor control. Build keyboard and screen-reader semantics from the start. Voice, typing, touch and captions are alternative controls, not mutually exclusive modes.

Read [Accessibility and privacy](docs/Accessibility_and_Privacy.md), [System diagrams](docs/System_Diagrams.md), and [Revision changes](CHANGELOG.md). Preview target selection must have an equivalent accessible label list, be bound to sourceVersion, and never authorize private-data upload. Rule answers require dated official evidence; user evaluation records independent/assisted/incomplete outcomes rather than invented impact claims.

The supplied overview and DOCX are exact copies of the revision 3 documents already delivered. References to the earlier ZIP in those documents mean the pre-revision-3 kit. This refreshed archive replaces it. System_Design.md contains the same canonical architecture text; focused contract documents expand it. The documented revision 3 behavior governs template implementation.

Run optional static checks with `python scripts/validate_bundle.py` (PyYAML enables YAML inspection). This command does not run application or provider tests. See VALIDATION.md for precise evidence and remaining gates.
