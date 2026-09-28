import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

/** All routes are protected by the globally registered CoreHubJwtGuard. */
@Controller('v1/students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions(Permission.STUDENT_READ_ANY, Permission.STUDENT_READ_OWN)
  async findAll(@CurrentUser() user: CoreHubIdentity, @Query() query: QueryStudentsDto) {
    const { items, total } = await this.students.findAll(user, query);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get(':id')
  @RequirePermissions(Permission.STUDENT_READ_ANY, Permission.STUDENT_READ_OWN)
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.findOne(user, id);
  }

  @Post()
  @RequirePermissions(Permission.STUDENT_CREATE)
  create(@CurrentUser() user: CoreHubIdentity, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.STUDENT_UPDATE_ANY, Permission.STUDENT_UPDATE_OWN)
  update(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(user, id, dto);
  }
}
