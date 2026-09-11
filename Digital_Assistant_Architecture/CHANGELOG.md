# Revision changes

## Revision 3 — 11 September 2026

- Included exact copies of Project_Overview.md and Digital_Assistant_Architecture.docx revision 3.
- Replaced the system-design text with the current canonical architecture; refreshed focused API, database, implementation and diagram documents.
- Made older adults, users facing English/reading barriers, and people with disabilities the primary audiences.
- Defined keyboard/touch chat activation, focus persistence, draft preservation, IME handling, pin/escape behavior, and the limits of in-app shortcuts.
- Added safe-label checklists, nonvisual privacy review, no cloud TTS of raw OCR, and preview target selection with an accessible equivalent.
- Separated replyLocale, interfaceLocale and task draftLocale. Standardized source.reviewedLabels and selectedTarget.
- Added dated official evidence requirements and representative-user evaluation gates.
- Aligned health routes to /api/v1/health and /api/v1/ready, including the Docker readiness probe.
- Replaced ambiguous TURN_DEADLINE_MS with TURN_EXECUTION_DEADLINE_MS: 15-second queue budget plus 30-second execution budget. Added TURN_MAX_EXTRA_RETRIES=2.
- Added quota-policy.example.json and an explicit read-only mount; unknown limits are not treated as unlimited.
- Replaced the API's broad env_file pass-through with explicit server environment entries; the browser receives only public Firebase/API configuration.
- Kept four blank Gemini and three blank Sarvam slots, shared quota groups and bounded permitted failover.
- Extended static checks to cover API/Docker route agreement, configuration mounts, public/secret boundaries, document parity and archive contents.

No application feature or live provider test is claimed by this revision. Docker application files remain development templates requiring app sources, workspace manifests and a lockfile. Production hardening remains an implementation gate.
