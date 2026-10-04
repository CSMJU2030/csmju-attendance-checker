import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffAttendanceRecordDto } from '../attendance-records/dto/attendance-record.response.dto';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { PaginationQueryDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import { AttendanceSessionsService } from './attendance-sessions.service';
import {
  AttendanceSessionDto,
  CurrentCodeDto,
  OpenedAttendanceSessionDto,
} from './dto/attendance-session.response.dto';
import { OpenAttendanceSessionDto } from './dto/open-attendance-session.dto';
import { QueryAttendanceSessionsDto } from './dto/query-attendance-sessions.dto';

const MANAGE = [
  Permission.ATTENDANCE_SESSION_MANAGE_ANY,
  Permission.ATTENDANCE_SESSION_MANAGE_OWN,
] as const;

@ApiTags('attendance-sessions')
@ApiBearerAuth()
@ApiCookieAuth('session')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('v1/attendance-sessions')
export class AttendanceSessionsController {
  constructor(private readonly sessions: AttendanceSessionsService) {}

  @Get()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: sessions of the sections they manage, newest first' })
  @ApiEnvelope(AttendanceSessionDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async findAll(
    @Query() query: QueryAttendanceSessionsDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    const { items, total } = await this.sessions.findAll(query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Post()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: open a session - a section has at most one OPEN session' })
  @ApiEnvelope(OpenedAttendanceSessionDto, { status: HttpStatus.CREATED })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  open(@Body() dto: OpenAttendanceSessionDto, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.open(dto, user);
  }

  @Get(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: one session with its check-in counts' })
  @ApiEnvelope(AttendanceSessionDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.findOne(id, user);
  }

  @Get(':id/code')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: the current code of an OPEN session' })
  @ApiEnvelope(CurrentCodeDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  getCode(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.getCode(id, user);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: close a session - its code stops working' })
  @ApiEnvelope(AttendanceSessionDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.close(id, user);
  }

  @Get(':id/records')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: the check-ins of one session, in order' })
  @ApiEnvelope(StaffAttendanceRecordDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async findRecords(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    const { items, total } = await this.sessions.findRecords(id, query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }
}
