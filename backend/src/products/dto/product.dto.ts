import { Product } from '@prisma/client';

/** Shape returned to clients for a product. Money fields are in cents. */
export class ProductDto {
  id: string;
  name: string;
  unitPrice: number;
  createdAt: string;

  constructor(product: Product) {
    this.id = product.id;
    this.name = product.name;
    this.unitPrice = product.unitPrice;
    this.createdAt = product.createdAt.toISOString();
  }
}
