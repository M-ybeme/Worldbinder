import { shouldMergeRevision } from './revision-recorder.service';

const ACTOR_A = 'user-a';
const ACTOR_B = 'user-b';
const NOW = new Date('2026-01-01T12:00:00.000Z');

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

describe('shouldMergeRevision', () => {
  it('never merges when no prior revision exists', () => {
    expect(shouldMergeRevision(undefined, ACTOR_A, true, NOW)).toBe(false);
  });

  it('never merges when allowMerge is false, even if everything else matches', () => {
    const latest = { createdByUserId: ACTOR_A, createdAt: minutesAgo(1) };
    expect(shouldMergeRevision(latest, ACTOR_A, false, NOW)).toBe(false);
  });

  it('merges when the same actor edits again within the window', () => {
    const latest = { createdByUserId: ACTOR_A, createdAt: minutesAgo(5) };
    expect(shouldMergeRevision(latest, ACTOR_A, true, NOW)).toBe(true);
  });

  it('does not merge when a different actor made the prior revision', () => {
    const latest = { createdByUserId: ACTOR_B, createdAt: minutesAgo(1) };
    expect(shouldMergeRevision(latest, ACTOR_A, true, NOW)).toBe(false);
  });

  it('does not merge once the window has elapsed', () => {
    const latest = { createdByUserId: ACTOR_A, createdAt: minutesAgo(31) };
    expect(shouldMergeRevision(latest, ACTOR_A, true, NOW)).toBe(false);
  });

  it('merges exactly at the window boundary (inclusive)', () => {
    const latest = { createdByUserId: ACTOR_A, createdAt: minutesAgo(30) };
    expect(shouldMergeRevision(latest, ACTOR_A, true, NOW)).toBe(true);
  });

  it('treats a revision whose actor was nulled out (deleted user) as never mergeable', () => {
    const latest = { createdByUserId: null, createdAt: minutesAgo(1) };
    expect(shouldMergeRevision(latest, ACTOR_A, true, NOW)).toBe(false);
  });
});
