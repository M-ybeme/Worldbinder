# Worldbinder UI/UX Design System and Visual Direction

> **Status:** Implementation design specification  
> **Scope:** Worldbinder v1 visual system, application shell, component styling, information hierarchy, and page presentation  
> **Primary goal:** Give Worldbinder a coherent, professional visual identity without compromising information density, usability, or the product's role as a campaign knowledge workspace.

---

## 1. Design Direction

Worldbinder should look and behave like a modern knowledge-management and workspace application with restrained fantasy character.

The visual direction should take cues from products such as:

- Linear
- Notion
- GitHub
- Obsidian
- Discord
- Modern developer/admin tools

These products are useful references because they handle:

- Dense information
- Long-lived workspaces
- Nested navigation
- Search-heavy workflows
- Editable structured content
- Repeated daily use
- Dark-mode interfaces
- Clear states and permissions

Worldbinder should **not** imitate the visual language of a fantasy game UI.

Avoid:

- Parchment textures
- Faux leather
- Stone or wood textures
- Ornate medieval borders
- Decorative runes
- Excessive fantasy display fonts
- RPG character-sheet framing
- Large gradients used as decoration
- Heavy glassmorphism
- Excessive rounded-card layouts
- Decorative animation that slows navigation

The product should feel like a serious application that happens to organize fantasy worlds, not a fantasy-themed website.

### 1.1 Core visual thesis

> **Worldbinder should feel like Linear and Notion designed a campaign-management application, with Obsidian-style connected knowledge and subtle fantasy identity.**

The interface itself remains clean and modern. Campaign content — maps, portraits, artwork, names, lore, and relationships — supplies most of the fantasy atmosphere.

---

## 2. Design Principles

### 2.1 Information first

Worldbinder contains potentially large quantities of campaign data. The interface must prioritize:

1. Scanability
2. Navigation
3. Retrieval speed
4. Hierarchy
5. Editing clarity
6. Permission awareness

Decoration must never make information harder to retrieve.

### 2.2 Dense, but not cramped

Worldbinder is closer to a professional workspace than a consumer landing page.

Use compact layouts where users are browsing structured information, but provide enough spacing to make groups and hierarchy obvious.

Lists, tables, filters, tabs, sidebars, and metadata rows should be comfortable at desktop density.

### 2.3 Consistency over novelty

Common UI behaviors should look familiar.

Use conventional patterns for:

- Buttons
- Inputs
- Dialogs
- Sidebars
- Tabs
- Dropdowns
- Tables
- Search
- Toasts
- Empty states
- Pagination
- Breadcrumbs
- Loading states

Worldbinder's identity should come from its domain-specific content and subtle visual choices, not from reinventing standard controls.

### 2.4 Fantasy through content, not chrome

Campaign artwork and data should create the atmosphere.

Examples:

- Character portraits
- Maps
- Faction emblems
- Entity icons
- Campaign cover images
- Relationship visualization
- Timeline content

The surrounding application chrome should remain restrained.

### 2.5 Semantic design tokens

Components must consume semantic tokens rather than arbitrary literal colors.

Do not scatter hardcoded colors across components.

The system should eventually support light mode without rewriting component styles.

### 2.6 Accessibility is part of the design system

Maintain:

- WCAG-compliant contrast
- Visible focus states
- Keyboard navigation
- Reduced-motion compatibility
- Semantic HTML
- Clear form labels
- Proper disabled states
- Non-color-only status indicators

---

## 3. Visual Personality

Worldbinder should feel:

- Dark
- Focused
- Literate
- Structured
- Calm
- Slightly mysterious
- Professional
- Tool-like rather than game-like

It should **not** feel:

- Playful
- Cartoonish
- Ornate
- Medieval
- Corporate enterprise-blue
- Generic bootstrap/admin-template
- Mobile-app oversized

The user should feel as though they are opening a personal campaign archive, not entering a game launcher.

---

## 4. Color System

Dark mode is the primary v1 visual identity.

The exact values may be tuned during implementation, but use the following hierarchy.

### 4.1 Suggested neutral palette

```css
--bg-app: #0f1015;
--bg-surface: #15171d;
--bg-surface-raised: #1b1e26;
--bg-surface-hover: #22252f;

--border-subtle: #272a33;
--border-default: #323640;
--border-strong: #454a57;

--text-primary: #f4f4f5;
--text-secondary: #b4b4bd;
--text-muted: #7d818d;
--text-disabled: #5d606a;
```

These values are starting points, not sacred constants.

### 4.2 Brand color

Worldbinder's primary brand accent should remain violet/purple.

Suggested starting range:

```css
--accent: #a855f7;
--accent-hover: #b76cf8;
--accent-active: #9333ea;
--accent-muted: rgba(168, 85, 247, 0.14);
--accent-border: rgba(168, 85, 247, 0.35);
```

Use the accent for:

- Primary actions
- Active navigation
- Links
- Selected tabs
- Focus rings
- Wiki links
- Important interactive highlights
- Brand elements

Do **not** use purple as a general surface color.

### 4.3 Semantic colors

Use restrained semantic colors.

```css
--success: #4ade80;
--warning: #fbbf24;
--danger: #f87171;
--info: #60a5fa;
```

Each semantic color should also have muted background and border variants.

Example:

```css
--danger-bg: rgba(248, 113, 113, 0.1);
--danger-border: rgba(248, 113, 113, 0.3);
```

### 4.4 Color usage rules

Color must communicate meaning.

Good uses:

- Selected state
- Status
- Severity
- Permission
- Entity type accents
- Relationship visualization

Bad uses:

- Random decorative panels
- Multiple competing gradients
- Different colors for every card
- Large colored backgrounds without semantic purpose

---

## 5. Typography

### 5.1 Primary typeface

Use a clean modern sans-serif for the application UI.

Preferred options:

1. Geist
2. Inter
3. IBM Plex Sans
4. System UI stack

Use one primary UI font consistently.

Suggested stack:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
```

### 5.2 Optional display/serif font

A secondary serif may be used sparingly for campaign-facing identity.

Appropriate uses:

- Campaign title
- Major world/entity headings
- Map title
- Possibly the Worldbinder wordmark

Do not use a decorative serif for:

- Body text
- Forms
- Buttons
- Tables
- Navigation
- Metadata

The secondary font is optional. Do not add it merely to make the app look "fantasy."

### 5.3 Type scale

Recommended baseline:

```text
12px — captions / tiny metadata
13px — secondary UI text
14px — default dense UI
16px — normal body copy
18px — section headings
20px — compact page headings
24px — standard page title
30–32px — major campaign/entity title where appropriate
```

Use font weight and color before adding unnecessary font-size variation.

### 5.4 Text hierarchy

Primary:

- Important names
- Main content
- Current values

Secondary:

- Descriptions
- Supporting labels
- Metadata

Muted:

- Timestamps
- Hints
- Secondary status text
- Empty-state explanations

---

## 6. Spacing System

Use a consistent spacing scale.

Recommended:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Default component spacing should usually come from:

- 8px
- 12px
- 16px
- 24px
- 32px

Avoid arbitrary one-off margins such as `17px`, `29px`, etc.

### 6.1 Page spacing

Desktop pages should generally use:

- 24–32px outer content padding
- 24–32px between major sections
- 12–16px between related controls
- 8px between tightly-related metadata

---

## 7. Border Radius

Worldbinder should use restrained rounding.

Recommended:

```text
Small controls:       6px
Buttons:              6–8px
Inputs:               6–8px
Cards/panels:         8–12px
Dialogs:              10–12px
Badges/pills:         9999px when appropriate
```

Avoid oversized consumer-style 20–30px radii.

---

## 8. Shadows and Elevation

Dark mode should rely more on:

- Surface contrast
- Borders
- Subtle highlights

than on heavy drop shadows.

Use shadows primarily for:

- Dialogs
- Popovers
- Dropdown menus
- Floating search
- Tooltips

Do not put prominent shadows around every card.

---

## 9. Application Shell

Worldbinder needs a consistent application shell before individual pages are polished.

### 9.1 Desktop structure

Primary layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar / campaign context / global actions                 │
├────────────────┬─────────────────────────────────────────────┤
│ Sidebar        │ Main content                                │
│                │                                             │
│ Dashboard      │                                             │
│ World          │                                             │
│ Sessions       │                                             │
│ Threads        │                                             │
│ Maps           │                                             │
│ Search         │                                             │
│                │                                             │
│ ─────────────  │                                             │
│ Members        │                                             │
│ Settings       │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

### 9.2 Sidebar

The sidebar should be the primary campaign navigation.

Primary campaign navigation:

- Dashboard
- World
- Sessions
- Threads
- Maps
- Search

Secondary campaign navigation:

- Members
- Settings
- Import / Export where appropriate

Sidebar behavior:

- Fixed on desktop
- Collapsible if useful
- Active route clearly highlighted
- Icons + labels
- Campaign selector/context near the top
- Account controls should not compete with campaign navigation

### 9.3 Top bar

The top bar should remain lightweight.

Possible contents:

- Breadcrumb/campaign context
- Global search shortcut
- Help
- Notifications later if needed
- Account avatar/menu

Do not duplicate the full sidebar navigation in the top bar.

### 9.4 Responsive behavior

Desktop is the primary use case.

For smaller widths:

- Sidebar becomes collapsible/drawer-based
- Tables may horizontally scroll or change presentation
- Page padding decreases
- Secondary actions collapse into menus
- Main workflows remain available

Do not redesign the entire app as mobile-first if that harms desktop campaign-management workflows.

---

## 10. Page Structure

Most Worldbinder pages should follow a predictable structure.

```text
Breadcrumbs / context

Page title                         Primary action
Short description                  Secondary actions

Tabs / filters / search controls

Main content
```

### 10.1 Standard page header

A page header may contain:

- Title
- Brief explanatory subtitle
- Primary CTA
- Optional secondary actions
- Breadcrumbs
- Status badge

Do not make page headers excessively tall.

---

## 11. Buttons

### 11.1 Variants

Create a small standard set:

- Primary
- Secondary
- Ghost
- Danger
- Icon button

### 11.2 Primary button

Use for the main action on a screen.

Examples:

- New entity
- Create campaign
- Save
- Invite member
- Create session

Avoid multiple visually-primary buttons in the same region.

### 11.3 Ghost buttons

Use for low-priority inline actions:

- Edit
- More
- Copy link
- Close
- Expand

### 11.4 Destructive actions

Destructive controls must be visually distinct and should generally require confirmation where data loss is possible.

Examples:

- Delete campaign
- Delete entity
- Revoke session
- Remove member

---

## 12. Inputs and Forms

Inputs should be visually consistent across auth, campaign settings, entity editing, and account pages.

Standard fields should include:

- Label
- Input
- Optional hint
- Error message
- Required state where relevant

Example structure:

```text
Display name

[ Resend API Test                      ]

Used to identify you to campaign members.
```

### 12.1 Input behavior

Inputs need:

- Strong keyboard focus ring
- Hover state
- Disabled state
- Error state
- Placeholder styling
- Consistent height
- Proper label association

### 12.2 Form width

Do not stretch simple forms to the full viewport.

Account/auth forms should generally use a constrained width around 360–520px depending on context.

---

## 13. Tabs

Tabs are appropriate for sibling views of the same resource.

Examples:

Account:

- Profile
- Security
- Sessions

Entity:

- Overview
- Relationships
- Sessions
- History

Campaign Settings:

- General
- Members
- Permissions
- Import/Export, if this hierarchy is chosen

Active tabs should be obvious without relying solely on color.

---

## 14. Cards and Surfaces

Cards should represent meaningful grouped units.

Good card candidates:

- Dashboard widgets
- Campaign chooser entries
- Entity preview
- Session summary
- Account/security section
- Import/export job
- Thread attention item

Do not place every list row inside a large card.

### 14.1 Card rule

If content could be represented more efficiently as a row in a list/table, prefer the row.

---

## 15. Lists and Tables

Worldbinder will contain dense collections. Build excellent list/table primitives.

Use lists/tables for:

- Entities
- Members
- Sessions
- Search results
- Revisions
- Active sessions
- Attachments
- Import/export history

Rows may contain:

- Icon/avatar
- Primary label
- Secondary summary
- Metadata
- Status
- Last-updated time
- Contextual actions

Example:

```text
Character    Duke Renald        Noble · Valewyn       Updated 2h ago
Location     Blackwall          Frontier city         Updated 1d ago
Faction      House Renald       Noble house            Updated 3d ago
```

Rows should have clear hover and keyboard focus states.

---

## 16. Search

Search is a first-class Worldbinder workflow.

Search UI should feel fast and central.

Consider:

- Global keyboard shortcut
- Search command dialog
- Search field on World pages
- Filters by entity type/tag/status
- Highlighted matched text
- Recently viewed resources

A global command/search overlay may eventually resemble Linear, GitHub, or VS Code command palettes.

Do not require deep navigation to find known information.

---

## 17. Entity Design

Entity presentation is one of the strongest opportunities for Worldbinder to establish its own identity.

### 17.1 Entity type icons

Each entity type should have a consistent icon.

Suggested conceptual mapping:

- Character — user/person
- Location — map pin
- Faction — flag/shield
- Organization — building/users
- Item — package/artifact
- Deity — star/sun
- Creature — creature/paw/skull
- Event — calendar
- Quest — flag/route
- Lore — book
- Custom — configurable/general icon

Use an existing icon library rather than hand-drawing inconsistent icons.

### 17.2 Entity header

Suggested structure:

```text
[Portrait]

CHARACTER
Duke Renald                         Alive
Governor of Valewyn

[Noble] [House Renald] [Valewyn]

Overview | Relationships | Sessions | History
```

The header should communicate immediately:

- What the entity is
- What it is called
- Important status
- Major metadata
- Navigation to related views

### 17.3 Entity metadata

Do not show every metadata field with equal visual weight.

Important information appears near the top.

Secondary metadata can use structured definition lists or compact panels.

---

## 18. Wiki Links and Connected Knowledge

Wiki links are a defining Worldbinder interaction and should receive distinct styling.

Inline linked entities should use the accent color and a subtle hover treatment.

Example:

```text
Cedric traveled north toward [[Blackwall]] with [[Alrik Eirsen]].
```

Potential future enhancement:

Hovering an entity link may show a compact preview containing:

- Entity type
- Name
- Portrait/icon
- Summary
- Key metadata

Do not implement hover previews if they materially delay the primary visual-system pass, but the design system should leave room for them.

---

## 19. Relationships

Relationships should feel like structured knowledge, not database rows.

Relationship displays may use:

- Directional labels
- Entity icons
- Compact linked rows
- Optional graph visualization

Example:

```text
Duke Renald
  Governs → Valewyn
  Member of → House Renald
  Rival of → Lady Serana
```

Do not depend exclusively on graph visualizations. Lists remain easier to scan and more accessible.

---

## 20. Dashboard

The campaign dashboard should be one of Worldbinder's strongest visual screens.

It should answer:

- What is happening?
- What changed recently?
- What needs attention?
- What is coming next?
- Where should I continue working?

Potential sections:

### Campaign summary

- Campaign name
- Current in-world date
- Current status
- Member count

### Next session

- Session number/title
- Scheduled date
- Preparation status

### Active threads

- Count
- Major/critical threads
- Neglected threads

### Recently updated

- Entities
- Sessions
- Threads

### Needs attention

Examples:

- Dormant plot threads
- Planned session with incomplete prep
- Unresolved invitation
- Recently changed campaign content

### Recent activity

Show meaningful changes rather than raw technical audit data.

The dashboard should resemble an operational workspace, not a fantasy character sheet.

---

## 21. Sessions

Session views should prioritize preparation and recap workflows.

Useful sections:

- Session header
- Status
- Scheduled/played date
- Featured entities
- Locations
- Plot threads
- Prep content
- Recap content
- Revealed information

Completed sessions should feel archival.

Planned sessions should emphasize editable preparation.

---

## 22. Plot Threads

Thread status should be highly scannable.

GM-facing statuses:

- Foreshadowed
- Active
- Dormant
- Resolved
- Abandoned

Use badges with text and subtle semantic styling.

Do not rely on color alone.

Critical/major importance may receive additional emphasis.

Neglected threads should be surfaced through the dashboard and thread-list sorting/filtering rather than excessive warning decoration.

---

## 23. Maps

Maps are one area where visual campaign content should dominate the UI.

The application chrome around the map should remain minimal.

Controls may include:

- Map selector
- Layer selector
- Zoom controls
- Pin visibility
- Edit mode
- Add pin

Uploaded map art supplies the fantasy atmosphere.

Avoid decorative framing around maps unless it serves a functional purpose.

---

## 24. Timeline

The timeline should remain visually structured and readable.

Prioritize:

- Date
- Event title
- Summary
- Connected entities
- Visibility
- Filters

Avoid overly decorative timeline lines or animations.

The timeline is a data-retrieval interface first.

---

## 25. Authentication Screens

Current authentication pages should be redesigned from browser-default styling into a deliberate standalone auth layout.

Recommended desktop structure:

```text
              WORLDBINDER

        Welcome back

        Email
        [                    ]

        Password
        [                    ]

        [      Log in       ]

        Forgot password?

        New to Worldbinder?
        Create an account
```

Options:

- Centered auth card
- Split layout with restrained campaign artwork

For v1, a centered constrained panel is sufficient.

Keep auth screens clean and low-distraction.

---

## 26. Account Screens

Account pages should use the application design system even when outside a campaign.

Example:

```text
Account
Manage your personal account and security.

Profile | Security | Sessions

┌───────────────────────────────────────┐
│ Profile information                   │
│                                       │
│ Display name                          │
│ Resend API Test                       │
│                                       │
│ Email                                 │
│ user@example.com        Verified      │
└───────────────────────────────────────┘
```

Place logout in the account menu or a logical account-action area rather than as an isolated browser-style button above the page title.

---

## 27. Badges and Status Indicators

Use badges for compact categorical information.

Examples:

- Verified
- Active
- Archived
- GM only
- Campaign members
- Selected members
- Private
- Planned
- Completed
- Dormant
- Critical

Badges should be:

- Small
- Legible
- Semantically colored
- Consistent

Avoid excessive badges where plain text would be clearer.

---

## 28. Permission and Visibility UI

Visibility is a core Worldbinder concept and should be clearly represented.

Use a consistent visibility component for:

- GM only
- Campaign members
- Selected members
- Private to author

The UI must make hidden/private state obvious to editors without implying that unauthorized users receive hidden data.

Potential iconography:

- Lock
- Users
- Selected-user icon
- Private/person icon

Permission state should appear where content is edited and where visibility-sensitive content is summarized.

---

## 29. Empty States

Empty states should explain what belongs in the area and provide a relevant next action.

Bad:

```text
No data.
```

Better:

```text
No sessions yet

Sessions keep preparation, recaps, featured entities, and plot-thread
progress together.

[Create first session]
```

Do not use oversized illustrations for every empty state.

---

## 30. Loading States

Prefer skeletons where layout is predictable.

Use spinners only for short isolated actions or indeterminate processes.

Examples:

- Entity list → row skeletons
- Dashboard → section skeletons
- Save action → button progress
- Export/import → explicit progress/status state

Avoid full-screen blocking loaders for normal page navigation.

---

## 31. Error States

Errors should be:

- Specific
- Recoverable where possible
- Visually distinct
- Non-destructive

A standard error component should support:

- Title
- Explanation
- Retry
- Back/navigation option
- Optional support/reference information

Do not expose raw stack traces or API details in user-facing errors.

---

## 32. Toasts and Feedback

Use toasts for transient confirmation:

- Saved
- Copied
- Invitation sent
- Member removed
- Export started

Do not use toasts for information that the user must act on.

Errors requiring correction should appear near the relevant control or as persistent page-level alerts.

---

## 33. Dialogs

Dialogs should be used for:

- Confirmations
- Small focused forms
- Destructive actions
- Quick selection

Do not put complex multi-step workflows in small modals.

Large editing tasks should use full pages or dedicated panels.

---

## 34. Icons

Use one icon family consistently.

Good options include modern outline icon libraries such as:

- Lucide
- Heroicons
- Phosphor, if used consistently

Do not mix multiple icon visual languages.

Icon-only controls require:

- Accessible labels
- Tooltips where meaning is not obvious

---

## 35. Motion

Animation should be restrained.

Appropriate motion:

- Menu opening
- Dialog appearance
- Sidebar collapse
- Hover/focus transitions
- Small state changes

Typical duration:

```text
100–200ms
```

Avoid:

- Large page transition animations
- Decorative floating effects
- Constant pulsing
- Slow modal animations
- Motion that interferes with rapid navigation

Respect `prefers-reduced-motion`.

---

## 36. Light Mode

Light mode is not required to block v1 visual polish.

However, semantic tokens must be structured so light mode can be added later.

Components should consume names such as:

```css
--bg-app
--bg-surface
--bg-surface-raised
--text-primary
--text-secondary
--text-muted
--border-default
--accent
--danger
--success
```

rather than assumptions such as `--black-background`.

Do not hardcode dark-mode values inside feature components.

---

## 37. Component System

Worldbinder already has `packages/ui`. Use it as the home for reusable visual primitives where appropriate.

Build from actual application needs rather than creating an abstract design system in isolation.

Priority primitives:

1. Button
2. IconButton
3. Input
4. Textarea
5. Select
6. Checkbox
7. Radio
8. Label/FormField
9. Badge
10. Card/Surface
11. Tabs
12. Tooltip
13. Dropdown/Menu
14. Dialog
15. Alert
16. Toast
17. Avatar
18. Skeleton
19. EmptyState
20. ErrorState
21. PageHeader
22. Breadcrumbs
23. Data/list row
24. Table primitives
25. Sidebar navigation item

Only extract feature-specific components into `packages/ui` after they demonstrate real reuse.

---

## 38. Tailwind and Styling Rules

Continue using Tailwind CSS as defined by the project stack.

However:

- Centralize colors/tokens
- Avoid arbitrary-value sprawl
- Avoid copy-pasting giant utility strings where a shared component exists
- Do not create CSS classes that merely reproduce Tailwind without semantic value
- Use variants/utilities consistently
- Prefer composition to one enormous universal component

Feature-specific layouts may remain inside feature folders.

Global primitives belong in the shared UI package when genuinely reusable.

---

## 39. Design Implementation Order

Do not beautify individual pages independently before establishing the shared system.

Recommended implementation sequence:

### Phase 1 — Foundations

- Color tokens
- Typography
- Spacing scale
- Radius
- Borders
- Focus states
- Global background/text behavior

### Phase 2 — Core primitives

- Buttons
- Inputs
- Form fields
- Badges
- Cards/surfaces
- Tabs
- Menus
- Dialogs
- Toasts
- Skeletons
- Empty/error states

### Phase 3 — Application shell

- Desktop sidebar
- Top bar
- Campaign context
- Account menu
- Responsive navigation
- Main content container
- Page headers
- Breadcrumbs

### Phase 4 — Auth and account

Use these relatively small screens to validate the design system:

- Login
- Registration
- Forgot/reset password
- Email verification
- Profile
- Security
- Sessions

### Phase 5 — High-value campaign screens

- Campaign list
- Dashboard
- World/entity list
- Entity detail

### Phase 6 — Remaining feature screens

- Sessions
- Threads
- Maps
- Timeline
- Search
- Members
- Settings
- Import/export

### Phase 7 — Polish

- Loading states
- Empty states
- Error states
- Hover/focus behavior
- Responsive review
- Accessibility review
- Visual consistency pass

---

## 40. Do Not Redesign Product Architecture

This design work should not change Worldbinder's underlying product model.

Preserve:

- Existing route structure unless a genuine UX defect requires change
- Backend permission enforcement
- Current entity types
- Existing data model
- Existing campaign roles
- Existing visibility system
- Existing workflows
- Existing feature scope

This is a visual and interaction-system pass, not a product rewrite.

---

## 41. Page-by-Page Refactoring Rule

When refactoring an existing page:

1. Preserve behavior.
2. Preserve permission logic.
3. Preserve test hooks/semantics unless intentionally updated.
4. Replace browser-default styling with design-system primitives.
5. Improve information hierarchy.
6. Constrain widths where appropriate.
7. Use standard spacing.
8. Ensure loading/empty/error states match shared patterns.
9. Verify keyboard accessibility.
10. Verify the page still functions at realistic data density.

Do not combine visual refactors with unrelated business-logic changes unless required.

---

## 42. Visual Quality Bar

Before a page is considered visually complete, ask:

- Is the primary action obvious?
- Is the page title/hierarchy clear?
- Can the user scan the page quickly?
- Are related items visually grouped?
- Are controls styled consistently?
- Are interactive elements obviously interactive?
- Does the page work with large realistic data sets?
- Is the page usable with keyboard navigation?
- Are empty/loading/error states intentional?
- Does it look like the same application as every other Worldbinder page?
- Is fantasy flavor coming from the campaign content rather than decorative chrome?

If the answer to several of these is no, the page is not finished.

---

## 43. Reference Philosophy

When making design decisions, use the following hierarchy:

### Copy universal conventions

Prefer familiar patterns from mature applications for:

- Navigation
- Search
- Forms
- Tables
- Tabs
- Dialogs
- Account menus
- Settings
- Loading and error states

### Adapt patterns to Worldbinder

Customize where the domain benefits:

- Entity representation
- Wiki links
- Visibility
- Relationships
- Campaign dashboard
- Sessions
- Plot threads
- Maps
- Timeline

### Invent only where necessary

Do not create custom interaction patterns when a conventional solution already works.

---

## 44. Final Design Summary

Worldbinder's visual identity should be:

> **A modern dark knowledge workspace with violet accents, restrained surfaces, high information density, strong typography, conventional professional UI patterns, and subtle fantasy identity supplied primarily by campaign content.**

The product should feel polished enough to sit beside modern professional software while remaining recognizably built for tabletop campaign knowledge.

The interface should disappear when the user is working.

The world should be what stands out.

---

## 45. Implementation Status

This section is updated as each rollout phase actually ships, per the phase
order below — treat it as the honest record of what's real today, the same
way `CHANGELOG.md` is for the rest of the product.

### Phase 1 — Foundations (shipped)

**Stack decision:** this app stays on plain CSS custom properties, not
Tailwind, despite this document's Tailwind-flavored examples throughout —
that was an explicit product decision, not an oversight. Read every
`className="..."` code sample and `--bg-app`/`--accent`/etc. token name in
this document as **implementation-agnostic naming guidance**, not literal
Tailwind config or literal CSS variable names. The actual token names live
in `packages/ui/src/tokens.css` and use a `--wb-` prefix consistent with
this codebase's existing `.wb-*` class convention (e.g. `--wb-bg-app`, not
`--bg-app`; `--wb-danger`, not `--danger`).

**What shipped:**

- A full token set in `packages/ui/src/tokens.css`, imported once at the
  app root (`apps/web/src/main.tsx`) ahead of all other CSS: neutral
  surface hierarchy (`bg-app`/`bg-surface`/`bg-surface-raised`/
  `bg-surface-hover` + `field-bg`), a 3-tier border scale (`subtle`/
  `default`/`strong`), a 4-tier text scale (`primary`/`secondary`/`muted`/
  `disabled`), accent (`accent`/`accent-hover`/`accent-active`/
  `accent-fg`), semantic colors (`success`/`warning`/`danger`/`info` —
  `info` is net-new, this app had no info color before), an 8-step type
  scale, a 10-step spacing scale, a 4-step radius scale, a 3-step shadow
  scale, and a 4-step z-index scale. Both light and dark variants exist
  (`:root` default + `@media (prefers-color-scheme: dark)` override,
  matching the pre-existing pattern — no manual theme toggle yet).
- **Every color value was contrast-verified against WCAG AA before use**,
  not copied from §4's suggested hex values as-is. Two concrete
  deviations, both because the doc's own suggestions fell short in
  practice: dark-mode `border-default` was lightened from the doc's
  `#323640` (~1.6:1 against `bg-app`, well under the 3:1 WCAG 1.4.11
  non-text-contrast floor) to `#70747f` (~3.2–4.1:1 against both `bg-app`
  and `bg-surface-raised`); dark-mode accent uses a lighter purple with
  dark text (`#c084fc` / `#16171d`, ~6.8:1) rather than the doc's
  dark-purple-with-white-text pairing (`#a855f7` + white only verifies to
  ~4.0:1, short of the 4.5:1 a button label needs). Full rationale is
  inline as comments in `tokens.css`.
- Muted background/border variants for accent and each semantic color
  (§4.3) are derived with `color-mix(in srgb, var(--wb-accent) 12%,
transparent)` at the point of use rather than stored as ~16 additional
  hardcoded tokens — this was already this codebase's convention before
  Phase 1 (see the pre-existing `wb-form-message--error` rule) and
  auto-adapts correctly for both themes from one base color per token.
- The confirmed "everything pushed to the far left" bug is fixed:
  `.app-shell__main` was missing `margin-inline: auto` entirely.
- All 11 existing `packages/ui` primitives (Button, TextField, Textarea,
  Select, Combobox, TagInput, FileDropzone, FormMessage, LoadingState,
  ErrorState, EmptyState) now consume tokens instead of hardcoded
  rem/hex/rgba values, and each has its own colocated CSS file
  (`Button.tsx` imports `./Button.css`, etc.) instead of living in the
  web app's `global.css` — a real component library shape, not just a
  className contract. Six of them (TextField, Textarea, Select, Combobox,
  TagInput, FileDropzone) share `Field.css` for the common
  `.wb-field`/`.wb-field__label`/`.wb-field__input`/`.wb-field__error`
  shape; Vite dedupes the repeated import so it's only loaded once.
- Found and fixed a real, pre-existing styling gap while doing this:
  `.wb-tag-input`/`.wb-tag-input__chip`/`.wb-tag-input__remove`/
  `.wb-tag-input__field` had **no CSS rules anywhere** — `TagInput` and
  `EntityDetailPage`'s read-only tag chips were rendering with bare
  browser default list/button styling. `TagInput.css` now defines them.
- `apps/web/src/styles/global.css` (770 lines pre-Phase-1) is trimmed to
  reset rules, the app shell, and genuinely cross-feature shared utility
  classes only. "Cross-feature" was verified by grep before moving
  anything, not assumed from a class's name — `.wb-session-list`, for
  example, sounds sessions-specific but actually backs card-style list
  rows in attachments, threads, timeline, maps, exports, and audit too,
  so it stayed a shared utility rather than moving into the sessions
  feature. Genuinely single-owner styling moved to a colocated file next
  to its feature: `features/maps/maps.css`, `features/search/search.css`,
  `features/entities/entities.css`, `features/attachments/attachments.css`.
- Added `lucide-react` as a dependency (no usage yet — available for
  Phase 2).

**Verification:** `tsc --noEmit` clean for both `@worldbinder/ui` and
`@worldbinder/web`; `eslint` clean; `vite build` clean; the four existing
unit suites this refactor could plausibly break
(`Combobox.test.tsx`, `TagInput.test.tsx`, `MapPinMarker.test.tsx`,
`App.test.tsx`) all pass; the dev server was started and every new CSS
file confirmed to resolve and serve without error. No automated browser
tool was available in that session to capture a real rendered screenshot —
a human visual pass (`pnpm dev`, check login/world-list/entity-detail)
is still outstanding before calling Phase 1 fully done.

### Phase 2 — Core primitives (shipped, scoped down from §39's full list)

§39 lists ~19 net-new primitives for this phase. Per the doc's own §37 rule
("built from real application need, not speculatively"), this phase built
only the ones with a confirmed real call site in the actual codebase —
found by grepping for `window.confirm`, raw `<input type="checkbox">`,
`<h1>`, native `title=` tooltips, `<table>`, and `role="tablist"` before
writing anything. Six primitives had real, immediate call sites:

- **Dialog** — extracted from `SearchOverlay.tsx`'s hand-rolled portal/
  focus-trap/backdrop-dismiss logic (that component now renders through
  Dialog instead of owning its own copy). Generic modal mechanics only —
  visual skin (background/border/radius/shadow) lives on `.wb-dialog__panel`
  so every dialog shares one look; a dialog variant overriding dimensions
  (like search's wider/shorter panel) uses a compound selector
  (`.wb-dialog__panel.wb-search-overlay__panel`) rather than relying on CSS
  import order to win the cascade.
- **ConfirmDialog** — built on Dialog + Button. Replaces every one of this
  codebase's 10 real `window.confirm()` call sites (`SessionDetailPage`,
  `TimelineEventDetailPage`, `ThreadDetailPage`, `EntityDetailPage`,
  `CampaignSettingsPage`, `MapDetailPage` ×3, `AttachmentsPanel`,
  `RevisionHistoryPanel`) with a real, keyboard-accessible, screen-reader-
  friendly dialog instead of a blocking native browser prompt.
- **IconButton** — real need was Dialog's own close button (icon-only,
  needs an accessible name via `label`/`aria-label`).
- **Checkbox** — retrofits the 4 real raw `<input type="checkbox">` usages
  (`MapLayerToggles` ×2, `SearchResultsPage`'s type filters,
  `StructuredDateEditor`'s "approximate" toggle, `SessionFormPage`'s
  participant list). Themed via `accent-color` on the native control rather
  than a hand-rolled SVG replacement — keeps native keyboard/screen-reader
  behavior for free, per §43's "copy universal conventions" guidance.
- **Badge** — replaces plain `" · GM only"` text with a real visual
  indicator (tone="warning") across every real visibility-flag call site:
  `EntityDetailPage`, `SessionDetailPage`, `TimelineEventDetailPage`,
  `ThreadDetailPage` (also used for its "Neglected" flag),
  `MapLayerToggles`, and `MapDetailPage`'s layer manager.
- **PageHeader** — while wiring Badge into the four detail pages, found
  that `.wb-entity-header`/`.wb-entity-header__meta` (title + meta row) had
  **zero CSS rules anywhere** despite being used across 10 files — a
  second latent styling gap, on top of Phase 1's `.wb-tag-input` find.
  Built PageHeader and migrated the four pages using the full title+meta
  shape (`EntityDetailPage`, `SessionDetailPage`, `TimelineEventDetailPage`,
  `ThreadDetailPage`); the remaining 6 usages of the bare
  `.wb-entity-header__actions`/`__tags` action-row classes (which turned
  out to be genuinely generic, reused well beyond page titles — confirmed
  by grep, same discipline as Phase 1's CSS split) got real shared CSS in
  `global.css` instead of a full PageHeader migration, since their shape
  (inline action rows inside panels, not page titles) doesn't fit
  PageHeader. Full page-by-page PageHeader rollout for every other page is
  Phase 4-6 work, not this phase's.
- Also added: a `danger` Button variant (needed by ConfirmDialog's
  destructive confirm action). Its text color reuses `--wb-bg-app` rather
  than a new `--wb-danger-fg` token — that token is near-white in light
  mode and near-black in dark mode, which happens to be exactly the
  light/dark swap `--wb-danger`'s own background needs for 4.5:1 text
  contrast in both themes (verified ~6.5:1 light, ~6.9:1 dark).

**Deliberately deferred** (no confirmed real call site found this pass):
Card/Surface, Tabs, Tooltip, Dropdown/Menu, Toast, Avatar, Skeleton,
Breadcrumbs, table primitives, sidebar nav item. Several of these have an
obvious future trigger — Dropdown/Menu and sidebar nav item when Phase 3
builds the real sidebar+topbar shell, Breadcrumbs alongside the wider
PageHeader rollout in Phases 4-6 — rather than being built ahead of that
need.

**Verification:** same bar as Phase 1 — `tsc --noEmit` clean for both
`@worldbinder/ui` and `@worldbinder/web`, `eslint` clean, `vite build`
clean, full existing unit suite green (still just the 4 pre-existing
files — none of this phase's real-logic changes across 10+ page files
have dedicated test coverage, so correctness there rests on manual review
plus the dev-server smoke check, not an automated safety net). No browser
tool was available to capture a real rendered screenshot this session
either — a human visual pass covering at least one delete confirmation,
the search overlay, and a couple of the migrated detail pages is still
outstanding.

### Phases 3–7 — not started

See this document's own phase structure (§39) for scope; the rollout plan
tracks these as separate checkpoints, each getting the same real-browser
verification before being called done.
