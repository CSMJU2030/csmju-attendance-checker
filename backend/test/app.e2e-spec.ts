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
    const course = (code: string, nameTh: string, isActive = true) => ({
      code,
      baseCode: code,
      nameTh,
      nameEn: null,
      credits: 3,
      departmentCode: 'CS',
      isActive,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    coreHub.setCourses([
      course('CS201', 'โครงสร้างข้อมูล'),
      course('CS305', 'วิศวกรรมซอฟต์แวร์'),
      course('CS310', 'ระบบปฏิบัติการ'),
      course('CS100', 'วิชาที่ปิดแล้ว', false),
    ]);
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

    it('no longer accepts a late threshold - attendance has no "late" status', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send({ ...newSection, lateAfterMinutes: 15 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('takes only an open Core Hub course and shows its name from Core Hub', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send(newSection)
        .expect(201);
      expect(created.body.data).toMatchObject({
        courseCode: 'CS305',
        courseName: 'วิศวกรรมซอฟต์แวร์',
        courseInCatalog: true,
      });
      // The Core Hub name is shown, never stored (reference-data.md 8).
      const stored = await db.classSection.findUnique({ where: { id: created.body.data.id } });
      expect(stored?.courseName ?? null).toBeNull();

      for (const courseCode of ['NOPE999', 'CS100']) {
        const refused = await request(app.getHttpServer())
          .post('/api/v1/class-sections')
          .set(bearer(staffToken))
          .send({ ...newSection, courseCode, sectionCode: '9' })
          .expect(400);
        expect(refused.body.error.code).toBe('VALIDATION_ERROR');
      }

      await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send({ ...newSection, courseName: 'typed name' })
        .expect(400);
    });

    it('shows a section typed in before the link with its own name', async () => {
      const legacy = await db.classSection.create({
        data: {
          courseCode: 'OLD101',
          courseName: 'วิชาเดิม',
          sectionCode: '1',
          academicYear: 2026,
          term: 1,
          ...ROOM,
          ownerCoreUserId: STAFF_CORE_ID,
        },
      });
      const response = await request(app.getHttpServer())
        .get(`/api/v1/class-sections/${legacy.id}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(response.body.data).toMatchObject({ courseName: 'วิชาเดิม', courseInCatalog: false });

      const linked = await request(app.getHttpServer())
        .get(`/api/v1/class-sections/${sectionId}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(linked.body.data).toMatchObject({ courseName: 'โครงสร้างข้อมูล', courseInCatalog: true });
    });

    it('finds a section by its Core Hub course name', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/class-sections?q=${encodeURIComponent('โครงสร้าง')}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(response.body.data.map((row: { id: string }) => row.id)).toEqual([sectionId]);
    });

    it('searches open Core Hub courses for the form', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/courses?q=cs3')
        .set(bearer(staffToken))
        .expect(200);
      expect(response.body.data).toEqual([
        { code: 'CS305', nameTh: 'วิศวกรรมซอฟต์แวร์', nameEn: null, credits: 3 },
        { code: 'CS310', nameTh: 'ระบบปฏิบัติการ', nameEn: null, credits: 3 },
      ]);
      await request(app.getHttpServer()).get('/api/v1/courses').set(bearer(studentToken)).expect(403);
    });

    it('rejects a duplicate course, section, year and term (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/class-sections')
        .set(bearer(staffToken))
        .send({ ...newSection, courseCode: 'CS201' })
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
      expect(mine.body.data[0]).toMatchObject({ attendanceSessionId: sessionId });
      expect(mine.body.data[0]).not.toHaveProperty('status');
    });

    describe('GET /api/v1/attendance-records (staff search)', () => {
      const search = (query: string, token = staffToken) =>
        request(app.getHttpServer())
          .get(`/api/v1/attendance-records?classSectionId=${sectionId}${query}`)
          .set(bearer(token));

      beforeEach(async () => {
        const opened = await openSession();
        await checkIn({ code: opened.body.data.code.code, ...ROOM }).expect(201);
      });

      it('lists the section check-ins and filters by a student id prefix', async () => {
        const all = await search('').expect(200);
        expect(all.body.data).toHaveLength(1);
        expect(all.body.data[0]).toMatchObject({ personCode: '6504101234' });
        expect(all.body.meta).toMatchObject({ total: 1, page: 1 });

        expect((await search('&personCode=650410').expect(200)).body.data).toHaveLength(1);
        expect((await search('&personCode=6599').expect(200)).body.data).toHaveLength(0);
      });

      it('filters by a half-open time range', async () => {
        const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
        const hourAhead = new Date(Date.now() + 3_600_000).toISOString();

        expect((await search(`&from=${hourAgo}&to=${hourAhead}`).expect(200)).body.data).toHaveLength(1);
        expect((await search(`&to=${hourAgo}`).expect(200)).body.data).toHaveLength(0);
        expect((await search(`&from=${hourAhead}`).expect(200)).body.data).toHaveLength(0);
      });

      it('rejects bad filters with 400', async () => {
        const later = new Date(Date.now() + 3_600_000).toISOString();
        const earlier = new Date(Date.now() - 3_600_000).toISOString();

        expect((await search(`&from=${later}&to=${earlier}`)).status).toBe(400);
        expect((await search('&from=yesterday')).body.error.code).toBe('VALIDATION_ERROR');
        expect((await search('&personCode=65%25')).status).toBe(400);
        await request(app.getHttpServer())
          .get('/api/v1/attendance-records')
          .set(bearer(staffToken))
          .expect(400);
      });

      it('is limited to staff who manage the section', async () => {
        expect((await search('', otherStaffToken)).status).toBe(403);
        expect((await search('', studentToken)).status).toBe(403);
        expect((await search('', adminToken).expect(200)).body.data).toHaveLength(1);
      });

      it('returns 404 for an unknown section', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/attendance-records?classSectionId=99999999-9999-4999-8999-999999999999')
          .set(bearer(staffToken))
          .expect(404);
      });
    });

    it('reports check-in counts on the session and a summary for the student', async () => {
      const opened = await openSession();
      const sessionId = opened.body.data.id;
      expect(opened.body.data).toMatchObject({ recordCount: 0 });
      expect(opened.body.data).not.toHaveProperty('lateCount');
      await checkIn({ code: opened.body.data.code.code, ...ROOM }).expect(201);

      const session = await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions/${sessionId}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(session.body.data).toMatchObject({ recordCount: 1 });

      const list = await request(app.getHttpServer())
        .get(`/api/v1/attendance-sessions?classSectionId=${sectionId}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(list.body.data[0]).toMatchObject({ id: sessionId, recordCount: 1 });

      const summary = await request(app.getHttpServer())
        .get('/api/v1/attendance-records/me/summary')
        .set(bearer(studentToken))
        .expect(200);
      expect(summary.body.data).toEqual({ total: 1 });

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

  // --------------------------------------------------------------- roster --
  describe('Class section roster', () => {
    const roster = () => `/api/v1/class-sections/${sectionId}/students`;
    const add = (personCodes: unknown, token = staffToken) =>
      request(app.getHttpServer()).post(roster()).set(bearer(token)).send({ personCodes });
    const list = (query = '', token = staffToken) =>
      request(app.getHttpServer()).get(`${roster()}${query}`).set(bearer(token));

    it('starts empty, adds ids once each and reports the ones already there', async () => {
      expect((await list().expect(200)).body).toMatchObject({ data: [], meta: { total: 0 } });

      const first = await add(['6504101235', '6504101234', '6504101234']).expect(201);
      expect(first.body.data).toEqual({ added: 2, alreadyOnRoster: [] });

      const again = await add(['6504101234', '6504101236']).expect(201);
      expect(again.body.data).toEqual({ added: 1, alreadyOnRoster: ['6504101234'] });

      const all = await list().expect(200);
      expect(all.body.data.map((row: { personCode: string }) => row.personCode)).toEqual([
        '6504101234',
        '6504101235',
        '6504101236',
      ]);
      expect(all.body.data[0]).not.toHaveProperty('fullNameTh');
      expect((await list('?q=6504101235').expect(200)).body.meta.total).toBe(1);
    });

    it('rejects malformed ids, an empty list and more than 500 ids', async () => {
      expect((await add(['65%04'])).status).toBe(400);
      expect((await add([])).status).toBe(400);
      expect((await add('6504101234')).status).toBe(400);
      const many = Array.from({ length: 501 }, (_, index) => String(6504100000 + index));
      expect((await add(many)).status).toBe(400);
    });

    it('takes a student off the roster, and 404s for one not on it', async () => {
      await add(['6504101234']).expect(201);
      const removed = await request(app.getHttpServer())
        .delete(`${roster()}/6504101234`)
        .set(bearer(staffToken))
        .expect(200);
      expect(removed.body.data).toEqual({ personCode: '6504101234', removed: true });

      await request(app.getHttpServer()).delete(`${roster()}/6504101234`).set(bearer(staffToken)).expect(404);
      await request(app.getHttpServer()).delete(`${roster()}/65%2504`).set(bearer(staffToken)).expect(400);
    });

    it('is managed by the owner and admins only', async () => {
      expect((await list('', otherStaffToken)).status).toBe(403);
      expect((await list('', studentToken)).status).toBe(403);
      expect((await add(['6504101234'], otherStaffToken)).status).toBe(403);
      expect((await add(['6504101234'], adminToken)).status).toBe(201);
      await request(app.getHttpServer())
        .get('/api/v1/class-sections/99999999-9999-4999-8999-999999999999/students')
        .set(bearer(staffToken))
        .expect(404);
    });

    it('marks check-ins from students who are not on the roster', async () => {
      const opened = await request(app.getHttpServer())
        .post('/api/v1/attendance-sessions')
        .set(bearer(staffToken))
        .send({ classSectionId: sectionId })
        .expect(201);
      const sessionId = opened.body.data.id;
      await request(app.getHttpServer())
        .post('/api/v1/attendance-records')
        .set(bearer(studentToken))
        .send({ code: opened.body.data.code.code, ...ROOM })
        .expect(201);

      const sessionRecords = () =>
        request(app.getHttpServer())
          .get(`/api/v1/attendance-sessions/${sessionId}/records`)
          .set(bearer(staffToken))
          .expect(200);
      const sectionRecords = () =>
        request(app.getHttpServer())
          .get(`/api/v1/attendance-records?classSectionId=${sectionId}`)
          .set(bearer(staffToken))
          .expect(200);

      // No roster yet: nothing to compare against.
      expect((await sessionRecords()).body.data[0].inRoster).toBeNull();

      await add(['6599999999']).expect(201);
      expect((await sessionRecords()).body.data[0].inRoster).toBe(false);
      expect((await sectionRecords()).body.data[0].inRoster).toBe(false);

      await add(['6504101234']).expect(201);
      expect((await sessionRecords()).body.data[0].inRoster).toBe(true);
      expect((await sectionRecords()).body.data[0].inRoster).toBe(true);
    });
  });

  // ------------------------------------------------------------ directory --
  describe('Student directory from Core Hub', () => {
    beforeAll(() => {
      const student = (personCode: string, departmentCode: string, entryYear: number, status = 'ACTIVE') => ({
        personCode,
        personType: 'STUDENT',
        fullNameTh: `นักศึกษา ${personCode}`,
        universityEmail: `${personCode}@example.test`,
        entryYear,
        status,
        faculty: { code: 'SCI', nameTh: 'คณะวิทยาศาสตร์' },
        department: { code: departmentCode, nameTh: `สาขา ${departmentCode}` },
      });
      coreHub.setDirectory([
        student('6604100001', 'CS', 2566),
        student('6604100002', 'CS', 2566),
        student('6704100003', 'CS', 2567),
        student('6604200004', 'IT', 2566),
        student('6504100005', 'CS', 2566, 'GRADUATED'),
        { personCode: 'lecturer.a', personType: 'STAFF', fullNameTh: 'อาจารย์ เอ', status: 'ACTIVE' },
      ]);
      coreHub.setDepartments([
        { code: 'IT', nameTh: 'เทคโนโลยีสารสนเทศ', nameEn: null, facultyCode: 'SCI', isActive: true, updatedAt: '2026-01-01' },
        { code: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์', nameEn: null, facultyCode: 'SCI', isActive: true, updatedAt: '2026-01-01' },
        { code: 'OLD', nameTh: 'ปิดแล้ว', nameEn: null, facultyCode: 'SCI', isActive: false, updatedAt: '2026-01-01' },
      ]);
    });

    it('lists active students of a department and entry year, without e-mail', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/people?departmentCode=CS&entryYear=2566')
        .set(bearer(staffToken))
        .expect(200);

      expect(response.body.data.map((row: { personCode: string }) => row.personCode)).toEqual([
        '6604100001',
        '6604100002',
      ]);
      expect(response.body.data[0]).toEqual({
        personCode: '6604100001',
        fullNameTh: 'นักศึกษา 6604100001',
        entryYear: 2566,
        departmentCode: 'CS',
        departmentNameTh: 'สาขา CS',
      });
      expect(response.body.meta).toMatchObject({ total: 2, page: 1, limit: 100 });
      expect(response.headers['cache-control'] ?? '').not.toContain('public');

      const forwarded = new URLSearchParams(coreHub.peopleListQueries.at(-1));
      expect(Object.fromEntries(forwarded)).toEqual({
        personType: 'STUDENT',
        status: 'ACTIVE',
        page: '1',
        limit: '100',
        departmentCode: 'CS',
        entryYear: '2566',
      });
    });

    it('lists open departments sorted by code', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/departments')
        .set(bearer(staffToken))
        .expect(200);
      expect(response.body.data).toEqual([
        { code: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์', facultyCode: 'SCI' },
        { code: 'IT', nameTh: 'เทคโนโลยีสารสนเทศ', facultyCode: 'SCI' },
      ]);
    });

    it('is for staff only and validates the filters', async () => {
      await request(app.getHttpServer()).get('/api/v1/people').set(bearer(studentToken)).expect(403);
      await request(app.getHttpServer()).get('/api/v1/departments').set(bearer(studentToken)).expect(403);
      await request(app.getHttpServer()).get('/api/v1/people?entryYear=66').set(bearer(staffToken)).expect(400);
      await request(app.getHttpServer()).get('/api/v1/people?limit=500').set(bearer(staffToken)).expect(400);
    });
  });

  // ---------------------------------------------------------------- stats --
  describe('Attendance statistics and the at-risk group', () => {
    const get = (path: string, token = staffToken) =>
      request(app.getHttpServer()).get(`/api/v1/attendance-stats${path}`).set(bearer(token));

    beforeEach(async () => {
      // Four closed sessions; a fifth is still open and must not count.
      const ids: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const session = await db.attendanceSession.create({
          data: { classSectionId: sectionId, openedByCoreUserId: STAFF_CORE_ID, codeSecret: 'x', status: 'CLOSED' },
        });
        ids.push(session.id);
      }
      const open = await db.attendanceSession.create({
        data: { classSectionId: sectionId, openedByCoreUserId: STAFF_CORE_ID, codeSecret: 'y', status: 'OPEN' },
      });
      const checkIn = (sessionId: string, personCode: string) =>
        db.attendanceRecord.create({
          data: { attendanceSessionId: sessionId, coreUserId: `user-${personCode}`, personCode, distanceMeters: 1 },
        });
      for (const id of ids) await checkIn(id, '6500000001');
      await checkIn(ids[0], '6500000002');
      await checkIn(ids[1], '6500000002');
      await checkIn(open.id, '6500000002');
      await checkIn(ids[3], '6599999999');
      for (const personCode of ['6500000001', '6500000002', '6500000003']) {
        await db.classSectionStudent.create({
          data: { classSectionId: sectionId, personCode, addedByCoreUserId: STAFF_CORE_ID },
        });
      }
    });

    it('lists every roster student, at-risk ones first, from closed sessions only', async () => {
      const response = await get(`/sections/${sectionId}`).expect(200);
      expect(response.body.data).toMatchObject({
        courseCode: 'CS201',
        courseName: 'โครงสร้างข้อมูล',
        closedSessions: 4,
        studentSource: 'ROSTER',
        studentCount: 3,
        attendanceRate: 6 / 12,
        atRiskCount: 2,
        offRosterCount: 1,
      });
      expect(response.body.data.students).toEqual([
        { personCode: '6500000003', attended: 0, absent: 4, absenceRate: 1, atRisk: true },
        { personCode: '6500000002', attended: 2, absent: 2, absenceRate: 0.5, atRisk: true },
        { personCode: '6500000001', attended: 4, absent: 0, absenceRate: 0, atRisk: false },
      ]);
    });

    it('gives per-section numbers and a summary for the caller sections', async () => {
      const sections = await get('/sections').expect(200);
      expect(sections.body.data).toHaveLength(1);
      expect(sections.body.data[0]).toMatchObject({ classSectionId: sectionId, atRiskCount: 2 });
      expect(sections.body.meta).toMatchObject({ total: 1 });

      const summary = await get('/summary').expect(200);
      expect(summary.body.data).toEqual({
        sections: 1,
        closedSessions: 4,
        students: 3,
        attendanceRate: 0.5,
        atRiskStudents: 2,
      });
    });

    it('lists at-risk students across the caller sections for the export and the alert', async () => {
      const response = await get('/at-risk').expect(200);
      expect(response.body.data.map((row: { personCode: string }) => row.personCode)).toEqual([
        '6500000003',
        '6500000002',
      ]);
      expect(response.body.data[0]).toMatchObject({
        classSectionId: sectionId,
        courseCode: 'CS201',
        courseName: 'โครงสร้างข้อมูล',
        closedSessions: 4,
        absent: 4,
      });
      expect((await get('/at-risk', otherStaffToken).expect(200)).body.data).toEqual([]);
      await get('/at-risk', studentToken).expect(403);
    });

    it('shows another lecturer nothing of this section, ADMIN everything, students nothing', async () => {
      expect((await get('/sections', otherStaffToken).expect(200)).body.data).toEqual([]);
      expect((await get('/summary', otherStaffToken).expect(200)).body.data.sections).toBe(0);
      await get(`/sections/${sectionId}`, otherStaffToken).expect(403);

      expect((await get('/sections', adminToken).expect(200)).body.data).toHaveLength(1);
      await get(`/sections/${sectionId}`, adminToken).expect(200);

      await get('/summary', studentToken).expect(403);
      await get(`/sections/${sectionId}`, studentToken).expect(403);
      await get('/sections/99999999-9999-4999-8999-999999999999').expect(404);
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
