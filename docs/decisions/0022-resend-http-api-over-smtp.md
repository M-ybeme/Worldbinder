# ADR-0022: Resend's HTTP API over SMTP for production email

**Status:** Accepted
**Date:** 2026-08-13

## Context

[ADR-0021](0021-resend-production-email.md) selected Resend as the production email provider, reached through its SMTP relay via the existing `nodemailer` transport — deliberately preserving Milestone 14's provider-agnostic SMTP design rather than adopting a provider-specific SDK. Once Railway was actually provisioned and configured with real Resend SMTP credentials, production registration consistently failed: `MailService` timed out after ~4 minutes trying to open a connection to `smtp.resend.com:587`, logging a real `ETIMEDOUT`. Investigating found this wasn't a configuration mistake — Railway blocks all outbound SMTP ports (25, 465, 587, 2525) for every plan below Pro ($20/month base), a platform-wide firewall policy, confirmed via Railway's own support channels. Switching SMTP ports doesn't help; the block targets SMTP traffic generally, not one specific port.

This left two real options: pay for Railway Pro to keep the SMTP path ADR-0021 specified, or send mail a different way that isn't blocked. The user chose the latter rather than take on a new recurring cost.

## Decision

`MailService` now supports two mail-sending paths, chosen once at startup based on whether `RESEND_API_KEY` is set:

- **Set** (production): send through Resend's HTTP API via the official `resend` npm package (`resend.emails.send(...)`), over HTTPS — a protocol Railway's SMTP-specific block doesn't touch.
- **Unset** (local dev, CI): unchanged — `nodemailer` over SMTP against Mailpit, exactly as before.

The two paths are mutually exclusive per process (never both active at once), keeping `MailService`'s public interface (`sendVerificationEmail`, `sendPasswordResetEmail`, `sendCampaignInviteEmail`) and every call site identical regardless of which transport is active underneath.

## Alternatives considered

- **Upgrade to Railway Pro** ($20/month base plus usage): would have let ADR-0021's original SMTP design work unmodified — no code change at all. Rejected on cost grounds by the user, given this is a portfolio/beta-stage project with no revenue to offset a new recurring cost just to keep one specific transport mechanism.
- **A different email provider with a working SMTP relay on Railway's free/hobby tier**: doesn't exist as a real option — Railway's block is on SMTP traffic generally (any destination, any provider), not specific to Resend. Switching providers wouldn't have fixed anything.
- **Drop SMTP entirely, use Resend's HTTP API everywhere including local dev**: would have meant real API calls (and a real API key) during local development and CI, losing Mailpit's fully-offline, no-external-dependency testing story — a deliberate, established project principle, not something to give up for transport consistency alone. Rejected; the dual-path design costs a few extra lines in `MailService`'s constructor and pays for keeping local dev exactly as it was.

## Consequences

- `apps/api` gains a real dependency, `resend`, used only when `RESEND_API_KEY` is set.
- `MailService.send()`'s error handling had to account for a real behavioral difference: `nodemailer` throws on failure, while the Resend SDK returns a `{ error }` field on an unsuccessful call rather than throwing — both are now normalized to a thrown error so callers and Sentry capture failures identically regardless of path.
- Local development, CI, and the entire Mailpit-based integration/e2e test suite are completely unaffected — `RESEND_API_KEY` is never set in those environments, so `MailService` takes the same SMTP path it always has.
- ADR-0021's SMTP-relay decision is superseded, not deleted — left in place as an honest record that this was tried first and failed for a real, external reason (a platform policy neither this project nor Resend controls), not a design mistake caught in review.
- Production `SMTP_*` environment variables become dead configuration once `RESEND_API_KEY` is set — left in `apiEnvSchema` (still exercised by local dev/CI) rather than removed, since they're not app-breaking, just unused in that one environment.

## Revisit conditions

If Railway's SMTP block policy ever changes (it was briefly rolled back once already, in August 2025, before being reinstated), or if this project ever moves off Railway to a host that allows outbound SMTP without a paid tier, the SMTP path in `MailService` is already there and tested — no code would need to change, only unsetting `RESEND_API_KEY` in that environment's config.
