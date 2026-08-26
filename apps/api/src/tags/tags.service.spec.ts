import { TagsService } from './tags.service';

describe('TagsService.normalizeTagName', () => {
  const service = new TagsService({} as never);

  it('lowercases and trims', () => {
    expect(service.normalizeTagName('  Ancient Ruins  ')).toBe('ancient ruins');
  });

  it('collapses internal whitespace runs to a single space', () => {
    expect(service.normalizeTagName('foreshadowing   arc')).toBe(
      'foreshadowing arc',
    );
  });

  it('is stable for an already-normalized name', () => {
    expect(service.normalizeTagName('faction')).toBe('faction');
  });
});
