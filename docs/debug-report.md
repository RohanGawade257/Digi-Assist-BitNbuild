# Current sprint result: 2026-09-11

Firebase initialization is resolved: live configuration200, Email/Password enabled and real synthetic browser password sign-in/protected preferences passed. The exact temporary account/data were removed. Quota setup is now resolved per API. Real approved-image Gemini generation and Sarvam WAV output have passed; see validation.md for current evidence and remaining checks.

The conversation/accessibility sprint repaired Enter/Send/IME/retry, progressive layout, draft/language continuity, contextual Help, local spoken introduction, capture cancellation including late grants, pointer reset, PiP Escape focus, previous-guidance model context and neutral post-End feedback. Final20 core tests, ten Mongo scenarios plus parent, and30/30 browser tests pass. See validation.md for current evidence and context.md for the resumable handoff.

## Historical investigation below

The original missing Firebase configuration and earlier test counts below describe the earlier investigation, not current blockers.

# Debugging report — 2026-09-11

The audit expanded the first typed slice into connected speech, desktop capture, floating chat, preferences/history/feedback/deletion and secondary localization. Live provider and human evaluation gates remain distinct from fixture tests.

| Finding | Repair | Evidence |
|---|---|---|
| Response limit checked after unbounded response.text allocation | Stream reader enforces byte cap during reads and aborts stalled bodies | Core stream/abort regression |
| Short labels matched inside earlier translation markers | Single-pass tokenization, exact token multiset, one-pass restoration | Short/repeated/overlapping-label regressions |
| Day quota charged before rejected minute reservation | Atomic combined account document; old counters seed migration | Concurrent real-Mongo debit and migration assertions |
| Missing bounded credential replacement | One retry per call/two extra per operation signal; same-account401 replacement; no429/403 identity cycling | Adapter retry and Mongo cooldown tests |
| Default Firebase initialization could restore disk auth | initializeAuth with inMemoryPersistence before observers | Built and authenticated browser fixture journeys |
| Multipart parts limit rejected a valid file+metadata request | Boundary-aware parts cap, still one file/one scalar field | Real Nest multipart suite |
| Five production dependency advisories (3 high,1 moderate,1 low) | Pin platform-express's Multer2.3.0 and gaxios's CommonJS-compatible uuid11.1.1 | Production audit now reports no known vulnerabilities; malformed field tests pass |
| Image dimensions checked only after bitmap allocation | Parse PNG/JPEG/WebP header dimensions before browser decode, then validate decoded bounds | Oversized-header regression and screenshot browser checks |
| Multiple padded TTS audio strings could decode only the first part | Validate and combine complete WAV parts or encoded fragments |1.5-second output from1s+0.5s fixtures |
| Unicode split could exceed requested chunk size at punctuation boundary | Bound cut position and preserve surrogate pairs | Chunk reconstruction/limit regression |
| Late/stale UI answers survived edits or context changes | Abort/discard on edits, locale changes and source invalidation; hash/version checks | Cancellation, IME, shared-frame and Mongo delete-during-generation tests |
| Browser test used obsolete draft option name | Correct locator to existing Prepare a draft label | Seven-language/draft journey passes |
| Test browser closed before end request completed | Wait for successful session-end response | Four-combination tests |
| Windows process teardown may bypass signal handlers | Explicit Playwright global teardown drops only the current manifest's UUID test DB | Cleanup confirmation after browser suite |
| Hidden localized file input inherited full-width input styles and widened mobile pages to432px | Scope the visually hidden input's dimensions and positioning while preserving keyboard access/focus indication |375px viewport and scroll width both375px; all locale reflow and axe checks pass |

Provider constraint: current Sarvam Bulbul v3 docs exclude Urdu output. User explicitly chose to retain the disclosed limitation. Urdu text/input stays available; no provider was replaced and no seven-language audio success is claimed.

Final automated results:19 core tests, ten real-Mongo scenarios plus parent,17 browser tests (22.3s, zero failures/skips), and zero known production dependency vulnerabilities. TypeScript, frozen-lockfile Docker builds and contract/copy checks pass. Final container smoke: web200, health200, readiness503 with database/identity valid and configuration invalid; protected endpoints401, malformed JSON400, oversized JSON413, API responses no-store.

No user credentials, existing databases, unrelated containers or reference-kit files were overwritten. Git changes remain reviewable in the working tree. Remaining live combinations and human checks remain outstanding; see validation.md.

Authentication follow-up: real read-only Firebase project-config probes returned400 CONFIGURATION_NOT_FOUND and Admin404 NOT_FOUND, despite internally consistent environment/bundle/project values. The remote project needs Authentication initialization and Email/Password enabled by the user. App repairs expose safe localized setup errors near account controls, enforce signup form validation, and preserve resend after partial signup success. Four new authentication regressions and the existing successful login/language journey pass across targeted runs. No live account or email was created/sent. See README troubleshooting and `scripts/probe-firebase.cjs`.

Final follow-up: answer text is now visible at the start of the newest turn; microphone startup is distinct from recording, with local duration validation. Final full browser suite30/30 passed in36.6s after these repairs;174 localized literals covered.
