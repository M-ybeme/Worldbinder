import type { TiptapDoc } from '@worldbinder/contracts'

interface TiptapNode {
  type?: string
  text?: string
  content?: TiptapNode[]
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'])

/** Flattens a Tiptap document to plain text for short previews (e.g. a
 * session recap on the Dashboard) — blocks are joined with a space so
 * paragraphs don't run together. Mirrors the API's own `extractPlainText`
 * (search-vector.util.ts), which can't be shared across the app boundary. */
export function tiptapToPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc) return ''
  const parts: string[] = []
  function walk(node: TiptapNode): void {
    if (typeof node.text === 'string') parts.push(node.text)
    node.content?.forEach(walk)
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push(' ')
  }
  ;(doc.content as TiptapNode[]).forEach(walk)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

/** Cuts at a word boundary and adds an ellipsis when the text is longer
 * than `max` characters. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
