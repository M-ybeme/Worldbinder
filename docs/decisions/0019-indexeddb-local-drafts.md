# ADR-0019: IndexedDB local drafts

**Status:** Accepted
**Date:** 2026-07-16

## Context

Entity editing autosaves on a debounce (`useEntityAutosave`, a 2-second idle delay). A network drop or a stale-write 409 conflict during that PATCH shouldn't silently lose the GM's edit — "the product must help during actual play" (§2.3) means it has to survive an unreliable table's wifi, not just the happy path.

## Decision

On any autosave failure — offline or a 409 conflict — the pending edit is written to IndexedDB (`draftDb.ts`, via the `idb` package, one object store keyed by `campaignId:entityId`) in addition to being held in React state, so it survives a page reload or a closed tab, not just an in-memory retry. The draft is cleared on the next successful save.

## Alternatives considered

- **`localStorage`**: a simpler synchronous API, but blocking and size-limited (roughly 5–10MB) — a poor fit for potentially-large TipTap JSON content (ADR-0010) accumulating across many entities.
- **Keep the failed edit only in memory/component state**: simplest, but a full page reload or tab crash during a network outage loses the edit entirely — exactly the failure mode this feature exists to prevent. Covered directly by an e2e test (`apps/web/e2e/entities.spec.ts`'s "offline mid-edit: change is preserved locally and synced once back online").

## Consequences

- Drafts are local to one browser/device — not synced across devices. Editing the same entity from two browsers could leave each with its own divergent local draft, with no cross-device reconciliation. A real, documented limitation, not an oversight.
- No draft-expiry or cleanup policy exists beyond clearing on successful save — a very old abandoned draft persists indefinitely in IndexedDB until either a save succeeds or the user clears site data.

## Revisit conditions

If a genuine "resume this draft on another device" need arises, that would require syncing drafts through the backend — a materially different design, not an extension of local IndexedDB storage.
