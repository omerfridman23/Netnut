import { EventWithProduct } from '../consumption.types';

/**
 * A single consumption history record returned to clients. Money in cents.
 *
 * Built from a CONSUME row in the unified WalletTransaction ledger: such rows
 * always carry productId/quantity/unitPrice, and their signed `amount` is
 * negative, so the displayed `totalCost` is `-amount`.
 */
export class ConsumptionEventDto {
  id: string;
  customerId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  createdAt: string;

  constructor(tx: EventWithProduct) {
    this.id = tx.id;
    this.customerId = tx.customerId;
    this.productId = tx.productId ?? '';
    this.productName = tx.product?.name;
    this.quantity = tx.quantity ?? 0;
    this.unitPrice = tx.unitPrice ?? 0;
    this.totalCost = -tx.amount;
    this.createdAt = tx.createdAt.toISOString();
  }
}
