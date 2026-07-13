// Milestone 9 — shared between apps/api (advisory presign-time check) and
// apps/worker (the authoritative post-upload check). Product/business
// constants, not per-deployment infrastructure values, so these are code
// constants rather than env vars — same reasoning as
// revisions/revision-recorder.service.ts's REVISION_WINDOW_MINUTES.

export const ATTACHMENT_MAX_SIZE_BYTES = 20_000_000 // 20MB, a documented judgment call

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const
export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

/**
 * Hand-rolled magic-byte sniffing rather than the `file-type` npm package:
 * apps/api and apps/worker both compile to CommonJS, and `file-type` has
 * been ESM-only since v17. PNG/JPEG/GIF/WebP/PDF each have trivial fixed
 * signatures, so a small hand-rolled check avoids the dependency entirely.
 *
 * Returns null for plain text/Markdown — those have no magic number by
 * design; callers should fall back to `looksLikeText()` for those.
 */
export function sniffMimeType(bytes: Uint8Array): AllowedAttachmentMimeType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, asciiBytes('GIF87a')) || startsWith(bytes, asciiBytes('GIF89a'))) {
    return 'image/gif'
  }
  if (
    startsWith(bytes, asciiBytes('RIFF')) &&
    bytes.length >= 12 &&
    matchesAt(bytes, 8, asciiBytes('WEBP'))
  ) {
    return 'image/webp'
  }
  if (startsWith(bytes, asciiBytes('%PDF-'))) return 'application/pdf'
  return null
}

/**
 * Text has no magic number, so this is a heuristic, not a detection: reject
 * if a null byte appears (binary formats almost always contain one early)
 * or the ratio of non-printable/control bytes is too high. Markdown cannot
 * be distinguished from plain text this way either — both collapse to
 * `text/plain` server-side; the declared extension is display-only.
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8000))
  if (sample.length === 0) return true

  let controlBytes = 0
  for (const byte of sample) {
    if (byte === 0) return false
    const isPrintableAscii = byte >= 0x20 && byte < 0x7f
    const isCommonWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d
    // Bytes >= 0x80 are plausible UTF-8 continuation/multibyte content, not
    // treated as control bytes here — this heuristic only needs to reject
    // clearly-binary formats, not validate strict UTF-8.
    const isHighBit = byte >= 0x80
    if (!isPrintableAscii && !isCommonWhitespace && !isHighBit) controlBytes++
  }
  return controlBytes / sample.length < 0.05
}

function asciiBytes(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0))
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return matchesAt(bytes, 0, signature)
}

function matchesAt(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((value, index) => bytes[offset + index] === value)
}
