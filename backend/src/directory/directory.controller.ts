import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CourseCatalog } from '../core-hub/course-catalog.service';
import { PeopleService } from '../core-hub/people.service';
import { Department } from '../core-hub/reference-data.types';
import { ReferenceDataService } from '../core-hub/reference-data.service';
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import {
  CourseSummaryDto,
  DepartmentDto,
  QueryCoursesDto,
  QueryStudentsDto,
  StudentSummaryDto,
} from './dto/directory.dto';

/**
 * Core Hub data the roster screen needs, read with the caller's own token.
 * Students are personal data: passed through, never cached or stored.
 */
@ApiTags('directory')
@ApiBearerAuth()
@ApiCookieAuth('session')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.SERVICE_UNAVAILABLE)
@Controller('v1')
export class DirectoryController {
  constructor(
    private readonly people: PeopleService,
    private readonly reference: ReferenceDataService,
    private readonly courses: CourseCatalog,
  ) {}

  @Get('courses')
  @RequirePermissions(Permission.CLASS_SECTION_CREATE)
  @ApiOperation({ summary: 'Staff: open Core Hub courses by code or name, for a new class section' })
  @ApiEnvelope(CourseSummaryDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async searchCourses(@Query() query: QueryCoursesDto, @CoreHubAccessToken() token: string) {
    const limit = query.limit ?? 20;
    const found = await this.courses.search(query.q ?? '', token, limit);
    const items = found.map((course) => ({
      code: course.code,
      nameTh: course.nameTh,
      nameEn: course.nameEn ?? null,
      credits: course.credits,
    }));
    return new CollectionResult(items, buildPaginationMeta(items.length, 1, limit));
  }

  @Get('people')
  @RequirePermissions(Permission.PEOPLE_SEARCH)
  @ApiOperation({ summary: 'Staff: active students in Core Hub, by department, entry year or name' })
  @ApiEnvelope(StudentSummaryDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async students(@Query() query: QueryStudentsDto, @CoreHubAccessToken() token: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const { items, total } = await this.people.searchStudents(token, {
      departmentCode: query.departmentCode,
      entryYear: query.entryYear,
      q: query.q,
      page,
      limit,
    });
    return new CollectionResult(items, buildPaginationMeta(total, page, limit));
  }

  @Get('departments')
  @RequirePermissions(Permission.PEOPLE_SEARCH)
  @ApiOperation({ summary: 'Staff: active departments (Core Hub reference data, cached)' })
  @ApiEnvelope(DepartmentDto, { collection: true })
  async departments(@CoreHubAccessToken() token: string) {
    const items = await this.reference.list<Department>('departments', token);
    const departments = items
      .map((item) => ({ code: item.code, nameTh: item.nameTh, facultyCode: item.facultyCode }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return new CollectionResult(departments, buildPaginationMeta(departments.length, 1, departments.length));
  }
}
