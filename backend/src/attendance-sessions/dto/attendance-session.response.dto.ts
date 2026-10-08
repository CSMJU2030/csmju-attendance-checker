import { ApiProperty } from '@nestjs/swagger';

/** One attendance round. The secret behind the code never leaves the backend. */
export class AttendanceSessionDto {
  id!: string;
  classSectionId!: string;
  openedByCoreUserId!: string;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'], enumName: 'AttendanceSessionStatus' })
  status!: 'OPEN' | 'CLOSED';

  openedAt!: Date;
  closedAt!: Date | null;
  /** Where the lecturer stood when opening; null = the class section's point. */
  latitude!: number | null;
  longitude!: number | null;
  /** Students who checked in to this session. */
  recordCount!: number;
}

/** The 6-digit code to show in class; it changes every `stepSeconds`. */
export class CurrentCodeDto {
  code!: string;
  expiresAt!: Date;
  stepSeconds!: number;
}

/** POST /api/v1/attendance-sessions - the new session with its first code. */
export class OpenedAttendanceSessionDto extends AttendanceSessionDto {
  code!: CurrentCodeDto;
}
