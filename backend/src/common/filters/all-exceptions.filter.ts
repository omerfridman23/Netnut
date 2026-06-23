import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../errors/app.errors';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    statusCode: number;
  };
}

/**
 * Single place that turns ANY thrown error into a consistent JSON error response:
 *
 *   { "error": { "code": "...", "message": "...", "statusCode": 422 } }
 *
 * This keeps the API contract uniform, hides internal details/stack traces from
 * clients, and ensures the process never crashes on an unhandled controller error.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const { status, code, message, details } = this.normalize(exception);
    const requestId = request.requestId ?? 'unknown';
    const prefix = `${request.method} ${request.url} -> ${status} ${code}: ${message} [${requestId}]`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(prefix, (exception as Error)?.stack);
    } else {
      this.logger.warn(prefix);
    }

    const body: ErrorBody = { error: { code, message, statusCode: status } };
    if (details !== undefined) body.error.details = details;

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    // Our own domain exceptions carry a stable code.
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    // Built-in / validation-pipe HttpExceptions.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        const message = Array.isArray(obj.message)
          ? (obj.message as string[]).join('; ')
          : ((obj.message as string) ?? exception.message);
        return {
          status,
          code: this.codeForStatus(status),
          message,
          details: Array.isArray(obj.message) ? obj.message : undefined,
        };
      }
      return { status, code: this.codeForStatus(status), message: exception.message };
    }

    // Anything else is an unexpected server error.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'INVALID_REQUEST';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'ERROR';
    }
  }
}
