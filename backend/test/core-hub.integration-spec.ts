/**
 * REAL integration test (spec §37).
 *
 *   1. Login to the running Core Hub
 *   2. Receive an RS256 access_token
 *   3. Call the running Demo Subsystem with it
 *   4. The subsystem downloads the Core Hub JWKS
 *   5. The subsystem verifies the token
 *   6. The subsystem maps the Core role to a subsystem role
 *   7. The protected API returns 200
 *
 * Run it with both services up:
 *
 *   CORE_HUB_URL=http://localhost:3000 \
 *   DEMO_SUBSYSTEM_URL=http://localhost:3001 \
 *   CORE_HUB_TEST_EMAIL=staff@core.local \
 *   CORE_HUB_TEST_PASSWORD=<password> \
 *   npm run test:integration
 *
 * Without those variables the suite skips instead of failing, so `npm test`
 * stays green on a machine that has no Core Hub running.
 */
import { decodeJwt, decodeProtectedHeader } from 'jose';

const CORE_HUB_URL = process.env.CORE_HUB_URL ?? '';
const DEMO_URL = process.env.DEMO_SUBSYSTEM_URL ?? 'http://localhost:3002';
const EMAIL = process.env.CORE_HUB_TEST_EMAIL ?? '';
const PASSWORD = process.env.CORE_HUB_TEST_PASSWORD ?? '';
const PRESET_TOKEN = process.env.CORE_HUB_ACCESS_TOKEN ?? '';

const canRun = Boolean(CORE_HUB_URL && ((EMAIL && PASSWORD) || PRESET_TOKEN));
const describeIntegration = canRun ? describe : describe.skip;

if (!canRun) {
  console.warn(
    '[integration] skipped: set CORE_HUB_URL and CORE_HUB_TEST_EMAIL/CORE_HUB_TEST_PASSWORD ' +
      '(or CORE_HUB_ACCESS_TOKEN) to run the real Core Hub integration test.',
  );
}

async function loginToCoreHub(): Promise<string> {
  if (PRESET_TOKEN) {
    return PRESET_TOKEN;
  }

  const response = await fetch(`${CORE_HUB_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Core Hub login failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as Record<string, any>;
  const token = body.access_token ?? body.data?.access_token;

  if (typeof token !== 'string') {
    throw new Error('Core Hub login response did not contain an access_token');
  }

  return token;
}

describeIntegration('Core Hub -> Demo Subsystem integration (spec §37, §38)', () => {
  let accessToken: string;

  beforeAll(async () => {
    accessToken = await loginToCoreHub();
  });

  it('Step 1-2: the Core Hub issues an RS256 token matching the fixed contract', () => {
    const header = decodeProtectedHeader(accessToken);
    const payload = decodeJwt(accessToken);

    expect(header.alg).toBe('RS256');
    expect(header.kid).toBeTruthy();
    expect(payload.iss).toBe(process.env.CORE_HUB_ISSUER ?? 'core-hub');
    expect(payload.aud).toBe(process.env.CORE_HUB_AUDIENCE ?? 'csmju2030');
    expect(payload.sub).toBeTruthy();
    expect(payload.role).toBeTruthy();
  });

  it('the Core Hub publishes a JWKS containing the token key id (public material only)', async () => {
    const jwksUrl =
      process.env.CORE_HUB_JWKS_URL ?? `${CORE_HUB_URL}/api/v1/.well-known/jwks.json`;
    const response = await fetch(jwksUrl);
    expect(response.ok).toBe(true);

    // RFC 7517: the JWKS document must be `{ "keys": [...] }` at the top level,
    // with no API envelope around it.
    const body = (await response.json()) as {
      keys?: Array<Record<string, unknown>>;
    };
    const header = decodeProtectedHeader(accessToken);

    const keys = body.keys ?? [];

    expect(Array.isArray(body.keys)).toBe(true);
    expect(keys.some((jwk) => jwk.kid === header.kid)).toBe(true);
    // A public JWKS must never expose private RSA parameters.
    expect(keys.every((jwk) => jwk.d === undefined)).toBe(true);
  });

  it('the Demo Subsystem health endpoint is public', async () => {
    const response = await fetch(`${DEMO_URL}/api/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, any>;
    expect(body.data.status).toBe('ok');
  });

  it('Step 3-6: the subsystem verifies the Core Hub token and maps the role', async () => {
    const response = await fetch(`${DEMO_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, any>;
    const payload = decodeJwt(accessToken);

    expect(body.success).toBe(true);
    expect(body.data.id).toBe(payload.sub);
    expect(body.data.coreRole).toBe(payload.role);
    expect(body.data.subsystemRole).toBe(String(payload.role).toUpperCase());
  });

  // Step 7 reads class sections, so CORE_HUB_TEST_EMAIL must be a staff or admin account.
  it('Step 7: a protected business API returns 200 with the same token', async () => {
    const response = await fetch(`${DEMO_URL}/api/v1/class-sections`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, any>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('rejects the same request without a token (401)', async () => {
    const response = await fetch(`${DEMO_URL}/api/v1/class-sections`);
    expect(response.status).toBe(401);
  });

  // ------------------------------------------------------------ central SSO --
  describe('Central SSO + callback_url', () => {
    const SUBSYSTEM = process.env.SSO_SUBSYSTEM ?? 'csmju-attendance-checker';

    const authorize = (query: string, token = accessToken) =>
      fetch(`${CORE_HUB_URL}/api/v1/auth/sso/authorize?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        redirect: 'manual',
      });

    it('redirects to the callback URL registered in the Subsystem Registry', async () => {
      const response = await authorize(`subsystem=${SUBSYSTEM}`);

      expect(response.status).toBe(302);

      const location = response.headers.get('location') ?? '';
      const redirect = new URL(location);

      expect(`${redirect.origin}${redirect.pathname}`).toBe(`${DEMO_URL}/auth/callback`);
      expect(redirect.searchParams.get('access_token')).toBeTruthy();
      expect(redirect.searchParams.get('token_type')).toBe('Bearer');
    });

    it('hands the user to the subsystem, which verifies the token via JWKS', async () => {
      const handoff = await authorize(`subsystem=${SUBSYSTEM}&state=integration-1`);
      const location = handoff.headers.get('location') as string;

      const response = await fetch(location, { redirect: 'manual' });

      expect(response.status).toBe(200);

      const body = (await response.json()) as Record<string, any>;
      const payload = decodeJwt(accessToken);

      expect(body.success).toBe(true);
      expect(body.data.id).toBe(payload.sub);
      expect(body.data.subsystemRole).toBe(String(payload.role).toUpperCase());
      expect(body.data.state).toBe('integration-1');
      expect(response.headers.get('set-cookie') ?? '').toContain('core_hub_access_token=');
    });

    it('reaches the subsystem without a second login (SSO cookie only)', async () => {
      const handoff = await authorize(`subsystem=${SUBSYSTEM}`);
      const callback = await fetch(handoff.headers.get('location') as string, {
        redirect: 'manual',
      });

      const setCookie = callback.headers.get('set-cookie') ?? '';
      const cookie = setCookie.split(';')[0];

      const me = await fetch(`${DEMO_URL}/api/v1/me`, { headers: { cookie } });

      expect(me.status).toBe(200);

      const body = (await me.json()) as Record<string, any>;

      expect(body.data.id).toBe(decodeJwt(accessToken).sub);
    });

    it('rejects an unauthenticated SSO request (401)', async () => {
      const response = await authorize(`subsystem=${SUBSYSTEM}`, '');

      expect(response.status).toBe(401);
    });

    it('rejects an unknown subsystem (404)', async () => {
      const response = await authorize('subsystem=does-not-exist-subsystem');

      expect(response.status).toBe(404);
    });

    it('rejects a callback URL that is not registered (400)', async () => {
      const response = await authorize(
        `subsystem=${SUBSYSTEM}&callback_url=${encodeURIComponent('https://evil.example.com/steal')}`,
      );

      expect(response.status).toBe(400);
    });
  });

  it('rejects a tampered token (401)', async () => {
    const [header, payload, signature] = accessToken.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const tampered = `${header}.${Buffer.from(
      JSON.stringify({ ...decoded, role: 'admin' }),
    ).toString('base64url')}.${signature}`;

    const response = await fetch(`${DEMO_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${tampered}` },
    });

    expect(response.status).toBe(401);
  });
});
