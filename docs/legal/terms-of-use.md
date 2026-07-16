# Terms of Use

> **Draft — for owner and eventual legal review.** This document has not been reviewed by an attorney. It describes terms for Worldbinder's Milestone 15 beta as it actually exists (2026-07-16) — a controlled, in-person, developer-moderated testing period, not a public commercial release. Do not treat this as finalized; do not publish it as a live terms page until reviewed by counsel and the placeholders below are filled in.

**Placeholders to resolve before this becomes a live document:** legal entity name/owner name, jurisdiction, and a permanent contact email.

## 1. What this is

These terms govern your use of Worldbinder during the Milestone 15 beta. By participating in a beta testing session, you agree to these terms. Worldbinder is pre-release software under active development — features, data structures, and even the terms themselves may change before any public release.

## 2. The service

Worldbinder is a permission-aware campaign encyclopedia and continuity manager for tabletop role-playing games. It lets a game master model a campaign as a network of characters, locations, factions, sessions, plot threads, and other structured content, with fine-grained control over what's visible to players versus kept GM-only. See `WORLDBINDER_V1_ROADMAP.md` for the full intended product scope.

Worldbinder is explicitly not a virtual tabletop, dice roller, combat tracker, or character sheet tool — see the roadmap's product principles (§2.5) for what it deliberately does not attempt to be.

## 3. Beta status

This is a closed, moderated beta. There is no public sign-up and no hosted production deployment. You are testing pre-release software at the developer's invitation, with the developer present to observe and take notes. Bugs, data loss, and unfinished features should be expected — this is precisely what the beta exists to find, per this milestone's exit criteria (no unresolved data-loss defect, no high-severity authorization defect, before any wider release).

## 4. Your account

You're responsible for the accuracy of the information you provide when creating an account and for keeping your password confidential. Accounts are for the individual beta participant they were created for and are not intended to be shared.

## 5. Your content

**You own what you create.** Campaign content you create in Worldbinder — entities, relationships, sessions, plot threads, maps, attachments, and everything else — is yours. Worldbinder's own product principle (roadmap §2.4, "users own their campaign data") commits to that content being exportable and restorable in a versioned, documented format independent of the underlying database, specifically so you are never locked in.

**You're responsible for what you upload.** Don't upload content you don't have the right to upload, or content that's unlawful, infringing, or knowingly harmful to others.

**GM-only content stays GM-only.** Worldbinder enforces `public`/`gm_only` visibility at the backend, not just in the interface, per its own permission model (ADR-0008, ADR-0009). We take that separation seriously as a product commitment, but during this beta you should still treat it as software under test, not a guarantee, when deciding what to mark GM-only.

## 6. Acceptable use

While using Worldbinder, don't:

- Attempt to access another user's account or another campaign you're not a member of, or attempt to bypass the permission/visibility system (`gm_only` content, campaign membership checks) rather than reporting it as a bug.
- Attempt to disrupt the service — for example, deliberately overloading it, attempting to bypass rate limiting, or probing for vulnerabilities outside of the beta testing you've been explicitly invited to do.
- Upload malicious files (e.g. files designed to exploit the attachment-processing pipeline) or content that is unlawful, harassing, or infringes someone else's rights.
- Use the service to collect other users' personal data beyond what's needed for your own campaign use.

If you find a genuine security or permission issue, please report it directly to the developer rather than continuing to probe it — that's exactly the kind of finding this beta is designed to surface (see the roadmap's beta goal, "find permission edge cases").

## 7. Availability and data loss

Because this is pre-release software with no production backup infrastructure provisioned yet beyond a locally-rehearsed backup/restore procedure (see `docs/runbooks/incident-triage.md`), we cannot guarantee against data loss during the beta. Don't use the beta as the sole copy of campaign content you can't afford to lose — export your campaign if it matters to you (see §5).

## 8. Termination

The developer may suspend or remove access to a beta account at any time, particularly for a violation of §6. You may stop using the service and request account/data deletion at any time — see the Privacy Policy's deletion section for how, given there's no self-service deletion feature yet during this beta.

## 9. No warranty

Worldbinder is provided "as is" during this beta, without warranty of any kind, express or implied. It is pre-release software being actively tested for exactly this reason.

## 10. Age requirement

You must be at least 16 years old to use Worldbinder, consistent with the Privacy Policy's age requirement.

## 11. Changes to these terms

These terms will be revisited before any public release, particularly once real hosting infrastructure exists and self-service account/data-deletion tooling is built. Material changes will be dated and described here rather than silently edited in.

## 12. Contact

During the Milestone 15 beta: contact the developer directly, in person, during your testing session. A permanent contact address will be added here before any public release.

---

_Last updated: 2026-07-16 — Milestone 15 draft._
