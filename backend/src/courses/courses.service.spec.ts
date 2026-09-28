import { EnrollmentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from './courses.service';

const COURSE = {
  id: '33333333-3333-4333-8333-333333333333',
  courseCode: 'CS101',
  name: 'Introduction to Programming',
  credits: 3,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CoursesService - business rules (spec §24, §26)', () => {
  let prisma: {
    course: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    enrollment: { count: jest.Mock };
  };
  let service: CoursesService;

  beforeEach(() => {
    prisma = {
      course: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([COURSE]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...COURSE, ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...COURSE, ...data })),
        delete: jest.fn().mockResolvedValue(COURSE),
      },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new CoursesService(prisma as unknown as PrismaService);
  });

  it('creates a course with a new course code', async () => {
    prisma.course.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ courseCode: 'CS401', name: 'Compilers', credits: 3 }),
    ).resolves.toMatchObject({ courseCode: 'CS401' });
  });

  it('rejects a duplicate course code with 409 (spec §26)', async () => {
    prisma.course.findUnique.mockResolvedValue(COURSE);

    await expect(
      service.create({ courseCode: 'CS101', name: 'Duplicate', credits: 3 }),
    ).rejects.toMatchObject({ status: 409 });

    expect(prisma.course.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown course', async () => {
    prisma.course.findUnique.mockResolvedValue(null);

    await expect(service.findOne(COURSE.id)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to delete a course that still has active enrollments', async () => {
    prisma.course.findUnique.mockResolvedValue(COURSE);
    prisma.enrollment.count.mockResolvedValue(2);

    await expect(service.remove(COURSE.id)).rejects.toMatchObject({ status: 409 });
    expect(prisma.course.delete).not.toHaveBeenCalled();
    expect(prisma.enrollment.count).toHaveBeenCalledWith({
      where: { courseId: COURSE.id, status: EnrollmentStatus.ENROLLED },
    });
  });

  it('deletes a course with no active enrollments', async () => {
    prisma.course.findUnique.mockResolvedValue(COURSE);

    await expect(service.remove(COURSE.id)).resolves.toEqual({ id: COURSE.id, deleted: true });
  });
});
