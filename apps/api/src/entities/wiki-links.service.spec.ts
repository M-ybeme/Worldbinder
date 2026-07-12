import type { TiptapDoc } from '@worldbinder/contracts';
import { CampaignPolicyService } from '../membership/campaign-policy.service';
import { WikiLinksService } from './wiki-links.service';

describe('WikiLinksService.extractMentions', () => {
  const service = new WikiLinksService(
    {} as never,
    new CampaignPolicyService(),
  );

  it('returns nothing for a null document', () => {
    expect(service.extractMentions(null)).toEqual([]);
  });

  it('finds a mention node nested inside paragraphs and marks', () => {
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
            { type: 'text', text: ' for details.' },
          ],
        },
      ],
    };

    expect(service.extractMentions(doc)).toEqual([
      { entityId: 'entity-1', displayText: 'Duke Renald' },
    ]);
  });

  it('finds multiple mentions across multiple blocks', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'entityMention', attrs: { entityId: 'a', label: 'A' } },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'entityMention',
                      attrs: { entityId: 'b', label: 'B' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(service.extractMentions(doc)).toEqual([
      { entityId: 'a', displayText: 'A' },
      { entityId: 'b', displayText: 'B' },
    ]);
  });

  it('ignores a mention node missing a valid entityId', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [{ type: 'entityMention', attrs: { label: 'Broken' } }],
    };

    expect(service.extractMentions(doc)).toEqual([]);
  });

  it('falls back to an empty display text when label is missing', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [{ type: 'entityMention', attrs: { entityId: 'entity-1' } }],
    };

    expect(service.extractMentions(doc)).toEqual([
      { entityId: 'entity-1', displayText: '' },
    ]);
  });
});
