import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { PaginationQueryDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import { AttendanceRecordsService } from './attendance-records.service';
import {
  AttendanceRecordViewDto,
  AttendanceSummaryDto,
  StaffAttendanceRecordDto,
} from './dto/attendance-record.response.dto';
import { CheckInDto } from './dto/check-in.dto';
import { QueryAttendanceRecordsDto } from './dto/query-attendance-records.dto';

@ApiTags('attendance-records')
@ApiBearerAuth()
@ApiCookieAuth('session')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('v1/attendance-records')
export class AttendanceRecordsController {
  constructor(private readonly records: AttendanceRecordsService) {}

  @Post()
  @RequirePermissions(Permission.ATTENDANCE_CHECK_IN)
  @ApiOperation({ summary: 'Student: check in with the code shown in class and the device location' })
  @ApiEnvelope(AttendanceRecordViewDto, { status: HttpStatus.CREATED })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT, HttpStatus.SERVICE_UNAVAILABLE)
  checkIn(
    @Body() dto: CheckInDto,
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
  ) {
    return this.records.checkIn(dto, user, token);
  }

  /** Staff: search the check-ins of a class section they manage. */
  @Get()
  @RequirePermissions(
    Permission.ATTENDANCE_SESSION_MANAGE_ANY,
    Permission.ATTENDANCE_SESSION_MANAGE_OWN,
  )
  @ApiOperation({ summary: 'Staff: search the check-ins of a class section, newest first' })
  @ApiEnvelope(StaffAttendanceRecordDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async findForSection(
    @Query() query: QueryAttendanceRecordsDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    const { items, total } = await this.records.findForSection(query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get('me/summary')
  @RequirePermissions(Permission.ATTENDANCE_RECORD_READ_OWN)
  @ApiOperation({ summary: 'Student: how many times they checked in' })
  @ApiEnvelope(AttendanceSummaryDto)
  summaryMine(@CurrentUser() user: CoreHubIdentity) {
    return this.records.summaryMine(user);
  }

  @Get('me')
  @RequirePermissions(Permission.ATTENDANCE_RECORD_READ_OWN)
  @ApiOperation({ summary: 'Student: their own check-ins, newest first' })
  @ApiEnvelope(AttendanceRecordViewDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async findMine(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
  ) {
    const { items, total } = await this.records.findMine(query, user, token);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }
}
