/**
 * Writes backend/openapi.json from the controllers and DTOs (tech-stack 3,
 * check API-01). Run it with `pnpm run generate:openapi`: the script first
 * runs `nest build`, because the @nestjs/swagger compiler plugin (nest-cli.json)
 * is what reads the DTO property types.
 *
 * CI runs this without a database, Core Hub or .env, so the app is created in
 * preview mode - modules and routes are scanned, no provider is instantiated
 * and nothing connects anywhere. The output must be byte-for-byte stable:
 * CI regenerates it and fails when it differs from the committed file.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ConfigModule validates the environment at import time; a placeholder is
// enough here because preview mode never connects to the database.
process.env.DATABASE_URL ||= 'postgresql://openapi:openapi@localhost:5432/openapi';

async function generate(): Promise<void> {
  const { AppModule } = await import('../app.module');
  const { ROUTES_OUTSIDE_API_PREFIX } = await import('../app-setup');

  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  // Same prefix as main.ts, so the paths match what the server answers.
  app.setGlobalPrefix('api', { exclude: ROUTES_OUTSIDE_API_PREFIX });

  const config = new DocumentBuilder()
    .setTitle('Attendance Checker API')
    .setDescription(
      'csmju-attendance-checker - CSMJU2030 subsystem. Every /api/v1 route needs the Core Hub ' +
        'access token: the HttpOnly session cookie set by /auth/callback, or a Bearer header.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('csmju_attendance_checker_access_token', { type: 'apiKey', in: 'cookie' }, 'session')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  await app.close();

  const target = join(__dirname, '..', '..', '..', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`openapi.json written: ${Object.keys(document.paths).length} paths`);
}

void generate();
