import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ConsumptionService } from './consumption.service';
import { CreateConsumptionDto } from './dto/create-consumption.dto';
import { ConsumptionEventDto } from './dto/consumption-event.dto';
import { ConsumptionResultDto } from './dto/consumption-result.dto';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination.dto';

@Controller('consumption')
export class ConsumptionController {
  constructor(private readonly consumptionService: ConsumptionService) {}

  /**
   * Record a consumption event and atomically deduct its cost. 201 on success.
   *
   * Optionally accepts an `Idempotency-Key` header (Stripe-style). If a request
   * with the same key was already processed, the original result is replayed and
   * the wallet is NOT charged again — making retries safe under at-least-once
   * delivery (dropped responses, client retries, queue redelivery).
   */
  @Post()
  consume(
    @Body() dto: CreateConsumptionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ConsumptionResultDto> {
    const key = idempotencyKey?.trim();
    return this.consumptionService.consume(dto, key ? key : null);
  }
}

/**
 * History lives under the customer resource: GET /api/customers/:id/consumption.
 * Kept in the consumption module since it's consumption data, but routed under
 * the customer it belongs to.
 */
@Controller('customers')
export class CustomerConsumptionController {
  constructor(private readonly consumptionService: ConsumptionService) {}

  @Get(':id/consumption')
  history(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<ConsumptionEventDto>> {
    return this.consumptionService.findHistory(id, query.limit, query.offset);
  }
}
