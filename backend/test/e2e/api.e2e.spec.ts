import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getPrisma } from '../helpers/test-app';

/**
 * E2E tests for the HTTP contract: routing, status codes, request validation,
 * error-body shape, and pagination shape. The deep money/business rules are
 * covered by the integration suite; here we assert the API surface behaves as
 * documented so clients (and the frontend) can rely on it.
 */
describe('Billing API (e2e contract)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;
  let productId: string;
  let customerId: string;

  beforeAll(async () => {
    app = await createTestApp('test-api.db');
    prisma = getPrisma(app);

    const product = await prisma.product.create({
      data: { name: 'Test Widget', unitPrice: 250 },
    });
    productId = product.id;
    const customer = await prisma.customer.create({
      data: { name: 'Test Customer', walletBalance: 1000 },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('GET /api/health returns ok', async () => {
    const res = await request(server()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/products lists products', async () => {
    const res = await request(server()).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('unitPrice');
  });

  it('GET /api/customers returns the paginated shape { data, total, offset, limit }', async () => {
    const res = await request(server()).get('/api/customers?limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('offset', 0);
    expect(res.body).toHaveProperty('limit', 10);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/customers/:id returns a customer', async () => {
    const res = await request(server()).get(`/api/customers/${customerId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(customerId);
  });

  it('GET /api/customers/:id returns 404 with a typed error code', async () => {
    const res = await request(server()).get('/api/customers/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error).toHaveProperty('statusCode', 404);
  });

  it('POST /api/consumption returns 201 and the result shape', async () => {
    const res = await request(server())
      .post('/api/consumption')
      .send({ customerId, productId, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('event');
    expect(res.body).toHaveProperty('walletBalance');
    expect(res.body).toHaveProperty('replayed', false);
  });

  it('POST /api/consumption returns 422 on insufficient funds', async () => {
    const res = await request(server())
      .post('/api/consumption')
      .send({ customerId, productId, quantity: 1_000_000 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('POST /api/consumption returns 400 on invalid quantity', async () => {
    const res = await request(server())
      .post('/api/consumption')
      .send({ customerId, productId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('POST /api/consumption returns 404 for an unknown product', async () => {
    const res = await request(server())
      .post('/api/consumption')
      .send({ customerId, productId: 'nope', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('POST /api/customers/:id/credit returns 200', async () => {
    const res = await request(server())
      .post(`/api/customers/${customerId}/credit`)
      .send({ amountCents: 5000 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('walletBalance');
  });

  it('POST /api/customers/:id/credit rejects non-positive amounts (400)', async () => {
    const res = await request(server())
      .post(`/api/customers/${customerId}/credit`)
      .send({ amountCents: -10 });
    expect(res.status).toBe(400);
  });

  it('GET /api/customers/:id/consumption returns the paginated history shape', async () => {
    const res = await request(server()).get(
      `/api/customers/${customerId}/consumption?limit=10&offset=0`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('offset', 0);
    expect(res.body).toHaveProperty('limit', 10);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
