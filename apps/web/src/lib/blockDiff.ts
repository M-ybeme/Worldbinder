import type { TiptapDoc } from '@worldbinder/contracts'

interface TiptapNode {
  type?: string
  text?: string
  attrs?: { label?: string }
  content?: TiptapNode[]
}

/** A document's top-level blocks (paragraphs, headings, list items, table
 * rows…) as readable text lines. Entity mentions read as their label. */
export function docToBlocks(doc: TiptapDoc | null | undefined): string[] {
  if (!doc) return []
  const blocks: string[] = []
  function inline(node: TiptapNode): string {
    if (typeof node.text === 'string') return node.text
    if (node.type === 'entityMention') return node.attrs?.label ?? ''
    if (node.type === 'hardBreak') return ' '
    return (node.content ?? []).map(inline).join('')
  }
  function walk(node: TiptapNode): void {
    const containers = new Set(['bulletList', 'orderedList', 'blockquote', 'table'])
    if (node.type && containers.has(node.type)) {
      node.content?.forEach(walk)
      return
    }
    if (node.type === 'listItem' || node.type === 'tableRow') {
      const parts = (node.content ?? []).map(inline).filter((part) => part.trim() !== '')
      if (parts.length > 0) blocks.push((node.type === 'listItem' ? '• ' : '') + parts.join(' | '))
      return
    }
    const text = inline(node).replace(/\s+/g, ' ').trim()
    if (text !== '') blocks.push(node.type === 'heading' ? `## ${text}` : text)
  }
  ;((doc.content ?? []) as TiptapNode[]).forEach(walk)
  return blocks
}

export type BlockChange =
  | { kind: 'same'; text: string }
  | { kind: 'mine'; text: string }
  | { kind: 'theirs'; text: string }

/** Line-level diff (longest common subsequence) between two block lists:
 * `mine` = only in the local version, `theirs` = only on the server. */
export function diffBlocks(mine: string[], theirs: string[]): BlockChange[] {
  const m = mine.length
  const n = theirs.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i]![j] =
        mine[i] === theirs[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const changes: BlockChange[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (mine[i] === theirs[j]) {
      changes.push({ kind: 'same', text: mine[i]! })
      i += 1
      j += 1
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      changes.push({ kind: 'mine', text: mine[i]! })
      i += 1
    } else {
      changes.push({ kind: 'theirs', text: theirs[j]! })
      j += 1
    }
  }
  while (i < m) changes.push({ kind: 'mine', text: mine[i++]! })
  while (j < n) changes.push({ kind: 'theirs', text: theirs[j++]! })
  return changes
}
