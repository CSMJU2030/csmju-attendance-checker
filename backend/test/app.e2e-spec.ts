/**
 * End-to-end suite for the Demo Subsystem (spec §36, §38, §39).
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
const OTHER_STUDENT_CORE_ID = 'user-002';
const STAFF_CORE_ID = 'user-003';
const ADMIN_CORE_ID = 'user-004';

describe('Demo Subsystem (e2e)', () => {
  let app: INestApplication;
  let coreHub: FakeCoreHub;
  let db: InMemoryPrisma;
  let key: TestSigningKey;
  let rotatedKey: TestSigningKey;

  let studentToken: string;
  let staffToken: string;
  let adminToken: string;

  let ownStudentId: string;
  let otherStudentId: string;
  let courseId: string;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    key = await createSigningKey('core-hub-2026');
    rotatedKey = await createSigningKey('core-hub-2027');

    coreHub = new FakeCoreHub();
    await coreHub.start([key]);

    // The fake Core Hub gets a random port, so these are set here - the
    // configuration factory reads them when the testing module is compiled.
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
  });

  beforeEach(async () => {
    db.reset();

    const own = await db.student.create({
      data: {
        coreUserId: STUDENT_CORE_ID,
        studentCode: 'CS67001',
        firstName: 'Somchai',
        lastName: 'Jaidee',
        email: 'cs67001@student.csmju.local',
        faculty: 'Science',
        major: 'Computer Science',
        year: 3,
      },
    });
    const other = await db.student.create({
      data: {
        coreUserId: OTHER_STUDENT_CORE_ID,
        studentCode: 'CS67002',
        firstName: 'Suda',
        lastName: 'Rakdee',
        email: 'cs67002@student.csmju.local',
        faculty: 'Science',
        major: 'Computer Science',
        year: 2,
      },
    });
    const course = await db.course.create({
      data: { courseCode: 'CS101', name: 'Introduction to Programming', credits: 3 },
    });

    ownStudentId = own.id;
    otherStudentId = other.id;
    courseId = course.id;
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
        data: { status: 'ok', service: 'student-service' },
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
        },
      });
    });

    it.each([
      ['student', 'STUDENT'],
      ['staff', 'STAFF'],
      ['admin', 'ADMIN'],
      ['alumni', 'ALUMNI'],
    ])('maps core role %s to subsystem role %s', async (coreRole, subsystemRole) => {
      const token = await signCoreHubToken(key, { role: coreRole, sub: 'user-map' });
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set(bearer(token))
        .expect(200);

      expect(response.body.data.subsystemRole).toBe(subsystemRole);
    });
  });

  // -------------------------------------------------------------- students --
  describe('Student APIs (spec §23)', () => {
    it('lets a STUDENT read their own profile', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/students/${ownStudentId}`)
        .set(bearer(studentToken))
        .expect(200);

      expect(response.body.data.studentCode).toBe('CS67001');
    });

    it("denies a STUDENT reading another student's profile (403)", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/students/${otherStudentId}`)
        .set(bearer(studentToken))
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('scopes the student list to the caller for a STUDENT', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set(bearer(studentToken))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].coreUserId).toBe(STUDENT_CORE_ID);
      expect(response.body.meta).toMatchObject({ total: 1, page: 1 });
    });

    it('lets STAFF read every student', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set(bearer(staffToken))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
    });

    it('denies a STUDENT creating a student record (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students')
        .set(bearer(studentToken))
        .send({
          studentCode: 'CS67009',
          firstName: 'Fake',
          lastName: 'Person',
          email: 'fake@student.csmju.local',
          faculty: 'Science',
          major: 'CS',
          year: 1,
        })
        .expect(403);
    });

    it('lets STAFF create a student record (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/students')
        .set(bearer(staffToken))
        .send({
          studentCode: 'CS67004',
          firstName: 'Nida',
          lastName: 'Suk',
          email: 'cs67004@student.csmju.local',
          faculty: 'Science',
          major: 'Computer Science',
          year: 1,
        })
        .expect(201);

      expect(response.body.data.studentCode).toBe('CS67004');
    });

    it('rejects a duplicate student code (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students')
        .set(bearer(staffToken))
        .send({
          studentCode: 'CS67001',
          firstName: 'Dup',
          lastName: 'Licate',
          email: 'dup@student.csmju.local',
          faculty: 'Science',
          major: 'CS',
          year: 1,
        })
        .expect(409);
    });

    it('rejects an invalid request body (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/students')
        .set(bearer(staffToken))
        .send({ studentCode: 'nope', firstName: '', year: 99 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('ignores identity fields smuggled in the request body', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/students/${otherStudentId}`)
        .set(bearer(studentToken))
        .send({ firstName: 'Hacked', role: 'admin', userId: STAFF_CORE_ID })
        .expect(400); // forbidNonWhitelisted rejects the unknown identity fields
    });

    it("denies a STUDENT updating another student's profile (403)", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/students/${otherStudentId}`)
        .set(bearer(studentToken))
        .send({ firstName: 'Hacked' })
        .expect(403);
    });

    it('lets a STUDENT update their own contact details', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/students/${ownStudentId}`)
        .set(bearer(studentToken))
        .send({ firstName: 'Somsak' })
        .expect(200);

      expect(response.body.data.firstName).toBe('Somsak');
    });

    it('stops a STUDENT changing their own academic year (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/students/${ownStudentId}`)
        .set(bearer(studentToken))
        .send({ year: 4 })
        .expect(403);
    });

    it('lets ADMIN update any student', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/students/${otherStudentId}`)
        .set(bearer(adminToken))
        .send({ year: 4 })
        .expect(200);
    });
  });

  // --------------------------------------------------------------- courses --
  describe('Course APIs (spec §24)', () => {
    it('lets any authenticated role read courses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/courses')
        .set(bearer(studentToken))
        .expect(200);

      expect(response.body).toMatchObject({ success: true });
      expect(response.body.data).toHaveLength(1);
    });

    it('denies a STUDENT creating a course (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set(bearer(studentToken))
        .send({ courseCode: 'CS999', name: 'Hacking 101', credits: 3 })
        .expect(403);
    });

    it('lets STAFF create a course (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set(bearer(staffToken))
        .send({ courseCode: 'CS201', name: 'Data Structures', credits: 3 })
        .expect(201);

      expect(response.body.data.courseCode).toBe('CS201');
    });

    it('rejects a duplicate course code (409)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set(bearer(staffToken))
        .send({ courseCode: 'CS101', name: 'Duplicate', credits: 3 })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('denies STAFF deleting a course but allows ADMIN', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/courses/${courseId}`)
        .set(bearer(staffToken))
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/courses/${courseId}`)
        .set(bearer(adminToken))
        .expect(200);
    });

    it('returns 404 for a missing course', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/courses/99999999-9999-4999-8999-999999999999')
        .set(bearer(staffToken))
        .expect(404);
    });
  });

  // ----------------------------------------------------------- enrollments --
  describe('Enrollment APIs (spec §25, §26)', () => {
    it('lets a STUDENT enroll themselves (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: ownStudentId, courseId })
        .expect(201);

      expect(response.body.data.status).toBe('ENROLLED');
    });

    it('denies a STUDENT enrolling another student (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: otherStudentId, courseId })
        .expect(403);
    });

    it('rejects a duplicate active enrollment (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: ownStudentId, courseId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: ownStudentId, courseId })
        .expect(409);
    });

    it('rejects an enrollment for a non-existent course (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(staffToken))
        .send({ studentId: ownStudentId, courseId: '99999999-9999-4999-8999-999999999999' })
        .expect(400);
    });

    it('rejects an enrollment for a non-existent student (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(staffToken))
        .send({ studentId: '99999999-9999-4999-8999-999999999999', courseId })
        .expect(400);
    });

    it('lets a STUDENT drop but not complete their own enrollment', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: ownStudentId, courseId })
        .expect(201);

      const enrollmentId = created.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/enrollments/${enrollmentId}`)
        .set(bearer(studentToken))
        .send({ status: 'COMPLETED' })
        .expect(403);

      const dropped = await request(app.getHttpServer())
        .patch(`/api/v1/enrollments/${enrollmentId}`)
        .set(bearer(studentToken))
        .send({ status: 'DROPPED' })
        .expect(200);

      expect(dropped.body.data.status).toBe('DROPPED');
    });

    it('reactivates a dropped enrollment instead of creating a duplicate', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: ownStudentId, courseId })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/enrollments/${created.body.data.id}`)
        .set(bearer(studentToken))
        .send({ status: 'DROPPED' })
        .expect(200);

      const again = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(studentToken))
        .send({ studentId: ownStudentId, courseId })
        .expect(201);

      expect(again.body.data.id).toBe(created.body.data.id);
      expect(db.enrollment.rows).toHaveLength(1);
    });

    it('shows a STUDENT only their own enrollments even when filtering by another id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(staffToken))
        .send({ studentId: otherStudentId, courseId })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/enrollments?studentId=${otherStudentId}`)
        .set(bearer(studentToken))
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('denies an ALUMNI creating an enrollment (403)', async () => {
      const alumniToken = await signCoreHubToken(key, {
        role: 'alumni',
        sub: OTHER_STUDENT_CORE_ID,
      });

      await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set(bearer(alumniToken))
        .send({ studentId: otherStudentId, courseId })
        .expect(403);
    });

    it('denies a Core Hub user with no linked student record (403)', async () => {
      const orphanToken = await signCoreHubToken(key, { role: 'student', sub: 'user-404' });

      await request(app.getHttpServer())
        .get('/api/v1/enrollments')
        .set(bearer(orphanToken))
        .expect(403);
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

  // -------------------------------------------------------- demo scenario --
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
      });

      // Step 5: business API with the same Core Hub token.
      const courses = await request(app.getHttpServer())
        .get('/api/v1/courses')
        .set(bearer(token))
        .expect(200);

      expect(courses.body.success).toBe(true);
      expect(Array.isArray(courses.body.data)).toBe(true);

      // The Core Hub was contacted only for its public keys.
      expect(coreHub.requestCount).toBeGreaterThan(0);
    });
  });
});
