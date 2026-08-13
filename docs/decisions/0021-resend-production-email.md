# ADR-0021: Resend selected for production transactional email

**Status:** Accepted
**Date:** 2026-08-12

## Context

Milestone 14 deliberately made the mail transport provider-agnostic (Phase 10 — "Email: transport made swappable"): `MailService` sends through `nodemailer` over plain SMTP, configured entirely by environment variables (`SMTP_HOST`/`PORT`/`USER`/`PASSWORD`/`SECURE`), with `ignoreTLS`'s hardcoded-off bug fixed so a real provider's STARTTLS upgrade isn't silently disabled. At that point the actual production provider was left open — the roadmap and threat model both said "Resend or Postmark," and no account existed for either. This ADR records the follow-up decision, made once real infrastructure planning began (Milestone 16), that narrows that choice to one concrete provider. It does not revisit or replace Milestone 14's transport design — it fills in the one input that design was built to accept.

## Decision

**Resend** is the selected production transactional email provider, reached through Resend's SMTP relay (`smtp.resend.com`) — not Resend's REST API or SDK. Production configuration is `Worldbinder application → MailService/nodemailer → Resend SMTP`, the exact same code path as `Worldbinder application → MailService/nodemailer → Mailpit` in local development, differing only in environment variables (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`) and DNS-level sending-domain authentication for `worldbinder.net`. Mailpit remains the local development target; nothing about local dev changes.

## Alternatives considered

- **Postmark**: the other provider named alongside Resend since Milestone 14. Also SMTP-compatible and would have worked equally well against the existing transport — no technical blocker on either side. Resend was chosen on cost/simplicity grounds for this project's low transactional volume (verification, password-reset, and campaign-invitation emails only — no marketing mail), not because Postmark has a technical shortcoming here.
- **Amazon SES**: named in the roadmap's original `§6.4` infrastructure list alongside Postmark/Resend. Rejected for production for the same reason — added AWS-account/IAM setup overhead this project's mail volume doesn't justify, when a simple SMTP-relay provider does the job through infrastructure that already exists.
- **Calling Resend's SDK/REST API directly instead of its SMTP relay**: would mean replacing `MailService`'s `nodemailer` transport with Resend-specific client code, discarding Milestone 14's deliberate provider-agnostic design for no functional gain — Resend's SMTP relay supports everything this app's mail sending needs (plain transactional sends, no templating/webhooks used). Rejected specifically to preserve that architecture.

## Consequences

- No code changes: `MailService`, its `nodemailer` transport, and every existing test (unit and the Mailpit-polling integration/e2e suites) are unaffected. Only environment variables and DNS records change when this is actually provisioned.
- Production provisioning (Milestone 16) now has a concrete checklist: create the Resend account, authenticate the `worldbinder.net` sending domain in DNS, configure `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` in Railway, set a real `MAIL_FROM` (e.g. `Worldbinder <notifications@worldbinder.net>`), and send a real end-to-end verification/reset/invitation email before considering it done.
- If Resend's pricing or reliability ever becomes a problem at production scale, switching providers is a configuration change (new SMTP credentials) — not a code change — exactly because Milestone 14's transport design was preserved rather than bypassed.

## Revisit conditions

If Resend's free/low tier stops covering this project's actual sending volume, or a real reliability issue surfaces in production, revisit the provider choice — the low migration cost (config only) means this isn't a high-stakes decision to get right permanently on the first try.
