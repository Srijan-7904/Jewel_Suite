// backend/tests/finance_api.test.ts
// Jewel Suite Part 8: Finance API Integration Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 8: Finance API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;
  let customerId: string;
  let supplierId: string;
  let karigarId: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = loginRes.body.data.token;

    // Create Customer
    const cRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Sunita Mehra',
        phone: '9844112233',
        customer_type: 'RETAIL',
        opening_balance: 5000,
        opening_balance_type: 'DEBIT',
      });
    customerId = cRes.body.data.id;

    // Create Supplier
    const sRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Surat Diamond Wholesalers',
        phone: '9844223344',
      });
    supplierId = sRes.body.data.id;

    // Create Karigar
    const kRes = await request(app)
      .post('/api/karigars')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Raju Polish Artisan',
        phone: '9844334455',
        specialization: 'POLISHING',
      });
    karigarId = kRes.body.data.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb) {
      testDb.close();
    }
  });

  it('GET /api/finance/ledger/customer/:id returns statement with opening balance', async () => {
    const res = await request(app)
      .get(`/api/finance/ledger/customer/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statement.current_balance).toBe(5000);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].entry_type).toBe('OPENING_BALANCE');
    expect(res.body.data.items[0].debit_credit).toBe('DEBIT');
  });

  it('POST /api/finance/payments records receipt and credits customer', async () => {
    const res = await request(app)
      .post('/api/finance/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        party_type: 'CUSTOMER',
        party_id: customerId,
        payment_type: 'RECEIPT',
        payment_mode: 'CASH',
        amount: 3000,
        notes: 'Cash payment towards opening balance',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.payment_number).toMatch(/^REC-\d{4}-\d{6}$/);
    expect(res.body.data.ledger_entry.balance_before).toBe(5000);
    expect(res.body.data.ledger_entry.balance_after).toBe(2000);

    // Verify customer statement
    const statementRes = await request(app)
      .get(`/api/finance/ledger/customer/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(statementRes.body.data.statement.current_balance).toBe(2000);
  });

  it('POST /api/finance/payments to supplier records payment and debits payable', async () => {
    // 1. First record opening payable for supplier
    await request(app)
      .post('/api/finance/adjustments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        party_type: 'SUPPLIER',
        party_id: supplierId,
        amount: 25000,
        direction: 'CREDIT',
        reason: 'Initial credit payable balance for raw bullion',
      });

    // 2. Pay supplier
    const pmtRes = await request(app)
      .post('/api/finance/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        party_type: 'SUPPLIER',
        party_id: supplierId,
        payment_type: 'PAYMENT',
        payment_mode: 'UPI',
        amount: 10000,
        reference_number: 'UPI-REF-889900',
        notes: 'UPI payment to supplier',
      });

    expect(pmtRes.status).toBe(201);
    expect(pmtRes.body.data.payment.payment_number).toMatch(/^PAY-\d{4}-\d{6}$/);
    expect(pmtRes.body.data.ledger_entry.balance_after).toBe(15000);

    // Verify supplier statement
    const suppRes = await request(app)
      .get(`/api/finance/ledger/supplier/${supplierId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(suppRes.body.data.statement.current_balance).toBe(15000);
  });

  it('GET /api/finance/cash-book reflects cash movements only', async () => {
    const res = await request(app)
      .get('/api/finance/cash-book')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    // Should have customer cash receipt (+3000)
    expect(res.body.total_cash_in).toBe(3000);
    expect(res.body.closing_balance).toBe(3000);
  });

  it('GET /api/finance/summary returns live calculated finance dashboard metrics', async () => {
    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_receivables).toBe(2000);
    expect(res.body.data.supplier_payables).toBe(15000);
    expect(res.body.data.cash_balance).toBe(3000);
    expect(res.body.data.today_collections).toBe(3000);
    expect(res.body.data.today_payments).toBe(10000);
  });

  it('End-to-End Sales Invoice Finalization updates customer ledger without double-counting', async () => {
    // 1. Get a stock item
    const invRes = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', `Bearer ${authToken}`);
    const availableItem = invRes.body.data.items.find((i: any) => i.status === 'IN_STOCK');
    expect(availableItem).toBeDefined();

    // 2. Create retail sale invoice
    const saleCreateRes = await request(app)
      .post('/api/sales/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        items: [
          {
            tag_no: availableItem.tag_no,
            item_name: availableItem.product_name,
            metal_id: availableItem.metal_id,
            purity_id: availableItem.purity_id,
            gross_weight: availableItem.gross_weight,
            less_weight: 0,
            tunch_percent: availableItem.tunch_percent,
            rate_per_gram: 7500,
            making_charge: 500,
          },
        ],
        payments: [
          {
            payment_mode: 'CASH',
            amount: 2000,
            notes: 'Counter advance',
          },
        ],
      });

    expect(saleCreateRes.status).toBe(201);
    const invoice = saleCreateRes.body.data;
    const initialCustomerBal = 2000;

    // 3. Finalize sale invoice
    const finalRes = await request(app)
      .post(`/api/sales/invoices/${invoice.id}/finalize`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.data.status).toBe('FINALIZED');

    // Expected new customer balance = initial (2000) + grand_total - payment (2000) = initial + (grand_total - 2000)
    const expectedBalance = initialCustomerBal + (finalRes.body.data.grand_total - 2000);

    const statementRes = await request(app)
      .get(`/api/finance/ledger/customer/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statementRes.body.data.statement.current_balance).toBeCloseTo(expectedBalance, 2);

    // Verify ledger entries include exactly 1 SALE debit and 1 SALE_PAYMENT credit for this invoice
    const invoiceEntries = statementRes.body.data.items.filter(
      (entry: any) => entry.reference_id === invoice.id
    );
    expect(invoiceEntries.length).toBe(2);
    expect(invoiceEntries.some((e: any) => e.entry_type === 'SALE' && e.debit_credit === 'DEBIT')).toBe(true);
    expect(invoiceEntries.some((e: any) => e.entry_type === 'SALE_PAYMENT' && e.debit_credit === 'CREDIT')).toBe(true);
  });
});
