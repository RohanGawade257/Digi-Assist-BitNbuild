# MongoDB Design

Revision 3. Status: proposed database contracts; application persistence is not implemented in this kit.

## Ownership and conventions

Database: digital_assistant. Firebase uid is the authoritative identity, stored as ownerUid on every private resource. IDs are opaque ObjectIds serialized as strings. Timestamps use UTC BSON Date. Never accept ownerUid from a client as authorization. Validate all incoming IDs and filter nested resource requests by both ownerUid and sessionId.

Firebase stores passwords and email verification state. MongoDB stores application data, not a duplicate password authority. A cached emailVerified value must never replace verification of current authentication state.

## Collections

| Collection | Main fields | Indexes |
| --- | --- | --- |
| users | firebaseUid, replyLocale, interfaceLocale, speechRate, audioEnabled, screenReaderMode, textScale, chatPinned, chatShortcutEnabled, chatShortcut, saveHistory, onboardingVersion, createdAt, updatedAt | unique firebaseUid |
| sessions | ownerUid, titleSanitized, taskKind, draftLocale, status, sourceKind, latestSourceVersion, taskSummarySanitized, historyEnabled, createdAt, updatedAt, endedAt, expiresAt | ownerUid+updatedAt descending; expiresAt TTL |
| messages | ownerUid, sessionId, requestId, role, inputMode, inputLocale, replyLocale, textSanitized, draftSanitized optional, draftLocale optional, answerEnSanitized when needed, referencedLabels, evidenceMetadata, completionBasis, createdAt, expiresAt | ownerUid+sessionId+createdAt; unique ownerUid+requestId+role; expiresAt TTL |
| feedback | ownerUid, sessionId, rating optional, textSanitized, saveConsentAt, locale, createdAt, expiresAt | ownerUid+createdAt; expiresAt TTL |
| requestRecords | ownerUid, sessionId, requestId, requestFingerprint, status, resultMessageId optional, startedAt, expiresAt | unique ownerUid+requestId; expiresAt TTL |
| quotaWindows | groupId, model, operation, windowStart, requestsReserved, inputTokensReserved, expiresAt | unique groupId+model+operation+windowStart; expiresAt TTL |
| providerHealth | groupId, slotId, operation optional, state, reasonCode, retryAt, updatedAt | unique groupId+slotId+operation |

Do not persist raw audio, images, extracted complete page text, API keys, authorization tokens, email recipients, or personal form values in these collections. ProviderHealth stores slot labels, never key values. Titles and summaries require sanitization too.

## Example message

```json
{
  "ownerUid": "verified-firebase-uid",
  "sessionId": "opaque-session-id",
  "requestId": "client-generated-uuid",
  "role": "assistant",
  "inputMode": "text",
  "inputLocale": "hi-IN",
  "replyLocale": "hi-IN",
  "textSanitized": "‘Compose’ बटन पर क्लिक करें।",
  "referencedLabels": [{"id": "label_1", "text": "Compose"}],
  "evidenceMetadata": [{"sourceKind": "screenshot", "sourceVersion": 3}],
  "completionBasis": "not_completed"
}
```

The example omits dates for readability; actual records must include required timestamps. Do not store the source screenshot beside it.

## Retention and deletion

- History disabled: keep conversation context only in bounded volatile memory for the active session; discard at end or after 15 minutes of inactivity. Metadata-only request records may remain briefly for idempotency. Restarting loses unsaved conversation; explain this honestly.
- History enabled: proposed default 30 days for sanitized session/message content. Show this preference to the user. Expiry is configurable and must not silently extend historical data.
- Feedback: proposed 90-day default after explicit save consent; no audio recording by default.
- Idempotency records: 24 hours; no raw payload. For unsaved conversations, an expired volatile result returns a retry/expired status rather than reconstructing personal content.
- Request media: process in memory, drop on request completion/cancellation, never log. Temporary buffers need bounded size and explicit cleanup. Do not expose a public audio or image URL.
- TTL is cleanup, not immediate authorization enforcement. Always enforce expiresAt in queries; MongoDB TTL deletion is asynchronous. [MongoDB documentation](https://www.mongodb.com/docs/manual/core/index-ttl/)
- User deletes session: mark deleted first, block reads/new writes, cancel turns, delete messages/feedback as requested, then remove session. Prevent late provider replies from recreating it.
- Delete account: recent Firebase authentication, mark deletion pending, block account access, remove owned records, delete Firebase identity, record only non-personal job outcome; retry partial failures.
- Backups require a stated retention policy. Do not promise immediate removal from all backups unless that has been implemented.

## Concurrency and atomicity

Acquire one active-turn lease per user/session with expiry and compare-and-set semantics. A unique request ID prevents double clicks from creating multiple turns. Reject the same request ID with a different payload fingerprint using 409. Verify the session remains open before committing a result.

Create quota-window records with unique indexes. Reserve capacity using atomic conditional increments; handle duplicate creation races by retrying the reservation, not the provider call. A quota group covers all keys that share an allowance. Local app caps remain conservative and 429 feedback overrides the scheduler.

For the single-replica hackathon use requestRecords status transitions and leases rather than requiring cross-collection transactions. If exactly-once multi-document effects become necessary, use a replica-set deployment and transactions. Provider calls themselves are not exactly-once merely because MongoDB supports transactions.

## Security tests required

1. User A cannot read, modify, delete, replay audio from, or submit a turn to user B's session.
2. Expired documents are inaccessible even before TTL cleanup.
3. Deleted sessions cannot be resurrected by late responses.
4. Turning history off stops subsequent content persistence.
5. Concurrent identical request IDs produce one logical turn.
6. Database dumps and logs contain no raw media, provider keys, or submitted sample identity values.

## Revision 3 boundaries

replyLocale is the persisted assistance-language field; migrate an older assistanceLocale field explicitly if an implementation already exists. draftLocale remains independent and task-scoped. Never infer or store a disability diagnosis from accessibility settings.

The preview image, selectedTarget region, OCR candidates, and review state are volatile client state, not stored screenshots or identity values. Persist only safe referenced label/evidence metadata when history is enabled. Source approval is bound to the current hash/version and cannot be restored as live context from history.

When history is off, session/lease metadata may exist for access and concurrency, but sanitized title, summary, and messages remain volatile too. Account preferences persist independently of history. Notify before idle expiry; do not discard an actively edited local draft without warning.
