import { HttpStatus, Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorDto, PageMetaDto } from './envelope.dto';

/**
 * Documents a success answer wrapped by ResponseInterceptor:
 * `{ success: true, data }`, or `{ success: true, data: [], meta }` for a
 * paginated collection.
 */
export function ApiEnvelope(
  model: Type<unknown>,
  options: { status?: HttpStatus; collection?: boolean; description?: string } = {},
) {
  const data = options.collection
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };
  const properties: Record<string, object> = {
    success: { type: 'boolean', enum: [true] },
    data,
  };
  if (options.collection) {
    properties.meta = { $ref: getSchemaPath(PageMetaDto) };
  }
  return applyDecorators(
    ApiExtraModels(model, PageMetaDto),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description ?? 'Success',
      schema: { type: 'object', required: Object.keys(properties), properties },
    }),
  );
}

const ERROR_TEXT: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad request or VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'No valid Core Hub session',
  [HttpStatus.FORBIDDEN]: 'The role or ownership does not allow this',
  [HttpStatus.NOT_FOUND]: 'Not found',
  [HttpStatus.CONFLICT]: 'Conflicts with the current state',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Core Hub is unavailable',
};

/** Documents the error answers an endpoint can give, all with ApiErrorDto. */
export function ApiErrors(...statuses: HttpStatus[]) {
  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ...statuses.map((status) =>
      ApiResponse({ status, description: ERROR_TEXT[status] ?? 'Error', type: ApiErrorDto }),
    ),
  );
}
