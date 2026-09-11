# API Contracts and Provider Scheduling

Revision 3. Status: design contracts to implement in NestJS; these routes are not running in this package.

## Common rules

Prefix /api/v1. Require Authorization: Bearer <Firebase ID token> except liveness/readiness. Validate token and ownership server-side. Use HTTPS outside localhost. Never put tokens or API keys in URLs. Return Cache-Control: no-store for private content. Allow only configured origins. Use shared validation schemas and generate an OpenAPI definition from the implementation.

Errors: {code, messageKey, requestId, retryAfterMs?, details?}. details contains safe structured fields, never upstream raw request bodies or secrets. Localize messageKey in the client. HTTP status distinguishes authentication, validation, quota, and provider failures.

## Endpoints

| Method/path | Purpose | Main behavior |
| --- | --- | --- |
| GET /api/v1/health | Process liveness | No AI call |
| GET /api/v1/ready | Configuration/database readiness | No AI call; no sensitive config values |
| GET /api/v1/capabilities | Enabled model/language capabilities | Report configured vs live-verified separately; no key details |
| GET/PATCH /api/v1/me | Preferences | Only current uid; no client-supplied verification state |
| POST /api/v1/sessions | New session | taskKind optional, historyEnabled explicit |
| GET /api/v1/sessions | Paginated history | Owner-filtered; cursor pagination |
| GET /api/v1/sessions/:id | Session detail | Owner/expiry checks, sanitized metadata only |
| GET /api/v1/sessions/:id/messages | Paginated sanitized messages | Owner/expiry checks |
| DELETE /api/v1/sessions/:id | Remove history/end session | Cancel active turns and block late writes |
| POST /api/v1/sessions/:id/transcriptions | Transcribe short audio | Explicit cloudSpeechConsent; memory-only audio |
| POST /api/v1/sessions/:id/turns | Ask text question with optional sanitized context | Idempotency key, source version; JSON or SSE response |
| POST /api/v1/sessions/:id/turns/:requestId/cancel | Cancel | Client AbortController also discards late output |
| POST /api/v1/sessions/:id/turns/:requestId/audio | Speak final answer | Uses server-owned validated answer; cannot be arbitrary public TTS proxy |
| POST /api/v1/sessions/:id/end | End assistance | Browser must also stop local tracks; server cannot directly release browser permission |
| POST /api/v1/feedback | Save optional feedback | Explicit consent, sanitized text, owner-bound session |
| DELETE /api/v1/me | Account deletion | Recent auth, retryable deletion workflow |

Separate transcription permits the user to correct unclear words before an expensive answer call. Audio may originate in the floating panel but belongs to the same session. The audio endpoint returns an authenticated binary stream, not a public storage link. Repeated playback can reuse a short-lived local audio buffer; release it when the session ends.

## Turn input

Use multipart/form-data with a validated JSON metadata part and at most one sanitized image part. No remote image URL accepted.

```json
{
  "requestId": "uuid",
  "question": "How do I attach a file to this email?",
  "inputLocale": "en-IN",
  "replyLocale": "hi-IN",
  "draftLocale": null,
  "inputMode": "text",
  "taskKind": "guide-task",
  "source": {
    "kind": "screenshot",
    "version": 4,
    "capturedAt": "2026-09-11T10:30:00Z",
    "sanitizedHash": "sha256-of-approved-content",
    "contextMode": "reviewed-crop",
    "reviewedLabels": [{"id": "label_1", "text": "Attach files"}],
    "selectedTarget": {"labelId": "label_1", "sourceVersion": 4},
    "userReviewed": true
  },
  "audioReply": true
}
```

source may be null for a general-help or draft-text question. A screen-dependent question without source results in clarification. userReviewed is a UI consent record, not evidence that arbitrary pixels are safe. Server checks file signatures, dimensions, size, and text privacy again, but client-side exclusion is what prevents initial transfer of raw material.

Accept Unicode text and mixed-language input, enforce maximum length, and preserve negations. Selected reply locale remains stable. Explicit unsupported input yields a localized request to use one of the seven tested languages.

## Stream events

| Event | Payload |
| --- | --- |
| accepted | requestId, sourceVersion |
| progress | stage messageKey; never hidden model reasoning |
| clarification | localized question, safe options if applicable |
| answer | final validated localized answer, English labels, evidence IDs, nextStep |
| audio_available | Whether an authenticated audio request is ready |
| error | Safe error envelope and retry hint |
| done | Terminal status and requestId |

Use fetch with response-body streaming so Authorization headers work; ordinary EventSource cannot set arbitrary authorization headers. Buffer generated text until structured validation and privacy checks pass. Streaming progress does not mean raw model tokens must be exposed. The client ignores events with an obsolete requestId or sourceVersion.

## Initial bounds

One active generation per session/user. Maximum question 2,000 characters; longer input gets a helpful limit message rather than silent truncation. Translation splits along sentence boundaries within provider limits and reassembles preserving labels. Audio recording initially capped at 25 seconds, with visible timer and manual send/cancel. Reject empty or unsupported media before billing.

Global queue maximum 20 turns and 15-second queue wait are initial application settings. Execution starts on dequeue with a separate 30-second deadline, so total wait may reach 45 seconds. Each provider call is capped at 20 seconds or the remaining execution time. Allow two attempts per operation and at most two extra retries across the turn; never repeat a completed stage merely because a later one fails. Tune from actual measured provider latency. If stages cannot finish, retain text when TTS alone fails and offer replay later.

## Quota scheduler specification

Credential descriptor: provider, slotId, secret reference, quotaGroup, enabled, priority. Never serialize its secret in diagnostics.

1. Resolve enabled slots and collapse duplicate key values internally without logging values.
2. Resolve group+model/operation budget and cooldown.
3. Reserve capacity atomically. When none is available, enqueue within the bounded limit or return a busy response.
4. Select primary/healthy slot; optionally round-robin within available permitted groups.
5. Execute with timeout and request correlation ID.
6. On success, reconcile usage and emit sanitized metrics.
7. On 429, cool down the group, not just the key. Respect Retry-After. Daily exhaustion stays unavailable until reset.
8. On invalid credential, disable that slot; on access/policy denial do not evade through another identity.
9. On transient failures, retry within the turn budget; stop after two attempts for that operation and two extra retries across the turn.
10. On cancellation or stale context, discard output and stop pending stages. Do not claim an upstream request was unbilled or canceled unless confirmed.

Required tests: four same-group keys do not create four budgets; secondary keys can replace invalid credentials; 429 observes group cooldown; exhaustion returns bounded failure; duplicates and cancellations do not create extra answers.

## Revision 3 language and selection contracts

Store replyLocale and interfaceLocale as separate user preferences. draftLocale belongs to the task; ask when it is absent for a draft-text request. A Hindi explanation with an English draft must not translate that draft back into Hindi. POST audio accepts a segment selector of explanation or draft and uses the validated segment's locale; it cannot accept arbitrary text as a public TTS proxy.

source.reviewedLabels replaces the older source.labels name. selectedTarget contains a labelId, sourceVersion, and optional normalizedRegion {x,y,width,height} in the range 0–1, wholly inside the preview. Validate label membership, region bounds, source version, and approval hash. Reject stale/mismatched targets; do not use coordinates to click an external website. Target selection does not grant upload consent. No raw OCR or entered values in this envelope.

GET /capabilities is an authenticated extension endpoint under /api/v1; it reports configured, verified, unavailable and reasonCode per feature/locale without exposing keys. Only health and ready are unauthenticated. Readiness validates database/configuration without billable provider calls.

## Final result schema

Model output is internal and validated before delivery: status (answer, clarify, insufficient_context), taskKind, observedContext, explanationEn, draftEn when requested, nextStep, referencedLabels, evidenceIds, requiresFreshContext, completionBasis. Final client output contains explanation {locale,text}, optional draft {locale,text}, original referencedLabels, evidence, requestId and sourceVersion. Progress events never expose unchecked model output.

Evidence entries identify approved context or reviewed official references. Rules require source title, URL, checkedAt, applicable task/jurisdiction and an approved excerpt; absent/conflicting evidence yields a limitation. No automatic open-web lookup is implied.

## Preferences

PATCH /me accepts replyLocale, interfaceLocale, speechRate, audioEnabled, screenReaderMode, textScale, chatPinned, chatShortcutEnabled, chatShortcut, saveHistory, and onboardingVersion. Validate ranges and locale membership. Prefer explicit per-setting patch semantics. Never accept ownerUid or emailVerified as trusted identity claims. Store no disability diagnosis.

## Failure and recovery contract

Error codes include AUTH_REQUIRED, EMAIL_UNVERIFIED, CONTEXT_STALE, CONTEXT_REVIEW_REQUIRED, TARGET_AMBIGUOUS, AUDIO_UNCLEAR, LOCALE_UNAVAILABLE, PROVIDER_BUSY, TURN_TIMEOUT and SESSION_CLOSED. Localized message catalogs map these to concise actions; repeat/stop/typed assistance must remain usable without another model request. Preserve unsent local text; do not automatically rebill on reconnect.
