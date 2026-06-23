import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { ConsumptionModule } from './consumption/consumption.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    MetricsModule,
    ProductsModule,
    CustomersModule,
    ConsumptionModule,
  ],
})
export class AppModule {}
