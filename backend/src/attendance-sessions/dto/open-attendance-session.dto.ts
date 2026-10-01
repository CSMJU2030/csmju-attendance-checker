import { IsUUID } from 'class-validator';

export class OpenAttendanceSessionDto {
  @IsUUID()
  classSectionId!: string;
}
