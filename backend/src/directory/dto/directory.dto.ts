import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** GET /api/v1/people - active students in Core Hub. */
export class QueryStudentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  /** Department code from GET /api/v1/departments. */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{1,30}$/, { message: 'departmentCode is not a department code' })
  departmentCode?: string;

  /** Buddhist-era year the student entered, e.g. 2566. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2500)
  @Max(2700)
  entryYear?: number;

  /** Student id or part of a name. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
}

/** One student from Core Hub, shown while picking a roster - never stored. */
export class StudentSummaryDto {
  personCode!: string;
  fullNameTh!: string;
  entryYear!: number | null;
  departmentCode!: string | null;
  departmentNameTh!: string | null;
}

/** An active department from Core Hub reference data. */
export class DepartmentDto {
  code!: string;
  nameTh!: string;
  facultyCode!: string;
}
