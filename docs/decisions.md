# Implementation decisions

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

Later live evidence: after the user filled .env and explicitly approved the metadata destination, Google's models.get returned HTTP 200 and generateContent support for the configured model. This verifies metadata access only. No generation or Sarvam call occurred; valid Firebase Admin JSON and verified quotas remain necessary.
