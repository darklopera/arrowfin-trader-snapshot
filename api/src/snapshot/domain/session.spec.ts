import { currentSessionStart } from './session';

const iso = (s: string) => currentSessionStart(new Date(s)).toISOString();

describe('currentSessionStart (CME Globex 17:00 America/Chicago)', () => {
  it('dataset cut 2026-08-25T14:30Z (09:30 CDT) -> session opened 2026-08-24 17:00 CDT = 22:00Z', () => {
    expect(iso('2026-08-25T14:30:00Z')).toBe('2026-08-24T22:00:00.000Z');
  });
  it('one UTC date holds the END of one session and the START of the next', () => {
    expect(iso('2026-08-25T20:59:00Z')).toBe('2026-08-24T22:00:00.000Z'); // 15:59 CDT, still the old session
    expect(iso('2026-08-25T22:01:00Z')).toBe('2026-08-25T22:00:00.000Z'); // 17:01 CDT, new session
  });
  it('is DST-correct: in winter (CST, UTC-6) the session opens at 23:00Z', () => {
    expect(iso('2026-12-10T15:00:00Z')).toBe('2026-12-09T23:00:00.000Z');
  });
  it('rolls Friday evening and Saturday back to the last real session (Thursday 17:00 CT)', () => {
    expect(iso('2026-08-29T03:00:00Z')).toBe('2026-08-27T22:00:00.000Z'); // Fri 22:00 CDT
    expect(iso('2026-08-29T15:00:00Z')).toBe('2026-08-27T22:00:00.000Z'); // Sat
  });
  it('Sunday 17:00 CT opens the Monday session', () => {
    expect(iso('2026-08-30T22:30:00Z')).toBe('2026-08-30T22:00:00.000Z');
  });
});
