import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Rotating 6-digit attendance code (HOTP, RFC 4226, over a time counter).
 *
 * Each session has a random secret. The code for a moment is derived from
 * that secret and the 2-minute window the moment falls in, so the code changes
 * every window without a timer and without storing any code in the database.
 */
export const CODE_STEP_SECONDS = 120;
export const CODE_DIGITS = 6;

/**
 * A code stays accepted for one extra window, so a student who reads the code
 * just before it rotates can still submit it.
 */
const ACCEPTED_PAST_WINDOWS = 1;

export function generateCodeSecret(): string {
  return randomBytes(32).toString('hex');
}

export function windowFor(now: Date): number {
  return Math.floor(now.getTime() / 1000 / CODE_STEP_SECONDS);
}

export function codeForWindow(secret: string, window: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(window));

  const digest = createHmac('sha256', Buffer.from(secret, 'hex')).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, '0');
}

export interface CurrentCode {
  code: string;
  expiresAt: Date;
  stepSeconds: number;
}

export function currentCode(secret: string, now: Date): CurrentCode {
  const window = windowFor(now);
  return {
    code: codeForWindow(secret, window),
    expiresAt: new Date((window + 1) * CODE_STEP_SECONDS * 1000),
    stepSeconds: CODE_STEP_SECONDS,
  };
}

export function isValidCode(secret: string, candidate: string, now: Date): boolean {
  const window = windowFor(now);
  const submitted = Buffer.from(candidate);
  let valid = false;

  // Check every accepted window without returning early, to keep timing flat.
  for (let past = 0; past <= ACCEPTED_PAST_WINDOWS; past += 1) {
    const expected = Buffer.from(codeForWindow(secret, window - past));
    if (expected.length === submitted.length && timingSafeEqual(expected, submitted)) {
      valid = true;
    }
  }

  return valid;
}
