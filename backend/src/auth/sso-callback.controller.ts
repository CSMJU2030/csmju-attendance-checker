import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { AppException } from '../common/errors';
import { AuthEventsLogger } from './auth-events.logger';
import { TokenRejectionReason, TokenVerificationError } from './auth.errors';
import { CoreHubTokenVerifier } from './core-hub-token.verifier';
import { Public } from './decorators/public.decorator';
import { SsoCallbackQueryDto } from './dto/sso-callback.dto';
import { mapCoreRoleToSubsystemRole } from './role-mapping';
import { buildSsoCookie } from './sso-session';

/**
 * Central SSO callback - the destination Core Hub has on file in the Subsystem
 * Registry (`GET /auth/callback`, outside the `/api` prefix).
 *
 * It reuses the existing verification chain unchanged:
 *   CoreHubTokenVerifier -> JwksService (RS256, kid, iss, aud, exp)
 * and then establishes an authenticated browser context by storing the very
 * same Core Hub token in an HttpOnly cookie. The subsystem still issues no
 * token, no session record and no credential of its own.
 */
@Controller('auth')
export class SsoCallbackController {
  constructor(
    private readonly verifier: CoreHubTokenVerifier,
    private readonly authEvents: AuthEventsLogger,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('callback')
  async callback(
    @Query() query: SsoCallbackQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    let payload;

    try {
      payload = await this.verifier.verify(query.access_token);
    } catch (error) {
      const reason =
        error instanceof TokenVerificationError
          ? error.reason
          : TokenRejectionReason.MALFORMED_TOKEN;
      const kid = error instanceof TokenVerificationError ? error.kid : undefined;

      this.authEvents.jwtRejected({ reason, kid, path: '/auth/callback' });

      throw AppException.unauthorized(
        'The Core Hub SSO token could not be verified',
      );
    }

    const subsystemRole = mapCoreRoleToSubsystemRole(payload.role);

    if (!subsystemRole) {
      this.authEvents.roleMappingFailed({ sub: payload.sub, coreRole: payload.role });

      throw AppException.forbidden(
        'Your Core Hub role has no access to this subsystem',
      );
    }

    const expiresInSec = this.remainingLifetimeSec(payload.exp);

    response.setHeader(
      'Set-Cookie',
      buildSsoCookie(
        query.access_token,
        expiresInSec,
        this.config.get<string>('nodeEnv') === 'production',
      ),
    );

    this.authEvents.jwtVerified({
      sub: payload.sub,
      coreRole: payload.role,
      subsystemRole,
    });

    return {
      id: payload.sub,
      email: payload.email ?? '',
      coreRole: payload.role,
      subsystemRole,
      session: {
        source: 'core-hub-sso',
        expiresIn: expiresInSec,
      },
      ...(query.state !== undefined && { state: query.state }),
    };
  }

  private remainingLifetimeSec(exp: number | undefined): number {
    if (typeof exp !== 'number') {
      return 0;
    }

    return Math.max(0, exp - Math.floor(Date.now() / 1000));
  }
}
