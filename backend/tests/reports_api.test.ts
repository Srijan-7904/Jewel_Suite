// backend/tests/reports_api.test.ts
// Jewel Suite Part 10: Reports API Endpoints Integration Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 10: Reports HTTP API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    // Authenticate with seeded Admin credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.data.token;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  // Security test
  it('should reject unauthenticated requests to reporting endpoints with 401', async () => {
    const res = await request(app).get('/api/reports/sales-summary');
    expect(res.status).toBe(401);
  });

  // Sales Reports Endpoints
  it('GET /api/reports/sales-summary - should return sales summary data', async () => {
    const res = await request(app)
      .get('/api/reports/sales-summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoicesCount).toBeDefined();
    expect(res.body.data.grossSales).toBeDefined();
  });

  it('GET /api/reports/sales-register - should return paginated sales register', async () => {
    const res = await request(app)
      .get('/api/reports/sales-register?page=1&pageSize=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBeDefined();
  });

  it('GET /api/reports/customer-sales - should return customer grouped sales', async () => {
    const res = await request(app)
      .get('/api/reports/customer-sales')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/product-sales - should return product sales by weight and value', async () => {
    const res = await request(app)
      .get('/api/reports/product-sales')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/metal-sales - should return metal-wise sales breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/metal-sales')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Purchase Reports Endpoints
  it('GET /api/reports/purchase-summary - should return purchase summary', async () => {
    const res = await request(app)
      .get('/api/reports/purchase-summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.billsCount).toBeDefined();
    expect(res.body.data.totalPurchase).toBeDefined();
  });

  it('GET /api/reports/purchase-register - should return purchase bills register', async () => {
    const res = await request(app)
      .get('/api/reports/purchase-register')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/supplier-purchases - should return supplier purchases', async () => {
    const res = await request(app)
      .get('/api/reports/supplier-purchases')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // Inventory Reports Endpoints
  it('GET /api/reports/current-stock - should return stock inventory with weights', async () => {
    const res = await request(app)
      .get('/api/reports/current-stock?status=IN_STOCK')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/stock-valuation - should return stock valuation grouped by metal/purity', async () => {
    const res = await request(app)
      .get('/api/reports/stock-valuation')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalStockValue).toBeDefined();
    expect(Array.isArray(res.body.data.groups)).toBe(true);
  });

  it('GET /api/reports/stock-movements - should return audit movements report', async () => {
    const res = await request(app)
      .get('/api/reports/stock-movements')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // Finance Reports Endpoints
  it('GET /api/reports/receivables - should return customer receivables', async () => {
    const res = await request(app)
      .get('/api/reports/receivables')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOutstanding).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/payables - should return supplier payables', async () => {
    const res = await request(app)
      .get('/api/reports/payables')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOutstanding).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/cash-book - should return physical cash book with running balance', async () => {
    const res = await request(app)
      .get('/api/reports/cash-book')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.closingBalance).toBeDefined();
    expect(Array.isArray(res.body.data.entries)).toBe(true);
  });

  it('GET /api/reports/payments - should return collections with mode breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/payments')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalCollection).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // Workshop & Repairs Endpoints
  it('GET /api/reports/karigar-jobs - should return workshop jobs list', async () => {
    const res = await request(app)
      .get('/api/reports/karigar-jobs')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/karigar-labour - should return karigar labour statement', async () => {
    const res = await request(app)
      .get('/api/reports/karigar-labour')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/repairs - should return repair register with ownership', async () => {
    const res = await request(app)
      .get('/api/reports/repairs')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // Girvi Loans Endpoints
  it('GET /api/reports/girvi-loans - should return active and overdue loans', async () => {
    const res = await request(app)
      .get('/api/reports/girvi-loans?overdueOnly=false')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // Saving Schemes Endpoints
  it('GET /api/reports/saving-schemes - should return scheme register', async () => {
    const res = await request(app)
      .get('/api/reports/saving-schemes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/reports/saving-installments - should return installment collections', async () => {
    const res = await request(app)
      .get('/api/reports/saving-installments')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // GST Endpoints
  it('GET /api/reports/gst-sales - should return GST sales summary', async () => {
    const res = await request(app)
      .get('/api/reports/gst-sales')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cgstAmount).toBeDefined();
    expect(res.body.data.sgstAmount).toBeDefined();
    expect(res.body.data.totalGst).toBeDefined();
  });

  it('GET /api/reports/gst-purchases - should return GST purchase summary', async () => {
    const res = await request(app)
      .get('/api/reports/gst-purchases')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalGst).toBeDefined();
  });

  it('GET /api/reports/hsn-summary - should return HSN summary', async () => {
    const res = await request(app)
      .get('/api/reports/hsn-summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/reports/gst-invoice-register - should return GST invoice register', async () => {
    const res = await request(app)
      .get('/api/reports/gst-invoice-register')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // Shop Header & Dashboard Metrics Endpoints
  it('GET /api/reports/shop-header - should return shop details for printable reports', async () => {
    const res = await request(app)
      .get('/api/reports/shop-header?reportName=Sales+Summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.shopName).toBeDefined();
    expect(res.body.data.reportName).toBe('Sales Summary');
  });

  it('GET /api/reports/dashboard-metrics - should return live business metrics from SQLite', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard-metrics')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.todaySales).toBeDefined();
    expect(res.body.data.monthlySales).toBeDefined();
    expect(res.body.data.receivables).toBeDefined();
    expect(res.body.data.payables).toBeDefined();
    expect(res.body.data.stockValuation).toBeDefined();
  });

  // CSV Export Endpoint
  it('GET /api/reports/export/sales-register - should export full filtered dataset as CSV attachment', async () => {
    const res = await request(app)
      .get('/api/reports/export/sales-register')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename=');
    expect(res.text).toContain('Invoice #,Date,Customer');
  });
});
