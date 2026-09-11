# Implemented API — first slice

Prefix `/api/v1`; strict JSON, 32 KiB bound. Private content uses no-store. Firebase bearer tokens required except health/readiness; provider-consuming operations require verified email. Owner IDs derive only from verified identity.

| Route | Behavior |
|---|---|
| GET /health | Liveness without provider calls |
| GET /ready | Mongo/config/identity-file checks; 503 until configured |
| GET /capabilities | Configured versus live-verified status; unavailable features explicit |
| GET/PATCH /me | Owner preferences; strict partial schema; history false only |
| POST /sessions | `{ "historyEnabled": false }`; opaque ID and expiry |
| GET /sessions | Empty saved-history list |
| GET /sessions/:id | Owner/expiry-checked metadata |
| DELETE /sessions/:id | Mark deleted, cancel turn, block late success |
| POST /sessions/:id/turns | Shared `turnSchema`; localized explanation and independent draft |
| POST /sessions/:id/turns/:requestId/cancel | Owner-checked cancel; browser also aborts/discards obsolete replies |

Errors: `{ code, messageKey, requestId, retryAfterMs? }`, never raw upstream bodies. Reused IDs return 409 REQUEST_ALREADY_USED/REQUEST_CONFLICT. No automatic retry or unsaved-answer replay.

Source may be null for general help/drafting. Otherwise reviewed public labels, optional selected ID, version/timestamp/hash are required. Canonical hash payload is exported by contracts. Static screenshot/description context does not imply live external visibility. No images, remote URLs, audio or raw OCR accepted.

OpenAPI generation, SSE, transcription/audio, saved messages, feedback, account deletion and desktop capture remain pending. Revision 3 remains the future full contract; JSON/label-only staging is recorded in decisions.
