import { searchQuerySchema } from '@worldbinder/validation';

describe('searchQuerySchema', () => {
  it('trims q and rejects an empty query', () => {
    expect(searchQuerySchema.parse({ q: '  Ashen Guard  ' }).q).toBe(
      'Ashen Guard',
    );
    expect(() => searchQuerySchema.parse({ q: '   ' })).toThrow();
    expect(() => searchQuerySchema.parse({})).toThrow();
  });

  it('rejects a query over the max length', () => {
    expect(() => searchQuerySchema.parse({ q: 'a'.repeat(201) })).toThrow();
  });

  it('applies default limit/offset when omitted', () => {
    const result = searchQuerySchema.parse({ q: 'Ashen' });
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('coerces string limit/offset query params and clamps limit to the max', () => {
    expect(searchQuerySchema.parse({ q: 'Ashen', limit: '10' }).limit).toBe(10);
    expect(() =>
      searchQuerySchema.parse({ q: 'Ashen', limit: '999' }),
    ).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'Ashen', limit: '0' })).toThrow();
    expect(() =>
      searchQuerySchema.parse({ q: 'Ashen', offset: '-1' }),
    ).toThrow();
  });

  it('parses types from a comma-separated string', () => {
    expect(
      searchQuerySchema.parse({ q: 'Ashen', types: 'entity, session' }).types,
    ).toEqual(['entity', 'session']);
  });

  it('parses types from a repeated-query-param array', () => {
    expect(
      searchQuerySchema.parse({ q: 'Ashen', types: ['entity', 'plot_thread'] })
        .types,
    ).toEqual(['entity', 'plot_thread']);
  });

  it('leaves types undefined when omitted', () => {
    expect(searchQuerySchema.parse({ q: 'Ashen' }).types).toBeUndefined();
  });

  it('rejects an unknown resource type', () => {
    expect(() =>
      searchQuerySchema.parse({ q: 'Ashen', types: 'entity,bogus' }),
    ).toThrow();
  });
});
