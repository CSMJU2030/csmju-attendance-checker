import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** `courseCode` is the stable business key and cannot be changed. */
export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  credits?: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}
