import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { PaginationQueryDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { OpenAttendanceSessionDto } from './dto/open-attendance-session.dto';
import { QueryAttendanceSessionsDto } from './dto/query-attendance-sessions.dto';

const MANAGE = [
  Permission.ATTENDANCE_SESSION_MANAGE_ANY,
  Permission.ATTENDANCE_SESSION_MANAGE_OWN,
] as const;

@Controller('v1/attendance-sessions')
export class AttendanceSessionsController {
  constructor(private readonly sessions: AttendanceSessionsService) {}

  @Get()
  @RequirePermissions(...MANAGE)
  async findAll(
    @Query() query: QueryAttendanceSessionsDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    const { items, total } = await this.sessions.findAll(query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Post()
  @RequirePermissions(...MANAGE)
  open(@Body() dto: OpenAttendanceSessionDto, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.open(dto, user);
  }

  @Get(':id')
  @RequirePermissions(...MANAGE)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.findOne(id, user);
  }

  @Get(':id/code')
  @RequirePermissions(...MANAGE)
  getCode(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.getCode(id, user);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(...MANAGE)
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sessions.close(id, user);
  }

  @Get(':id/records')
  @RequirePermissions(...MANAGE)
  async findRecords(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    const { items, total } = await this.sessions.findRecords(id, query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }
}
