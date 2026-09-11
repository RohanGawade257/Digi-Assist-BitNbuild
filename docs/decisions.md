# Implementation decisions

Entries before “Debugger pass decisions” record the earlier first slice. The later decisions supersede its disabled history, separate quota debits and absent retries/queue. Current capabilities and validation are in README.md and docs/validation.md.

## 2026-09-11: Governing overview
The kit overview explicitly supersedes revision 2 and adds 76 lines of requirements. Use its revision 3 alongside the master prompt. Preserve both originals. The Markdown architecture is canonical; DOCX extraction is unnecessary.

## First slice scope and compatibility
No application existed. Use the prescribed root pnpm workspace, Next.js 16, NestJS 11 and MongoDB official driver. Host Node is 22.20.0; containers target Node 24. Node 22 is supported for local checks; no host replacement is required. Pin dependencies and lock installation. Use Node's built-in test runner with compiled API code to exercise Nest decorator metadata without a second compiler.

## Incremental contracts
Start typed turns with strict JSON and reviewed label-only context. No image bytes accepted by this API. Raw screenshots remain local; manual public-label entry provides a keyboard alternative without pretending to classify arbitrary OCR. Multipart approved crops remain a later extension. History creation accepts false only until persistence/deletion gates pass; do not pretend an enabled history option works.

## Small state and styles
Use React state and native form controls with CSS tokens for the first connected slice. Additional state/UI libraries would not resolve a current problem. Seven-language catalogs are explicit and require human review. Native language quality and complete localization remain release gates.

## Local runtime evidence
Docker initially appeared unavailable in the sandbox; an elevated read-only check found the running Engine 29.2.1. Mongo startup then failed because localhost 27017 is already occupied. Preserve the existing service and use configurable MONGO_PORT, default 27018, for this project's container. Update only the development URI generated in this session. Turbopack hit Windows `Access is denied` inside the sandbox; the same production build passed outside it. No bundler replacement needed.

## Quota schema v2
Revision 1's per-operation allowances cannot express a cross-operation account cap. Use conservative shared group RPM/TPM/RPD ceilings and atomic Mongo reservations, with explicit verified=true. Configure each ceiling no higher than the strictest applicable provider/model/account allowance; unknown limits fail readiness. UTF-8 bytes plus an output allowance conservatively reserve tokens. Failed later reservations retain earlier debits. No retries or queue in this slice: bounded busy errors preserve capacity. UTC-day caps and provider 429 cooldowns do not prove account-specific reset alignment. Multi-replica user leases, usage reconciliation and permitted failover remain incomplete.

## Current documentation consulted
Context7 CLI resolved official projects before requesting docs for [Next.js](https://nextjs.org/docs/app), [NestJS guards/testing](https://docs.nestjs.com/fundamentals/testing), [Firebase token revocation](https://firebase.google.com/docs/auth/admin/manage-sessions), [MongoDB driver](https://github.com/mongodb/node-mongodb-native), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), and [Sarvam translation](https://docs.sarvam.ai/api-reference/text/translate-text). Package registry versions were checked; agreed framework majors were retained and working patches pinned. Actual configured model access is still unverified.

Later live evidence: after the user filled .env and explicitly approved the metadata destination, Google's models.get returned HTTP 200 and generateContent support for the configured model. This verifies metadata access only. No generation or Sarvam call occurred. The subsequently supplied Firebase Admin JSON now validates; verified account quotas remain missing.
## Debugger pass decisions — 2026-09-11

- Production audit found Multer2.2.0 advisories and a uuid buffer-bounds advisory through gaxios. Scoped pnpm overrides pin Multer2.3.0 and uuid11.1.1; gaxios uses only v4 and the patched version retains CommonJS exports. Updated lockfile, zero remaining production advisories, real upload/malformed-field integration tests and full typecheck pass.
- JSON turn responses remain the implemented transport instead of the kit's proposed SSE. Separate cancellation, bounded execution and UI status cover this working slice without introducing a second streaming protocol. OpenAPI documents the actual endpoints and runtime-only refinement checks.

- Provider gap discovered from current Sarvam documentation: Bulbul v3 lists 11 output languages but excludes Urdu (https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/how-to/set-the-language). The user explicitly chose “Retain the explicit limitation”. Urdu remains in all text/input contracts. TTS rejects Urdu before quota reservation and the UI explains its unavailability. Seven-language audio is not claimed; no provider was replaced.

- Provider bodies must be bounded while streaming; checking response.text() afterward allowed unbounded allocation. Deadlines now cover bodies. Retry budget is two extra attempts per operation signal, at most one per provider call; 429 and 403 never rotate identities. Same-account replacement is limited to authentication failures.
- Quota reservations use one account document with conditional minute/day resets and a combined atomic debit. The previous two-document implementation consumed daily quota on minute rejection. Existing minute/day counters seed new account documents so the upgrade cannot reset spent quota; old quotaWindows documents expire naturally. Stop older API replicas during upgrades.
- Safe saved conversations are embedded in a session (last 50 turns, 30-day fixed retention), making deletion versus late writes atomic on standalone MongoDB. Default-off conversations remain only in bounded volatile memory (six turns, 15-minute idle expiry). No raw image/audio is persisted.
- Microphone transport is PCM16 WAV captured with AudioWorklet, validated from bytes server-side. This avoids trusting browser duration metadata or adding a media transcoder. Upload is a separate consented action; strict privacy defaults on. TTS accepts only server-owned answer chunks, never arbitrary client text.
- Image headers enforce dimensions before decoder allocation, followed by decoded-size validation. TTS joins complete WAV parts or encoded fragments rather than concatenating padded base64 strings. Byte-level regressions cover both boundaries.

## 2026-09-11: Conversation/accessibility sprint

The latest user request supersedes the architecture's old keyboard mapping: Enter and Send submit through one guarded function; Shift+Enter inserts a newline and IME composition does not send. Preserve drafts on error and across language/task/source changes; explicit End clears volatile work. Keep six visible turns, matching bounded server continuity. Include previous localized guidance in model context, but never treat it as current-screen evidence or proof of actions.

Use progressive native disclosures and existing CSS/React state, with conversation primary and source review secondary. Essential privacy/source information remains visible; optional localized hints appear once after about2 seconds and do not steal focus. Introduction speech uses only a matching local device voice on explicit request, with caption/Skip and no unauthenticated cloud fallback.

End must release pending as well as active media: abort capture initialization, stop late-granted tracks, and bound preview startup. Preserve the existing PiP host and correct Escape focus return. Feedback after End uses an explicitly nullable sessionId and consent, retaining nonnull ownership checks and deleted-account rejection; no default rating.

Firebase's public project response may contain a numeric project number, so diagnostics compare it with the app ID's project-number segment as well as the project ID. Real temporary-account password login is separate evidence from normal signup/email delivery and live model generation. Quota limits remain a hard external gate; no guessed caps or credential bypass.

Final visual review: scroll new conversation turns to their start, not the audio controls at the bottom. Separate microphone permission/initialization from active recording; validate minimum WAV duration locally before offering cloud upload. These changes came from an actual clipped-answer screenshot and a91ms rejected browser recording, not speculative redesign.

## Approved-image slice (2026-09-11, supersedes earlier labels-only restriction)

The user explicitly requested locally edited, exactly approved screenshot analysis. The app now offers approved-image and labels-only modes. It normalizes/crops/masks locally, binds consent to image SHA256 and source version, validates authenticated bounded PNGs and sends approved bytes as Gemini inlineData only with a question. No image storage, automatic upload, continuous cloud streaming or privacy guarantee. Snapshot evidence never means live visibility. Numeric editing and typed labels remain accessible alternatives.

Quota schema v3 establishes each API independently, distinguishes verified/unpublished/unverified metrics and preserves shared-account budgets/cooldowns. User-confirmed Gemini limits and Sarvam free/Starter RPM policies are recorded only in the ignored local configuration. No guessed Sarvam TPM/RPD or global verified flag. Gemini3 image token reservations follow the documented resolution token allocation rather than base64 text length. Real browser generation and Sarvam audio200 are now observed; native evaluation and remaining provider combinations are still gates.
