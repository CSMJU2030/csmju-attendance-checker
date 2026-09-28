import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { EnrollmentsService } from './enrollments.service';

@Controller('v1/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get()
  @RequirePermissions(Permission.ENROLLMENT_READ_ANY, Permission.ENROLLMENT_READ_OWN)
  async findAll(@CurrentUser() user: CoreHubIdentity, @Query() query: QueryEnrollmentsDto) {
    const { items, total } = await this.enrollments.findAll(user, query);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get(':id')
  @RequirePermissions(Permission.ENROLLMENT_READ_ANY, Permission.ENROLLMENT_READ_OWN)
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollments.findOne(user, id);
  }

  @Post()
  @RequirePermissions(Permission.ENROLLMENT_CREATE_ANY, Permission.ENROLLMENT_CREATE_OWN)
  create(@CurrentUser() user: CoreHubIdentity, @Body() dto: CreateEnrollmentDto) {
    return this.enrollments.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ENROLLMENT_UPDATE_ANY, Permission.ENROLLMENT_UPDATE_OWN)
  update(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.enrollments.update(user, id, dto);
  }
}
