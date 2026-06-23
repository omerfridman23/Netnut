import { hostname } from 'node:os';
import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    // `instance` is the container hostname, which differs per replica — handy for
    // observing that the gateway distributes requests across both backends.
    const base = { instance: hostname(), pid: process.pid };

    try {
      await this.prisma.ping();
      res.status(HttpStatus.OK).json({ ...base, status: 'ok', db: 'up' });
    } catch (err) {
      this.logger.error('Health check: database unreachable', (err as Error)?.stack);
      // Return 503 so load-balancers and orchestrators can pull this instance out of rotation.
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ ...base, status: 'degraded', db: 'down' });
    }
  }
}
