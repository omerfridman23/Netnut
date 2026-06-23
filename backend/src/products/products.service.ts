import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { ProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async findAll(): Promise<ProductDto[]> {
    const products = await this.repository.findAll();
    return products.map((p) => new ProductDto(p));
  }
}
