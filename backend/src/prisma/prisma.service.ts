import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Wraps the Prisma client as an injectable Nest provider and applies the SQLite
 * PRAGMAs that make concurrent, multi-instance access safe and well-behaved:
 *
 *   - journal_mode=WAL  : readers don't block the writer (faster dashboards) and
 *                         the single writer doesn't block readers.
 *   - busy_timeout=N    : when another connection/instance holds the write lock,
 *                         wait up to N ms (retrying internally) instead of
 *                         immediately failing with SQLITE_BUSY.
 *   - foreign_keys=ON   : enforce referential integrity (off by default in SQLite).
 *
 * Because DATABASE_URL pins connection_limit=1, these per-connection PRAGMAs
 * apply to the single connection this process uses.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.applySqlitePragmas();
    this.logger.log('Prisma connected and SQLite PRAGMAs applied');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Verifies the database connection is alive. Throws on failure. */
  async ping(): Promise<void> {
    await this.$queryRawUnsafe('SELECT 1');
  }

  private async applySqlitePragmas(): Promise<void> {
    // Some PRAGMAs return a result row (e.g. journal_mode echoes "wal"), which
    // SQLite forbids via $executeRaw. $queryRawUnsafe handles both cases.
    // WAL is persisted on the database file; setting it repeatedly is harmless.
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await this.$queryRawUnsafe(`PRAGMA busy_timeout = ${env.busyTimeoutMs};`);
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    // NORMAL is the recommended durability/performance balance when using WAL.
    await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  }
}
