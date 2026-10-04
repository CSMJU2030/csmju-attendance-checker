import { ApiProperty } from '@nestjs/swagger';

/** A class group that takes attendance in one room. */
export class ClassSectionDto {
  id!: string;
  /** Core Hub course code with its version, e.g. 10301111-1. */
  courseCode!: string;
  /** From Core Hub when the course is in its catalog, else the name typed before the link. */
  courseName!: string;
  /** False for a section typed in before the Core Hub link, or while Core Hub is unreachable. */
  courseInCatalog!: boolean;
  sectionCode!: string;
  /** Gregorian year; the UI shows the Buddhist era. */
  academicYear!: number;
  term!: number;
  latitude!: number;
  longitude!: number;
  /** Students must be within this many meters of the check-in point. */
  radiusMeters!: number;
  /** Core Hub user (`sub`) of the staff member who owns the section. */
  ownerCoreUserId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

/** DELETE /api/v1/class-sections/:id */
export class DeletedClassSectionDto {
  id!: string;

  @ApiProperty({ type: 'boolean', enum: [true] })
  deleted!: true;
}
