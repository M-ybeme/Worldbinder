# Worldbinder UI/UX Philosophy and Navigation Model

## Core Design Principle

Worldbinder should not feel like a database, spreadsheet, or collection of forms.

A GM does not think:

> "I need to edit Entity #42."

A GM thinks:

> "Who was that guard captain the players met three sessions ago?"

Or:

> "What was the plot thread about the missing caravan?"

Or:

> "Show me everything connected to the Ashen Guard."

The UI should be designed around how GMs think about their worlds rather than how data is stored internally.

---

# High-Level Navigation

The primary navigation should remain intentionally small.

```text
Dashboard
World
Sessions
Threads
Maps
Search
```

These represent different views into the same connected campaign data.

Avoid creating dozens of top-level navigation areas.

The encyclopedia should remain the center of the product.

**Decision:** Timeline and the relationship graph are views _within_ World, not separate top-level destinations — they're different lenses on the same campaign knowledge (chronological, spatial via Maps, relational), not a distinct content domain:

```text
World
├── Encyclopedia
├── Timeline
└── Relationships
```

Maps stays top-level despite being "a view of world data" too, because it's visually distinct and likely to be used as a major navigation surface in its own right, not a secondary lens on entity pages.

This structure and navigation is the same for GM and player roles — see Player Experience below and Threads' player-visibility breakdown under Plot Threads. Role differences affect content and available actions, not which sections exist.

---

# Dashboard

## Purpose

The dashboard answers:

> "What is happening in my campaign right now?"

It acts as the campaign command center.

## Example Layout

```text
Campaign Name

Current In-World Date

Upcoming Session

---------------------

Active Plot Threads

---------------------

Recently Edited

---------------------

Recent Activity

---------------------

Campaign Statistics
```

## Dashboard Components

Recommended widgets:

### Current Campaign Status

- Current in-world date
- Campaign status
- Upcoming session
- Last session played

### Active Plot Threads

- High-priority threads
- Recently updated threads
- Dormant threads requiring attention

### Recently Edited

- Entities
- Sessions
- Plot threads

### Recent Activity

- New entities
- Updated relationships
- New sessions
- Thread updates

### Quick Actions

- New Character
- New Location
- New Session
- New Plot Thread

---

# World Section

## Purpose

The World section is the encyclopedia.

This is where the majority of campaign information lives.

It should function similarly to a private campaign wiki.

## World List View

Example:

```text
World

Search...

Characters
Locations
Factions
Items
Events
Lore

-------------------

Blackwall

Frontier town near the mountains.

-------------------

Duke Renald

Ruler of Westvale.

-------------------

Ashen Guard

Military faction.
```

## Filtering

Support filtering by:

- Entity type
- Tags
- Visibility
- Recently updated
- Alphabetical
- Favorites

---

# Entity Pages

## Purpose

Entity pages are the most important pages in the application.

Everything should ultimately connect back to entity pages.

An entity page is the canonical source of information.

## Example

```text
Blackwall
(Location)

================================

Summary

Frontier town near the northern wall.

================================

Description

Rich text content.

================================

Relationships

Located In
→ Velis

Controlled By
→ Duke Renald

Nearby
→ Stonewater Pass

================================

Appears In

Session 3
Session 8
Session 12

================================

Plot Threads

Missing Caravan
Ashen Guard Activity

================================

Attachments

Map
Images

================================

Backlinks

Referenced By:

Duke Renald
Ashen Guard
Stonewater Pass
```

---

# Entity Page Layout

Recommended sections:

## Header

Contains:

- Name
- Entity type
- Tags
- Visibility badge
- Quick actions

## Summary

Short description.

## Main Content

Rich-text content.

## Relationships

Shows:

- Outgoing relationships
- Incoming relationships

## Session Appearances

Sessions where the entity appears.

## Plot Threads

Connected plot threads.

## Attachments

Images, documents, maps.

## Backlinks

All references pointing to the entity.

## Revision History

Historical changes.

---

# Sessions

## Purpose

Sessions create campaign history.

They connect gameplay events to encyclopedia entries.

## Session List

Example:

```text
Session 1
Session 2
Session 3
Session 4
...
```

## Session Detail

Example:

```text
Session 12

Date:
June 8

===================

Summary

Players investigated
the Amber Temple.

===================

Locations

Amber Temple
Mountain Pass

===================

Characters

Alrik
Cedric
Duke Renald

===================

Threads Advanced

King's Illness

===================

Threads Created

Cult Beneath the Temple
```

## Session Components

### Metadata

- Session number
- Date
- In-world date
- Status

### Recap

Public session summary.

### GM Notes

Private information.

### Featured Entities

Characters, locations, factions, etc.

### Plot Thread Changes

- Introduced
- Advanced
- Resolved

### Discoveries

Information revealed to players.

---

# Plot Threads

## Purpose

Plot threads represent unresolved story elements.

This feature exists to help GMs maintain continuity.

## Example

```text
Missing Caravan

Status:
Active

Importance:
Major

====================

Summary

A merchant caravan
vanished near Blackwall.

====================

Connected Locations

Blackwall
North Road

====================

Connected NPCs

Cedric
Captain Varen

====================

Session Timeline

Session 4
Introduced

Session 6
Investigated

Session 9
Evidence Found

====================

GM Notes

Hidden information.
```

## Thread Components

### Metadata

- Status
- Importance
- Visibility

### Summary

Player-facing explanation.

### GM Information

Hidden information.

### Connected Entities

Characters, locations, factions, events.

### Session Timeline

Historical progression.

### Resolution

Final outcome.

---

## Player Visibility

Players get a **Threads** nav item — plot threads are player-visible data (`public_content_json`, player-facing status) and hiding the whole section behind no navigation entry would just make that data hard to reach for no benefit.

The thread itself can be visible while parts of it stay hidden — the API filters fields, the frontend never receives what it shouldn't render.

### GM sees

- Public summary
- GM notes
- Internal status (Foreshadowed / Active / Dormant / Resolved / Abandoned) and importance
- Full connected entities, including hidden ones
- Full progression history and planned developments
- Edit controls

### Player sees

- Public title and summary
- Player-facing status (see projection below) — never the raw internal status
- Known connected entities only
- Session history that has been revealed
- Public resolution, if resolved

### Player sees nothing of

- GM notes
- Planned developments
- Hidden entities/relationships
- Internal importance, unless intentionally exposed
- Unrevealed session connections

### Status projection

Internal status is GM-facing and can itself spoil something ("Abandoned" reveals a dead end before the players find that out in-fiction). Players get a smaller projected vocabulary instead of the raw enum:

| Internal (GM) | Player-facing                                    |
| ------------- | ------------------------------------------------ |
| Foreshadowed  | Open                                             |
| Active        | Ongoing                                          |
| Dormant       | Ongoing                                          |
| Resolved      | Completed                                        |
| Abandoned     | Open, or hidden entirely depending on visibility |

v1: pure API-side projection computed from `status`, no extra column. Revisit only if a GM needs the player-facing label to diverge from a mechanical function of internal status.

Example — GM view:

```text
The Missing Caravan

Status: Active

GM Truth:
The caravan was intercepted by agents of House Valmere.

Planned Development:
Evidence appears in Session 9.

Hidden Connection:
Duke Renald
```

Same thread, player view:

```text
The Missing Caravan

Status: Ongoing

The party learned that a merchant caravan disappeared
on the North Road near Blackwall.

Known Connections:
- Blackwall
- North Road
- Captain Varen

Discovered In:
- Session 4
- Session 6
```

---

# Maps

## Important Design Rule

Maps are NOT the source of truth.

Maps are a visual navigation layer.

The encyclopedia remains the canonical source of information.

## Purpose

Maps answer:

> "Where is it?"

The encyclopedia answers:

> "What is it?"

## Example

```text
[Map]

Blackwall ●

Stonewater ●

Karthspire ●
```

Selecting a pin should open the corresponding entity page.

Example:

```text
Click Pin

→ Open Blackwall Entity
```

Not:

```text
Show giant popup
containing all data
```

---

# Map Features

## Pins

Pins may represent:

- Locations
- Characters
- Factions
- Events
- Quests

## Linked Data

Each pin can connect directly to:

- Entity pages
- Plot threads
- Session references
- Attachments

## Layers

Examples:

- Cities
- Villages
- Factions
- Events
- Quests
- Player-visible content

## Visibility

Different map elements may have:

- GM-only visibility
- Shared visibility

---

# Search

## Purpose

Search may become the most-used feature in the application.

A GM often remembers a name rather than where information was stored.

## Example

```text
Search...

Ashen
```

Results:

```text
Ashen Guard
(Faction)

Ashen Fortress
(Location)

Ashen War
(Event)
```

Selecting a result navigates directly to the page.

## Search Scope

Search should include:

- Entity names
- Aliases
- Tags
- Session notes
- Plot threads
- Relationship descriptions

---

# Creating Information

## UX Goal

Creating information should feel fast and natural.

Avoid forcing users to complete large forms before content exists.

## Preferred Workflow

User selects:

```text
New Character
```

Enters:

```text
Duke Renald
```

Clicks Create.

The application immediately creates the page and navigates there.

The user then gradually adds:

- Description
- Relationships
- Tags
- Images
- Notes

This should feel similar to creating a new wiki article.

---

# Relationship Creation

Relationships should be easy to create from any page.

Example:

```text
Duke Renald

+ Relationship
```

Search:

```text
Westvale
```

Select relationship type:

```text
Controls
```

Save.

Result:

```text
Duke Renald

Controls
→ Westvale
```

And automatically:

```text
Westvale

Controlled By
→ Duke Renald
```

No duplicate editing should be required.

---

# Player Experience

Players primarily use Worldbinder as a campaign wiki.

Navigation stays structurally the same as the GM's — role differences show up in content and available actions, not in which sections exist. Removing whole sections (e.g. hiding Threads) just makes players wonder where information lives:

```text
Dashboard
World
Sessions
Threads
Maps
Search
```

Most interactions are read-only. Threads specifically are read-only with filtered content — see Player Visibility under Plot Threads.

Players use the system to:

- Look up NPCs
- Review session history
- View locations
- Follow plot developments (read-only, via Threads)
- Search campaign knowledge

---

# Future Expansion Possibilities

Not necessarily v1.

Potential future additions:

## Player Knowledge Tracking

Example:

```text
Blackwall

GM Notes
- Baron is secretly a vampire

Known By Party
- Baron is wealthy

Known By Cedric
- Baron paid for his schooling

Known By Elara
- Baron visited her family
```

This would allow player-specific knowledge visibility.

This feature should only be considered after the simpler visibility model is stable.

---

# The Most Important UX Principle

Worldbinder should feel like navigating a connected world.

A user should be able to start on any page and discover related information through:

- Relationships
- Backlinks
- Session references
- Plot threads
- Maps
- Search

The product becomes valuable when users realize:

> "I can start anywhere and quickly find everything connected to it."

That is the primary difference between Worldbinder and a folder full of notes or documents.

The encyclopedia pages are the heart of the application.

Everything else exists to help users navigate, visualize, and understand the connected campaign data.
