import { ApiProperty } from '@nestjs/swagger';

/** GET /api/health */
export class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  /** This subsystem's id, e.g. `csmju-attendance-checker`. */
  service!: string;
}
