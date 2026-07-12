import { checkRelationshipTypeCompatibility } from './relationships.service';

describe('checkRelationshipTypeCompatibility', () => {
  it('allows any source/target when the type has no allow-list', () => {
    const type = { allowedSourceTypesJson: null, allowedTargetTypesJson: null };
    expect(
      checkRelationshipTypeCompatibility(type, 'character', 'deity'),
    ).toEqual({
      compatible: true,
    });
  });

  it('rejects a source type outside the allow-list', () => {
    const type = {
      allowedSourceTypesJson: ['character'],
      allowedTargetTypesJson: null,
    };
    expect(
      checkRelationshipTypeCompatibility(type, 'location', 'character'),
    ).toEqual({ compatible: false, reason: 'source' });
  });

  it('rejects a target type outside the allow-list', () => {
    const type = {
      allowedSourceTypesJson: null,
      allowedTargetTypesJson: ['faction', 'organization'],
    };
    expect(
      checkRelationshipTypeCompatibility(type, 'character', 'location'),
    ).toEqual({ compatible: false, reason: 'target' });
  });

  it('accepts a source/target combination that satisfies both allow-lists', () => {
    const type = {
      allowedSourceTypesJson: ['character'],
      allowedTargetTypesJson: ['faction', 'organization'],
    };
    expect(
      checkRelationshipTypeCompatibility(type, 'character', 'faction'),
    ).toEqual({
      compatible: true,
    });
  });
});
