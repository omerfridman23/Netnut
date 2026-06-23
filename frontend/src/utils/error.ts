import { ApiError } from '../api/client';

/**
 * Returns the server's own message for ApiErrors, or a caller-supplied
 * fallback string for any other thrown value.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
