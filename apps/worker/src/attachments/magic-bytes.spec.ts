import { looksLikeText, sniffMimeType } from '@worldbinder/validation';
import { describe, expect, it } from 'vitest';

describe('sniffMimeType', () => {
  it('detects PNG by its 8-byte signature', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(sniffMimeType(buffer)).toBe('image/png');
  });

  it('detects JPEG by its 3-byte signature', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(sniffMimeType(buffer)).toBe('image/jpeg');
  });

  it('detects GIF87a and GIF89a', () => {
    expect(sniffMimeType(Buffer.from('GIF87a rest', 'ascii'))).toBe('image/gif');
    expect(sniffMimeType(Buffer.from('GIF89a rest', 'ascii'))).toBe('image/gif');
  });

  it('detects WebP (RIFF....WEBP)', () => {
    const buffer = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP', 'ascii'),
    ]);
    expect(sniffMimeType(buffer)).toBe('image/webp');
  });

  it('rejects RIFF without a WEBP fourCC (e.g. a WAV file)', () => {
    const buffer = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE', 'ascii'),
    ]);
    expect(sniffMimeType(buffer)).toBeNull();
  });

  it('detects PDF by its %PDF- signature', () => {
    expect(sniffMimeType(Buffer.from('%PDF-1.7 rest', 'ascii'))).toBe('application/pdf');
  });

  it('returns null for an executable (MZ header) — not in the allowlist', () => {
    const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0, 0]);
    expect(sniffMimeType(buffer)).toBeNull();
  });

  it('returns null for a buffer too short to contain any known signature', () => {
    expect(sniffMimeType(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe('looksLikeText', () => {
  it('accepts plain ASCII text', () => {
    expect(looksLikeText(Buffer.from('Hello, world!\nSecond line.', 'utf8'))).toBe(true);
  });

  it('accepts UTF-8 text with multibyte characters', () => {
    expect(looksLikeText(Buffer.from('Café, naïve, 日本語', 'utf8'))).toBe(true);
  });

  it('rejects a buffer containing a null byte', () => {
    const buffer = Buffer.from([0x48, 0x65, 0, 0x6c, 0x6f]);
    expect(looksLikeText(buffer)).toBe(false);
  });

  it('rejects a buffer with a high ratio of binary control bytes', () => {
    const buffer = Buffer.from(Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 0x01 : 0x41)));
    expect(looksLikeText(buffer)).toBe(false);
  });

  it('treats an empty buffer as text (nothing to reject)', () => {
    expect(looksLikeText(Buffer.alloc(0))).toBe(true);
  });
});
