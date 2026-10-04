import { ApiProperty } from '@nestjs/swagger';

/** One student on a class section's roster - the id only, never a name. */
export class RosterStudentDto {
  personCode!: string;
  /** When the student was added to the roster. */
  addedAt!: Date;
}

export class AddRosterStudentsResultDto {
  /** How many student ids were newly added. */
  added!: number;
  /** Ids that were already on the roster and were skipped. */
  alreadyOnRoster!: string[];
}

export class RemovedRosterStudentDto {
  personCode!: string;

  @ApiProperty({ type: 'boolean', enum: [true] })
  removed!: true;
}
