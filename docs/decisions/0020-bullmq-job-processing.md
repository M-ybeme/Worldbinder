# ADR-0020: BullMQ job processing

**Status:** Accepted
**Date:** 2026-07-16

## Context

Some work — attachment magic-byte/dimension detection, export archive generation, import validation and execution, periodic cleanup sweeps — is too slow or heavy to do inline in an API request. It needs a background job system, run by the separate `apps/worker` process that shares the API's database (ADR-0003's modular monolith: a second process, not a second independently-deployed service).

## Decision

BullMQ, backed by the same Redis instance already required for rate limiting (Milestone 14). The API enqueues jobs (attachment processing, export, import); `apps/worker`'s queue consumers (`attachment-worker.ts`, `export-worker.ts`, `import-worker.ts`) pick them up and execute them. Both processes build their Redis connection through a `createQueueConnection` factory, duplicated (not shared as a package) between `apps/api` and `apps/worker` — the same precedent as the S3 client factory (ADR-0012).

## Alternatives considered

- **A bespoke Postgres-table-based job queue** (poll a `jobs` table with `SELECT ... FOR UPDATE SKIP LOCKED`): avoids adding Redis as a new dependency — except Redis is already a hard dependency for rate limiting, so there's no real dependency-reduction benefit. BullMQ gives retry/backoff/concurrency/delayed-job semantics for free that a hand-rolled table-poller would have to reimplement from scratch.
- **A third-party managed queue service** (e.g. SQS): real infrastructure this app doesn't need yet, and would tie a self-hostable app to one cloud provider's managed service — at odds with the swappable, S3-compatible pattern the rest of the storage/email stack follows (ADR-0012).

## Consequences

- `apps/worker` must be running for attachments, exports, and imports to ever leave their pending state — a real availability dependency, already surfaced by Milestone 14 Phase 11's queue health indicator, and the direct cause of a real footgun found in Milestone 15: a stray `pnpm dev` worker process left running silently consumed jobs meant for the integration test suite's own Redis queue, corrupting test state until traced back to this.
- Job payloads and results are plain JSON through Redis, not queryable via SQL the way a Postgres-table-based queue's history would be. Status observability instead comes from the owning resource's own status column (`attachments.status`, `campaign_exports.status`, etc.), not the queue itself.

## Revisit conditions

If job volume or complexity ever outgrows BullMQ's single-Redis-instance model (e.g. a genuine need for cross-region job distribution) — not a realistic near-term concern at this product's scale.
