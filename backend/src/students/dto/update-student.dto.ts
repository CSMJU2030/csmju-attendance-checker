import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * `studentCode` is intentionally NOT updatable: it is the stable business key.
 * Which of these fields a caller may change depends on their permissions -
 * see StudentsService.update().
 */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  faculty?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  major?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  year?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  coreUserId?: string;
}
