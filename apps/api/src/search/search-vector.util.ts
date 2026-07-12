import type { TiptapDoc } from '@worldbinder/contracts';
import { sql, type SQL } from 'drizzle-orm';

/** A minimal TipTap JSON node shape — only what extraction needs. Mirrors
 * `WikiLinksService`'s `TiptapNode` shape (`entities/wiki-links.service.ts`). */
interface TiptapTextNode {
  type?: string;
  text?: unknown;
  content?: unknown[];
}

/** Walks a TipTap document collecting every `text` node's content into a
 * single space-joined plain-text string, for tsvector indexing and snippet
 * generation. Same recursion shape as `WikiLinksService.extractMentions`,
 * but concatenates text instead of collecting mention nodes. */
export function extractPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc) return '';

  const pieces: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const typed = node as TiptapTextNode;

    if (typed.type === 'text' && typeof typed.text === 'string') {
      pieces.push(typed.text);
    }

    if (Array.isArray(typed.content)) {
      for (const child of typed.content) visit(child);
    }
  };

  visit(doc);
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

export interface WeightedTextPieces {
  /** Weight A — name/title, aliases. */
  a?: string[];
  /** Weight B — tags, summary. */
  b?: string[];
  /** Weight C — body content. */
  c?: string[];
  /** Weight D — relationship description text. */
  d?: string[];
}

function joinPieces(pieces: string[] | undefined): string {
  return (pieces ?? []).filter((piece) => piece.trim().length > 0).join(' ');
}

/** Builds the weighted `tsvector` SQL expression stored in a
 * `search_vector*` column (roadmap §14.2's A/B/C/D weighting), for use
 * directly as a column value in an insert `.values()`/update `.set()` call.
 * Always emits all four `setweight` calls (empty groups become an empty
 * string, which `to_tsvector` turns into an empty vector) rather than
 * conditionally omitting weights — simpler than building the expression
 * piecemeal, and `||` on an empty tsvector is a no-op. */
export function buildWeightedTsvector(pieces: WeightedTextPieces): SQL {
  const a = joinPieces(pieces.a);
  const b = joinPieces(pieces.b);
  const c = joinPieces(pieces.c);
  const d = joinPieces(pieces.d);

  return sql`setweight(to_tsvector('english', ${a}), 'A') || setweight(to_tsvector('english', ${b}), 'B') || setweight(to_tsvector('english', ${c}), 'C') || setweight(to_tsvector('english', ${d}), 'D')`;
}
