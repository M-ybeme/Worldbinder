# Testing strategy

## Three layers, deliberately not mocked at the boundaries that matter

| Layer                         | What it covers                                              | Runs against                                    | Command                 |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ----------------------- |
| Unit                          | Pure logic — policy services, validation, utility functions | Nothing external (real code, no DB/Redis)       | `pnpm test`             |
| Integration (`*.e2e-spec.ts`) | Full request/response through real NestJS controllers       | Real Postgres, Redis, MinIO, Mailpit            | `pnpm test:integration` |
| End-to-end (Playwright)       | Full user flows through a real browser                      | Real dev stack (API + worker + web + all infra) | `pnpm test:e2e`         |

Despite the name, `*.e2e-spec.ts` files (Jest, `apps/api/test/`) are what this document calls **integration** tests — they exercise the real service layer, guards, and database through `supertest` against a real `NestTestingModule`, but without a browser. The Playwright suite (`apps/web/e2e/`) is the actual end-to-end layer, driving Chromium/Firefox/WebKit against the real running app.

**Integration tests hit real infrastructure, not mocks — this is a deliberate roadmap principle, not a shortcut.** Mocking Postgres/Redis/Mailpit would mean a passing test suite could still ship a broken migration, a real SQL error, or a genuinely broken auth-email flow. Auth integration tests poll Mailpit's REST API (`localhost:8025`) to retrieve real verification/reset-password links rather than asserting a mock was called — the same discipline the Milestone 15 demo-content script and Milestone 14 load-test scripts follow: real HTTP calls against a real running server, not raw inserts or stubbed responses.

## Unit tests

`pnpm test` fans out across all four packages that have them (`@worldbinder/api` via Jest, `@worldbinder/web`/`@worldbinder/worker`/`@worldbinder/config` via Vitest). These cover logic that's genuinely pure and worth isolating from infrastructure: `CampaignPolicyService`'s truth table, revision merge-window boundary logic (`shouldMergeRevision`), calendar/search-query validation, magic-byte detection, rate-limit guard behavior. If a piece of logic needs a real database to make sense of, it belongs in the integration layer instead — these tests intentionally don't reach for network/DB mocks to fake that need.

## Integration tests

`pnpm test:integration` requires `pnpm infra:up` first (or CI's ephemeral service containers). Runs with `maxWorkers: 1` (`apps/api/test/jest-e2e.json`) — specs share real IP-scoped rate limits and a real Mailpit inbox against the same backend, so parallel workers would race each other's state, not just slow down. Single-test invocation:

```bash
pnpm --filter @worldbinder/api exec dotenv -e ../../.env -- jest --config ./test/jest-e2e.json auth.e2e-spec -t "full lifecycle"
```

**Known footgun, hit for real in Milestone 15 and worth repeating here**: never run `pnpm test:integration` while a `pnpm dev` stack is also running against the same `.env`. The dev API/worker processes consume the same real Redis/BullMQ queues the test suite uses — a stray running worker will silently pick up jobs meant for the test suite's own attachment-processing assertions, corrupting expected state in ways that look like a flaky app bug but are actually two consumers racing for the same queue. Stop the dev stack before running this suite.

## End-to-end (Playwright) tests

`pnpm test:e2e` (root) or `pnpm --filter @worldbinder/web test:e2e` requires both `pnpm infra:up` **and** `pnpm dev` already running — the opposite precondition from integration tests, and the two commands should never run at the same time for the reason above. `apps/web/playwright.config.ts` deliberately doesn't use Playwright's `webServer` auto-start, since the app needs Postgres/Redis/Mailpit plus three Node processes, not one. Runs with `workers: 1` for the same shared-state reason as the integration suite. Not yet wired into CI (`.github/workflows/ci.yml` doesn't run it) since CI doesn't orchestrate the full multi-process dev stack — run it locally before a release, per Milestone 16's regression-pass phase.

When writing a new Playwright spec: always wait for the _target_ page's own content to be visible before interacting with it, not just the URL to change — a client-side route change updates the address bar before the new page's content necessarily paints. A missing wait here produced a real, deterministic (not flaky) test failure caught during Milestone 16 Phase 1, where a test interacted with the previous page's still-visible content immediately after a navigation click.

## CI (`.github/workflows/ci.yml`)

Four jobs, running in parallel: `lint-typecheck-build` (lint, typecheck, unit tests, build — one job since they share the same install/build steps), `integration-tests` (real Postgres/Redis/Mailpit service containers), `validate-migrations` (confirms `drizzle-kit generate` produces no diff — catches a hand-edited or out-of-sync migration), and `secret-scan` (Gitleaks). The `.claude/hooks/changelog-check-on-push.mjs` hook additionally blocks a local `git push` that doesn't touch `CHANGELOG.md`.

## What isn't covered yet

No coverage-percentage threshold is enforced anywhere (no `--coverage` gate in CI) — test coverage is judged by reviewing what each milestone's phase actually exercised, not a numeric target. No visual-regression/screenshot-diff testing exists. No load/performance testing runs in CI — the Milestone 14 load-test scripts (`apps/api/src/load-test/`, `apps/worker/src/load-test/`) are run manually against a local stack, not on every push.
