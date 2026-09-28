/**
 * Development seed data for the Demo Subsystem.
 *
 * IMPORTANT: no Core Hub users, passwords or sessions are seeded here.
 * `coreUserId` values below are EXTERNAL REFERENCES to Core Hub identities
 * (the `sub` claim of a Core Hub access token) and carry no credentials.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, EnrollmentStatus } from '../generated/prisma/client';

// Prisma 7 driver adapter, bound to the subsystem's own DATABASE_URL.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('[seed] seeding demo_student_db ...');

  const students = [
    {
      studentCode: 'CS67001',
      coreUserId: 'user-001', // external reference to a Core Hub identity
      firstName: 'Somchai',
      lastName: 'Jaidee',
      email: 'cs67001@student.csmju.local',
      faculty: 'Science',
      major: 'Computer Science',
      year: 3,
    },
    {
      studentCode: 'CS67002',
      coreUserId: 'user-002',
      firstName: 'Suda',
      lastName: 'Rakdee',
      email: 'cs67002@student.csmju.local',
      faculty: 'Science',
      major: 'Computer Science',
      year: 2,
    },
    {
      studentCode: 'CS67003',
      coreUserId: null,
      firstName: 'Anan',
      lastName: 'Wongsakul',
      email: 'cs67003@student.csmju.local',
      faculty: 'Science',
      major: 'Software Engineering',
      year: 1,
    },
  ];

  for (const student of students) {
    await prisma.student.upsert({
      where: { studentCode: student.studentCode },
      update: student,
      create: student,
    });
  }

  const courses = [
    {
      courseCode: 'CS101',
      name: 'Introduction to Programming',
      credits: 3,
      description: 'Fundamentals of programming with TypeScript.',
    },
    {
      courseCode: 'CS201',
      name: 'Data Structures and Algorithms',
      credits: 3,
      description: 'Core data structures, complexity analysis and algorithms.',
    },
    {
      courseCode: 'CS301',
      name: 'Distributed Systems and Identity',
      credits: 3,
      description: 'SSO, OAuth2/OIDC concepts, JWT, JWKS and key rotation.',
    },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { courseCode: course.courseCode },
      update: course,
      create: course,
    });
  }

  const pairs: Array<[string, string, EnrollmentStatus]> = [
    ['CS67001', 'CS101', EnrollmentStatus.COMPLETED],
    ['CS67001', 'CS201', EnrollmentStatus.ENROLLED],
    ['CS67001', 'CS301', EnrollmentStatus.ENROLLED],
    ['CS67002', 'CS101', EnrollmentStatus.ENROLLED],
    ['CS67002', 'CS201', EnrollmentStatus.DROPPED],
    ['CS67003', 'CS101', EnrollmentStatus.ENROLLED],
  ];

  for (const [studentCode, courseCode, status] of pairs) {
    const student = await prisma.student.findUniqueOrThrow({ where: { studentCode } });
    const course = await prisma.course.findUniqueOrThrow({ where: { courseCode } });

    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      update: { status },
      create: { studentId: student.id, courseId: course.id, status },
    });
  }

  const [studentCount, courseCount, enrollmentCount] = await Promise.all([
    prisma.student.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
  ]);

  console.log(
    `[seed] done: ${studentCount} students, ${courseCount} courses, ${enrollmentCount} enrollments`,
  );
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
