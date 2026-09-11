# Session handoff

Updated 2026-09-11. Build the agreed multilingual digital-task guide; preserve accessibility, privacy, seven locales and user-controlled external actions.

Read `progress.md` next. Governing documents: user request, `Codex_Astra_Master_Prompt.md`, and architecture kit revision 3. The kit overview explicitly supersedes root revision 2; its meaningful additions have already been compared. Do not repeat discovery or extract DOCX: Markdown is canonical. No app source or Git repository existed at discovery; no Git repository/commits have been created. Preserve the reference kit.

Applied skills: find-docs and ui-ux-pro-max. Context7 documentation requests must run outside sandbox. Single agent, no extra agents authorized.

Current components: pinned pnpm workspace at apps/web, apps/api, packages/contracts. Real Firebase auth client/admin, Nest health/readiness, owner-filtered Mongo sessions/preferences, typed Gemini/Sarvam adapters, strict approval hashes, shared Mongo quota counters, cancel/dedupe, core locale catalogs, local screenshot/label review. History forced off. UI extended review text is still English. Speech, desktop capture, full persistence and user evaluation remain incomplete.

Runtime: Node 22.20.0, pnpm 10.30.3, Docker Engine 29.2.1. Sandbox access to some pnpm files fails EPERM; elevated build/tests work. Docker also needs elevated tool execution here. Existing port 27017 preserved; project Mongo uses 27018. Setup generated ignored .env/local Mongo credentials. The user subsequently filled Firebase public/Admin project values, Gemini key/model and Sarvam key in .env; preserve those edits and never print values. Remaining live setup: valid secrets/firebase-admin.json and verified quota policy group limits. Secondary provider slots remain optional.

Verification: full typecheck and host/container builds passed, Node/Mongo digests pinned. 11 core tests passed. Real Mongo/Nest integration passed 7 nested cases plus parent: auth boundaries, ownership, dedupe, stale source, delete-during-generation, expiry/preferences, shared quotas/cooldown. Final Docker-hosted browser suite 6/6 in 7.8s, zero axe violations in two tested states; desktop/mobile screenshots visually inspected. Repairs include Express direct pin, explicit select labels, valid PNG fixture, configurable Mongo port, cancel on edits, pin empty-chat behavior and logout-error handling.

Services: Docker project digital-assistant; web http://localhost:3000, API http://localhost:3001, Mongo 127.0.0.1:27018. Real smoke: / 200; health 200; ready 503/database=true/identityConfigured=false/configurationValid=false; unauthenticated capabilities and POST sessions 401, safe no-store errors. Unhealthy API is expected until live setup. No real Firebase identity, Gemini generation, Sarvam calls or deployment.

New probe: apps/api/src/probe.ts plus probe:local/probe:config scripts. Local-only mode never makes external requests. Auto-review twice rejected the metadata network probe; after explicit user approval to send GEMINI_API_KEY_1 to Google's official generativelanguage.googleapis.com metadata endpoint, probe:config passed: HTTP200 and generateContent supported. generationPerformed=false; Sarvam key present; Firebase credential file false; QUOTA_POLICY_PATH validation problem. This permission is for metadata, not unrelated services/spending. Latest probe TypeScript compilation passed. No approval question remains pending.

Decisions: root pnpm monorepo; Next16/Nest11 majors preserved; host Node22 and container Node24 verified. Strict JSON/label-only source first, no raw images accepted. Quota v2 shares conservative account caps; no queue/retry/failover yet. History forced false; no production fake-answer or auth bypass. React state/native controls; extended catalogs and preferences UI wiring incomplete. See docs/decisions.md and docs/api.md for staged contracts.

Next actions:
1. All final container builds include the probe scripts; local diagnostics and metadata checks passed. Confirm current service/config state before continuing; do not restart scaffolding or repeat completed suites without changes.
2. Obtain valid local Firebase Admin JSON and verified account quota policy; preserve user .env. Then test real authenticated typed journeys with synthetic data and appropriate authorization. Do not treat Gemini metadata access as generation verification.
3. Complete secondary review/error localization, server preference hydration/save, idle warning and richer turn context without saving history by default.
4. Implement consented Sarvam STT/correction/TTS and playback, then desktop capture/freshness; preserve all seven locales and separate draft language.
5. Implement optional sanitized history/deletion/feedback, queue/failover and official-reference evidence; run expanded accessibility/device/human gates. docs/evaluation.md contains the unsimulated evaluation template.
