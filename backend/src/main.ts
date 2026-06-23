import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // All routes are served under /api.
  app.setGlobalPrefix('api');

  // Validate + transform every request body/query against its DTO.
  // whitelist strips unknown properties; forbidNonWhitelisted rejects them.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // In production set CORS_ORIGINS to the exact frontend origin(s).
  // When unset (dev), all origins are allowed so the local frontend works without config.
  const corsOrigin = env.corsOrigins.length > 0 ? env.corsOrigins : true;
  app.enableCors({ origin: corsOrigin });

  // Graceful shutdown so SQLite connections close cleanly.
  app.enableShutdownHooks();

  await app.listen(env.port, '0.0.0.0');
  new Logger('Bootstrap').log(`Backend listening on port ${env.port} (pid ${process.pid})`);
}

void bootstrap();
