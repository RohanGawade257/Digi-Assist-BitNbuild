# Implementation decisions

## 2026-09-11: Governing overview
The kit overview explicitly supersedes revision 2 and adds 76 lines of requirements. Use its revision 3 alongside the master prompt. Preserve both originals. The Markdown architecture is canonical; DOCX extraction is unnecessary.

## First slice scope and compatibility
No application existed. Use the prescribed root pnpm workspace, Next.js 16, NestJS 11 and MongoDB official driver. Host Node is 22.20.0; containers target Node 24. Node 22 is supported for local checks; no host replacement is required. Pin dependencies and lock installation. Use Node's built-in test runner with compiled API code to exercise Nest decorator metadata without a second compiler.

## Incremental contracts
Start typed turns with strict JSON and reviewed label-only context. No image bytes accepted by this API. Raw screenshots remain local; manual public-label entry provides a keyboard alternative without pretending to classify arbitrary OCR. Multipart approved crops remain a later extension. History creation accepts false only until persistence/deletion gates pass; do not pretend an enabled history option works.

## Small state and styles
Use React state and native form controls with CSS tokens for the first connected slice. Additional state/UI libraries would not resolve a current problem. Seven-language catalogs are explicit and require human review. Native language quality and complete localization remain release gates.
