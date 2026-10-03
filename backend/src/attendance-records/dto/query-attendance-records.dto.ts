import { IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * Staff search over the check-ins of one class section.
 *
 * `from` / `to` are ISO 8601 instants and form a half-open range
 * (`from <= checkedInAt < to`), so the UI sends the start of the first day
 * and the start of the day after the last one, in its own time zone.
 */
export class QueryAttendanceRecordsDto extends PaginationQueryDto {
  @IsUUID()
  classSectionId!: string;

  /** Student id, or its leading digits. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9A-Za-z-]+$/, { message: 'personCode may contain only letters, digits and "-"' })
  personCode?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
