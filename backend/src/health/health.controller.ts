import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope } from '../openapi/api-envelope';
import { HealthDto } from './dto/health.response.dto';
import { Public } from '../auth/decorators/public.decorator';

/**
 * GET /api/health (spec §21) - public service monitoring endpoint.
 * It requires no Core Hub authentication and exposes no internal detail.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public liveness check' })
  @ApiEnvelope(HealthDto)
  check() {
    return {
      status: 'ok',
      service: this.config.get<string>('subsystemId', 'csmju-attendance-checker'),
    };
  }
}
