import { Module } from '@nestjs/common';
import {
  ConsumptionController,
  CustomerConsumptionController,
} from './consumption.controller';
import { ConsumptionService } from './consumption.service';
import { ConsumptionRepository } from './consumption.repository';
import { ProductsModule } from '../products/products.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [ProductsModule, CustomersModule],
  controllers: [ConsumptionController, CustomerConsumptionController],
  providers: [ConsumptionService, ConsumptionRepository],
})
export class ConsumptionModule {}
