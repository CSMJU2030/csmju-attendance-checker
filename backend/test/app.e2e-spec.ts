/**
 * End-to-end suite for the Attendance Checker (spec §36, §38, §39).
 *
 * It boots the real NestJS application - global guards, validation pipe,
 * response interceptor and exception filter included - against:
 *   - a fake Core Hub that serves ONLY a JWKS document, and
 *   - an in-memory stand-in for the subsystem database.
 *
 * The subsystem code under test is unchanged: it still downloads JWKS, selects
 * the key by `kid`, verifies RS256 signatures and enforces its own policies.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
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

const STUDENT_CORE_ID = 'user-001';
const OTHER_STAFF_CORE_ID = 'user-009';
const STAFF_CORE_ID = 'user-003';
const ADMIN_CORE_ID = 'user-004';

/** Check-in point of the seeded class section. */
const ROOM = { latitude: 18.8925, longitude: 99.0142 };

describe('Attendance Checker (e2e)', () => {
  let app: INestApplication;
  let coreHub: FakeCoreHub;
  let db: InMemoryPrisma;
  let key: TestSigningKey;
  let rotatedKey: TestSigningKey;

  let studentToken: string;
  let staffToken: string;
  let adminToken: string;
  let otherStaffToken: string;

  let sectionId: string;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    key = await createSigningKey('core-hub-2026');
    rotatedKey = await createSigningKey('core-hub-2027');

    coreHub = new FakeCoreHub();
    await coreHub.start([key]);

    // The fake Core Hub gets a random port, so these are set here - the
    // configuration factory reads them when the testing module is compiled.
    // GET /people/me: the student is linked to a person, staff accounts are not.
    coreHub.setPeople({ [STUDENT_CORE_ID]: { personCode: '6504101234', personType: 'STUDENT' } });
    process.env.CORE_HUB_URL = coreHub.url;
    process.env.CORE_HUB_JWKS_URL = coreHub.jwksUrl;

    db = new InMemoryPrisma();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
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
    adminToken = await signCoreHubToken(key, {
      sub: ADMIN_CORE_ID,
      email: 'admin@core.local',
      role: 'admin',
    });
    otherStaffToken = await signCoreHubToken(key, {
      sub: OTHER_STAFF_CORE_ID,
      email: 'staff2@core.local',
      role: 'staff',
    });
  });


  beforeEach(async () => {
    db.reset();

    const section = await db.classSection.create({
      data: {
        courseCode: 'CS201',
        courseName: 'Data Structures',
        sectionCode: '1',
        academicYear: 2026,
        term: 1,
        ...ROOM,
        ownerCoreUserId: STAFF_CORE_ID,
      },
    });
    sectionId = section.id;
  });

  afterAll(async () => {
    await app?.close();
    await coreHub?.stop();
  });

  // ---------------------------------------------------------------- health --
  describe('GET /api/health (spec §21)', () => {
    it('is public and reports the service name', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { status: 'ok', service: 'csmju-attendance-checker' },
      });
    });
  });

  // ------------------------------------------------------- authentication --
  describe('Authentication (spec §36, §39)', () => {
    it('rejects a request with no token (401)', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/me').expect(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a non-Bearer Authorization scheme (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set({ Authorization: 'Basic dXNlcjpwYXNz' })
        .expect(401);
    });

    it('rejects a malformed token (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer('not-a-jwt')).expect(401);
    });

    it('rejects an expired token (401)', async () => {
      const expired = await signCoreHubToken(key, {
        role: 'staff',
        expiresInSec: -60,
        issuedAtOffsetSec: -600,
      });
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(expired)).expect(401);
    });

    it('rejects a token signed by an attacker key (401)', async () => {
      const attackerKey = await createSigningKey('core-hub-2026');
      const forged = await signCoreHubToken(attackerKey, { role: 'admin' });
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(forged)).expect(401);
    });

    it('rejects a token whose role claim was modified after signing (401)', async () => {
      const escalated = tamperPayload(studentToken, { role: 'admin' });
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(escalated)).expect(401);
    });

    it('rejects a wrong issuer (401)', async () => {
      const token = await signCoreHubToken(key, { issuer: 'evil-hub' });
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(token)).expect(401);
    });

    it('rejects a wrong audience (401)', async () => {
      const token = await signCoreHubToken(key, { audience: 'other-platform' });
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(token)).expect(401);
    });

    it('rejects an HS256 token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(await signHs256Token()))
        .expect(401);
    });

    it('rejects an unsigned alg=none token (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(createAlgNoneToken())).expect(401);
    });

    it('rejects an unknown kid (401)', async () => {
      const unknown = await createSigningKey('core-hub-1999');
      const token = await signCoreHubToken(unknown);
      await request(app.getHttpServer()).get('/api/v1/me').set(bearer(token)).expect(401);
    });

    it('returns 403 for a Core Hub role this subsystem does not map', async () => {
      const token = await signCoreHubToken(key, { role: 'finance-officer' });
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(token))
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('never leaks a token or Authorization header in an error response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(studentToken.slice(0, -3)))
        .expect(401);

      expect(JSON.stringify(response.body)).not.toContain(studentToken.slice(0, 20));
    });
  });

  // ------------------------------------------------------------------ /me --
  describe('GET /api/v1/me (spec §22)', () => {
    it('returns the verified Core Hub identity plus the mapped subsystem role', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(staffToken))
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: STAFF_CORE_ID,
          email: 'staff@core.local',
          coreRole: 'staff',
          subsystemRole: 'STAFF',
          session: { expiresAt: expect.any(String) },
        },
      });
    });

    it.each([
      ['student', 'STUDENT'],
      ['staff', 'STAFF'],
      ['admin', 'ADMIN'],
    ])('maps core role %s to subsystem role %s', async (coreRole, subsystemRole) => {
      const token = await signCoreHubToken(key, { role: coreRole, sub: 'user-map' });
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(token))
        .expect(200);

      expect(response.body.data.subsystemRole).toBe(subsystemRole);
    });

    it('refuses alumni, who are not registered for this subsystem (403)', async () => {
      const token = await signCoreHubToken(key, { role: 'alumni', sub: 'user-alumni' });
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(token))
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });


  // -------------------------------------------------------- class sections --
  describe('Core Hub roles since standards 1.6.0', () => {
    it('lets a lecturer run class sections like staff', async () => {
      const lecturerToken = await signCoreHubToken(key, {
        sub: 'user-lecturer',
        email: 'lecturer@core.local',
        role: 'lecturer',
      });

      const me = await request(app.getHttpServer()).get('/api/v1/me').set(bearer(lecturerToken)).expect(200);
      expect(me.body.data).toMatchObject({ coreRole: 'lecturer', subsystemRole: 'STAFF' });

      await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(lecturerToken))
        .send({
          courseCode: 'CS310',
          courseName: 'Lecturer section',
          sectionCode: '1',
          academicYear: 2026,
          term: 1,
          ...ROOM,
        })
        .expect(201);
    });

    it('refuses a guest with 403 FORBIDDEN', async () => {
      const guestToken = await signCoreHubToken(key, { sub: 'user-guest', email: 'guest@core.local', role: 'guest' });

      const response = await request(app.getHttpServer()).get('/api/v1/me').set(bearer(guestToken)).expect(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Class sections', () => {
    const newSection = {
      courseCode: 'CS305',
      courseName: 'Software Engineering',
      sectionCode: '1',
      academicYear: 2026,
      term: 1,
      ...ROOM,
    };

    it('lets STAFF create a section and makes them the owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send(newSection)
        .expect(201);

      expect(response.body.data).toMatchObject({
        courseCode: 'CS305',
        ownerCoreUserId: STAFF_CORE_ID,
        radiusMeters: 50,
      });
    });

    it('denies a STUDENT creating a section (403)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(studentToken))
        .send(newSection)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects an invalid body with VALIDATION_ERROR (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send({ ...newSection, latitude: 200 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a duplicate course, section, year and term (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send({ ...newSection, courseCode: 'CS201', courseName: 'Data Structures' })
        .expect(409);
    });

    it('lists sections with pagination meta', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/class-sections')
        .set(bearer(staffToken))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('filters to sections the caller owns with ?mine=true', async () => {
      const mine = await request(app.getHttpServer())
        .get('/api/v1/class-sections?mine=true')
        .set(bearer(staffToken))
        .expect(200);
      expect(mine.body.meta.total).toBe(1);

      const others = await request(app.getHttpServer())
        .get('/api/v1/class-sections?mine=true')
        .set(bearer(otherStaffToken))
        .expect(200);
      expect(others.body.meta.total).toBe(0);
    });

    it('lets the owner delete a section with no sessions (200 + deleted:true)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send(newSection)
        .expect(201);
      const id = created.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/class-sections/${id}`)
        .set(bearer(otherStaffToken))
        .expect(403);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/class-sections/${id}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(response.body.data).toEqual({ id, deleted: true });

      await request(app.getHttpServer())
        .get(`/api/v1/class-sections/${id}`)
        .set(bearer(staffToken))
        .expect(404);
    });

    it('refuses to delete a section that has attendance history (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance-sessions')
        .set(bearer(staffToken))
        .send({ classSectionId: sectionId })
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/class-sections/${sectionId}`)
        .set(bearer(staffToken))
        .expect(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('denies a STUDENT deleting a section (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/class-sections/${sectionId}`)
        .set(bearer(studentToken))
        .expect(403);
    });
  });

  // --------------------------------------------------- attendance sessions --
  describe('Attendance sessions and check-in', () => {
    const openSession = async (token = staffToken) =>
      request(app.getHttpServer())
        .post('/api/v1/attendance-sessions')
        .set(bearer(token))
        .send({ classSectionId: sectionId });

    const checkIn = (body: Record<string, unknown>, token = studentToken) =>
      request(app.getHttpServer()).post('/api/v1/attendance-records').set(bearer(token)).send(body);

    it('opens a session for the owner, hides the secret and returns a 6-digit code', async () => {
      const response = await openSession();

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('OPEN');
      expect(response.body.data.code.code).toMatch(/^\d{6}$/);
      expect(JSON.stringify(response.body)).not.toContain('codeSecret');
    });

    it('refuses a second OPEN session for the same section (409)', async () => {
      await openSession();
      const second = await openSession();
      expect(second.status).toBe(409);
    });

    it('refuses staff who do not own the section (403) and students (403)', async () => {
      expect((await openSession(otherStaffToken)).status).toBe(403);
      expect((await openSession(studentToken)).status).toBe(403);
    });

    it('lets ADMIN read the code of a session in any section', async () => {
      const opened = await openSession();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions/${opened.body.data.id}/code`)
        .set(bearer(adminToken))
        .expect(200);

      expect(response.body.data).toMatchObject({ code: expect.stringMatching(/^\d{6}$/), stepSeconds: 120 });
    });

    it('checks a student in with the current code inside the radius', async () => {
      const opened = await openSession();
      const { code } = opened.body.data.code;

      const response = await checkIn({ code, ...ROOM, accuracyMeters: 10 });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        coreUserId: STUDENT_CORE_ID,
        personCode: '6504101234',
        status: 'PRESENT',
        distanceMeters: 0,
        classSection: { courseCode: 'CS201', sectionCode: '1' },
      });

      expect(response.body.data).not.toHaveProperty('email');
      expect(coreHub.lastPeopleAuthorization).toBe(`Bearer ${studentToken}`);

      const again = await checkIn({ code, ...ROOM });
      expect(again.status).toBe(409);
    });

    it('rejects a wrong code (400) and a student outside the radius (409)', async () => {
      const opened = await openSession();
      const { code } = opened.body.data.code;
      const wrong = code === '000000' ? '111111' : '000000';

      expect((await checkIn({ code: wrong, ...ROOM })).status).toBe(400);

      const far = await checkIn({ code, latitude: ROOM.latitude + 0.01, longitude: ROOM.longitude });
      expect(far.status).toBe(409);
      expect(far.body.error.code).toBe('CONFLICT');
    });

    it('does not let STAFF check in as a student (403)', async () => {
      const opened = await openSession();
      const response = await checkIn({ code: opened.body.data.code.code, ...ROOM }, staffToken);
      expect(response.status).toBe(403);
    });

    it('shows the owner the records and the student their own history', async () => {
      const opened = await openSession();
      const sessionId = opened.body.data.id;
      await checkIn({ code: opened.body.data.code.code, ...ROOM }).expect(201);

      const records = await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions/${sessionId}/records`)
        .set(bearer(staffToken))
        .expect(200);
      expect(records.body.data).toHaveLength(1);
      expect(records.body.meta.total).toBe(1);

      const mine = await request(app.getHttpServer())
        .get('/api/v1/attendance-records/me')
        .set(bearer(studentToken))
        .expect(200);
      expect(mine.body.data[0]).toMatchObject({ attendanceSessionId: sessionId, status: 'PRESENT' });
    });

    it('reports check-in counts on the session and a summary for the student', async () => {
      const opened = await openSession();
      const sessionId = opened.body.data.id;
      expect(opened.body.data).toMatchObject({ recordCount: 0, lateCount: 0 });
      await checkIn({ code: opened.body.data.code.code, ...ROOM }).expect(201);

      const session = await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions/${sessionId}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(session.body.data).toMatchObject({ recordCount: 1, lateCount: 0 });

      const list = await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions?classSectionId=${sectionId}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(list.body.data[0]).toMatchObject({ id: sessionId, recordCount: 1, lateCount: 0 });

      const summary = await request(app.getHttpServer())
        .get('/api/v1/attendance-records/me/summary')
        .set(bearer(studentToken))
        .expect(200);
      expect(summary.body.data).toEqual({ total: 1, present: 1, late: 0 });

      await request(app.getHttpServer())
        .get('/api/v1/attendance-records/me/summary')
        .set(bearer(staffToken))
        .expect(403);
    });

    it('stops accepting codes once the session is closed', async () => {
      const opened = await openSession();
      const sessionId = opened.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/attendance-sessions/${sessionId}/close`)
        .set(bearer(staffToken))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions/${sessionId}/code`)
        .set(bearer(staffToken))
        .expect(409);

      expect((await checkIn({ code: opened.body.data.code.code, ...ROOM })).status).toBe(400);
    });

    it('returns 404 for an unknown session and 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/attendance-sessions/99999999-9999-4999-8999-999999999999')
        .set(bearer(staffToken))
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/v1/attendance-sessions/not-a-uuid')
        .set(bearer(staffToken))
        .expect(400);
    });
  });

  // ------------------------------------------------------------- rotation --
  describe('Core Hub key rotation (spec §40)', () => {
    it('accepts a token signed with a newly rotated key after refreshing JWKS', async () => {
      coreHub.rotate([key, rotatedKey]);

      const rotatedToken = await signCoreHubToken(rotatedKey, {
        role: 'staff',
        sub: STAFF_CORE_ID,
        email: 'staff@core.local',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(rotatedToken))
        .expect(200);

      expect(response.body.data.subsystemRole).toBe('STAFF');
    });
  });

  // -------------------------------------------------------- ---- scenario --
  describe('End-to-end demo scenario (spec §38)', () => {
    it('token -> JWKS -> verification -> role mapping -> business API', async () => {
      // Step 1-2: a Core Hub RS256 token exists (issued by the fake Core Hub key).
      const token = await signCoreHubToken(key, {
        sub: STAFF_CORE_ID,
        email: 'staff@core.local',
        role: 'staff',
        sid: 'session-id',
      });

      // Step 3-4: the subsystem verifies it and recognises the user.
      const me = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(token))
        .expect(200);

      expect(me.body.data).toEqual({
        id: STAFF_CORE_ID,
        email: 'staff@core.local',
        coreRole: 'staff',
        subsystemRole: 'STAFF',
        session: { expiresAt: expect.any(String) },
      });

      // Step 5: business API with the same Core Hub token.
      const sections = await request(app.getHttpServer())
        .get('/api/v1/class-sections')
        .set(bearer(token))
        .expect(200);

      expect(sections.body.success).toBe(true);
      expect(Array.isArray(sections.body.data)).toBe(true);

      // The Core Hub was contacted only for its public keys.
      expect(coreHub.requestCount).toBeGreaterThan(0);
    });
  });
});
