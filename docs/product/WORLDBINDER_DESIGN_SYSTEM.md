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

### Phase 3 — App shell (shipped, scoped down from the original plan)

The original rollout plan described this phase as "replace `App.tsx`'s
flat header with the doc's sidebar+topbar structure; fold
`CampaignLayout.tsx`'s current horizontal nav into the new sidebar." On
inspection that's not quite right: §9's sidebar content (Dashboard/World/
Sessions/Threads/Maps/Search + Members/Settings/Import-Export) is entirely
campaign-scoped — none of it applies to `App.tsx`'s non-campaign routes
(login, account, status, help, the campaigns list). So the real sidebar+
topbar rebuild landed in `CampaignLayout.tsx` only, which is the actual
owner of that nav; `App.tsx`'s lightweight top-level header (already
token-driven since Phase 1) is unchanged — there's nothing campaign-scoped
to put in a sidebar there.

**What shipped**, all in `CampaignLayout.tsx`/`.css` (+ a small
`CampaignSwitcher.css`):

- A real fixed sidebar: primary nav (Dashboard/World/Sessions/Threads/
  Maps/Search) and secondary nav (Members/Settings/Import-Export),
  icons via `lucide-react` (first real usage — added inert in Phase 1),
  the "All campaigns" back link and campaign switcher at the top.
- **Active-route highlighting** — confirmed via grep that no `.active`
  CSS existed anywhere before this (react-router's `NavLink` needs the
  function form of `className` to expose `isActive`; the old code passed
  a bare string, so it never could have worked), despite the design doc
  explicitly requiring it (§9.2). Real gap, now fixed.
- A topbar: campaign name (truncates with an ellipsis for long names),
  search (opens the same Ctrl/Cmd+K overlay), help, and account —
  the last two are direct icon-links, not a dropdown menu, since
  Dropdown/Menu has no other real caller yet either (still correctly
  deferred from Phase 2).
- Responsive collapse at 768px (Milestone 13's own established tablet
  floor): sidebar becomes a horizontal wrapped nav row above the
  content instead of a fixed column, matching the wrap-based pattern
  `global.css`'s `.wb-links` already used elsewhere, rather than adding
  a drawer/toggle-button that nothing else in the app has precedent for.
- `AuditPage` was **not** added to the sidebar nav — checked its own
  code comment first, which explicitly documents it as reachable only
  via a link from Settings, not the fixed primary/secondary nav. The
  rollout plan's "wire up AuditPage's missing nav entry" line was based
  on stale notes from before that comment (and the Settings link) were
  read directly; corrected here rather than carried forward.

**A real browser check this time** (Playwright driving headless
Chromium — no `chromium-cli` in this sandbox, so a small throwaway
script under `apps/web/`, deleted after use, launched the full stack
via `pnpm dev`, logged in as the seeded demo user, and screenshotted the
sidebar, active-link state, a form page, and the search overlay). It
caught a real, pre-existing bug the previous two phases' build/lint/test
checks couldn't have: `.wb-button` and `.wb-icon-button` never reset
`text-decoration`, so every `<Link>` styled as a button (this app's own
established pattern for "Edit"/"New entity"-type actions, used well
before this rollout) rendered underlined. Fixed in both files. Also
spotted, but deliberately left alone as out of this phase's scope: a
missing space between a campaign name and its `owner · draft` meta text
on `CampaignsListPage` — unrelated content-page styling, Phase 6's job.

### Phase 4 — Auth and account pages (shipped)

Covered the plan's full checklist: `LoginPage`, `RegisterPage`,
`ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`,
`AcceptInvitationPage`, `ProfilePage`, `SecurityPage`, `SessionsPage`. Most
of these pages turned out to already be in reasonable shape structurally
(consistent form/`FormMessage`/`Button` usage from Phase 1's token pass) —
the real work this phase found was two **foundational, app-wide** gaps
these link/heading-heavy pages happened to expose clearly, not something
scoped to just these nine files:

- **No global heading typography anywhere.** `h1`/`h2`/`h3` had zero CSS
  rules in the whole app — every bare heading on every page (not just
  these nine) was rendering with raw browser UA-stylesheet defaults
  instead of the type scale. Added global `h1`/`h2`/`h3`/`p` rules to
  `global.css`; a class selector (`.wb-page-header__title`, etc.) still
  wins on specificity, so already-componentized headings are unaffected.
- **No global link color, despite the design doc mandating one (§4.2:
  "Use the accent for: ... Links").** Every plain `<a>`/`<Link>` in the
  app — and these auth pages are almost entirely links and form
  labels — was rendering the browser's default link blue. Added a global
  `a { color: var(--wb-accent) }` (plus hover/focus-visible). Anything
  with its own anchor color (search results, sidebar links, buttons
  styled as links, entity mentions) already overrides this via class
  specificity, confirmed case-by-case before landing it, not assumed.

Page-specific fixes, once those two landed:

- **`AccountLayout`'s Profile/Security/Sessions tab nav had the exact
  same missing-active-state bug Phase 3 already found and fixed for
  `CampaignLayout`'s sidebar** — plain `<NavLink>` usage without the
  function-form `className`, so `isActive` was never exposed. Fixed the
  same way. Also had to give the tab nav an explicit inactive color
  (`--wb-text-secondary`) scoped to `.wb-account-layout__bar`, since the
  new global link-accent default would otherwise make active and
  inactive tabs the same color — caught by actually looking at the
  screenshot, not assumed from the CSS alone.
- **`AcceptInvitationPage`'s loading state was a raw `<p>Loading
invitation…</p>`** instead of the `LoadingState` primitive every other
  loading page in the app already uses; its error branch also had no
  heading, unlike every other page's error state. Fixed both.

**Verification:** typecheck/lint/build/unit-tests clean, and — real
browser check this time via Playwright against local dev, not just
production. Hit a genuine Playwright/Vite-dev gotcha along the way:
`waitUntil: 'networkidle'` never resolves against Vite's dev server,
because its HMR WebSocket keeps the connection permanently "active" —
switched to `waitUntil: 'load'` plus explicit element waits instead, the
same fix this project's own `run` skill documentation already calls out
as the standard workaround.

### Phase 5 — High-value campaign screens (shipped)

Covered the plan's checklist: `CampaignsListPage`, `CampaignOverviewPage`,
`WorldListPage`, `EntityDetailPage` (already done in Phase 2),
`EntityFormPage`. Same story as Phase 4 — three of these five pages turned
out to be **completely unstyled**, not just inconsistent:

- `.wb-campaign-list`/`.wb-campaign-list__meta` (`CampaignsListPage`),
  `.wb-world-filters`/`.wb-entity-list`/`.wb-entity-list__meta`
  (`WorldListPage`), and **`.wb-world-header` — used by 10 pages across 8
  features** (maps, search, plot-threads, timeline, sessions, entities,
  imports, exports, audit) — all had zero CSS rules anywhere. This is the
  same shape of gap Phases 1-4 kept finding (`.wb-tag-input`,
  `.wb-entity-header`, `.wb-campaign-header`), just at a larger scale: a
  cross-feature utility used by a third of the app's list pages, never
  styled once.
  - Gave `.wb-campaign-list`/`.wb-entity-list` the same card-row treatment
    as the already-styled `.wb-session-list` (flex row, `space-between`,
    border, radius) — this is also the real fix for the "missing space"
    bug flagged back in Phase 3's live testing: it wasn't a missing
    space, it was zero layout on the row at all, so the name and its
    `role · status`/type/tag meta just sat glued together inline.
  - `.wb-world-header` got the shared-utility treatment (like
    `.wb-entity-header__actions` in Phase 2) for the 9 pages outside this
    phase's scope. `WorldListPage` itself — the one page in this phase
    that actually has this shape — migrated fully to `PageHeader`
    instead, since its two-link action group needed real internal gap
    handling a single shared class couldn't give it without becoming
    PageHeader's own logic reimplemented a second time.
- `CampaignOverviewPage`'s `<dl className="wb-campaign-overview">` was
  also unstyled; rather than write a third near-duplicate of
  `.status-panel`'s key-value layout (already used by `ProfilePage`),
  switched its className to reuse `.status-panel` directly.
- `EntityFormPage`'s edit-mode loading/error states were the raw
  `<p>Loading…</p>` this document already flagged as a normalization
  target back in Phase 1's research — fixed to `LoadingState`/`ErrorState`
  like every other page.
- Added `Badge` to `WorldListPage`'s per-row "GM only" indicator, the same
  treatment every other visibility flag in the app got in Phase 2.

**A real bug found live-testing, unrelated to CSS**: `CampaignOverviewPage`
rendered `campaign.systemName ?? '—'`, but the create-campaign form
submits an empty string for a left-blank optional field (its Zod schema
has no `.nullable()` or empty-to-`undefined` transform) — `??` doesn't
catch `''`, so the "System" row rendered with no visible value at all,
looking like a layout bug until traced to its actual cause. Fixed the
display-layer symptom (`||` instead of `??`); the schema-level question of
whether an empty string should even be storable is a separate, bigger
conversation than this phase's scope.

### Phase 6 — Remaining feature screens (shipped)

Covered the plan's full checklist: Session/Thread/Map/Timeline
list+detail+form (12 pages), `SearchResultsPage`, `MembersPage`,
`CampaignSettingsPage`, `ImportCampaignPage`, `ExportsPage`, `HelpPage` —
plus the required decision on `StatusPage`/`AuditPage`, both outside the
design doc's own page list: **no special treatment** — they already reuse
the same tokenized primitives (`status-panel`, `wb-world-header`,
`wb-session-list`, `wb-pagination`) every other page does, so they just
get the same consistency pass as anything else, not a bespoke pattern.

By far the biggest finding this phase, found by grepping across the whole
app rather than page-by-page: **the exact `<p>Loading…</p>` bug flagged
back in Phase 1 and fixed on `EntityDetailPage`/`EntityFormPage` in
Phases 2 and 5 was never actually fixed anywhere else** —
`SessionDetailPage`, `ThreadDetailPage`, `MapDetailPage`,
`TimelineEventDetailPage`, and all four of their `*FormPage` counterparts
(8 files) still had it, for both their loading state (raw `<p>`, no
spinner) and their error state (bare `FormMessage`, no retry button). All
8 fixed to `LoadingState`/`ErrorState` in this pass, closing out a gap
that had actually spanned every phase of this rollout so far.

Also fixed, once found:

- `.wb-member-list`/`.wb-invitation-list` (`MembersPage`) — zero CSS
  anywhere, same pattern as every other list class this rollout has
  found; new `features/membership/membership.css`.
- Five more `" · GM only"` plain-text visibility flags upgraded to
  `Badge` (`SessionListPage`, `ThreadListPage`, `MapListPage`,
  `TimelineListPage`, plus `WorldListPage`'s in Phase 5) — every list page
  showing this flag now shows it the same way.
- `MapFormPage` and `CampaignSettingsPage` each independently hand-rolled
  the identical inline `style={{maxWidth, borderRadius, display,
marginBottom}}` object for their uploaded-image preview. New shared
  `.wb-image-preview` utility (`global.css`) replaces both.
- `ImportCampaignPage`'s confirm-import action was a raw `<button
className="wb-button wb-button--primary">` instead of the `Button`
  component; found while touching the file, fixed along with the same
  pattern in `SearchResultsPage`'s and `AuditPage`'s pagination controls.
- Assorted raw `<p>` transient-status text (`Uploading…`,
  `Validating archive…`, `Importing…`, `Searching…`, `Uploading and
processing…`) upgraded to `LoadingState` for the same reason every
  other loading state in the app uses it — a consistent, recognizable
  "something is happening" affordance instead of plain text that looks
  identical to static content.

**Verification:** typecheck/lint/build/tests clean (two unused-import
lint errors from the `ErrorState` swap-in, fixed immediately); a real
Playwright pass against local dev covering all of Sessions/Threads/Maps/
Timeline/Members/Settings/Import-Export/Audit/Search/Help for a logged-in
GM, no console errors, no visual regressions.

### Phase 7 — Polish (shipped)

Loading/empty/error consistency was already closed out as a side effect
of Phases 1–6's find-as-you-go fixes, so this phase's real scope was the
three items that needed a dedicated pass: hover/focus review, a
responsive review at 768px, and a real automated accessibility re-check
(Milestone 13's original audit predates this entire visual layer).

**Hover/focus-visible audit** — grepped every interactive element in
`packages/ui` and `apps/web` against existing `:focus-visible` rules.
Four real gaps found and fixed, all genuine keyboard-navigation misses
rather than cosmetic:

- `TagInput`'s chip remove `<button>` — no focus style at all.
- `CampaignSwitcher`'s `<select>` — relied on the browser's inconsistent
  default ring instead of the app's accent outline.
- `EntityMultiPicker`'s chip remove buttons — same gap as `TagInput`.
- `AccessiblePinList`'s pin-activation buttons — the accessibility-critical
  keyboard equivalent of clicking a map pin had no visible focus
  indicator, the one case in this list where the fix isn't optional
  polish.

**Automated accessibility scan** — no `@axe-core/playwright` dependency
existed, but `axe-core` was already present transitively; injected the
raw `axe.min.js` bundle into real pages via Playwright
(`page.addScriptTag` + `page.evaluate(() => axe.run(...))`, filtered to
`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`) rather than adding a new
package for a one-off. Covered 14 page/state combinations (every primary
nav destination, an entity detail page, a `ConfirmDialog` open, and the
search overlay in both its empty and populated-results states). Found
and fixed:

- `RichTextEditor`'s TipTap contenteditable div had no accessible name
  (`aria-input-field-name`); fixing it needed both `role="textbox"` and
  `aria-labelledby` together — the label alone was flagged as
  `aria-prohibited-attr` since a bare `<div>`'s implicit role doesn't
  permit `aria-labelledby` at all.
- `SearchOverlay`'s results `<ul>` conditionally carries `role="listbox"`
  (WAI-ARIA requires a listbox to have at least one `role="option"`
  child, which an empty query can't provide) — getting this right took
  three iterations, since the status `<li>`s' own role override has to
  track the exact same condition as the parent's, not be hardcoded to
  one state.
- `FileDropzone` was a `role="button"` div wrapping a hidden,
  `aria-hidden`, keyboard-inert `<input type="file">` — flagged as both
  `nested-interactive` and a missing accessible name. Rewritten on the
  native `<label>`-wraps-`<input>` HTML pattern, which needed no custom
  keyboard handling at all (removed `useRef`, `openPicker()`,
  `handleKeyDown()`, and every custom ARIA attribute it had accumulated).
- Two `TextField` instances (`CalendarMonthsEditor`'s era-label field,
  `TimelineListPage`'s tag filter) were manually-controlled without
  `id` or `name`, silently producing `htmlFor={undefined}` via the
  primitive's `id ?? name` fallback. Fixed both, then grepped all
  ~35+ `TextField`/`Textarea`/`Select` call sites app-wide to confirm no
  other instance of the same bug class remained.

Final scan: **0 violations across all 14 page/state combinations.**

**Responsive review (768px)** — screenshotted all 8 primary campaign
pages plus the search overlay and a `ConfirmDialog` at 768px viewport
width, checking `document.documentElement.scrollWidth` against the
viewport for horizontal overflow at each. None found — the sidebar's
existing collapse-to-horizontal-nav breakpoint (already built in Phase 3) held up cleanly with no new CSS needed.

**Verification:** typecheck/lint/build clean; full unit suite green
(146 tests across api/web/worker/config).

## 46. UI/UX Rework

The 7-phase rollout above (§45) shipped a consistent token/primitive system
but, per direct user feedback after using the live result, left two real
problems unaddressed: the app felt "too narrow on a large screen" and
"isn't dynamic." Both had a single, concrete root cause each (see Phase 1
below) rather than being diffuse polish issues — this is a separate,
7-phase rework, tracked here as its own section since §45's rollout is
already closed out as complete.

### Phase 1 — Foundation: root-cause width fix, tokens, CardGrid (shipped)

- **Root cause of "too narrow on a large screen," found and fixed**:
  `apps/web/src/app/App.tsx` is the one root layout for every route, and
  `global.css`'s `.app-shell__main { max-width: 640px }` — sized for
  narrow auth forms — wrapped the entire campaign section too (sidebar,
  topbar, dashboard, entity pages), confirmed via 1920px screenshots to
  leave roughly two-thirds of the viewport empty on every campaign page.
  Fixed by conditionally rendering: `App.tsx` now checks
  `location.pathname.startsWith('/app/campaign/')` (the singular
  campaign-workspace prefix, distinct from the plural `/app/campaigns`
  list route — no collision) and, when true, skips the outer
  `<header>` entirely (`CampaignLayout` already duplicates all of it —
  back-link, Help, Account — in its own sidebar/topbar) and swaps in a
  new `.app-shell__main--full` class instead of the default narrow one.
  Auth/account/status/help/campaigns-list routes are untouched and stay
  narrow, exactly as before.
- **A real sizing bug caught before it shipped**: the first version of
  `.app-shell__main--full` also set `display: flex`, intended to make
  `<main>` stretch to fill the shell's height. This would have broken
  `.wb-campaign-layout` (CampaignLayout's root, which has no `width`/
  `flex` of its own) — turning it from a block element that naturally
  fills 100% of its parent's width into a flex item sized to its own
  content instead. Caught by reasoning through CSS flex-item sizing
  before testing, not after; removed `display: flex` since
  `.wb-campaign-layout`'s own `min-height: 100svh` already handles
  full-height sidebar borders without it.
- `CampaignLayout.css`'s inner content cap raised from a hardcoded
  `1100px` to a new `--wb-container-workspace` token (1800px) — not
  edge-to-edge, since several campaign pages (Members/Settings/Search/
  Import-Export/Audit/Maps-list) are still simple single-column forms
  that would look broken fully stretched on a 4K/ultrawide display; the
  pages getting real wide-screen treatment (Phases 4–5) define their own
  responsive grid inside this ceiling.
- New width/breakpoint constants and motion-duration tokens added to
  `packages/ui/src/tokens.css` (the app had zero of either before this —
  every width in the app was a hardcoded magic number). Width/breakpoint
  tokens are documentation-only (CSS custom properties can't appear
  inside `@media` feature values); every consuming `@media` rule still
  hard-codes its pixel number with a comment naming the constant.
- New `CardGrid` primitive (`packages/ui/src/CardGrid.tsx`) — a
  `repeat(auto-fill, minmax(...))` responsive grid, the one new layout
  primitive this rework needs (justified by 2 real consumers from day
  one: WorldListPage's entity grid and the dashboard's widget grid,
  Phases 4–5). No `Card`/rail-split primitive was added — each of those
  has only one real consumer and belongs as page-local CSS, matching
  `packages/ui`'s existing "built up only as real screens need them"
  philosophy.

**Verification:** typecheck/lint/build/vitest clean. Real Playwright
checks at 700/1024/1920/2560px confirmed: the campaign workspace's
`app-shell__main` now spans the full viewport at every width (was
hard-capped at 640px before); the campaign content itself scales up to
the new 1800px ceiling; the outer header is correctly absent throughout
the campaign section; `/account/profile` (outside the campaign workspace)
stays narrow and centered at 640px at every viewport width, confirming
the narrow-page behavior is untouched; the existing 768px sidebar-collapse
breakpoint still works correctly.

### Phase 2 — Motion pass (shipped)

Implements §35's motion guidance literally — of 26 CSS files in the app,
exactly one (`LoadingState.css`, the spinner) had any `transition`/
`animation` before this phase; every hover/focus/active state elsewhere
snapped instantly. Scoped to what §35 actually asks for: "Dialog
appearance" (entrance only, not exit — `Dialog.tsx` already unmounts
synchronously on close via `if (!open) return null`, so a CSS-only mount
animation is sufficient and needed no component changes), hover/focus
transitions, and smoothing the existing 768px sidebar reflow (no new
collapse _feature_ — none exists today, building one would be a UX
feature decision out of scope for a motion pass).

- `.wb-button`/`.wb-icon-button` (`packages/ui/src/Button.css`/
  `IconButton.css`): `transition` on background-color/border-color/color
  at `--wb-motion-duration-fast` (120ms).
- `.wb-sidebar__link` (`CampaignLayout.css`): same transition;
  `.wb-sidebar` itself gets `transition: width` at
  `--wb-motion-duration-base` (180ms), so a live resize across 768px now
  animates the sidebar's width change instead of snapping.
- `Dialog.css`: `@keyframes` mount animation on `.wb-dialog__backdrop`
  (opacity fade) and `.wb-dialog__panel` (opacity + `translateY(-8px)
scale(0.98)` → resting), both gated behind
  `@media (prefers-reduced-motion: reduce)` individually, following
  `LoadingState.css`'s existing precedent.
- Card-row hover states added to `.wb-entity-list li`/`.wb-session-list
li`/`.wb-campaign-list li` (`entities.css`/`global.css`/
  `campaigns.css`) — none had a `:hover` state at all before this; border/
  background shift + transition. This is the base Phase 4's entity card
  grid restyle builds on.
- `global.css` gained a blanket
  `@media (prefers-reduced-motion: reduce) { * { transition-duration:
0.01ms !important; ... } }` as defense-in-depth on top of the
  per-component gating above — protects any transition a later phase adds
  and forgets to gate individually.

**Verification:** typecheck/lint/build/vitest clean. Real Playwright
checks: confirmed the sidebar link's computed `transition-duration` is
actually `0.12s` (not just present in the CSS source); confirmed the
dialog panel's computed `animation-name` is `wb-dialog-panel-in` under
normal motion and `none` under `page.emulateMedia({ reducedMotion:
'reduce' })` — the per-component gating actually takes effect at runtime,
not just in the stylesheet; a screenshot taken immediately on dialog-open
caught it mid-fade, confirming the animation genuinely runs rather than
being a dead CSS rule.

### Phase 3 — Entity type icons (shipped)

Implements §17.1's conceptual icon mapping, verified 1:1 against
`entityTypeEnum`'s 11 real values. `lucide-react` was already a
dependency (added Phase 1, used only in `CampaignLayout.tsx`'s sidebar
nav before this) — confirmed all 11 needed icon names
(`User`/`MapPin`/`Flag`/`Building2`/`Package`/`Star`/`PawPrint`/
`CalendarDays`/`Route`/`BookOpen`/`Shapes`) exist in the installed
version before writing the mapping.

- New `apps/web/src/features/entities/lib/entityTypeIcons.tsx`:
  `ENTITY_TYPE_ICONS` map + an `<EntityTypeIcon type size?/>` wrapper.
  `faction` and `quest` both offered "flag" as one of two suggested icon
  options in §17.1 — assigned to faction, quest gets its other suggested
  option (route) so no two entity types share an icon.
- Wired into `EntityDetailPage.tsx`'s `PageHeader` title (no `PageHeader`
  change needed — `title: ReactNode` already accepts arbitrary nodes).
- Dashboard "Recent Activity" needed one small backend addition first:
  `CampaignActivityItem` (`packages/contracts`) gained an optional
  `entityType?: EntityType`, populated by a one-line addition to
  `CampaignsService`'s existing `recentEntities` mapping (that query
  already selected the full entity row, so no new query was needed).
  Session/plot-thread activity rows reuse the same `CalendarDays`/
  `GitBranch` icons `CampaignLayout.tsx`'s sidebar nav already uses, for
  visual consistency.
- WorldListPage's type-filter `<Select>` stays plain text, unchanged —
  native `<option>` elements can't render an icon in any browser; the
  WorldListPage entity cards themselves get their icon in Phase 4
  alongside the card-grid rework.

**Verification:** typecheck/lint/build clean across all affected
packages (`@worldbinder/contracts`/`@worldbinder/api`/
`@worldbinder/web`, confirming the new optional contract field doesn't
break API compilation); full web vitest suite (11/11) and full API jest
suite (96/96) green. Real browser: confirmed via screenshot that the
dashboard's Recent Activity rows show the correct icon per type
(character entity → person icon, session → calendar icon, plot thread →
branch icon) and the entity detail page header shows the same icon
beside the entity name.

### Phase 4 — World list → responsive card grid (shipped)

Per the user's confirmed direction (card grid, not an enhanced list),
`WorldListPage`'s single-column `.wb-entity-list` row layout is replaced
by the new `CardGrid` primitive (Phase 1) — entity cards (icon, name,
2-line-clamped summary, type, visibility badge, tags) that wrap to more
columns as the viewport widens, instead of one entity per row regardless
of screen size.

- Two new filters added alongside the existing Search/Type/Tag: a
  visibility filter (All/Public/GM only) and a sort option (Recently
  updated/Name A–Z). `packages/validation`'s `listEntitiesQuerySchema`
  gained matching `visibility`/`sortBy` fields; `EntitiesService.list()`
  gained an `and`-ed visibility condition (narrows on top of, doesn't
  replace, the existing role-based public-only condition for non-GM
  members) and branches its `orderBy` between `asc(entities.name)` and
  the existing `desc(entities.updatedAt)` default.
- `.wb-entity-list`/`.wb-entity-list li`/`.wb-entity-list__meta` removed
  from `entities.css` (grepped first to confirm no other real usage, only
  a stale comment reference elsewhere) — replaced by `.wb-entity-card`
  and its `__header`/`__name`/`__summary`/`__meta`/`__tags` sub-classes.

**Verification:** typecheck/lint/build clean; full web vitest (11/11) and
API jest (96/96) green. New integration test (`entities.e2e-spec.ts`)
covering both new filters — confirmed against real Postgres, full suite
re-run clean at 191/191 (190 + 1 new). Real browser, seeded with 11 test
entities spanning every entity type to actually exercise grid wrapping
(the existing test campaign only had 1 entity): confirmed 5 columns at
1920px, 2 at 1024px and 700px, correct icon per card, and that both new
filters actually change the rendered results (not just render correctly)
— sort-by-name produced a genuinely alphabetical list, filtering by
entity type correctly narrowed to just that type. Test entities deleted
after verification.

### Phase 5 — Entity detail + dashboard → two-column/rail rework (shipped)

The largest phase. Needed one new backend lookup that didn't exist
before: entity → plot threads (the relation only existed thread →
entities via `plotThreadEntities`).

- **Backend**: `PlotThreadsService.listForEntity()` — joins
  `plotThreadEntities` → `plotThreads`, filters by entity/campaign/not-
  deleted, then the same per-row `policy.canViewVisibility` filter as the
  existing `listForSession`. `EntitiesService.getPlotThreads()` is a thin
  passthrough (`requireVisibleEntity` guard, then delegate) — mirrors the
  existing `getSessionAppearances`/`SessionsService.listForEntity` pattern
  exactly, found by reading that method rather than assumed; new
  `GET /campaigns/:id/entities/:id/plot-threads` on `EntitiesController`.
  `PlotThreadsModule` added to `EntitiesModule`'s imports (already
  exported `PlotThreadsService`, no circular-dependency risk confirmed
  before wiring).
- **`EntityDetailPage.tsx`** restructured into a CSS grid: main column
  (header/summary/rich-text content, capped at a `--wb-container-reading`
  720px measure) + a `position: sticky` rail (Relationships → new Plot
  Threads panel → Session Appearances → Attachments → Backlinks → Revision
  History) that collapses to a single stacked column below the new
  `--wb-breakpoint-wide` (1200px). This is also the section order fix:
  Backlinks now correctly renders after Attachments instead of right
  after Relationships, matching `docs/planning/ui-ux.md`'s specified
  order.
- **`RelatedContentPanel`** trimmed to Relationships-only; its Backlinks
  block extracted into a new `BacklinksPanel.tsx` (same
  `useEntityBacklinksQuery` hook, unchanged). New
  `EntityPlotThreadsPanel.tsx` renders the new endpoint's data using the
  same `wb-relationship-list` markup already shared across every other
  rail section.
- **`CampaignOverviewPage.tsx`**'s 5 widget blocks (Current Status,
  Sessions, Active Threads, Dormant Threads, Recent Activity, Quick
  Actions) now render through `CardGrid` (Phase 1's primitive, this is
  its second real consumer) with a new `.wb-dashboard-widget` card
  treatment, instead of one stacked column.

**Verification:** typecheck/lint/build clean; full web vitest (11/11) and
API jest (96/96) green. Two new integration tests
(`plot-threads.e2e-spec.ts`: entity-scoped listing correctly filters out
a `gm_only` thread for a player while an owner sees both, plus a
cross-campaign 404 check) — full suite re-run clean at 193/193 (191 + 2
new). Real browser: confirmed via computed styles (not just visual
inspection) that `.wb-entity-detail` is a genuine 2-column grid at
1920px and collapses to 1 column below 1200px, and that the rail's
`position` is actually `sticky` (not just present in the CSS source);
screenshot confirmed the exact section order fix and the new Plot
Threads panel rendering its empty state correctly; dashboard screenshot
confirmed the new 4-card grid layout.

### Phase 6 — Quick-create flow (shipped)

Implements `docs/planning/ui-ux.md`'s "Creating Information" section
("type a name, click Create, the app navigates there, then progressively
add details") — confirmed in an earlier audit that the backend already
only requires a name/title for entities/sessions/plot threads, so this
was a pure frontend gap.

- New `packages/ui/src/QuickCreateDialog.tsx` — generic, content-agnostic
  (built on `Dialog`, following `ConfirmDialog`'s own compositional
  template) so it hosts a different minimal form per resource type.
- New `EntityTypePicker.tsx` — an icon+label button grid substituting for
  a `<select>` specifically for quick-create's type selection (native
  `<option>` elements can't render an icon in any browser).
  `entityTypeIcons.tsx` gained `ENTITY_TYPE_LABELS`/`ENTITY_TYPES`
  exports so this picker and `WorldListPage`'s type filter share one
  label list instead of maintaining two.
- `QuickCreateEntityDialog`/`QuickCreateSessionDialog`/
  `QuickCreateThreadDialog` — each wraps `QuickCreateDialog` with the
  real create mutation, navigating to the new record's detail page on
  success (same target the old full forms already used).
- All 6 known `<Link to=".../new">` entry points (WorldListPage,
  SessionListPage, ThreadListPage, and the dashboard's 3 Quick Actions)
  now open the dialog instead of navigating to a full-page form. The
  dashboard's Quick Actions became the doc's exact 4 buttons (New
  Character / New Location / New Session / New Plot Thread — the first
  two pre-fill `EntityTypePicker`'s selection, skipping that step).
- `/world/new`, `/sessions/new`, `/threads/new` stay valid deep-linkable
  URLs (bookmarks, back-button) without maintaining a second parallel
  creation UI — each now routes to a tiny wrapper component
  (`*QuickCreateRoute.tsx`) that renders the same dialog pre-opened,
  `onClose` navigating to the list route. `EntityFormPage`/
  `SessionFormPage`/`ThreadFormPage` are unchanged and now serve edit
  mode exclusively — genuinely where "progressively fill in details"
  happens after quick-create's first step.

**Four real, pre-existing bugs found and fixed while re-running the e2e
suite for real** (none caused by this phase — all predate it, from
earlier phases of this session's work, just never re-verified against a
real browser until this run):

- `entities.spec.ts`'s delete step used `page.once('dialog', ...)` for a
  native `window.confirm()` — but `ConfirmDialog` (added in this
  rollout's own Phase 2, core primitives) replaced that with a real
  modal weeks ago. The test's single click only opened the dialog and
  never confirmed it, so delete silently never ran. Fixed by clicking
  the dialog-scoped "Delete" button too.
- The offline-mid-edit test set `context.setOffline(true)` immediately
  after clicking "Edit," racing the lazy-loaded `EntityFormPage.tsx`
  chunk's dynamic `import()`. It happened to always win before this
  phase, because the old create flow used the _same_ `EntityFormPage`
  component (warming the chunk); quick-create uses a different
  component, so Edit's dynamic import is now genuinely the first fetch.
  Fixed by waiting for the edit form to actually render first.
- `sessions.spec.ts`/`plot-threads.spec.ts` asserted against
  `.wb-entity-header__meta`, a class that stopped existing once
  `SessionDetailPage`/`ThreadDetailPage` migrated to the `PageHeader`
  primitive (`.wb-page-header__meta`) during this rollout's own Phase 2
  — correct before that migration, stale after, never re-run since.
- `sessions.spec.ts`'s `getByLabel('Search')` became ambiguous once the
  topbar's Ctrl/Cmd+K button (`aria-label="Search (Ctrl/Cmd+K)"`, added
  in this rollout's Phase 3) started substring-matching the same query
  as the World list's own Search field.

**Verification:** typecheck/lint/build clean; full web vitest (11/11)
and API jest (96/96) green. Real browser: all 6 entry points confirmed
opening a dialog (not a page nav) with Escape correctly closing;
`/world/new` direct-loaded confirmed opening the same dialog with Escape
navigating back to `/world`; a full create-to-navigate round trip
exercised for all three resource types (fill name, submit, confirm
landing on the real new record's detail page), with test data cleaned up
after. All 5 affected Playwright e2e spec files, rewritten to create
through the dialog instead of the old full-page forms, verified with a
full 3-browser run (chromium/firefox/webkit): 24/24 passing.

### Phase 7 — Favorites (shipped, rollout complete)

The smallest, most cuttable phase, and the last one — closes out the
7-phase UI/UX rework. No favorites concept existed anywhere before this:
no schema, no API, no UI.

- New `entity_favorites` join table (`apps/api/src/database/schema.ts`),
  following the exact composite-unique junction pattern `entityTags`
  already established (`userId`/`entityId`, `unique(userId, entityId)`,
  a reverse index on `entityId`). Migration reviewed before applying —
  exactly one new table, no drops/renames — via the `db-migration` skill.
- `EntitiesService.favorite()`/`unfavorite()` (new `POST`/`DELETE
:entityId/favorite`), each guarded by the same `requireVisibleEntity`
  check the other entity-scoped endpoints use. Favoriting is
  idempotent (`onConflictDoNothing`), and so is unfavoriting (a plain
  delete matching zero rows isn't an error) — confirmed with a real
  double-favorite/double-unfavorite integration test, not assumed.
- `EntityDetail` gained `isFavorite: boolean`, computed for real only in
  `getById()` (the actual page-load path) — `create()`/`update()` default
  it to `false` rather than adding a wasted query to paths that don't
  need it, since neither response renders the star toggle.
  `listEntitiesQuerySchema` gained `favorite: z.literal('true').optional()`
  — deliberately only the literal `'true'` (never `'false'`), sidestepping
  the `z.coerce.boolean()` footgun documented in `packages/config/src/env.ts`
  by construction rather than by remembering not to send the string
  `"false"`.
- `EntityDetailPage`'s `PageHeader` actions gained a star `IconButton`
  (filled when favorited), available to every campaign member — favoriting
  is a personal preference, not an edit permission, so it's not gated
  behind `canManage` the way Edit/Delete are. `WorldListPage` gained a
  "Favorites only" checkbox alongside the existing filters.

**Verification:** typecheck/lint/build clean; full web vitest (11/11)
and API jest (96/96) green. Two new integration tests — a full
favorite/double-favorite/filter/unfavorite/double-unfavorite round trip,
and a per-user isolation check (one member's favorite doesn't leak into
another member's view of the same entity) — full suite re-run clean at
195/195 (193 + 2 new). Real browser: confirmed the star's `aria-label`
and `aria-pressed` both flip correctly on click and **persist across a
full page reload** (proving the round trip actually reaches the database,
not just local state); confirmed the World list's favorites-only filter
against two real entities (one favorited, one not) that it genuinely
excludes the non-favorited one, not just re-displays everything. All 5
e2e spec files from Phase 6 re-run clean, confirming no regression from
the new filter/star UI elements.

**Rollout status**: all 7 phases of the UI/UX rework are now shipped —
the root-cause width fix, the motion pass, entity type icons, the World
list card grid, the entity-detail/dashboard rail rework, the quick-create
flow, and favorites.

## 47. UX-Audit Remediation

With §46's rework shipped, a 3-agent UX audit was run across Creation,
Study, Search, Organization, and Review flows — not a feature checklist,
but a judgment pass on how each flow actually feels to use end to end.
It surfaced ~30 concrete findings; the user agreed with all of them and
this is the resulting fix effort, tracked here as its own section. Four
scope decisions were made up front: autosave for sessions/plot threads
brought in line with entities; favorites get both a dashboard widget and
a search-ranking boost; tags extend to sessions and plot threads; the
timeline gets a date-grouped list (using the campaign's own custom
calendar), not a full visual timeline. Three more were resolved before
implementation started: "Neglected"/"Dormant" naming unifies to
"Neglected"; timeline filter-by-plot-thread is deferred (no schema
relation exists between timeline events and plot threads today — real
scope growth, not a confirmed finding); session completion gets a
read-only recap of already-logged thread changes, not an editable one.

### Phase 1 — Quick, contained fixes (shipped)

Seven independent, low-risk findings, fixed together as one phase.

- **GM-only content had no visual distinction from public content** —
  confirmed both `EntityDetailPage` and `SessionDetailPage` rendered
  GM-only `RichTextEditor` blocks with identical styling to public ones,
  distinguished only by a small field label. Fixed with a new
  `.wb-gm-content` wrapper class (`apps/web/src/styles/global.css`,
  alongside the other cross-feature shared utility classes already
  documented there) — a warning-tinted background + left border,
  reusing the same `--wb-warning` token the "GM only" `Badge` already
  uses, rather than inventing a new color. Color-only treatment,
  deliberately not adding an icon — the existing warning color already
  reads clearly against the surrounding content in a live check.
- **Search results had no type icons at all** — `SearchResult`
  (`packages/contracts/src/search.ts`) gained an optional `entityType`
  field, following the exact precedent `CampaignActivityItem.entityType`
  already set; `SearchService.searchEntities()` threads it through
  (it already selected `entities.entityType` for the subtitle label, so
  this was a one-line addition, not a new query). `SearchResultRow` now
  renders `EntityTypeIcon` for entity results and the same
  `CalendarDays`/`GitBranch` icons `CampaignOverviewPage`'s
  `ActivityIcon` uses for session/plot-thread results, plus new icons
  (`CalendarClock`, `Link2`) for timeline events and relationships —
  the two resource types search returns that the dashboard activity
  feed doesn't.
- **The Audit log was unreachable from any nav** — both
  `CampaignLayout.tsx` and `AuditPage.tsx` used to document, in their
  own comments, a deliberate decision to keep it Settings-link-only.
  That decision is reversed: `CampaignLayout`'s secondary nav gained an
  "Audit Log" link, gated by the same `canManage` check as Settings.
  Both comments were updated so they stop asserting a decision that's
  no longer true — the alternative (a nav change with a stale comment
  next to it explaining why the nav should stay as it wasn't) would
  have been worse than either the old or new behavior.
- **Attachment uploads had no loading feedback**, unlike the identical
  presign→PUT→complete→poll→link pipeline on `MapFormPage`, which
  already showed `<LoadingState label="Uploading and processing…" />`.
  `AttachmentsPanel` gained the same line.
- **Relationship creation's Save button never showed a pending state**,
  unlike every other submit button in the app. Fixed with the same
  `{mutation.isPending ? 'Saving…' : 'Save'}` convention used
  everywhere else.
- **"Neglected" vs. "Dormant Threads Requiring Attention"** — the same
  `thread.neglected`/`dashboard.neglectedThreads` boolean, two different
  headings in two different places. Unified to "Neglected" /
  "Neglected Threads" everywhere, matching the field's own name in code.
- **Dead create-mode code in three form pages** — `EntityFormPage`,
  `SessionFormPage`, `ThreadFormPage` all still had a full working
  `!isEditMode` create branch (create mutation, disabled-on-create
  ternaries, a conditional submit button), but §46 Phase 6 already
  repointed every `*/new` route to a quick-create dialog, so these three
  pages are only ever reached via `:id/edit` in practice. Removed the
  dead branches from all three; `EntityFormPage` (the most entangled,
  since its edit-mode logic shares state — `hydratedRef`,
  `skipNextAutosaveRef`, the conflict-resolution banner — with what used
  to be the create path) was done last and re-verified live afterward,
  not just by typecheck. The entity form's create-mode-only 2-second
  IndexedDB draft-save effect was removed entirely — edit mode's draft
  persistence is already handled inside `useEntityAutosave` itself (it
  writes to `draftDb` on any save failure), so this wasn't dual-purpose
  code, it was two unrelated mechanisms that happened to share a file.

**Verification:** `pnpm typecheck` / `pnpm lint` / `pnpm build` clean
across the whole workspace; full web vitest (11/11) and the API's
search-service jest suite (17/17) green. Real Playwright checks against
a live dev stack (Postgres/Redis/MinIO/Mailpit via `pnpm infra:up`,
seeded demo data): confirmed both GM-only content blocks render with the
warning-tinted wrapper on an entity and a session; confirmed a search
result for a character-type entity renders its `EntityTypeIcon`
(matching "Character" subtitle); confirmed the Audit Log link renders in
the sidebar for a GM; confirmed the entity edit page's autosave still
round-trips correctly post-cleanup (edited the name field, confirmed the
"Saved" banner and the change persisting after reload, then reverted and
confirmed that persisted too); confirmed the plot thread edit page
renders "Edit plot thread" (not the old conditional heading) and its
"Save changes" button still successfully saves and navigates back to the
thread detail page.

### Phase 2 — Quick-create parity + generic autosave (shipped)

- **Timeline events had no quick-create flow** — `world/timeline/new`
  still routed straight to the full `TimelineEventFormPage`, unlike
  entities/sessions/threads, which all got a quick-create dialog in
  §46 Phase 6. Fixed with a new `QuickCreateTimelineEventDialog`
  (`apps/web/src/features/timeline/components/`), mirroring
  `QuickCreateEntityDialog`'s structure exactly, plus a new
  `TimelineEventQuickCreateRoute` for the deep-linkable `/new` URL. The
  dialog asks for title + an optional date (unlike sessions/threads'
  title-only quick create) — a timeline event's whole point is usually
  _when_ it happened, but undated is a first-class case (the "Undated"
  section on `TimelineListPage`), so the date stays genuinely optional,
  using the existing calendar-aware `StructuredDateEditor` rather than a
  new lighter date input. `TimelineEventFormPage` is now edit-mode only,
  same dead-branch cleanup already applied to the other three form pages
  in Phase 1.
- **Sessions and plot threads had no real autosave** — decision #1 from
  the audit's follow-up questions was that they should match entities,
  not just gain an unsaved-changes warning. The entity-only
  `useEntityAutosave` hook (`apps/web/src/features/entities/hooks/`) and
  its IndexedDB draft store (`entities/lib/draftDb.ts`) hardcoded
  `entitiesApi.updateEntity`/`UpdateEntityInput`/`EntityDetail` and an
  entity-only draft key — not directly reusable as-is. Generalized both:
  - `apps/web/src/lib/useAutosave.ts` — the same debounce/save/
    conflict-detection state machine, now parameterized by a `save`
    function, a `resourceType`, and a `resourceId` instead of calling
    the entities API directly. Confirmed safe to genericize the
    409-conflict branch without per-resource special-casing:
    `sessions.service.ts` and `plot-threads.service.ts` both already
    implement the identical `assertNotStale()` →
    `ConflictException({ currentUpdatedAt })` pattern entities use.
  - `apps/web/src/lib/draftDb.ts` — the IndexedDB store, generalized
    the same way: `EntityDraft` → `ResourceDraft` with a
    `resourceType: 'entity' | 'session' | 'plot_thread'` field, the
    draft key extended to `${resourceType}:${campaignId}:${resourceId
?? 'new'}`. Store name and `idb` `openDB` version both kept
    stable-but-bumped (1 → 2, `upgrade()` a no-op for existing rows) —
    no destructive migration needed since IndexedDB is schemaless per
    row; old entity-only-format keys are simply never looked up again
    rather than migrated, a deliberate choice since they're pure local
    cache with no server-side source of truth to reconcile against.
  - **Why both halves, not just the debounce-and-PATCH half**: a
    half-generalized autosave that dropped the offline-resilience half
    (drafts surviving a failed save, restorable on next visit) wouldn't
    have actually satisfied "real autosave, matching entities" — it
    would have looked the same until the first offline edit or 409,
    then silently behaved worse than entities. Generalizing the draft
    store alongside the hook was what made the _decision_ true, not
    just the common-case UI.
  - `EntityFormPage` now consumes the promoted, generic hook/store
    (thin call-site change, same behavior); `SessionFormPage`/
    `ThreadFormPage` replaced their explicit "Save changes" button with
    the same status/conflict/draft-restore banners `EntityFormPage`
    already had. The old entity-specific hook and draft store were
    deleted once nothing imported them.

**Verification:** `pnpm typecheck` / `pnpm lint` / `pnpm build` clean;
full web vitest (11/11) green. Real browser: created a timeline event
via quick-create from both the Timeline list button and the `/new` deep
link, confirmed both navigate to the new event's detail page and that
Escape on the deep-link route returns to the Timeline list; edited a
session and a plot thread, confirmed the debounced autosave fires (the
"Saved" banner appears within ~2s of the last edit) with no explicit
save button remaining on either form.
