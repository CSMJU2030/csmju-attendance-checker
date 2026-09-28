import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('v1/courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @RequirePermissions(Permission.COURSE_READ)
  async findAll(@Query() query: QueryCoursesDto) {
    const { items, total } = await this.courses.findAll(query);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get(':id')
  @RequirePermissions(Permission.COURSE_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.courses.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.COURSE_CREATE)
  create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.COURSE_UPDATE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(id, dto);
  }

  /** ADMIN only - STAFF deliberately does not hold `course:delete`. */
  @Delete(':id')
  @RequirePermissions(Permission.COURSE_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.courses.remove(id);
  }
}
