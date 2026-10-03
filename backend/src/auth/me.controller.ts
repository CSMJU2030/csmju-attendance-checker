import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../openapi/api-envelope';
import { CurrentUser } from './decorators/current-user.decorator';
import { CoreHubIdentity } from './core-hub-identity';
import { MeDto } from './dto/me.response.dto';

/**
 * GET /api/v1/me (spec §22)
 *
 * Proves the subsystem trusts the *verified* Core Hub identity: every field
 * below comes from a signature-checked JWT claim plus the subsystem's own
 * role mapping.
 *
 * `session.expiresAt` is the token's `exp` (auth-contract 5): a frontend can
 * renew ahead of it - through /auth/login - before showing a long form.
 */
@ApiTags('me')
@ApiBearerAuth()
@ApiCookieAuth('session')
@Controller('v1/me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'The signed-in user and their role in this subsystem' })
  @ApiEnvelope(MeDto)
  @ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  me(@CurrentUser() user: CoreHubIdentity) {
    return {
      id: user.id,
      email: user.email,
      coreRole: user.coreRole,
      subsystemRole: user.subsystemRole,
      session: {
        expiresAt: user.exp !== undefined ? new Date(user.exp * 1000).toISOString() : null,
      },
    };
  }
}
