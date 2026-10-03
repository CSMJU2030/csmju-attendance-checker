import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import { ClassSectionsService } from './class-sections.service';
import { ClassSectionDto, DeletedClassSectionDto } from './dto/class-section.response.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';

@ApiTags('class-sections')
@ApiBearerAuth()
@ApiCookieAuth('session')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Controller('v1/class-sections')
export class ClassSectionsController {
  constructor(private readonly sections: ClassSectionsService) {}

  @Get()
  @RequirePermissions(Permission.CLASS_SECTION_READ)
  @ApiOperation({ summary: 'Staff: list and search class sections' })
  @ApiEnvelope(ClassSectionDto, { collection: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  async findAll(@Query() query: QueryClassSectionsDto, @CurrentUser() user: CoreHubIdentity) {
    const { items, total } = await this.sections.findAll(query, user);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get(':id')
  @RequirePermissions(Permission.CLASS_SECTION_READ)
  @ApiOperation({ summary: 'Staff: one class section' })
  @ApiEnvelope(ClassSectionDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sections.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.CLASS_SECTION_CREATE)
  @ApiOperation({ summary: 'Staff: create a class section - the caller becomes its owner' })
  @ApiEnvelope(ClassSectionDto, { status: HttpStatus.CREATED })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  create(@Body() dto: CreateClassSectionDto, @CurrentUser() user: CoreHubIdentity) {
    return this.sections.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CLASS_SECTION_UPDATE_ANY, Permission.CLASS_SECTION_UPDATE_OWN)
  @ApiOperation({ summary: 'Staff: change the name, location or thresholds of a section' })
  @ApiEnvelope(ClassSectionDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassSectionDto,
    @CurrentUser() user: CoreHubIdentity,
  ) {
    return this.sections.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CLASS_SECTION_DELETE_ANY, Permission.CLASS_SECTION_DELETE_OWN)
  @ApiOperation({ summary: 'Staff: delete a section that has no attendance history' })
  @ApiEnvelope(DeletedClassSectionDto)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CoreHubIdentity) {
    return this.sections.remove(id, user);
  }
}
