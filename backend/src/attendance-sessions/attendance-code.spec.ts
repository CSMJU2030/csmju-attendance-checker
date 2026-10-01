import {
  CODE_STEP_SECONDS,
  codeForWindow,
  currentCode,
  generateCodeSecret,
  isValidCode,
  windowFor,
} from './attendance-code';

const SECRET = 'a'.repeat(64);
const STEP_MS = CODE_STEP_SECONDS * 1000;
const T0 = new Date(Date.UTC(2026, 8, 29, 2, 0, 0));

describe('Rotating attendance code', () => {
  it('is 6 digits and stable inside one 2-minute window', () => {
    const early = new Date(T0.getTime() + 1_000);
    const late = new Date(T0.getTime() + STEP_MS - 1_000);

    expect(currentCode(SECRET, early).code).toMatch(/^\d{6}$/);
    expect(currentCode(SECRET, early).code).toBe(currentCode(SECRET, late).code);
  });

  it('changes in the next window and reports when the current one expires', () => {
    const now = new Date(T0.getTime() + 1_000);
    const next = new Date(T0.getTime() + STEP_MS + 1_000);

    const code = currentCode(SECRET, now);
    expect(code.code).not.toBe(currentCode(SECRET, next).code);
    expect(code.expiresAt.getTime()).toBe((windowFor(now) + 1) * STEP_MS);
    expect(code.stepSeconds).toBe(120);
  });

  it('accepts the current code and the code of the previous window only', () => {
    const now = new Date(T0.getTime() + 2 * STEP_MS + 5_000);
    const window = windowFor(now);

    expect(isValidCode(SECRET, codeForWindow(SECRET, window), now)).toBe(true);
    expect(isValidCode(SECRET, codeForWindow(SECRET, window - 1), now)).toBe(true);
    expect(isValidCode(SECRET, codeForWindow(SECRET, window - 2), now)).toBe(false);
    expect(isValidCode(SECRET, codeForWindow(SECRET, window + 1), now)).toBe(false);
  });

  it('rejects a wrong or malformed code', () => {
    const code = currentCode(SECRET, T0).code;
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

    expect(isValidCode(SECRET, wrong, T0)).toBe(false);
    expect(isValidCode(SECRET, '12345', T0)).toBe(false);
  });

  it('gives different sessions different codes', () => {
    const other = generateCodeSecret();
    expect(other).toMatch(/^[0-9a-f]{64}$/);
    expect(currentCode(other, T0).code).not.toBe(currentCode(SECRET, T0).code);
  });
});
