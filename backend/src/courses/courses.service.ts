import { Injectable } from '@nestjs/common';
import { Course, EnrollmentStatus, Prisma } from '../../generated/prisma/client';
import { AppException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCoursesDto): Promise<{ items: Course[]; total: number }> {
    const where: Prisma.CourseWhereInput = query.q
      ? {
          OR: [
            { courseCode: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: { courseCode: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw AppException.notFound('Course not found');
    }
    return course;
  }

  /** Business rule: a course code must be unique (spec §26). */
  async create(dto: CreateCourseDto): Promise<Course> {
    const existing = await this.prisma.course.findUnique({
      where: { courseCode: dto.courseCode },
    });

    if (existing) {
      throw AppException.conflict(`Course code ${dto.courseCode} already exists`);
    }

    return this.prisma.course.create({ data: dto });
  }

  async update(id: string, dto: UpdateCourseDto): Promise<Course> {
    await this.findOne(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  /** A course with active enrollments cannot be deleted (spec §26 spirit). */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.findOne(id);

    const activeEnrollments = await this.prisma.enrollment.count({
      where: { courseId: id, status: EnrollmentStatus.ENROLLED },
    });

    if (activeEnrollments > 0) {
      throw AppException.conflict(
        'Course still has active enrollments and cannot be deleted',
        { activeEnrollments },
      );
    }

    await this.prisma.course.delete({ where: { id } });
    return { id, deleted: true };
  }
}
