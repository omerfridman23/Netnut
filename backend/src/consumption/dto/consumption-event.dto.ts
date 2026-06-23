import { EventWithProduct } from '../consumption.types';

/** A single consumption history record returned to clients. Money in cents. */
export class ConsumptionEventDto {
  id: string;
  customerId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  createdAt: string;

  constructor(event: EventWithProduct) {
    this.id = event.id;
    this.customerId = event.customerId;
    this.productId = event.productId;
    this.productName = event.product?.name;
    this.quantity = event.quantity;
    this.unitPrice = event.unitPrice;
    this.totalCost = event.totalCost;
    this.createdAt = event.createdAt.toISOString();
  }
}
