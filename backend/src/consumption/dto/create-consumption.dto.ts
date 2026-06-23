import { Type } from 'class-transformer';
import { IsInt, IsPositive, IsString, Max, MinLength } from 'class-validator';

/** Body for recording a consumption event. */
export class CreateConsumptionDto {
  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @IsPositive({ message: 'quantity must be greater than 0' })
  @Max(1_000_000, { message: 'quantity exceeds the maximum allowed per request' })
  quantity!: number;
}
