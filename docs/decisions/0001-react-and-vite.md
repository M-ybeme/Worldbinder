# ADR-0001: React and Vite for the frontend

**Status:** Accepted
**Date:** 2026-07-10

## Context

Worldbinder needs a frontend framework that supports a large, long-lived single-page application with rich-text editing, complex forms, and frequent navigation between deeply nested campaign resources. The project also exists to demonstrate professional frontend engineering.

## Decision

Use React 19 with Vite as the build tool and dev server, React Router for client-side routing, and TypeScript in strict mode.

## Alternatives considered

- **Next.js:** Server rendering and file-based routing are not needed. Worldbinder is an authenticated, session-based application with no public/SEO-facing pages, so SSR adds operational complexity without product benefit.
- **SvelteKit / Vue:** Smaller ecosystems for the specific libraries this project needs (TipTap, TanStack Query, mature accessibility tooling). React was chosen partly for ecosystem depth.

## Consequences

Client-side routing means auth and permission checks must be enforced by the API, not just hidden in the UI (see [[0003-modular-monolith]] and the authorization design in the roadmap). Vite gives fast local iteration, which matters for a project worked on in short sessions.

## Revisit conditions

None expected before v1.
