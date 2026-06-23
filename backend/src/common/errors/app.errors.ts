import { HttpException, HttpStatus } from '@nestjs/common';
import { formatUsd } from '../money';

/**
 * Domain-specific exceptions.
 *
 * Each carries a stable, machine-readable `code` (so the frontend can branch on
 * error type without parsing messages) plus the right HTTP status. They extend
 * Nest's HttpException so the framework + our global filter handle them uniformly.
 */
export abstract class AppException extends HttpException {
  abstract readonly code: string;

  constructor(status: HttpStatus, message: string) {
    super(message, status);
  }
}

export class ResourceNotFoundException extends AppException {
  readonly code = 'RESOURCE_NOT_FOUND';

  constructor(resource: string, id: string) {
    super(HttpStatus.NOT_FOUND, `${resource} with id "${id}" was not found`);
  }
}

export class InsufficientFundsException extends AppException {
  readonly code = 'INSUFFICIENT_FUNDS';

  constructor(required: number, available: number) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      `Insufficient wallet balance: this charge needs ${formatUsd(required)} but the wallet only has ${formatUsd(available)}.`,
    );
  }
}

export class InvalidRequestException extends AppException {
  readonly code = 'INVALID_REQUEST';

  constructor(message: string) {
    super(HttpStatus.BAD_REQUEST, message);
  }
}
