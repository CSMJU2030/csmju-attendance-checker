import { ApiProperty } from '@nestjs/swagger';
import { SubsystemRole } from '../core-hub-identity';

export class MeSessionDto {
  /** The token's `exp`. Past it the next call returns 401 and /auth/login runs again. */
  expiresAt!: Date | null;
}

/** GET /api/v1/me - the verified Core Hub identity plus this subsystem's role. */
export class MeDto {
  /** Core Hub user id (`sub`). */
  id!: string;

  email!: string;

  /** Core Hub role from the token, e.g. `student` or `lecturer`. */
  coreRole!: string;

  @ApiProperty({ enum: SubsystemRole, enumName: 'SubsystemRole' })
  subsystemRole!: SubsystemRole;

  session!: MeSessionDto;
}
