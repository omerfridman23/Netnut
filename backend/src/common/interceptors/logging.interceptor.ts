import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Assigns a unique request ID to every incoming request and logs one structured
 * line per request with method, path, status, latency, and that ID.
 *
 * The ID is:
 *   - Read from `X-Request-Id` if the client or gateway already sent one.
 *   - Otherwise generated as a UUID and attached to both the request object and
 *     the `X-Request-Id` response header so clients can correlate retries.
 *
 * Downstream code (error filter, etc.) reads `req.requestId` to include it in logs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { requestId: string }>();
    const res = http.getResponse<Response>();
    const start = Date.now();

    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms [${requestId}]`,
        );
      }),
    );
  }
}
