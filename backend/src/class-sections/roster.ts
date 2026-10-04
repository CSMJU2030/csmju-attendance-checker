import { PrismaService } from '../prisma/prisma.service';

/**
 * Whether each check-in's student is on the section's roster, worked out at
 * read time (never stored): `null` while the section has no roster yet, else
 * true/false. An account without a student id is never on the roster.
 */
export async function rosterMembership(
  prisma: PrismaService,
  classSectionId: string,
  personCodes: Array<string | null>,
): Promise<(personCode: string | null) => boolean | null> {
  const size = await prisma.classSectionStudent.count({ where: { classSectionId } });
  if (size === 0) {
    return () => null;
  }
  const codes = [...new Set(personCodes.filter((code): code is string => code !== null))];
  const onRoster = await prisma.classSectionStudent.findMany({
    where: { classSectionId, personCode: { in: codes } },
  });
  const members = new Set(onRoster.map((row) => row.personCode));
  return (personCode) => personCode !== null && members.has(personCode);
}
