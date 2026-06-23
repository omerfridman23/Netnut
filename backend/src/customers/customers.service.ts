import { Injectable } from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { CustomerDto } from './dto/customer.dto';
import { PaginatedResult, toPaginatedResult } from '../common/dto/pagination.dto';
import { ResourceNotFoundException } from '../common/errors/app.errors';
import { recordCredit } from '../common/metrics/metrics.store';

@Injectable()
export class CustomersService {
  constructor(private readonly repository: CustomersRepository) {}

  async findPage(limit: number, offset: number): Promise<PaginatedResult<CustomerDto>> {
    const { rows, total } = await this.repository.findPage(limit, offset);
    return toPaginatedResult(rows, total, offset, limit, (r) => new CustomerDto(r));
  }

  async findByIdOrThrow(id: string): Promise<CustomerDto> {
    const customer = await this.repository.findById(id);
    if (!customer) throw new ResourceNotFoundException('Customer', id);
    return new CustomerDto(customer);
  }

  async creditWallet(
    id: string,
    amountCents: number,
    idempotencyKey?: string | null,
  ): Promise<CustomerDto> {
    const result = await this.repository.creditWallet(id, amountCents, idempotencyKey ?? null);

    switch (result.status) {
      case 'customer_not_found':
        throw new ResourceNotFoundException('Customer', id);
      case 'replayed':
        // Idempotent retry: same key, original result, wallet untouched.
        recordCredit('replayed');
        return new CustomerDto(result.customer);
      case 'ok':
        recordCredit('ok');
        return new CustomerDto(result.customer);
    }
  }
}
