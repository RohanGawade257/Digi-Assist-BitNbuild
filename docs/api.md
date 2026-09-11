# Implemented API

Prefix: `/api/v1`. [Generated OpenAPI 3.1](openapi.json) comes from the shared Zod request/answer schemas. Regenerate with `pnpm docs:api`; check drift with `pnpm check:docs`.

All routes except health/readiness require Firebase bearer authentication. Session creation and provider operations require verified email. UID/ownership comes only from the verified token. JSON bodies default to32KiB. Verified-authenticated turn routes accept a3MiB JSON envelope for approved PNGs; successful and failed responses are non-cacheable in the production app.

| Route | Implemented behavior |
|---|---|
| GET /health | Liveness; no provider call |
| GET /ready | Mongo, Admin validity and Gemini operation readiness; separate Sarvam operation flags; live verification remains separate |
| GET /capabilities | Configured versus live-verified; strict speech-input flag; explicit Urdu output limitation |
| GET/PATCH /me | Strict owner preferences; unknown fields rejected |
| DELETE /me | Auth time within5 minutes; cancel, delete local data/tombstone, delete Firebase identity; retry after partial failure |
| POST /sessions | Explicit boolean historyEnabled; false is default in UI |
| GET /sessions | Last50 retained saved-session summaries owned by caller |
| GET /sessions/:id | Open, owner/retention/idle checked metadata |
| GET /sessions/:id/history | Owner/retention checked saved text; no reactivation of old screen context |
| POST /sessions/:id/end | End active work; retain history only when explicitly opted in |
| DELETE /sessions/:id | Delete active or saved session, unset embedded text and cancel work |
| POST /sessions/:id/turns | Reviewed typed or voice-transcript turn; one JSON answer, independently localized explanation/draft |
| POST /sessions/:id/turns/:requestId/cancel | Owner-checked cancellation; late responses discarded |
| POST /sessions/:id/transcriptions | Authenticated multipart: one audio/wav file and one scalar metadata JSON field |
| POST /sessions/:id/turns/:requestId/audio | Owned recent answer segment/chunk; returns audio/wav |
| POST /sessions/:id/speech/cancel | Cancel owned speech operation |
| POST /feedback | Explicit consent, non-sensitive comment, owned active session or sessionId:null after End; retention90 days |

Transcription metadata: requestId UUID, inputLocale, cloudSpeechConsent:true. PCM16 RIFF/WAV is validated from bytes: mono/stereo,8–48kHz,0.1–25 seconds, at most3MiB. Silence, malformed audio, wrong fields and strict-mode uploads fail before provider billing. Raw audio is held in memory only. A successful transcript must be corrected/reviewed and explicitly confirmed before sending a normal turn.

Audio accepts only segment explanation/draft, chunk index and pace0.5–1.5. Text comes from the server's owned recent answer, never arbitrary client input. Chunks preserve all Unicode text. PCM fragments are validated and combined without dropping later base64-padded parts. Urdu output fails before quota reservation. Client repeat uses a local blob cache cleared with the answer/session.

Source may be null for general help/drafts. Otherwise contextMode selects reviewed-labels or approved-image. Image mode requires analysisConsent:true and a canonical base64 PNG (at most2MiB,2048 pixels per side,4MP), dimensions and SHA256; label mode forbids image bytes. Full PNG signature/chunk CRC/raster checks reject malformed or metadata-bearing images. It also carries source kind/version/time, optional selected label and normalized preview region, plus a canonical SHA256 approval hash. Target membership/version/region bounds and consent are validated. Desktop context adds checkedAt within5 seconds; it is refreshed immediately before sending and excluded from the immutable approval payload. Browser frame changes revoke approval and abort obsolete work. Static images do not imply live visibility.

Runtime checks supplement JSON Schema: ownership, token revocation, email verification, privacy, label membership, hash equality, monotonic versions and timestamp freshness. Only explicitly approved normalized PNG bytes are accepted within a turn and forwarded as Gemini inlineData; there is no standalone image store, remote URL, raw OCR or external-action endpoint. Image bytes never enter session history or logs. Approval hashes bind the image digest, dimensions, consent and source version. JSON response transport is intentionally retained instead of SSE; cancellation is separate.

Sessions retain metadata for15 minutes of idle time. Unsaved content is bounded volatile memory (last6 turns, at most1000 cached sessions, periodic expiry). Opted-in history is embedded in the session, last50 turns and fixed30-day retention, so a deleted/ended session cannot be restored by a late answer. Reads check expiry before Mongo TTL cleanup. A UID/deleting-only account tombstone blocks in-flight writes after deletion.

Errors are safe objects: code, messageKey, requestId, optional retryAfterMs. No upstream body, question, credential or stack is exposed. Used/conflicting turn/transcription IDs return409 rather than rebilling. Upstream timeouts return504, preventing automatic408 POST replay. Assistant turns have a90-second total deadline; translation/generation calls45 seconds, speech calls20 seconds and speech operations30 seconds. Retries are bounded, with at most15-second queue wait. Account quotas are shared across key slots; legacy counters are migrated without resetting spend. One API replica is supported because active cancellation and volatile context are process-local.

Post-End feedback keeps sessionId as a required property but accepts null. Nonnull IDs remain ownership/active-session checked; account deletion blocks either form. Recent reasoning includes previous localized guidance for continuity only, never as current-screen evidence; current approved labels or the explicitly approved image snapshot provide current-turn evidence. Image evidence is reported as approved-image and never described as live.

Quota schema v3 establishes each API separately. Gemini generate requires the configured model and applicable verified limits. Sarvam translate/transcribe/speak have independent RPM buckets shared by all account keys. Unpublished TPM/RPD metrics have evidence but no numeric caps; unverified metrics gate the API. No global verified flag is used. Local minute/day reservation counters and upstream429 cooldowns are conservative controls, not an exact reproduction of the provider?s token-bucket algorithm.
