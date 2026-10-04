import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateClassSectionDto {
  /** Core Hub course code with its version, e.g. 10301111-1 (GET /api/v1/courses). */
  @IsString()
  @Matches(/^[0-9A-Za-z][0-9A-Za-z_.-]{0,39}$/, { message: 'courseCode must be a Core Hub course code' })
  courseCode!: string;

  /** e.g. 1 or 01 */
  @IsString()
  @Matches(/^\d{1,3}$/, { message: 'sectionCode must be 1-3 digits' })
  sectionCode!: string;

  /** Gregorian year, e.g. 2026 (the UI shows 2569). */
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  academicYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  term!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(500)
  radiusMeters?: number;
}
