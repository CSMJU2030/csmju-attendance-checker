import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { ClassSectionsService } from './class-sections.service';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';

@Controller('v1/class-sections')
export class ClassSectionsController {
  constructor(private readonly sections: ClassSectionsService) {}

  @Get()
  @RequirePermissions(Permission.CLASS_SECTION_READ)
  async findAll(@Query() query: QueryClassSectionsDto, @CurrentUser() user: CoreHubIdentity) {
    const { items, total } = await this.sections.findAll(query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get(':id')
  @RequirePermissions(Permission.CLASS_SECTION_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sections.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.CLASS_SECTION_CREATE)
  create(@Body() dto: CreateClassSectionDto, @CurrentUser() user: CoreHubIdentity) {
    return this.sections.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CLASS_SECTION_UPDATE_ANY, Permission.CLASS_SECTION_UPDATE_OWN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassSectionDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    return this.sections.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CLASS_SECTION_DELETE_ANY, Permission.CLASS_SECTION_DELETE_OWN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sections.remove(id, user);
  }
}
