import { isPinVisible, type PinVisibilityInput } from './maps.service';

const baseInput: PinVisibilityInput = {
  mapVisibility: 'public',
  layerVisibility: null,
  pinVisibility: 'public',
  linkedEntityVisibility: null,
  linkedEntityDeleted: false,
};

describe('isPinVisible', () => {
  it('is visible when everything is public and there is no layer or linked entity', () => {
    expect(isPinVisible(baseInput, false)).toBe(true);
  });

  it('is hidden from a non-GM viewer when the map itself is gm_only', () => {
    expect(
      isPinVisible({ ...baseInput, mapVisibility: 'gm_only' }, false),
    ).toBe(false);
    expect(isPinVisible({ ...baseInput, mapVisibility: 'gm_only' }, true)).toBe(
      true,
    );
  });

  it('is hidden from a non-GM viewer when the pin is on a gm_only layer, even though the map and pin are public', () => {
    expect(
      isPinVisible({ ...baseInput, layerVisibility: 'gm_only' }, false),
    ).toBe(false);
    expect(
      isPinVisible({ ...baseInput, layerVisibility: 'gm_only' }, true),
    ).toBe(true);
  });

  it('is hidden from a non-GM viewer when the pin itself is gm_only', () => {
    expect(
      isPinVisible({ ...baseInput, pinVisibility: 'gm_only' }, false),
    ).toBe(false);
  });

  it('does not leak a gm_only linked entity through an otherwise-public pin on a public map', () => {
    const input: PinVisibilityInput = {
      ...baseInput,
      linkedEntityVisibility: 'gm_only',
    };
    expect(isPinVisible(input, false)).toBe(false);
    expect(isPinVisible(input, true)).toBe(true);
  });

  it('is hidden for everyone, including a GM, when the linked entity has been soft-deleted', () => {
    const input: PinVisibilityInput = {
      ...baseInput,
      linkedEntityDeleted: true,
    };
    expect(isPinVisible(input, false)).toBe(false);
    expect(isPinVisible(input, true)).toBe(false);
  });
});
