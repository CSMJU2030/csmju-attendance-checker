import { IsUUID } from 'class-validator';

/**
 * NOTE: there is deliberately no `coreUserId`/`role` field here. Identity comes
 * only from the verified Core Hub token (spec §8, §41.7-41.8). A STUDENT may
 * pass a `studentId`, but the service rejects it unless it is their own record.
 */
export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  courseId!: string;
}
