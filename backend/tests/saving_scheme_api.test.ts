// backend/tests/saving_scheme_api.test.ts
// Jewel Suite Part 9: Saving Schemes HTTP API Integration Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 9: Saving Scheme API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;
  let customerId: string;
  let schemeTypeId: string;
  let createdSchemeId: string;
  let firstInstallmentId: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = loginRes.body.data.token;

    // Create a customer
    const cRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Anita Desai',
        phone: '9822334455',
        customer_type: 'RETAIL',
      });
    customerId = cRes.body.data.id;

    // Fetch scheme types
    const tRes = await request(app)
      .get('/api/saving-schemes/types')
      .set('Authorization', `Bearer ${authToken}`);
    const swarna5k = tRes.body.data.find((t: any) => t.code === 'SWARNA-5K') || tRes.body.data[0];
    schemeTypeId = swarna5k.id;
  });

  afterAll(() => {
    testDb.close();
  });

  it('GET /api/saving-schemes/types - should list active scheme types', async () => {
    const res = await request(app)
      .get('/api/saving-schemes/types')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/saving-schemes - should enroll customer and generate monthly installments', async () => {
    const res = await request(app)
      .post('/api/saving-schemes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        scheme_type_id: schemeTypeId,
        start_date: '2026-02-15',
        notes: 'Enrolled via retail counter',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scheme_number).toMatch(/^SCH-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.installments.length).toBeGreaterThan(0);

    createdSchemeId = res.body.data.id;
    firstInstallmentId = res.body.data.installments[0].id;
  });

  it('POST /api/saving-schemes/:id/installments/:installmentId/pay - should pay installment and post finance receipt', async () => {
    const res = await request(app)
      .post(`/api/saving-schemes/${createdSchemeId}/installments/${firstInstallmentId}/pay`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 5000,
        payment_mode: 'UPI',
        reference_number: 'UPI-SCH-TEST-99',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.installment.status).toBe('PAID');
    expect(res.body.data.scheme.paid_installments).toBe(1);
    expect(res.body.data.scheme.paid_amount).toBe(5000);
  });

  it('GET /api/saving-schemes/:id - should fetch full scheme detail with installments', async () => {
    const res = await request(app)
      .get(`/api/saving-schemes/${createdSchemeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdSchemeId);
    expect(res.body.data.customer_name).toBe('Anita Desai');
    expect(res.body.data.installments).toHaveLength(11);
  });

  it('GET /api/customers/:id/saving-schemes - should return customer scheme history', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/saving-schemes`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
