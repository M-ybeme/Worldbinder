import type { TiptapDoc } from '@worldbinder/contracts';
import { sql } from 'drizzle-orm';
import { buildWeightedTsvector, extractPlainText } from './search-vector.util';

describe('extractPlainText', () => {
  it('returns an empty string for a null/undefined document', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
  });

  it('concatenates text nodes nested inside paragraphs and marks', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The ' },
            { type: 'text', text: 'Ashen Guard', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' patrols the wall.' },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe('The Ashen Guard patrols the wall.');
  });

  it('concatenates text across multiple blocks with a separating space', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Heading' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text.' }] },
      ],
    };

    expect(extractPlainText(doc)).toBe('Heading Body text.');
  });

  it('ignores non-text nodes such as entity mentions', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            {
              type: 'entityMention',
              attrs: { entityId: 'entity-1', label: 'Duke Renald' },
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe('See .');
  });

  it('collapses runs of whitespace and trims the result', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '  Hello   ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '  World  ' }] },
      ],
    };

    expect(extractPlainText(doc)).toBe('Hello World');
  });
});

describe('buildWeightedTsvector', () => {
  it('builds a four-weight setweight/to_tsvector expression', () => {
    const result = buildWeightedTsvector({
      a: ['Duke Renald'],
      b: ['noble', 'antagonist'],
      c: ['He rules Westvale with an iron fist.'],
    });

    const built = sql`setweight(to_tsvector('english', ${'Duke Renald'}), 'A') || setweight(to_tsvector('english', ${'noble antagonist'}), 'B') || setweight(to_tsvector('english', ${'He rules Westvale with an iron fist.'}), 'C') || setweight(to_tsvector('english', ${''}), 'D')`;

    expect(result.queryChunks).toEqual(built.queryChunks);
  });

  it('joins multiple pieces within the same weight with a space', () => {
    const result = buildWeightedTsvector({
      a: ['Duke Renald', 'The Iron Duke'],
    });
    const built = sql`setweight(to_tsvector('english', ${'Duke Renald The Iron Duke'}), 'A') || setweight(to_tsvector('english', ${''}), 'B') || setweight(to_tsvector('english', ${''}), 'C') || setweight(to_tsvector('english', ${''}), 'D')`;

    expect(result.queryChunks).toEqual(built.queryChunks);
  });

  it('drops blank/whitespace-only pieces before joining', () => {
    const result = buildWeightedTsvector({ b: ['  ', 'tag', ''] });
    const built = sql`setweight(to_tsvector('english', ${''}), 'A') || setweight(to_tsvector('english', ${'tag'}), 'B') || setweight(to_tsvector('english', ${''}), 'C') || setweight(to_tsvector('english', ${''}), 'D')`;

    expect(result.queryChunks).toEqual(built.queryChunks);
  });

  it('produces an all-empty-weight expression when no pieces are given', () => {
    const result = buildWeightedTsvector({});
    const built = sql`setweight(to_tsvector('english', ${''}), 'A') || setweight(to_tsvector('english', ${''}), 'B') || setweight(to_tsvector('english', ${''}), 'C') || setweight(to_tsvector('english', ${''}), 'D')`;

    expect(result.queryChunks).toEqual(built.queryChunks);
  });
});
