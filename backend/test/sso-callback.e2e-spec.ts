/**
 * Central SSO + callback_url - subsystem side (e2e).
 *
 * Core Hub redirects an authenticated user to the callback URL registered in
 * the Subsystem Registry:
 *
 *   GET /auth/callback?access_token=<Core Hub RS256 JWT>&token_type=Bearer&...
 *
 * The subsystem verifies that token through the *existing* JWKS chain and
 * establishes a browser context (HttpOnly cookie) so the user reaches the
 * subsystem's own APIs without a second login.
 *
 * Runs against a fake Core Hub that serves only a JWKS document and an
 * in-memory database double - no PostgreSQL required.
 */
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SSO_COOKIE_NAME } from '../src/auth/sso-session';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeCoreHub } from './helpers/fake-core-hub';
import { InMemoryPrisma } from './helpers/in-memory-prisma';
import {
  TestSigningKey,
  createAlgNoneToken,
  createSigningKey,
  signCoreHubToken,
  signHs256Token,
  tamperPayload,
} from './helpers/token-factory';

const STUDENT_CORE_ID = 'user-002';
const STAFF_CORE_ID = 'user-003';

describe('Central SSO callback (e2e)', () => {
  let app: INestApplication;
  let coreHub: FakeCoreHub;
  let db: InMemoryPrisma;
  let key: TestSigningKey;

  let studentToken: string;
  let staffToken: string;

  const cookiesOf = (response: request.Response): string[] => {
    const raw = response.headers['set-cookie'];
    return Array.isArray(raw) ? raw : raw ? [raw as unknown as string] : [];
  };

  const ssoCookie = (response: request.Response): string => {
    const cookie = cookiesOf(response).find((entry) =>
      entry.startsWith(`${SSO_COOKIE_NAME}=`),
    );
    return cookie ?? '';
  };

  beforeAll(async () => {
    key = await createSigningKey('core-hub-2026');

    coreHub = new FakeCoreHub();
    await coreHub.start([key]);

    process.env.CORE_HUB_URL = coreHub.url;
    process.env.CORE_HUB_JWKS_URL = coreHub.jwksUrl;

    db = new InMemoryPrisma();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();

    app = moduleRef.createNestApplication();

    // identical to src/main.ts
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'auth/callback', method: RequestMethod.GET }],
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    studentToken = await signCoreHubToken(key, {
      sub: STUDENT_CORE_ID,
      email: 'student@core.local',
      role: 'student',
    });
    staffToken = await signCoreHubToken(key, {
      sub: STAFF_CORE_ID,
      email: 'staff@core.local',
      role: 'staff',
    });
  });

  beforeEach(async () => {
    db.reset();

    await db.student.create({
      data: {
        coreUserId: STUDENT_CORE_ID,
        studentCode: 'CS67002',
        firstName: 'Suda',
        lastName: 'Rakdee',
        email: 'cs67002@student.csmju.local',
        faculty: 'Science',
        major: 'Computer Science',
        year: 2,
      },
    });
    await db.course.create({
      data: { courseCode: 'CS101', name: 'Introduction to Programming', credits: 3 },
    });
  });

  afterAll(async () => {
    await app?.close();
    await coreHub?.stop();
  });

  // --------------------------------------------------------------- success --
  describe('successful handoff', () => {
    it('verifies the Core Hub token and returns the mapped identity', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: staffToken, token_type: 'Bearer', expires_in: '900' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: STAFF_CORE_ID,
        email: 'staff@core.local',
        coreRole: 'staff',
        subsystemRole: 'STAFF',
        session: { source: 'core-hub-sso' },
      });
      expect(response.body.data.session.expiresIn).toBeGreaterThan(0);
    });

    it('sets an HttpOnly SameSite=Lax session cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: studentToken })
        .expect(200);

      const cookie = ssoCookie(response);
      expect(cookie).toContain(`${SSO_COOKIE_NAME}=`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toMatch(/Max-Age=\d+/);
    });

    it('echoes the state parameter back', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: staffToken, state: 'nonce-123' })
        .expect(200);

      expect(response.body.data.state).toBe('nonce-123');
    });

    it('accepts the callback without optional Core Hub parameters', async () => {
      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: staffToken })
        .expect(200);
    });
  });

  // ------------------------------------------------- authenticated context --
  describe('authenticated context after SSO (no second login)', () => {
    it('lets the SSO cookie alone reach /api/v1/me', async () => {
      const callback = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: studentToken })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Cookie', ssoCookie(callback))
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: STUDENT_CORE_ID,
        coreRole: 'student',
        subsystemRole: 'STUDENT',
      });
    });

    it('lets the SSO cookie reach a business API', async () => {
      const callback = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: studentToken })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/courses')
        .set('Cookie', ssoCookie(callback))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('still enforces subsystem authorization for a cookie session', async () => {
      const callback = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: studentToken })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', ssoCookie(callback))
        .send({ courseCode: 'CS999', name: 'Nope', credits: 3 })
        .expect(403);
    });

    it('prefers the Authorization header over the cookie', async () => {
      const callback = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: studentToken })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Cookie', ssoCookie(callback))
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.data.subsystemRole).toBe('STAFF');
    });

    it('rejects a forged cookie value (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Cookie', `${SSO_COOKIE_NAME}=not-a-jwt`)
        .expect(401);
    });

    it('rejects a cookie holding a tampered token (401)', async () => {
      const escalated = tamperPayload(studentToken, { role: 'admin' });

      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Cookie', `${SSO_COOKIE_NAME}=${escalated}`)
        .expect(401);
    });
  });

  // --------------------------------------------------------------- failures --
  describe('rejected handoffs', () => {
    it('rejects a callback without a token (400)', async () => {
      const response = await request(app.getHttpServer()).get('/auth/callback').expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(ssoCookie(response)).toBe('');
    });

    it('rejects a tampered token and sets no cookie (401)', async () => {
      const escalated = tamperPayload(studentToken, { role: 'admin' });

      const response = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: escalated })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(ssoCookie(response)).toBe('');
    });

    it('rejects an expired token (401)', async () => {
      const expired = await signCoreHubToken(key, {
        role: 'staff',
        expiresInSec: -60,
        issuedAtOffsetSec: -600,
      });

      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: expired })
        .expect(401);
    });

    it('rejects an HS256 token (401)', async () => {
      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: await signHs256Token() })
        .expect(401);
    });

    it('rejects an unsigned alg=none token (401)', async () => {
      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: createAlgNoneToken() })
        .expect(401);
    });

    it('rejects a token signed by an unknown key id (401)', async () => {
      const rogue = await createSigningKey('core-hub-1999');

      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: await signCoreHubToken(rogue) })
        .expect(401);
    });

    it('rejects a wrong issuer (401)', async () => {
      const token = await signCoreHubToken(key, { issuer: 'evil-hub' });

      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: token })
        .expect(401);
    });

    it('returns 403 for a Core Hub role this subsystem does not map', async () => {
      const token = await signCoreHubToken(key, { role: 'finance-officer' });

      const response = await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: token })
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(ssoCookie(response)).toBe('');
    });

    it('rejects unknown query parameters (400)', async () => {
      await request(app.getHttpServer())
        .get('/auth/callback')
        .query({ access_token: staffToken, role: 'admin' })
        .expect(400);
    });
  });

  // ----------------------------------------------------------------- route --
  describe('route placement', () => {
    it('serves the callback at the registered root path, not under /api', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/callback')
        .query({ access_token: staffToken })
        .expect(404);
    });
  });
});
