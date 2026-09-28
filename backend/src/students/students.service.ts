import { Injectable } from '@nestjs/common';
import { Prisma, Student } from '../../generated/prisma/client';
import { AuthEventsLogger } from '../auth/auth-events.logger';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, can } from '../auth/permissions';
import { AppException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

/** Fields a student may change on their OWN record. */
const SELF_EDITABLE_FIELDS = ['firstName', 'lastName', 'email'] as const;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authEvents: AuthEventsLogger,
  ) {}

  /** Resolves the business record linked to a Core Hub identity, if any. */
  async findByCoreUserId(coreUserId: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { coreUserId } });
  }

  async findAll(
    user: CoreHubIdentity,
    query: QueryStudentsDto,
  ): Promise<{ items: Student[]; total: number }> {
    const where: Prisma.StudentWhereInput = {};

    if (query.faculty) {
      where.faculty = query.faculty;
    }
    if (query.major) {
      where.major = query.major;
    }
    if (query.q) {
      where.OR = [
        { studentCode: { contains: query.q, mode: 'insensitive' } },
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Callers without `student:read:any` only ever see their own record.
    if (!can(user.subsystemRole, Permission.STUDENT_READ_ANY)) {
      where.coreUserId = user.id;
    }

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { studentCode: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(user: CoreHubIdentity, id: string): Promise<Student> {
    const student = await this.prisma.student.findUnique({ where: { id } });

    if (!student) {
      throw AppException.notFound('Student not found');
    }

    this.assertCanAccess(user, student, Permission.STUDENT_READ_ANY, 'read');

    return student;
  }

  async create(user: CoreHubIdentity, dto: CreateStudentDto): Promise<Student> {
    // Guard already required `student:create`; only STAFF/ADMIN hold it.
    const existing = await this.prisma.student.findUnique({
      where: { studentCode: dto.studentCode },
    });

    if (existing) {
      throw AppException.conflict(`Student code ${dto.studentCode} already exists`);
    }

    return this.prisma.student.create({ data: dto });
  }

  async update(user: CoreHubIdentity, id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.prisma.student.findUnique({ where: { id } });

    if (!student) {
      throw AppException.notFound('Student not found');
    }

    const canUpdateAny = can(user.subsystemRole, Permission.STUDENT_UPDATE_ANY);
    this.assertCanAccess(user, student, Permission.STUDENT_UPDATE_ANY, 'update');

    if (!canUpdateAny) {
      // Self-service edits are limited to contact details; academic fields and
      // the Core Hub link stay under staff control.
      const attempted = Object.keys(dto).filter(
        (key) => !SELF_EDITABLE_FIELDS.includes(key as (typeof SELF_EDITABLE_FIELDS)[number]),
      );

      if (attempted.length > 0) {
        this.authEvents.authorizationDenied({
          sub: user.id,
          subsystemRole: user.subsystemRole,
          reason: `self_update_restricted_fields:${attempted.join(',')}`,
        });
        throw AppException.forbidden(
          `You may only update: ${SELF_EDITABLE_FIELDS.join(', ')}`,
        );
      }
    }

    return this.prisma.student.update({ where: { id }, data: dto });
  }

  /**
   * Ownership rule (spec §26): a student may only touch their own record.
   * Callers holding the `:any` permission bypass the ownership requirement.
   */
  private assertCanAccess(
    user: CoreHubIdentity,
    student: Student,
    anyPermission: Permission,
    action: string,
  ): void {
    if (can(user.subsystemRole, anyPermission)) {
      return;
    }

    if (student.coreUserId && student.coreUserId === user.id) {
      return;
    }

    this.authEvents.authorizationDenied({
      sub: user.id,
      subsystemRole: user.subsystemRole,
      reason: `not_owner:student:${action}`,
    });
    throw AppException.forbidden('You do not have permission to perform this action');
  }
}
