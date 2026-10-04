import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** A student id as Core Hub writes `personCode`. */
export const PERSON_CODE_PATTERN = /^[0-9A-Za-z-]{1,20}$/;

/** POST /api/v1/class-sections/:id/students */
export class AddRosterStudentsDto {
  /** Student ids to add. Ids already on the roster are skipped. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Matches(PERSON_CODE_PATTERN, {
    each: true,
    message: 'each person code may contain only letters, digits and "-"',
  })
  personCodes!: string[];
}

/** GET /api/v1/class-sections/:id/students */
export class QueryRosterDto extends PaginationQueryDto {
  /** Student id, or its leading digits. */
  @IsOptional()
  @IsString()
  @Matches(PERSON_CODE_PATTERN, { message: 'q may contain only letters, digits and "-"' })
  q?: string;
}
