import { Injectable } from '@nestjs/common';
import { Enrollment, EnrollmentStatus, Prisma, Student } from '../../generated/prisma/client';
import { AuthEventsLogger } from '../auth/auth-events.logger';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, can } from '../auth/permissions';
import { AppException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

const INCLUDE_RELATIONS = {
  student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
  course: { select: { id: true, courseCode: true, name: true, credits: true } },
} satisfies Prisma.EnrollmentInclude;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authEvents: AuthEventsLogger,
  ) {}

  async findAll(
    user: CoreHubIdentity,
    query: QueryEnrollmentsDto,
  ): Promise<{ items: Enrollment[]; total: number }> {
    const where: Prisma.EnrollmentWhereInput = {};

    if (query.courseId) {
      where.courseId = query.courseId;
    }
    if (query.status) {
      where.status = query.status;
    }

    if (can(user.subsystemRole, Permission.ENROLLMENT_READ_ANY)) {
      if (query.studentId) {
        where.studentId = query.studentId;
      }
    } else {
      // Own enrollments only, regardless of what the client asked for.
      const own = await this.requireOwnStudentRecord(user);
      where.studentId = own.id;
    }

    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: { enrolledAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(user: CoreHubIdentity, id: string): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    });

    if (!enrollment) {
      throw AppException.notFound('Enrollment not found');
    }

    await this.assertOwnershipOrAny(user, enrollment.studentId, Permission.ENROLLMENT_READ_ANY, 'read');

    return enrollment;
  }

  /**
   * Business rules (spec §26):
   * - the student and the course must exist;
   * - a STUDENT may only enroll themselves;
   * - no duplicate ACTIVE enrollment for the same (student, course).
   */
  async create(user: CoreHubIdentity, dto: CreateEnrollmentDto): Promise<Enrollment> {
    await this.assertOwnershipOrAny(
      user,
      dto.studentId,
      Permission.ENROLLMENT_CREATE_ANY,
      'create',
    );

    const [student, course] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.course.findUnique({ where: { id: dto.courseId } }),
    ]);

    if (!student) {
      throw AppException.badRequest('Enrollment must reference an existing student');
    }
    if (!course) {
      throw AppException.badRequest('Enrollment must reference an existing course');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: dto.studentId, courseId: dto.courseId } },
    });

    if (existing) {
      if (existing.status === EnrollmentStatus.ENROLLED) {
        throw AppException.conflict(
          `Student ${student.studentCode} already has an active enrollment in ${course.courseCode}`,
        );
      }

      // Previously dropped/completed: reactivate the single record for the pair.
      return this.prisma.enrollment.update({
        where: { id: existing.id },
        data: { status: EnrollmentStatus.ENROLLED, enrolledAt: new Date() },
        include: INCLUDE_RELATIONS,
      });
    }

    return this.prisma.enrollment.create({
      data: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        status: EnrollmentStatus.ENROLLED,
      },
      include: INCLUDE_RELATIONS,
    });
  }

  /**
   * STAFF/ADMIN may set any status. A STUDENT may only DROP their own
   * enrollment - they cannot mark a course COMPLETED for themselves.
   */
  async update(
    user: CoreHubIdentity,
    id: string,
    dto: UpdateEnrollmentDto,
  ): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id } });

    if (!enrollment) {
      throw AppException.notFound('Enrollment not found');
    }

    const canUpdateAny = can(user.subsystemRole, Permission.ENROLLMENT_UPDATE_ANY);
    await this.assertOwnershipOrAny(
      user,
      enrollment.studentId,
      Permission.ENROLLMENT_UPDATE_ANY,
      'update',
    );

    if (!canUpdateAny && dto.status !== EnrollmentStatus.DROPPED) {
      this.authEvents.authorizationDenied({
        sub: user.id,
        subsystemRole: user.subsystemRole,
        reason: `student_status_transition_not_allowed:${dto.status}`,
      });
      throw AppException.forbidden('You may only drop your own enrollment');
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { status: dto.status },
      include: INCLUDE_RELATIONS,
    });
  }

  /** The business record linked to the verified Core Hub identity. */
  private async requireOwnStudentRecord(user: CoreHubIdentity): Promise<Student> {
    const student = await this.prisma.student.findUnique({ where: { coreUserId: user.id } });

    if (!student) {
      this.authEvents.authorizationDenied({
        sub: user.id,
        subsystemRole: user.subsystemRole,
        reason: 'no_linked_student_record',
      });
      throw AppException.forbidden(
        'Your Core Hub account is not linked to a student record in this subsystem',
      );
    }

    return student;
  }

  private async assertOwnershipOrAny(
    user: CoreHubIdentity,
    studentId: string,
    anyPermission: Permission,
    action: string,
  ): Promise<void> {
    if (can(user.subsystemRole, anyPermission)) {
      return;
    }

    const own = await this.requireOwnStudentRecord(user);
    if (own.id === studentId) {
      return;
    }

    this.authEvents.authorizationDenied({
      sub: user.id,
      subsystemRole: user.subsystemRole,
      reason: `not_owner:enrollment:${action}`,
    });
    throw AppException.forbidden('You do not have permission to perform this action');
  }
}
