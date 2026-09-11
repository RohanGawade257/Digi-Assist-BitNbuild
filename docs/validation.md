# Observed validation — 2026-09-11

| Check | Observed result |
|---|---|
| Frozen pnpm install | Passed; four workspaces current |
| Full TypeScript check | Contracts/API/web passed |
| API/contracts and web production builds | Passed outside Windows sandbox |
| Core tests | 11 passed, 0 failed, 0 skipped |
| Real Mongo/Nest HTTP | 7 nested scenarios + parent passed; Firebase/provider doubles injected |
| Browser initial run | 4 passed; select naming and error locator issues found |
| Browser after repairs | 5 passed; invalid copied PNG fixture rejected |
| Targeted screenshot rerun | Passed with Chromium-generated synthetic PNG; invalid SVG/local blob/clear checked |
| Axe | Zero violations in checked onboarding and 375px enlarged-text workspace |
| Compose configuration | Passed |
| Mongo | Healthy on localhost 27018; existing 27017 service preserved |
| Final Docker builds/start | Repaired web/API built and started; web/Mongo healthy; API alive but readiness deliberately 503 |
| Final full browser suite | All 6 passed in 7.8s against running Docker web after lifecycle fixes |
| Real container smoke | Web 200; health 200; ready 503/database=true; unauthenticated capabilities and POST sessions 401; API no-store headers |
| Visual inspection | Real 1440px onboarding and 375px workspace screenshots inspected; readable controls/reflow; secondary text still English |
| Gemini metadata probe | User explicitly approved key transmission to official Google endpoint; HTTP 200, generateContent supported, no generation performed |
| Latest local configuration | Sarvam key present; Firebase Admin file invalid/missing; quota policy unverified |
| Final diagnostic packaging | probe:local passed with metadataStatus=NOT_REQUESTED; probe scripts included in final rebuilt API image |

Repairs: direct Express dependency; explicit select labels; error locator separate from Next's route announcer; valid generated PNG without relaxing validation; configurable project Mongo port. Sandbox dependency/Docker access failures resolved by running unchanged checks outside it.

Integration creates a unique `guide_test_<uuid>` database and checks that prefix before deleting only it. Existing databases and volumes are preserved. Production logs exclude questions and upstream error bodies.

Unverified: live Firebase identity, Gemini generation, Sarvam calls, account quotas, native listening, microphone/capture devices, NVDA/TalkBack/VoiceOver, representative participants, official rubric, public deployment. Catalog rendering is not language-quality evidence. Axe checks are not WCAG certification or screen-reader evaluation.

Automatic approval review initially rejected sending the Gemini key to Google without explicit destination-specific permission. No workaround was used. After the user explicitly approved that metadata probe, it ran successfully. That approval covers the stated metadata check, not unrelated services or spending.
