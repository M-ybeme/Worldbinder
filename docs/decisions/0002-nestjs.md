# ADR-0002: NestJS for the API

**Status:** Accepted
**Date:** 2026-07-10

## Context

The API needs dependency injection, a clear module boundary system, first-class testing support, and structure that scales as the domain grows across auth, campaigns, entities, relationships, sessions, and more. The project also exists to demonstrate professional Node backend development distinct from the user's existing .NET/Blazor portfolio.

## Decision

Use NestJS 11 as the API framework, with Express as the underlying HTTP adapter.

## Alternatives considered

- **Plain Express/Fastify:** Faster to start but leaves module boundaries, DI, and testing conventions unenforced. Given the number of domain modules planned (see the repository structure), an unopinionated framework would require rebuilding Nest's conventions by hand.
- **Fastify adapter instead of Express:** Marginal performance gain, smaller ecosystem for some Nest integrations (e.g. nestjs-pino works well on both, but more examples exist for Express). Not worth it for a project where request throughput is not the bottleneck.

## Consequences

Nest's module system directly enables the modular-monolith architecture in [[0003-modular-monolith]]. Controllers, services, and guards get a natural home, which matters for the authorization design where policy decisions must live outside controllers.

## Revisit conditions

None expected before v1.
