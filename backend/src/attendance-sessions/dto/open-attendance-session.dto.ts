import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

/**
 * The lecturer's device location is optional. When it is sent, students are
 * measured from it for this session; when it is not, from the section's point.
 */
export class OpenAttendanceSessionDto {
  @IsUUID()
  classSectionId!: string;

  @ValidateIf((dto: OpenAttendanceSessionDto) => dto.latitude !== undefined || dto.longitude !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf((dto: OpenAttendanceSessionDto) => dto.latitude !== undefined || dto.longitude !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** `GeolocationCoordinates.accuracy` from the browser, in meters. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;
}
