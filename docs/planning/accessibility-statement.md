# Accessibility statement

**Target**: primary workflows meet WCAG 2.2 AA expectations. **This is not a certification claim** — no formal WCAG audit, automated `axe` scan, or manual testing with real assistive technology (NVDA, JAWS, VoiceOver) has been performed. What follows is an honest account of what Milestone 13 (UX and Accessibility Hardening, completed 2026-07-15) actually found and fixed, verified through DOM/ARIA-correctness reasoning and Playwright-driven checks, not a compliance certificate.

## What was audited and fixed

Milestone 13 began from a genuinely greenfield state — no responsive CSS, no shared loading/error/empty components, no focus-trap primitive, real keyboard bugs, and untested contrast. Eight phases, each with concrete findings:

- **Loading/error/empty states** (Phase 1): several pages had no loading or error handling at all, or conflated a real error with "not found" — fixed with shared `LoadingState`/`ErrorState`/`EmptyState` components rolled out across every list/detail page.
- **Keyboard and screen-reader access** (Phase 2): `MapPinMarker` was focusable but keyboard activation (Enter/Space) silently did nothing — a real bug, not a style gap. `SearchOverlay` declared `role="dialog" aria-modal="true"` with no actual focus trap, letting Tab escape to the page behind it. Neither `SearchOverlay` nor `Combobox` set `aria-activedescendant` as arrow keys moved the active option. Tag/chip rows had no `aria-live` announcement. All fixed, including a minimal focus-trap utility built for the search dialog (none existed anywhere in `packages/ui` before this).
- **Contrast** (Phase 3): muted text was done via CSS `opacity` rather than a dedicated color token, several instances likely failing AA's 4.5:1 for normal text — replaced with real `--wb-muted-fg`-style tokens computed to pass AA in both light and dark themes.
- **Responsive/tablet layout** (Phase 4): zero viewport breakpoints existed; fixed-width layout throughout. Added a tablet breakpoint target (~768–1024px) and fluid layout for the main content area, nav, and key forms.
- **Reduced motion** (Phase 5): a preemptive `prefers-reduced-motion: reduce` guard, added before any real animation existed in the app, so the one animation that has since appeared (`LoadingState`'s spinner) was already covered.
- **Onboarding and help** (Phase 6): a lightweight first-run experience for the zero-campaign state, plus a basic Help page — deliberately not a full product tour, consistent with this codebase's "build up only as real screens need them" philosophy.
- **Browser compatibility** (Phase 7): added Firefox and WebKit Playwright projects alongside the existing Chromium one (this repo's documented supported-desktop-browser list — no separate browserslist config exists or is needed). Running the full e2e suite against all three surfaced 5 failures, all genuine test-timing bugs, not product bugs — fixed by scoping locators and waiting for real post-mount state instead of racing navigation.
- **Regression-proofing** (Phase 8): added `eslint-plugin-jsx-a11y` to the shared ESLint config (`apps/web` extends it), which surfaced 5 findings — 4 legitimate patterns documented with an inline justification, one genuine fix (a redundant `role="list"` removed). Added `getByRole`/`getByLabelText` tests for the three riskiest widgets touched in Phase 2, so these specific bugs can't silently regress.

## Scope

Desktop and tablet only — no mobile-emulation testing or phone-specific layout work has been done; that's out of scope for the current roadmap, not an oversight.

## Known gaps

- No automated `axe`/`jest-axe` scan runs anywhere (static analysis via `eslint-plugin-jsx-a11y` covers the specific gaps this milestone's manual audit found, not a general runtime accessibility scan).
- No testing has been done with real screen readers or other assistive technology — all verification is DOM/ARIA-structural reasoning plus Playwright's accessibility-tree-aware locators (`getByRole`, `getByLabelText`), which is a meaningful signal but not the same as a human AT user's experience.
- `packages/ui` itself has no lint step of its own — its components are only linted where consumed by `apps/web`, a pre-existing gap noted but not closed in Milestone 13.
- No mobile/phone support.

## Reporting an issue

During the current in-person beta, tell the developer directly (see `docs/product/beta-release-notes.md`). There's no separate accessibility-specific feedback channel yet — general support-contact provisioning is deferred to Milestone 16 alongside real hosting.

---

_Last updated: 2026-08-12, as part of Milestone 16's documentation pass. Reflects Milestone 13's actual completed work (0.13.1–0.13.7), not a new audit._
