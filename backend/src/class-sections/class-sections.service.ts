import { Injectable } from '@nestjs/common';
import { ClassSection, Prisma } from '../../generated/prisma/client';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, can } from '../auth/permissions';
import { AppException } from '../common/errors';
import { CourseCatalog } from '../core-hub/course-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';

/**
 * A caller holding `anyPermission` may act on every section; everyone else
 * only on the sections they own.
 */
export function assertCanManageSection(
  section: Pick<ClassSection, 'ownerCoreUserId'>,
  user: CoreHubIdentity,
  anyPermission: Permission,
): void {
  if (can(user.subsystemRole, anyPermission)) {
    return;
  }
  if (section.ownerCoreUserId !== user.id) {
    throw AppException.forbidden('คุณไม่ได้เป็นผู้สอนของกลุ่มเรียนนี้');
  }
}

/** A section as the API shows it: the course name comes from Core Hub. */
export type ClassSectionView = Omit<ClassSection, 'courseName'> & {
  courseName: string;
  /** Is `courseCode` a Core Hub course? False for sections typed in before the link. */
  courseInCatalog: boolean;
};

@Injectable()
export class ClassSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseCatalog,
  ) {}

  /**
   * Course names from the Core Hub cache, falling back to the name typed in
   * before the link, then to the code - showing a section never fails.
   */
  async views(sections: ClassSection[], token: string): Promise<ClassSectionView[]> {
    const names = await this.courses.names(
      sections.map((section) => section.courseCode),
      token,
    );
    return sections.map((section) => {
      const course = names.get(section.courseCode);
      return {
        ...section,
        courseName: course?.nameTh ?? section.courseName ?? section.courseCode,
        courseInCatalog: course !== undefined,
      };
    });
  }

  async findAll(
    query: QueryClassSectionsDto,
    user: CoreHubIdentity,
    token: string,
  ): Promise<{ items: ClassSection[]; total: number }> {
    // A name search also matches sections whose Core Hub course has that name.
    const namedCodes = query.q ? await this.courses.codesNamed(query.q, token) : [];
    const where: Prisma.ClassSectionWhereInput = {
      academicYear: query.academicYear,
      term: query.term,
      ownerCoreUserId: query.mine ? user.id : undefined,
      ...(query.q
        ? {
            OR: [
              { courseCode: { contains: query.q, mode: 'insensitive' } },
              { courseName: { contains: query.q, mode: 'insensitive' } },
              ...(namedCodes.length > 0 ? [{ courseCode: { in: namedCodes } }] : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.classSection.findMany({
        where,
        orderBy: { courseCode: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.classSection.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<ClassSection> {
    const section = await this.prisma.classSection.findUnique({ where: { id } });
    if (!section) {
      throw AppException.notFound('ไม่พบกลุ่มเรียนนี้');
    }
    return section;
  }

  /** The caller becomes the owner of the new section. */
  async create(
    dto: CreateClassSectionDto,
    user: CoreHubIdentity,
    token: string,
  ): Promise<ClassSection> {
    await this.courses.assertOpen(dto.courseCode, token);
    const existing = await this.prisma.classSection.findUnique({
      where: {
        courseCode_sectionCode_academicYear_term: {
          courseCode: dto.courseCode,
          sectionCode: dto.sectionCode,
          academicYear: dto.academicYear,
          term: dto.term,
        },
      },
    });

    if (existing) {
      throw AppException.conflict(
        `กลุ่มเรียน ${dto.courseCode} กลุ่ม ${dto.sectionCode} ภาคเรียน ${dto.term}/${dto.academicYear} มีอยู่แล้ว`,
      );
    }

    return this.prisma.classSection.create({
      data: { ...dto, ownerCoreUserId: user.id },
    });
  }

  async update(
    id: string,
    dto: UpdateClassSectionDto,
    user: CoreHubIdentity,
  ): Promise<ClassSection> {
    const section = await this.findOne(id);
    assertCanManageSection(section, user, Permission.CLASS_SECTION_UPDATE_ANY);
    return this.prisma.classSection.update({ where: { id }, data: dto });
  }

  /**
   * A section that already has attendance sessions cannot be deleted: the
   * cascade would silently erase the students' attendance history.
   */
  async remove(id: string, user: CoreHubIdentity): Promise<{ id: string; deleted: true }> {
    const section = await this.findOne(id);
    assertCanManageSection(section, user, Permission.CLASS_SECTION_DELETE_ANY);

    const sessionCount = await this.prisma.attendanceSession.count({
      where: { classSectionId: id },
    });
    if (sessionCount > 0) {
      throw AppException.conflict(
        'กลุ่มเรียนนี้มีประวัติการเช็คชื่อแล้ว จึงลบไม่ได้',
        { attendanceSessionCount: sessionCount },
      );
    }

    await this.prisma.classSection.delete({ where: { id } });
    return { id, deleted: true };
  }
}
