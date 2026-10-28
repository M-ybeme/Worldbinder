import type { TiptapDoc } from '@worldbinder/contracts'
import { diffBlocks, docToBlocks, type BlockChange } from '../../lib/blockDiff'

/** One field that differs between the local edit and the server's newer
 * version — what keeping the local version would overwrite. */
export type FieldDifference =
  | { kind: 'value'; label: string; mine: string; theirs: string }
  /** Entity IDs; the conflict dialog resolves names through the
   * visibility-checked entity endpoint. */
  | { kind: 'entities'; label: string; mine: string[]; theirs: string[] }
  | { kind: 'content'; label: string; changes: BlockChange[] }

function show(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalize(value: unknown): unknown {
  return value === undefined || value === null || value === '' ? null : value
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

/**
 * Collects differences field by field. Each editor lists its own fields;
 * the helpers decide whether they differ and how to present them.
 */
export function differenceCollector() {
  const differences: FieldDifference[] = []
  return {
    differences,
    /** A plain value (or list of values) shown as text. `display` turns a
     * raw value into readable text (e.g. an enum label). */
    value(label: string, mine: unknown, theirs: unknown, display: (v: unknown) => string = show) {
      if (!same(mine, theirs)) differences.push({ kind: 'value', label, mine: display(mine), theirs: display(theirs) })
    },
    /** One or more entity references, compared as sets. */
    entities(label: string, mine: string[] | string | null | undefined, theirs: string[] | string | null | undefined) {
      const list = (v: string[] | string | null | undefined) =>
        (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean)
      const a = list(mine)
      const b = list(theirs)
      if (!same([...a].sort(), [...b].sort())) differences.push({ kind: 'entities', label, mine: a, theirs: b })
    },
    /** Rich text, as a paragraph-level diff. */
    content(label: string, mine: TiptapDoc | null | undefined, theirs: TiptapDoc | null | undefined) {
      const changes = diffBlocks(docToBlocks(mine), docToBlocks(theirs))
      if (changes.some((change) => change.kind !== 'same')) differences.push({ kind: 'content', label, changes })
    },
  }
}
