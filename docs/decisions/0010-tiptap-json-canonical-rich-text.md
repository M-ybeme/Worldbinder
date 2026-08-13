# ADR-0010: TipTap JSON as canonical rich text

**Status:** Accepted
**Date:** 2026-07-16

## Context

Entity/session/plot-thread content needs real rich text (headings, paragraphs, lists) plus one thing plain rich-text formats don't give you for free: a first-class inline reference to another entity — a wiki-link mention — that carries a stable `entityId`, not just a display string, so backlinks (`WikiLinksService`) and permission-aware rendering stay correct even if the target is later renamed. Content also splits `public`/`gm_only` (ADR-0009) and needs to round-trip losslessly through export/import (§17).

## Decision

Store rich text as TipTap's native JSON document shape (`TiptapDoc`: `{ type: 'doc', content: unknown[] }`, `packages/contracts/src/entities.ts`) directly in `jsonb` columns (`publicContentJson`, `gmContentJson`, `recapContentJson`, etc.), and use TipTap as the actual React editor component too — the wire format is the editor's own model, not a derived serialization. A custom `entityMention` node (`{ type: 'entityMention', attrs: { entityId, label } }`) carries the wiki-link reference inline; `WikiLinksService.extractMentions()` walks the JSON tree with a small structural type (`TiptapNode`) to find them, no HTML/markdown parsing involved.

## Alternatives considered

- **Markdown text**: simple and portable, but has no first-class inline entity-reference node — would need a custom syntax (e.g. `[[entity]]`) plus a parser, and generating clickable mention widgets from parsed markdown is more fragile than reading a typed JSON node.
- **HTML strings**: directly renderable, but requires sanitization on every write and read (XSS surface), and encoding structured attributes like `entityId` means custom `data-*` attributes and a second parse step to extract them for backlinks.
- **Plain text plus a separate structured-mentions table**: decouples display from references, but mention positions can drift out of sync with the text on edit. TipTap's node-embedded model keeps content and references atomically consistent — a mention only exists if it's really in the document.

## Consequences

- Any renderer of entity content needs the same TipTap JSON model — fine, since only this app's own frontend ever renders it.
- `jsonb` storage has no native full-text index on the rich content directly; search instead extracts plain text into `tsvector` columns at write time (`search-vector.util.ts`, ADR-0014).
- The export format (§17, ADR-0017) must serialize/deserialize this JSON shape losslessly, since it's the canonical representation, not a derived one.

## Revisit conditions

If a second client (e.g. a read-only public site) ever needs to consume campaign content without TipTap, add a markdown/HTML export transform at that boundary rather than changing the canonical storage format.
