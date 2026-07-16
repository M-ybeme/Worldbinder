# Worldbinder — Beta Release Notes

Welcome, and thanks for testing. This is a closed, in-person beta — you're using pre-release software with the developer in the room, watching how it actually holds up at the table and between sessions. There's no sign-up flow to walk through and no support ticket to file: if something breaks or feels wrong, just say so.

## What Worldbinder is

Worldbinder is a **campaign encyclopedia and continuity manager** for tabletop RPGs — the thing that sits beside your notes and your dice, not a replacement for either. It's built around one idea: campaign knowledge is connected, and finding that connection quickly — mid-session, not after twenty minutes of scrolling — is the whole point.

Open a character and you should immediately see their faction, the city they govern, the sessions they've appeared in, the plot threads tied to them, every other page that mentions them, and — if you're the GM — the secrets about them nobody else can see.

Worldbinder is deliberately **not** a virtual tabletop, dice roller, combat tracker, or character sheet app. If you came in expecting one of those, that's useful feedback too — it tells us where the line between "what people assume" and "what we actually built" sits.

## What you can do in this beta

- **Build a campaign as connected entities**, not isolated notes — characters, locations, factions, organizations, items, deities, creatures, historical events, quests, lore, and a catch-all custom type. Link them with typed relationships (ally, rival, member-of, guards, and others), and Worldbinder tracks backlinks automatically — mention someone in another page's text and it shows up on their page as "referenced by," no manual linking required.
- **Split what's public from what's GM-only**, enforced by the backend, not just hidden in the UI — a player's search, page view, or backlink list will never surface `gm_only` content they're not entitled to see.
- **Run sessions and track plot threads** — recap sessions after the fact, link the entities/locations/plot threads involved, and watch plot-thread status evolve (foreshadowed → active → resolved/dormant/abandoned) as your campaign actually plays out.
- **Search across everything** — entities, sessions, plot threads, timeline events — with fuzzy matching, so a rough memory of a name still finds the right page.
- **See revision history**, including who changed what and when, with the ability to restore an earlier version of any entity, session, or plot thread.
- **Draw maps** with layered visibility — a public "surface" layer everyone sees, and a GM-only layer for what's hidden underneath — with pins linking map locations back to real entities.
- **Track a timeline**, mixing historical backstory with the campaign's own unfolding events, each optionally linked to the entities and sessions involved.
- **Attach files** — portraits, handouts, map images, a campaign cover — to the entities, sessions, and plot threads they belong to.
- **Export and re-import a full campaign** as a versioned archive — your data isn't locked into this one running copy of the app.
- **Invite others with real roles** — GM, editor, player, viewer — each with different write/visibility permissions, so a shared campaign behaves the way a shared campaign actually should.

## The demo campaign: Ashgate Crossing

To give you something real to explore instead of an empty campaign, we built out a full demo: **Ashgate Crossing**, a river-crossing town in a succession crisis after its lord's sudden death — while beneath its own chapel, a drowned god's cult quietly uses the chaos as cover.

It's sized to actually show off what connected campaign knowledge looks like once it's real: 39 entities across every type Worldbinder supports, 48 relationships between them, 7 plot threads at different stages, 6 sessions (five played and recapped, one still on the horizon), 14 timeline events, two layered maps, and a handful of real attachments. It has genuine secrets — content only the GM (and, if granted, a trusted editor) can see — and a real multi-session narrative arc, including at least one thread that only resolves once you go looking for it.

Three accounts are set up against it, so you can see the campaign from more than one seat at the table:

| Role   | Email                           | Password                   |
| ------ | ------------------------------- | -------------------------- |
| GM     | `demo-gm@worldbinder.local`     | `ashgate-crossing-demo-9!` |
| Editor | `demo-editor@worldbinder.local` | `ashgate-crossing-demo-9!` |
| Player | `demo-player@worldbinder.local` | `ashgate-crossing-demo-9!` |

Try searching for something and comparing what the GM account sees versus the player account — that gap is deliberate, and it's most of the point.

## What we especially want your reaction to

- Does the navigation and terminology make sense on first contact, without an explanation from us?
- Does setting up a campaign from scratch feel reasonable, or is something confusing/missing?
- At the table, how fast can you actually find something you need mid-session? Too slow is a failed feature, even if the data model behind it is elegant.
- Did you ever expect Worldbinder to do something it doesn't (dice rolling, combat tracking, a character sheet)? That's useful signal about what people assume a "campaign tool" does.
- Anything that felt like it should have been permission-gated but wasn't, or vice versa.

## Explicitly out of scope for this beta

Being upfront about what's deliberately not here yet, so nothing reads as a surprise gap:

- **No hosted deployment.** Everything runs locally or in a controlled test environment the developer runs directly — there's no public URL yet. That's Milestone 16's job.
- **No in-app feedback or bug-report form, and no support channel.** Since this beta is in-person and moderated, feedback happens by talking to the developer directly during your session, not through the app.
- **Error monitoring (Sentry) is wired into the code but inert** — no real project is provisioned yet, so it isn't collecting anything during this beta.
- **No self-service account or data deletion yet.** If you want your account removed after the beta, ask the developer directly — see `docs/legal/privacy-policy.md` for the honest current state of that.
- **The Privacy Policy and Terms of Use are drafts** (`docs/legal/`), written against how the app actually works today, but not yet reviewed by a lawyer and not yet live anywhere.

## Thank you

This beta exists to find what's broken, confusing, or missing before anyone else sees it. Say what you actually think — confusion, a wrong assumption, or "I expected X and got Y" is exactly the kind of finding that makes the next version better.

---

_Milestone 15 — Beta. Last updated: 2026-07-16._
