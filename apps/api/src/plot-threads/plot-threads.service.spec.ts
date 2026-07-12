import {
  computeResolvedSessionTransition,
  isNeglected,
  NEGLECT_THRESHOLD_SESSIONS,
  projectPlayerFacingStatus,
} from './plot-threads.service';

describe('projectPlayerFacingStatus', () => {
  it('projects each internal status to its player-facing label', () => {
    expect(projectPlayerFacingStatus('foreshadowed')).toBe('open');
    expect(projectPlayerFacingStatus('active')).toBe('ongoing');
    expect(projectPlayerFacingStatus('dormant')).toBe('ongoing');
    expect(projectPlayerFacingStatus('resolved')).toBe('completed');
    expect(projectPlayerFacingStatus('abandoned')).toBe('open');
  });
});

describe('computeResolvedSessionTransition', () => {
  it('records the resolving session when moving into resolved', () => {
    expect(
      computeResolvedSessionTransition(
        { currentStatus: 'active', currentResolvedSessionId: null },
        'resolved',
        'session-9',
      ),
    ).toEqual({ resolvedSessionId: 'session-9' });
  });

  it('keeps the existing resolved session id if no new session is given', () => {
    expect(
      computeResolvedSessionTransition(
        { currentStatus: 'active', currentResolvedSessionId: null },
        'resolved',
        null,
      ),
    ).toEqual({ resolvedSessionId: null });
  });

  it('clears the resolved session id when moving away from resolved', () => {
    expect(
      computeResolvedSessionTransition(
        { currentStatus: 'resolved', currentResolvedSessionId: 'session-9' },
        'active',
        null,
      ),
    ).toEqual({ resolvedSessionId: null });
  });

  it('is a no-op for a transition that does not cross the resolved boundary', () => {
    expect(
      computeResolvedSessionTransition(
        { currentStatus: 'active', currentResolvedSessionId: null },
        'dormant',
        null,
      ),
    ).toEqual({ resolvedSessionId: null });

    expect(
      computeResolvedSessionTransition(
        { currentStatus: 'resolved', currentResolvedSessionId: 'session-9' },
        'resolved',
        'session-12',
      ),
    ).toEqual({ resolvedSessionId: 'session-9' });
  });
});

describe('isNeglected', () => {
  it('is never neglected once resolved or abandoned, regardless of the gap', () => {
    expect(
      isNeglected(
        { status: 'resolved', lastReferencedSessionNumber: null },
        20,
      ),
    ).toBe(false);
    expect(
      isNeglected({ status: 'abandoned', lastReferencedSessionNumber: 1 }, 20),
    ).toBe(false);
  });

  it('is not neglected if the campaign has no completed sessions yet', () => {
    expect(
      isNeglected(
        { status: 'active', lastReferencedSessionNumber: null },
        null,
      ),
    ).toBe(false);
  });

  it('is neglected if never referenced but sessions have been played', () => {
    expect(
      isNeglected(
        { status: 'foreshadowed', lastReferencedSessionNumber: null },
        5,
      ),
    ).toBe(true);
  });

  it('respects the threshold boundary exactly', () => {
    const justUnderThreshold = NEGLECT_THRESHOLD_SESSIONS - 1;
    expect(
      isNeglected(
        {
          status: 'active',
          lastReferencedSessionNumber: 10 - justUnderThreshold,
        },
        10,
      ),
    ).toBe(false);
    expect(
      isNeglected(
        {
          status: 'active',
          lastReferencedSessionNumber: 10 - NEGLECT_THRESHOLD_SESSIONS,
        },
        10,
      ),
    ).toBe(true);
  });

  it('is not neglected if recently referenced', () => {
    expect(
      isNeglected({ status: 'active', lastReferencedSessionNumber: 9 }, 10),
    ).toBe(false);
  });
});
