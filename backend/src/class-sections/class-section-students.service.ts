import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { AppException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { ClassSectionsService, assertCanManageSection } from './class-sections.service';
import { AddRosterStudentsDto, QueryRosterDto } from './dto/roster.dto';

const UPDATE_ANY = Permission.CLASS_SECTION_UPDATE_ANY;

export interface RosterStudent {
  personCode: string;
  addedAt: Date;
}

/**
 * The roster of a class section. Core Hub keeps people and courses but no
 * enrollment, so the lecturer lists the students here. Ids pasted by hand
 * are checked for format only: looking each one up in Core Hub would be one
 * call per row, which reference-data.md 7.2 forbids.
 */
@Injectable()
export class ClassSectionStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sections: ClassSectionsService,
  ) {}

  async list(
    classSectionId: string,
    query: QueryRosterDto,
    user: CoreHubIdentity,
  ): Promise<{ items: RosterStudent[]; total: number }> {
    await this.managed(classSectionId, user);
    const where: Prisma.ClassSectionStudentWhereInput = {
      classSectionId,
      personCode: query.q ? { startsWith: query.q } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.classSectionStudent.findMany({
        where,
        orderBy: { personCode: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.classSectionStudent.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({ personCode: row.personCode, addedAt: row.createdAt })),
      total,
    };
  }

  async add(
    classSectionId: string,
    dto: AddRosterStudentsDto,
    user: CoreHubIdentity,
  ): Promise<{ added: number; alreadyOnRoster: string[] }> {
    await this.managed(classSectionId, user);
    const codes = [...new Set(dto.personCodes)];
    const existing = await this.prisma.classSectionStudent.findMany({
      where: { classSectionId, personCode: { in: codes } },
    });
    const already = new Set(existing.map((row) => row.personCode));
    const fresh = codes.filter((code) => !already.has(code));
    if (fresh.length > 0) {
      await this.prisma.classSectionStudent.createMany({
        data: fresh.map((personCode) => ({
          classSectionId,
          personCode,
          addedByCoreUserId: user.id,
        })),
        skipDuplicates: true,
      });
    }
    return { added: fresh.length, alreadyOnRoster: codes.filter((code) => already.has(code)) };
  }

  async remove(
    classSectionId: string,
    personCode: string,
    user: CoreHubIdentity,
  ): Promise<{ personCode: string; removed: true }> {
    await this.managed(classSectionId, user);
    const row = await this.prisma.classSectionStudent.findUnique({
      where: { classSectionId_personCode: { classSectionId, personCode } },
    });
    if (!row) {
      throw AppException.notFound(`ไม่พบรหัส ${personCode} ในรายชื่อของกลุ่มเรียนนี้`);
    }
    await this.prisma.classSectionStudent.delete({ where: { id: row.id } });
    return { personCode, removed: true };
  }

  private async managed(classSectionId: string, user: CoreHubIdentity): Promise<void> {
    const section = await this.sections.findOne(classSectionId);
    assertCanManageSection(section, user, UPDATE_ANY);
  }
}
