import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { PaginationQueryDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { AttendanceRecordsService } from './attendance-records.service';
import { CheckInDto } from './dto/check-in.dto';

@Controller('v1/attendance-records')
export class AttendanceRecordsController {
  constructor(private readonly records: AttendanceRecordsService) {}

  @Post()
  @RequirePermissions(Permission.ATTENDANCE_CHECK_IN)
  checkIn(
    @Body() dto: CheckInDto,
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
  ) {
    return this.records.checkIn(dto, user, token);
  }

  @Get('me/summary')
  @RequirePermissions(Permission.ATTENDANCE_RECORD_READ_OWN)
  summaryMine(@CurrentUser() user: CoreHubIdentity) {
    return this.records.summaryMine(user);
  }

  @Get('me')
  @RequirePermissions(Permission.ATTENDANCE_RECORD_READ_OWN)
  async findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: CoreHubIdentity) {
    const { items, total } = await this.records.findMine(query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }
}
