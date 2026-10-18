import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 6: Exchange API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;
  let customerId: string;
  let goldId: string;
  let p22kId: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = loginRes.body.data.token;

    // Create customer via API
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Vikas Sharma',
        phone: '9822011223',
        city: 'Mumbai',
      });
    customerId = custRes.body.data.id;

    // Get masters
    const metalsRes = await request(app)
      .get('/api/rates/metals')
      .set('Authorization', `Bearer ${authToken}`);
    const gold = metalsRes.body.data.find((m: any) => m.code === 'GOLD');
    goldId = gold.id;

    const puritiesRes = await request(app)
      .get(`/api/rates/metals/${gold.id}/purities`)
      .set('Authorization', `Bearer ${authToken}`);
    const p22k = puritiesRes.body.data.find((p: any) => p.code === '22K');
    p22kId = p22k.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb) {
      testDb.close();
    }
  });

  it('POST /api/exchanges creates a draft exchange transaction with items', async () => {
    const res = await request(app)
      .post('/api/exchanges')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        exchange_date: '2026-10-04',
        notes: 'API Created Exchange',
        items: [
          {
            source_type: 'CUSTOMER_JEWELLERY',
            metal_id: goldId,
            purity_id: p22kId,
            item_name: 'Old Gold Necklace API',
            tag_no: 'EX-API-001',
            gross_weight: 12.0,
            less_weight: 0.0,
            tunch_percent: 91.67,
            exchange_rate: 7000.0,
            deduction_percent: 0.0,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exchange_number).toMatch(/^EX-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.total_exchange_value).toBeGreaterThan(0);
  });

  it('GET /api/exchanges returns paginated list of exchanges', async () => {
    const res = await request(app)
      .get('/api/exchanges')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/exchanges/:id/finalize finalizes exchange and creates stock', async () => {
    // 1. Create a draft
    const createRes = await request(app)
      .post('/api/exchanges')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        items: [
          {
            source_type: 'LOOSE_METAL',
            metal_id: goldId,
            purity_id: p22kId,
            item_name: 'Old Bullion Piece',
            tag_no: 'EX-API-FIN-01',
            gross_weight: 10.0,
            less_weight: 0.0,
            tunch_percent: 100.0,
            exchange_rate: 7000.0,
          },
        ],
      });

    const exchangeId = createRes.body.data.id;

    // 2. Finalize
    const finalizeRes = await request(app)
      .post(`/api/exchanges/${exchangeId}/finalize`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.success).toBe(true);
    expect(finalizeRes.body.data.status).toBe('FINALIZED');

    // 3. Verify stock item exists via inventory API
    const stockRes = await request(app)
      .get(`/api/inventory/stock?search=EX-API-FIN-01`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(stockRes.status).toBe(200);
    expect(stockRes.body.data.items.length).toBe(1);
    expect(stockRes.body.data.items[0].acquisition_type).toBe('EXCHANGE');
  });

  it('POST /api/exchanges/:id/cancel cancels a draft exchange', async () => {
    const createRes = await request(app)
      .post('/api/exchanges')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
      });

    const exchangeId = createRes.body.data.id;

    const cancelRes = await request(app)
      .post(`/api/exchanges/${exchangeId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });

  it('GET /api/customers/:id/exchanges returns customer exchange history', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/exchanges`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
