# ADR-0018: Structured fantasy-calendar dates

**Status:** Accepted
**Date:** 2026-07-16

## Context

Tabletop campaigns are usually set in worlds that don't use the real Gregorian calendar — custom month names, different month lengths, sometimes a different number of months entirely. Timeline events and a campaign's "current world date" need to represent in-world dates faithfully, not force everything into a real-world calendar that may not even apply.

## Decision

A versioned, structured JSON shape for in-world dates — `WorldDate` (full precision: year/month/day, `schemaVersion`, optional label) and `TimelineDate` (variable precision — year-only, year+month, or full — plus an `approximate` flag) — validated against the owning campaign's own `CalendarConfig` (`packages/contracts/src/calendar.ts`): an ordered list of named months with fixed day counts, defaulting to `DEFAULT_CALENDAR_CONFIG` when a campaign hasn't customized it. Dates are stored as `jsonb`, not native SQL `date`/`timestamp` columns.

## Alternatives considered

- **Native Postgres `date`/`timestamp` columns**: would force every in-world date into the real Gregorian calendar — actively wrong for fantasy settings with a different month structure, which is the entire reason this feature exists. Rejected as directly contradicting the requirement, not just a worse fit.
- **Free-text date strings** ("early spring, three years after the founding"): fully flexible narratively, but impossible to sort, compare, or range-query structurally — would break timeline ordering and any date-based query entirely.

## Consequences

- Every date comparison and sort in the app (timeline ordering, "current world date" display) goes through calendar-aware comparison logic instead of native SQL date functions — a real complexity cost, but contained in `packages/validation`'s calendar module rather than scattered across call sites.
- Timeline events support partial precision (year-only, year+month) plus an explicit `approximate` flag — something a native date type has no way to represent at all, and a real product need (not every historical event has a known exact day).

## Revisit conditions

If real-world calendar interoperability is ever wanted (e.g. exporting a campaign timeline into an actual calendar app), add a Gregorian-mapping layer on top of this structure — not a change to the core structured format itself.
