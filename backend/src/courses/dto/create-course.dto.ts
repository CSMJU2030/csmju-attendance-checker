import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateCourseDto {
  /** e.g. CS101 - unique across the subsystem (spec §26). */
  @IsString()
  @Matches(/^[A-Z]{2,4}\d{3,4}$/, { message: 'courseCode must look like CS101' })
  courseCode!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  credits!: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}
