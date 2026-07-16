import type { TiptapDoc } from '@worldbinder/contracts';

/**
 * Milestone 15 Phase 1 — minimal TipTap document builders for the demo
 * content script, so content is written as plain function calls rather
 * than hand-assembled JSON. `mention()` produces the same inline
 * wiki-link node shape the real editor writes (see `packages/validation`'s
 * entity-mention documentation) so `WikiLinksService.refreshLinks()`
 * actually parses these into real backlinks — this is the mechanism that
 * makes the demo campaign's entities genuinely interconnected rather than
 * just linked via structured relationship rows.
 */

export function paragraph(
  // Accepts plain strings, real mention() nodes, or (Phase 3) a
  // `mentionRef()` marker awaiting `resolveMentions()` — any inline node
  // shape, not just this file's own `mention()` output. Untyped
  // deliberately: this is data-authoring convenience, not a validated
  // schema (the real API validates the actual payload server-side).
  ...content: unknown[]
): Record<string, unknown> {
  return {
    type: 'paragraph',
    content: content.map((piece) =>
      typeof piece === 'string' ? { type: 'text', text: piece } : piece,
    ),
  };
}

export function heading(text: string, level = 2): Record<string, unknown> {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  };
}

export function mention(
  entityId: string,
  label: string,
): Record<string, unknown> {
  return {
    type: 'entityMention',
    attrs: { entityId, label },
  };
}

export function doc(...blocks: Record<string, unknown>[]): TiptapDoc {
  return { type: 'doc', content: blocks };
}
