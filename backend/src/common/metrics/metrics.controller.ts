import { hostname } from 'node:os';
import { Controller, Get } from '@nestjs/common';
import { metrics } from './metrics.store';

/**
 * Read-only snapshot of this instance's runtime counters.
 * Handy for *seeing* the concurrency machinery work under load: hit the system
 * hard, then watch `dbRetries` climb while consistency stays intact.
 */
@Controller('metrics')
export class MetricsController {
  @Get()
  snapshot() {
    return {
      instance: hostname(),
      uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
      consume: {
        ok: metrics.consumeOk,
        replayed: metrics.consumeReplayed,
        insufficientFunds: metrics.consumeInsufficient,
        notFound: metrics.consumeNotFound,
      },
      credit: {
        ok: metrics.creditOk,
        replayed: metrics.creditReplayed,
      },
      db: {
        retries: metrics.dbRetries,
        retriesExhausted: metrics.dbRetryExhausted,
      },
    };
  }
}
