import { Customer } from '@prisma/client';

/** Customer representation returned to clients. Money fields are in cents. */
export class CustomerDto {
  id: string;
  name: string;
  walletBalance: number;
  createdAt: string;
  updatedAt: string;

  constructor(customer: Customer) {
    this.id = customer.id;
    this.name = customer.name;
    this.walletBalance = customer.walletBalance;
    this.createdAt = customer.createdAt.toISOString();
    this.updatedAt = customer.updatedAt.toISOString();
  }
}
