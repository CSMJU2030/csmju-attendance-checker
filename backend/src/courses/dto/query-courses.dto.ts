import { IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryCoursesDto extends PaginationQueryDto {
  /** Free-text search over course code and name. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
}
