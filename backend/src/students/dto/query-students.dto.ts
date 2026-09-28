import { IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryStudentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  faculty?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  major?: string;

  /** Free-text search over student code, names and email. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
}
