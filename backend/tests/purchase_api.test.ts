import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 5: Purchase API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;
  let supplierId: string;
  let productId: string;
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

    // Create a supplier via API
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Royal Bullion Corp',
        supplier_code: 'SUP-ROYAL',
        phone: '9988776655',
      });
    supplierId = supRes.body.data.id;

    // Get masters
    const prodRes = await request(app)
      .get('/api/products?pageSize=1')
      .set('Authorization', `Bearer ${authToken}`);
    productId = prodRes.body.data.items[0].id;

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
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  it('should block unauthenticated requests to purchase endpoints', async () => {
    const res = await request(app).get('/api/purchases');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/purchases - should create a new draft purchase bill', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        supplier_id: supplierId,
        supplier_invoice_number: 'ROYAL/2026/091',
        gst_rate: 3.0,
        notes: 'Monthly gold inventory purchase',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.purchase_number).toMatch(/^PUR-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.supplier_name).toBe('Royal Bullion Corp');
  });

  it('POST /api/purchases/:id/items - should add items to draft purchase bill', async () => {
    // 1. Create a draft bill
    const createRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        supplier_id: supplierId,
      });
    const billId = createRes.body.data.id;

    // 2. Add item
    const itemRes = await request(app)
      .post(`/api/purchases/${billId}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        metal_id: goldId,
        purity_id: p22kId,
        tag_no: 'API-INWARD-01',
        gross_weight: 15.0,
        less_weight: 0.5,
        tunch_percent: 91.67,
        rate_per_gram: 7000.0,
        making_charge: 1500.0,
      });

    expect(itemRes.status).toBe(200);
    expect(itemRes.body.success).toBe(true);
    expect(itemRes.body.data.items.length).toBe(1);
    expect(itemRes.body.data.items[0].tag_no).toBe('API-INWARD-01');
    expect(itemRes.body.data.grand_total).toBeGreaterThan(0);
  });

  it('POST /api/purchases/:id/finalize - should finalize draft and inward stock into active inventory', async () => {
    // 1. Create draft
    const createRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        supplier_id: supplierId,
      });
    const billId = createRes.body.data.id;

    // 2. Add item
    await request(app)
      .post(`/api/purchases/${billId}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        metal_id: goldId,
        purity_id: p22kId,
        tag_no: 'API-INWARD-FIN',
        gross_weight: 18.0,
        less_weight: 0,
        tunch_percent: 91.67,
        rate_per_gram: 7000.0,
      });

    // 3. Add payment
    await request(app)
      .post(`/api/purchases/${billId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        payment_mode: 'BANK',
        amount: 80000.0,
        reference_number: 'NEFT-88912',
      });

    // 4. Finalize
    const finRes = await request(app)
      .post(`/api/purchases/${billId}/finalize`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(finRes.status).toBe(200);
    expect(finRes.body.success).toBe(true);
    expect(finRes.body.data.status).toBe('FINALIZED');
    expect(finRes.body.data.amount_paid).toBe(80000.0);

    // 5. Verify the tag now exists in inventory
    const stockRes = await request(app)
      .get('/api/inventory/stock/tag/API-INWARD-FIN')
      .set('Authorization', `Bearer ${authToken}`);

    expect(stockRes.status).toBe(200);
    expect(stockRes.body.success).toBe(true);
    expect(stockRes.body.data.tag_no).toBe('API-INWARD-FIN');
    expect(stockRes.body.data.status).toBe('IN_STOCK');
    expect(stockRes.body.data.acquisition_type).toBe('PURCHASE');
  });

  it('GET /api/suppliers/:id/purchases - should return purchases for supplier', async () => {
    const res = await request(app)
      .get(`/api/suppliers/${supplierId}/purchases`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
