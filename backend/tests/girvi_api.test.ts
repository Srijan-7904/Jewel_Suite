// backend/tests/girvi_api.test.ts
// Jewel Suite Part 9: Girvi / Pledged Jewellery Loans HTTP API Integration Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 9: Girvi API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;
  let customerId: string;
  let createdLoanId: string;

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
        name: 'Vikas Agarwal',
        phone: '9811223344',
        customer_type: 'RETAIL',
      });
    customerId = cRes.body.data.id;
  });

  afterAll(() => {
    testDb.close();
  });

  it('POST /api/girvi/loans - should create a new Girvi loan in DRAFT status', async () => {
    const res = await request(app)
      .post('/api/girvi/loans')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        loan_date: '2026-03-01',
        due_date: '2026-09-01',
        principal_amount: 35000,
        interest_rate: 1.75,
        interest_type: 'MONTHLY_PERCENT',
        ltv_percent: 75,
        processing_fee: 350,
        items: [
          {
            description: '22K Gold Mangalsutra',
            gross_weight: 8.5,
            less_weight: 0.5,
            tunch_percent: 91.6,
            valuation_rate: 7000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.loan_number).toMatch(/^GL-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.principal_amount).toBe(35000);
    createdLoanId = res.body.data.id;
  });

  it('POST /api/girvi/loans/:id/disburse - should disburse loan and post to finance ledger', async () => {
    const res = await request(app)
      .post(`/api/girvi/loans/${createdLoanId}/disburse`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ payment_mode: 'CASH' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.disbursement_date).toBeTruthy();
  });

  it('POST /api/girvi/loans/:id/payments - should record repayment and update outstanding', async () => {
    const res = await request(app)
      .post(`/api/girvi/loans/${createdLoanId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        principal_amount: 15000,
        interest_amount: 1000,
        charges_amount: 0,
        payment_mode: 'UPI',
        reference_number: 'UPI-TEST-001',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PARTIALLY_PAID');
    expect(res.body.data.total_repaid).toBe(16000);
  });

  it('GET /api/girvi/loans - should list loans with pagination and search', async () => {
    const res = await request(app)
      .get('/api/girvi/loans')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ search: 'Mangalsutra' });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(createdLoanId);
  });

  it('GET /api/girvi/metrics - should return live dashboard metrics', async () => {
    const res = await request(app)
      .get('/api/girvi/metrics')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.active_loans_count).toBeGreaterThan(0);
    expect(res.body.data.total_principal_outstanding).toBeGreaterThan(0);
  });

  it('GET /api/customers/:id/girvi-loans - should return customer loan history', async () => {
    const res = await request(app)
      .get(`/api/customers/${customerId}/girvi-loans`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
