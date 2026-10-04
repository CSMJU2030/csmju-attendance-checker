import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { AppException } from '../common/errors';
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import { ClassSectionStudentsService } from './class-section-students.service';
import { AddRosterStudentsDto, PERSON_CODE_PATTERN, QueryRosterDto } from './dto/roster.dto';
import {
  AddRosterStudentsResultDto,
  RemovedRosterStudentDto,
  RosterStudentDto,
} from './dto/roster.response.dto';

const UPDATE = [Permission.CLASS_SECTION_UPDATE_ANY, Permission.CLASS_SECTION_UPDATE_OWN] as const;

@ApiTags('class-sections')
@ApiBearerAuth()
@ApiCookieAuth('session')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
@Controller('v1/class-sections/:id/students')
export class ClassSectionStudentsController {
  constructor(private readonly students: ClassSectionStudentsService) {}

  @Get()
  @RequirePermissions(...UPDATE)
  @ApiOperation({ summary: 'Staff: the roster of a class section, by student id' })
  @ApiEnvelope(RosterStudentDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryRosterDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    const { items, total } = await this.students.list(id, query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Post()
  @RequirePermissions(...UPDATE)
  @ApiOperation({ summary: 'Staff: add student ids to the roster (up to 500 per call)' })
  @ApiEnvelope(AddRosterStudentsResultDto, { status: HttpStatus.CREATED })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRosterStudentsDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    return this.students.add(id, dto, user);
  }

  @Delete(':personCode')
  @RequirePermissions(...UPDATE)
  @ApiOperation({ summary: 'Staff: take one student off the roster' })
  @ApiEnvelope(RemovedRosterStudentDto)
  @ApiErrors(HttpStatus.BAD_REQUEST)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('personCode') personCode: string,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    if (!PERSON_CODE_PATTERN.test(personCode)) {
      throw AppException.badRequest('รหัสนักศึกษาไม่ถูกต้อง');
    }
    return this.students.remove(id, personCode, user);
  }
}
