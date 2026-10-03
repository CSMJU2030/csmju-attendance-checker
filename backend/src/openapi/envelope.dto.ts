import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode } from '../common/errors';

/** `meta` of a paginated collection (api-conventions 5). */
export class PageMetaDto {
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class ApiErrorBodyDto {
  /** One of the codes in standards/contracts/error-codes.json. */
  @ApiProperty({ enum: Object.values(ErrorCode), enumName: 'ErrorCode' })
  code!: string;

  message!: string;

  /** Field errors for VALIDATION_ERROR, or extra facts such as `distanceMeters`. */
  @ApiProperty({ required: false, description: 'Field errors for VALIDATION_ERROR, or extra facts such as `distanceMeters`.' })
  details?: unknown;
}

/** Every error answer: `{ success: false, error }` (api-conventions 3). */
export class ApiErrorDto {
  @ApiProperty({ type: 'boolean', enum: [false] })
  success!: false;

  error!: ApiErrorBodyDto;
}
