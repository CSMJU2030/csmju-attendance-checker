import { CheckInAttempts, LOCKOUT_WINDOW_MS, MAX_FAILED_ATTEMPTS } from './check-in-attempts';

describe('CheckInAttempts - brute-force guard', () => {
  const t0 = new Date(Date.UTC(2026, 8, 29, 2, 0, 0));
  const at = (ms: number) => new Date(t0.getTime() + ms);

  it('locks a user out after too many wrong codes', () => {
    const attempts = new CheckInAttempts();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) {
      attempts.recordFailure('user-002', at(i));
    }
    expect(attempts.lockedOutFor('user-002', at(10))).toBe(0);

    attempts.recordFailure('user-002', at(20));
    expect(attempts.lockedOutFor('user-002', at(30))).toBe(LOCKOUT_WINDOW_MS - 30);
  });

  it('keeps each user separate', () => {
    const attempts = new CheckInAttempts();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      attempts.recordFailure('user-002', t0);
    }
    expect(attempts.lockedOutFor('user-005', t0)).toBe(0);
  });

  it('releases the lock when the window ends or on a correct code', () => {
    const attempts = new CheckInAttempts();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      attempts.recordFailure('user-002', t0);
    }
    expect(attempts.lockedOutFor('user-002', at(LOCKOUT_WINDOW_MS))).toBe(0);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      attempts.recordFailure('user-002', t0);
    }
    attempts.clear('user-002');
    expect(attempts.lockedOutFor('user-002', t0)).toBe(0);
  });
});
