/**
 * Development seed data for the Attendance Checker.
 *
 * IMPORTANT: no Core Hub users, passwords or sessions are seeded here.
 * `ownerCoreUserId` values are EXTERNAL REFERENCES to Core Hub identities
 * (the `sub` claim of a Core Hub access token) and carry no credentials.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma 7 driver adapter, bound to the subsystem's own DATABASE_URL.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

/** `staff@core.local` in the Core Hub development seed. */
const STAFF_CORE_USER_ID = 'user-003';

/** Faculty of Science, Maejo University (approximate check-in point). */
const CHECK_IN_POINT = { latitude: 18.8925, longitude: 99.0142 };

async function main(): Promise<void> {
  console.log('[seed] seeding attendance_checker_db ...');

  const sections = [
    { courseCode: 'CS201', courseName: 'Data Structures', sectionCode: '1' },
    { courseCode: 'CS201', courseName: 'Data Structures', sectionCode: '2' },
    { courseCode: 'CS305', courseName: 'Software Engineering', sectionCode: '1' },
  ];

  for (const section of sections) {
    const key = { ...section, academicYear: 2026, term: 1 };
    await prisma.classSection.upsert({
      where: {
        courseCode_sectionCode_academicYear_term: {
          courseCode: key.courseCode,
          sectionCode: key.sectionCode,
          academicYear: key.academicYear,
          term: key.term,
        },
      },
      update: { courseName: key.courseName, ...CHECK_IN_POINT },
      create: { ...key, ...CHECK_IN_POINT, ownerCoreUserId: STAFF_CORE_USER_ID },
    });
  }

  console.log(`[seed] done: ${await prisma.classSection.count()} class sections`);
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
