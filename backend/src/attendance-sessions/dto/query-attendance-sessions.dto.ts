import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttendanceSessionStatus } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryAttendanceSessionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsEnum(AttendanceSessionStatus)
  status?: AttendanceSessionStatus;
}
