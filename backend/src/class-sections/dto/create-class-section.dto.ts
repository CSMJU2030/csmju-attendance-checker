import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateClassSectionDto {
  /** e.g. CS201 */
  @IsString()
  @Matches(/^[A-Z]{2,4}\d{3,4}$/, { message: 'courseCode must look like CS201' })
  courseCode!: string;

  @IsString()
  @Length(1, 200)
  courseName!: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  lateAfterMinutes?: number;
}
