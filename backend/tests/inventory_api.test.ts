import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 3: Inventory API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = loginRes.body.data.token;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  it('should block unauthenticated requests to inventory endpoints', async () => {
    const res = await request(app).get('/api/inventory/stock');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/inventory/stock - should list stock items with pagination', async () => {
    const res = await request(app)
      .get('/api/inventory/stock?page=1&pageSize=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data.items[0]).toHaveProperty('tag_no');
    expect(res.body.data.items[0]).toHaveProperty('fine_weight');
    expect(res.body.data.items[0]).toHaveProperty('current_valuation');
  });

  it('GET /api/inventory/stock/tag/:tagNo - should find stock item by tag number', async () => {
    const res = await request(app)
      .get('/api/inventory/stock/tag/GOLD-R-001')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tag_no).toBe('GOLD-R-001');
    expect(res.body.data.product_name).toBeDefined();
    expect(res.body.data.metal_code).toBe('GOLD');
    expect(res.body.data.purity_code).toBe('22K');
  });

  it('POST /api/inventory/stock - should validate input and create stock item', async () => {
    // 1. Get a product, metal, and purity
    const prodRes = await request(app)
      .get('/api/products?pageSize=1')
      .set('Authorization', `Bearer ${authToken}`);
    const product = prodRes.body.data.items[0];

    const metalsRes = await request(app)
      .get('/api/rates/metals')
      .set('Authorization', `Bearer ${authToken}`);
    const gold = metalsRes.body.data.find((m: any) => m.code === 'GOLD');

    const puritiesRes = await request(app)
      .get(`/api/rates/metals/${gold.id}/purities`)
      .set('Authorization', `Bearer ${authToken}`);
    const p22k = puritiesRes.body.data.find((p: any) => p.code === '22K');

    const newStock = {
      tag_no: 'API-TAG-901',
      product_id: product.id,
      metal_id: gold.id,
      purity_id: p22k.id,
      gross_weight: 15.500,
      less_weight: 0.500,
      tunch_percent: 91.67,
      rate_per_gram: 7190.0,
      making_charge: 1500.0,
      notes: 'API created stock item',
    };

    const res = await request(app)
      .post('/api/inventory/stock')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newStock);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tag_no).toBe('API-TAG-901');
    expect(res.body.data.net_weight).toBe(15.0);
    expect(res.body.data.fine_weight).toBe(13.7505);
    expect(res.body.data.status).toBe('IN_STOCK');
  });

  it('PUT /api/inventory/stock/:id/status - should transition status and log movement', async () => {
    // Find our newly created tag
    const findRes = await request(app)
      .get('/api/inventory/stock/tag/API-TAG-901')
      .set('Authorization', `Bearer ${authToken}`);
    const item = findRes.body.data;

    const transitionRes = await request(app)
      .put(`/api/inventory/stock/${item.id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        to_status: 'REPAIR',
        notes: 'Small solder touch-up required',
      });

    expect(transitionRes.status).toBe(200);
    expect(transitionRes.body.data.status).toBe('REPAIR');

    // Verify movements endpoint
    const movRes = await request(app)
      .get(`/api/inventory/stock/${item.id}/movements`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(movRes.status).toBe(200);
    expect(movRes.body.data.length).toBe(2); // OPENING_STOCK + REPAIR_OUT
    expect(movRes.body.data[1].movement_type).toBe('REPAIR_OUT');
    expect(movRes.body.data[1].to_status).toBe('REPAIR');
  });

  it('GET /api/inventory/valuation - should return aggregated live stock valuation', async () => {
    const res = await request(app)
      .get('/api/inventory/valuation')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_items).toBeGreaterThanOrEqual(4);
    expect(res.body.data.total_fine_weight).toBeGreaterThan(0);
    expect(res.body.data.total_current_valuation).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.groups)).toBe(true);
    expect(res.body.data.groups.length).toBeGreaterThan(0);
  });
});
