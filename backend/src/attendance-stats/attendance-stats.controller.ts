import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { PaginationQueryDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import { AttendanceStatsService } from './attendance-stats.service';
import {
  AtRiskEntryDto,
  SectionStatDetailDto,
  SectionStatDto,
  StatsSummaryDto,
} from './dto/attendance-stats.response.dto';

const MANAGE = [
  Permission.ATTENDANCE_SESSION_MANAGE_ANY,
  Permission.ATTENDANCE_SESSION_MANAGE_OWN,
] as const;

/**
 * Attendance statistics and the at-risk group (absent from at least 30% of
 * closed sessions). Lecturers see their own sections; ADMIN sees every one.
 */
@ApiTags('attendance-stats')
@ApiBearerAuth()
@ApiCookieAuth('session')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('v1/attendance-stats')
export class AttendanceStatsController {
  constructor(private readonly stats: AttendanceStatsService) {}

  @Get('summary')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: totals across the sections the caller may see' })
  @ApiEnvelope(StatsSummaryDto)
  summary(@CurrentUser() user: CoreHubIdentity) {
    return this.stats.summary(user);
  }

  @Get('at-risk')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: every at-risk student across the caller sections, worst first' })
  @ApiEnvelope(AtRiskEntryDto, { collection: true })
  async atRisk(@CurrentUser() user: CoreHubIdentity, @CoreHubAccessToken() token: string) {
    const items = await this.stats.atRisk(user, token);
    return new CollectionResult(items, buildPaginationMeta(items.length, 1, items.length));
  }

  @Get('sections')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: attendance rate and at-risk count per section' })
  @ApiEnvelope(SectionStatDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async sections(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
  ) {
    const { items, total } = await this.stats.sectionPage(
      user,
      { skip: query.skip, take: query.take },
      token,
    );
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get('sections/:id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'Staff: one section with every student, at-risk students first' })
  @ApiEnvelope(SectionStatDetailDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  section(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
  ) {
    return this.stats.section(id, user, token);
  }
}
