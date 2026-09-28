import { EnrollmentStatus } from '../../../generated/prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEnrollmentDto {
  @IsEnum(EnrollmentStatus, {
    message: 'status must be one of ENROLLED, DROPPED, COMPLETED',
  })
  status!: EnrollmentStatus;
}
