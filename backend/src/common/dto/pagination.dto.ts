import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query params for offset/limit pagination. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

/** Paginated response shape returned to all list endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Turns a `{ rows, total }` repository result into the standard API envelope.
 * Eliminates the repeated `{ data: rows.map(fn), total, offset, limit }` boilerplate
 * from every paginated service method.
 */
export function toPaginatedResult<TRow, TDto>(
  rows: TRow[],
  total: number,
  offset: number,
  limit: number,
  map: (row: TRow) => TDto,
): PaginatedResult<TDto> {
  return { data: rows.map(map), total, offset, limit };
}
