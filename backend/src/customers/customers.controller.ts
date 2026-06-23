import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomerDto } from './dto/customer.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResult<CustomerDto>> {
    return this.customersService.findPage(query.limit, query.offset);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CustomerDto> {
    return this.customersService.findByIdOrThrow(id);
  }

  /**
   * Credit (top up) a wallet. Returns 200 with the updated customer.
   *
   * Optionally accepts an `Idempotency-Key` header (Stripe-style): a retried
   * top-up with the same key is applied at most once and replays the original
   * result. The balance is incremented atomically, so concurrent top-ups never
   * lose each other.
   */
  @Post(':id/credit')
  @HttpCode(HttpStatus.OK)
  credit(
    @Param('id') id: string,
    @Body() dto: CreditWalletDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CustomerDto> {
    const key = idempotencyKey?.trim();
    return this.customersService.creditWallet(id, dto.amountCents, key ? key : null);
  }
}
