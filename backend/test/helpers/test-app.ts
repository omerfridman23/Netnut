import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Boots a real NestJS app backed by an isolated SQLite test database.
 *
 * Each test file passes a unique dbFile so suites never collide. We use
 * `prisma db push --force-reset` to create a clean schema (faster than running
 * the full migration history and sufficient for tests). The same global pipes
 * and filters as production are applied so behavior/HTTP codes match real usage.
 */
export async function createTestApp(dbFile: string): Promise<INestApplication> {
  // connection_limit=1 mirrors production: a single SQLite connection per process
  // so our busy_timeout/WAL PRAGMAs reliably govern all access (no pool contention).
  const url = `file:./${dbFile}?connection_limit=1`;
  process.env.DATABASE_URL = url;

  // Clear any leftover DB + WAL/SHM sidecar files so each run starts clean.
  // Prisma resolves relative file: paths against the schema dir (prisma/).
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(join(process.cwd(), 'prisma', `${dbFile}${suffix}`), { force: true });
  }

  execSync('npx prisma db push --skip-generate --force-reset', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}
