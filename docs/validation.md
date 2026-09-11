# Validation evidence

## Voice correction, 2026-09-11

Real browser checks use generated spoken WAV input through the actual local neural VAD, temporary verified Firebase accounts, and actual Sarvam/Gemini calls. They do not use a physical microphone. Successful image follow-ups read VIOLET COMPASS from approved pixels with no manual labels or phrase in the question. Each successful loop verifies two STTs, two answer responses, two audio responses, playback progress, automatic resumption and End stopping all capture tracks. Another browser window held focus; native OS application focus and human listening quality remain untested.

| Language | Real voice + image chain |
|---|---|
| Hindi | verified; final image answer: कृपया VIOLET COMPASS बटन का चयन करें। |
| English | verified |
| Bengali | verified after VAD threshold repair; both transcriptions match the synthetic questions |
| Marathi | verified |
| Telugu | verified |
| Tamil | failed strict accuracy check: Sarvam misrecognized the short synthetic question even from its uncut WAV. Earlier image/audio loop passed; latest image answer requested another view rather than reading the instruction. Do not mark reliable Tamil conversation verified. |
| Urdu | failed/unsupported speech output; limitation shown with zero speech/answer requests; text retained |

Repairs found by live checks: upstream20-second timeouts used408 and caused a transport replay followed by409. Upstream timeouts now use504; generation/translation calls allow45 seconds within90-second turns. Focused504 regression passes. Custom VAD thresholds missed Bengali; restored the library's .3/.25 thresholds while retaining450ms minimum speech,800ms leading audio and adjustable2/3.5/5-second silence. Static Sarvam onboarding/recovery assets cover six supported output locales. Local cloud microphone input was explicitly enabled by the user; per-session consent and exact-image consent remain separate. All completed test identities and owned data were removed.

Final focused checks: seven voice/typing cases pass (six in the combined run, approval case after fixing its teardown to await End), plus the earlier microphone-denial case and the upstream504 unit regression. They cover exact/negated voice commands, voice approval without image upload, edited-image spoken review, pause reset, one submission, capture suspension during playback, bounded provider recovery, Send/Enter, Shift/IME and retained failed drafts. Final typecheck, production builds and docs checks pass. Full broad suites were not repeated.

Earlier image-slice evidence below predates this voice change; it is not a claim that every broad suite was rerun.

Updated 2026-09-11. This supersedes earlier quota-blocked and labels-only checkpoints. The English approved-image journey is live-verified; the entire product is not release-verified.

| Check | Actual result |
|---|---|
| Core/API regressions | pnpm test:23/23 pass, including PNG/hash/consent validation and Gemini3 image token budgeting |
| Mongo/Nest integration | pnpm test:integration:12 nested scenarios plus parent,13 entries pass |
| Full browser suite | pnpm test:browser:32/32 pass in45.6s, no retries/skips/failures |
| Build/types | Typecheck and final frozen Docker web/API production builds pass; final images running |
| Contracts/localization | pnpm check:docs passes;202 literals covered, generated OpenAPI current |
| Local configuration | No problems or pending policies; Gemini, translation, transcription and speech-output operations independently configured; valid Firebase Admin JSON |
| Live identity | Real temporary preverified-account Firebase password login and protected preferences200; pre-login draft retained |
| Live image journey | Real Gemini200 from one outgoing question request; exact approved preview bytes and SHA256 match submitted image |
| Live speech | Real Sarvam200; valid2.133333-second WAV; browser currentTime advanced and no audio error appeared |
| Cleanup | Exact temporary Firebase identity and owned app data removed; UID-only deletion tombstone may remain |

## Live synthetic screenshot proof

scripts/check-live-image.cjs --run generated an800x450 screenshot with a synthetic private header and the instruction Press the VIOLET COMPASS button to continue. The browser masked the top20percent and cropped width to90percent, producing the720x450 image shown in its local preview. It explicitly checked image-analysis consent and approved that exact PNG. The question was: What action does the instruction in this snapshot ask me to take? Quote its button label exactly. The phrase VIOLET COMPASS was not entered as a label or included in the question; reviewedLabels was empty.

The production browser -> Firebase-authenticated Nest route -> actual Gemini REST generateContent -> displayed answer flow returned200. Answer: Please select the button labeled VIOLET COMPASS. The API request image bytes exactly matched the approved preview and its SHA256. The real adapter diagnostic separately observed Google's200 response and verified the forwarded inlineData digest matched the approved image. No provider mocks were used for these live checks.

The same owned answer was sent to real Sarvam after Enable answer audio and Play. The strengthened check requires loaded audio, positive duration, actual playback progress and no UI audio alert. It passed. This establishes working browser playback, not human listening quality. Urdu TTS remains explicitly unavailable by accepted product decision.

Safe latest report (synthetic text only; no keys, tokens, IDs or image bytes):

```json
{
  "realFirebasePasswordLogin": true,
  "realGeminiImageStatus": 200,
  "attemptStatuses": [
    200
  ],
  "outgoingTurns": 1,
  "distinctiveInstructionRecognized": true,
  "manuallyEnteredLabels": 0,
  "approvedImageWidth": 720,
  "approvedImageHeight": 450,
  "approvedImageChangedFromOriginal": true,
  "answer": "Please select the button labeled VIOLET COMPASS.",
  "approvedBytesMatchPreview": true,
  "liveSpeechVerified": true,
  "realSpeechStatus": 200,
  "audioDurationSeconds": 2.133333
}
```

The initial image response incorrectly populated manual label IDs with observed text; prompt/schema now separate these fields while retaining ID validation. Some intermediate live requests timed out or returned REQUEST_ALREADY_USED409. The final run returned200 on its first attempt with one outgoing turn. The harness permits at most one explicit UI Retry for selected transient failures and records every status; final attemptStatuses was[200]. No reliability or zero-billing-on-cancel guarantee is made.

Visual review exposed successful audio loading without playback because React and imperative code both updated src. The ref now owns src; regression tests and the final real check require currentTime to advance. Old load-only speech evidence is superseded.

## Boundaries covered

Browser regressions cover local crop/mask pixels, exact preview/data/hash equality, no question upload before approval, editing/replacing images, changed shared frames, renewed approval, failed request/draft/Retry, labels-only voice/text paths, Send/Enter duplicates, Shift/IME, translation/draft preservation, native audio controls/cache, capture cancellation, mobile reflow/RTL, automated axe and Chromium floating-chat focus.

Core and real-Mongo integration tests reject missing image consent, malformed or metadata-bearing PNGs, dimensions/hash mismatches, too-large bodies, unauthenticated/unverified users, cross-owner sessions and stale source versions before image analysis. Database assertions exclude approvedImage/base64 from sessions and request records. Sarvam translate/speak budgets are independent, shared across account keys, and do not invent unpublished TPM/RPD caps. An unverified operation remains gated without blocking an independently established Gemini operation.

Automated browser suites inject Firebase/provider doubles into an isolated Nest API4101 backed by a unique guide_test_UUID Mongo database. Every completed run deletes only that database after verifying its exact name. These fixture answers establish UI behavior, not live translation/vision quality. No user database or unrelated27017 service was changed.

The live script creates only a temporary synthetic preverified account, blocks verification-email requests and holds generated credentials in memory. Exact-account cleanup always runs; a secrets/live-image-check.json manifest is retained only for incomplete cleanup. All completed live runs removed their manifests. Test screenshots/reports under ignored test-results contain only generated synthetic content; the application itself persists no images or raw recordings. Browser runs replace test-results, so run the live check afterward if keeping its local artifacts.

## Remaining release gates

- Real Sarvam translation and microphone-transcription combinations, including Hindi guidance with independently selected English drafts. Policy readiness is established; live behavior for these operations is still unverified. Strict privacy remains enabled by default, with separate recording-upload consent.
- Normal signup, verification and password-reset email delivery through an authorized mailbox. Real preverified-account login is already verified.
- Native text review across seven languages, human listening across six supported output languages, screen readers, physical microphone/sharing/touch and representative users. Follow docs/evaluation.md; automated axe and PCM playback are not substitutes.
- Public deployment was not performed. Local Docker is the tested runtime. Preserve the accepted Urdu-audio limitation; no replacement provider or seven-language speech success claim.
