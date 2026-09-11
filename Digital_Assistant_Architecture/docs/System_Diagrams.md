# System diagrams

Revision 3. These describe the planned system; they do not imply that application code is included. Mermaid diagrams render in compatible Markdown viewers. Read [System Design](System_Design.md) for boundary details.

## Components and trust boundaries

```mermaid
flowchart TD
  Capture["Local capture or screenshot"] --> Review["Accessible local review"]
  Review --> Web["Next.js website"]
  Web --> Auth["Firebase Authentication"]
  Web --> API["NestJS API"]
  API --> Gate["Identity and context checks"]
  Gate --> Turn["Turn orchestration"]
  Turn --> Gemini["Gemini reasoning"]
  Turn --> Sarvam["Sarvam language services"]
  Turn --> DB["MongoDB permitted records"]
  Native["Future native client"] -.-> API
```

Raw pixels stay local until approved context is produced. Voice recording is a separate consented transfer; transcript redaction cannot protect audio already sent to Sarvam. All provider secrets remain in the API. No component has remote-click or email-send authority.

## Answer and clarification flow

```mermaid
flowchart TD
  Ask["Voice or typed question"] --> Clear{"Clear question?"}
  Clear -->|No| Clarify["Localized clarification"]
  Clear -->|Yes| Context{"Screen context needed?"}
  Context -->|Yes| Safe["Fresh approved labels or crop"]
  Context -->|No| English["Safe English question"]
  Safe --> English
  English --> Ground["Gemini with relevant evidence"]
  Ground --> Valid{"Evidence and labels valid?"}
  Valid -->|No| Limit["Clarification or limitation"]
  Valid -->|Yes| Localize["Reply and draft locales separately"]
  Localize --> Output["Validated text and optional speech"]
```

STT occurs only for voice input. An unclear recording uses the selected-language recovery prompt. Source changes invalidate target selection and review; a stale request cannot speak directions for a new page. Draft language never silently changes assistance language.

## Chat interaction states

```mermaid
stateDiagram-v2
  [*] --> Collapsed
  Collapsed --> Revealed: Launcher focus or hover
  Revealed --> Editing: Enter Space or tap
  Editing --> Pinned: Pin visible
  Pinned --> Editing: Unpin
  Editing --> Floating: Explicit floating window action
  Floating --> Editing: Window closed
  Editing --> Collapsed: Escape and restore focus
  Revealed --> Collapsed: No focus hover draft or unread reply
```

Focus reveals the in-page panel; it does not open a browser window. Typing, an unsent draft, unread reply, or pin prevents automatic collapse. Touch has explicit buttons. Keyboard shortcuts work only in a receiving assistant window; ordinary websites cannot install global hotkeys in unrelated applications. Chat movement must not duplicate microphone capture or playback.

## Quota scheduling

```mermaid
flowchart TD
  Request["Validated turn"] --> Budget{"Group budget available?"}
  Budget -->|No| Queue["Bounded queue or busy reply"]
  Budget -->|Yes| Reserve["Atomic reservation"]
  Reserve --> Key["Healthy permitted credential"]
  Key --> Call["Provider operation"]
  Call --> Outcome{"Result category"}
  Outcome -->|Success| Reconcile["Reconcile usage"]
  Outcome -->|Rate limit| Cooldown["Group cooldown"]
  Outcome -->|Invalid key| Disable["Disable slot"]
  Outcome -->|Policy denial| Stop["Stop and report"]
```

Four same-project Gemini slots have one project budget. Sarvam grouping follows verified account limits. Per-operation reservations must also respect any shared cross-operation/account ceiling. Two attempts per operation and two extra retries per turn are maximums, constrained by the execution deadline.

## Container boundary

Base Compose starts MongoDB only. The app overlay later adds web and API, read-only Firebase credentials, a read-only quota-policy bind mount, and readiness dependencies. The API health URL is `/api/v1/ready`. Development ports bind to localhost; mobile testing needs a deliberately configured HTTPS endpoint. See the [Docker README](../README.md) and [Compose startup documentation](https://docs.docker.com/compose/how-tos/startup-order/).
