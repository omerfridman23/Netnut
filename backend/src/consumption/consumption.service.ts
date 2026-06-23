import { Injectable } from '@nestjs/common';
import { ConsumptionRepository } from './consumption.repository';
import { ProductsRepository } from '../products/products.repository';
import { CustomersRepository } from '../customers/customers.repository';
import { CreateConsumptionDto } from './dto/create-consumption.dto';
import { ConsumptionEventDto } from './dto/consumption-event.dto';
import { ConsumptionResultDto } from './dto/consumption-result.dto';
import { PaginatedResult, toPaginatedResult } from '../common/dto/pagination.dto';
import {
  InsufficientFundsException,
  ResourceNotFoundException,
} from '../common/errors/app.errors';
import { recordConsume } from '../common/metrics/metrics.store';

@Injectable()
export class ConsumptionService {
  constructor(
    private readonly repository: ConsumptionRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly customersRepository: CustomersRepository,
  ) {}

  async consume(
    dto: CreateConsumptionDto,
    idempotencyKey?: string | null,
  ): Promise<ConsumptionResultDto> {
    // Look up the product to get an authoritative price (never trust the client
    // for pricing) and snapshot it onto the event.
    const product = await this.productsRepository.findById(dto.productId);
    if (!product) throw new ResourceNotFoundException('Product', dto.productId);

    const totalCost = product.unitPrice * dto.quantity;

    const result = await this.repository.consume({
      customerId: dto.customerId,
      productId: dto.productId,
      quantity: dto.quantity,
      unitPrice: product.unitPrice,
      totalCost,
      idempotencyKey: idempotencyKey ?? null,
    });

    switch (result.status) {
      case 'customer_not_found':
        recordConsume('not_found');
        throw new ResourceNotFoundException('Customer', dto.customerId);
      case 'insufficient_funds':
        recordConsume('insufficient');
        throw new InsufficientFundsException(totalCost, result.available);
      case 'replayed':
        // Idempotent retry: same key, original result, wallet untouched.
        recordConsume('replayed');
        return {
          event: new ConsumptionEventDto(result.event),
          walletBalance: result.walletBalance,
          replayed: true,
        };
      case 'ok':
        recordConsume('ok');
        return {
          event: new ConsumptionEventDto(result.event),
          walletBalance: result.walletBalance,
          replayed: false,
        };
    }
  }

  async findHistory(
    customerId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<ConsumptionEventDto>> {
    const customer = await this.customersRepository.findById(customerId);
    if (!customer) throw new ResourceNotFoundException('Customer', customerId);

    const { rows, total } = await this.repository.findHistory(customerId, limit, offset);
    return toPaginatedResult(rows, total, offset, limit, (e) => new ConsumptionEventDto(e));
  }
}
