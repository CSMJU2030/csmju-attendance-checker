/**
 * Counts wrong codes per user so a 6-digit code cannot be guessed by brute
 * force. State is per process: with several backend instances each instance
 * keeps its own count, which still caps guessing far below the 10^6 codes.
 */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 10 * 60 * 1000;

interface Attempts {
  failures: number;
  firstFailureAt: number;
}

export class CheckInAttempts {
  private readonly byUser = new Map<string, Attempts>();

  /** Milliseconds until the user may try again, or 0 when not locked out. */
  lockedOutFor(coreUserId: string, now: Date): number {
    const attempts = this.current(coreUserId, now);
    if (!attempts || attempts.failures < MAX_FAILED_ATTEMPTS) {
      return 0;
    }
    return attempts.firstFailureAt + LOCKOUT_WINDOW_MS - now.getTime();
  }

  recordFailure(coreUserId: string, now: Date): void {
    const attempts = this.current(coreUserId, now);
    if (attempts) {
      attempts.failures += 1;
    } else {
      this.byUser.set(coreUserId, { failures: 1, firstFailureAt: now.getTime() });
    }
  }

  clear(coreUserId: string): void {
    this.byUser.delete(coreUserId);
  }

  private current(coreUserId: string, now: Date): Attempts | undefined {
    const attempts = this.byUser.get(coreUserId);
    if (attempts && now.getTime() - attempts.firstFailureAt >= LOCKOUT_WINDOW_MS) {
      this.byUser.delete(coreUserId);
      return undefined;
    }
    return attempts;
  }
}
