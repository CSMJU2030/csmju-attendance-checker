import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateStudentDto {
  /** e.g. CS67001 */
  @IsString()
  @Matches(/^[A-Z]{2,4}\d{4,6}$/, {
    message: 'studentCode must look like CS67001',
  })
  studentCode!: string;

  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 100)
  faculty!: string;

  @IsString()
  @Length(1, 100)
  major!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  year!: number;

  /**
   * OPTIONAL external reference to a Core Hub identity (`sub`).
   * It links business data to a Core Hub user - it is NOT an authentication
   * record and never carries credentials (spec §34).
   */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  coreUserId?: string;
}
