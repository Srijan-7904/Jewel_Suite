// backend/tests/settings_all_tabs_api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Store Configuration — All 11 Tabs API Integrity Verification', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    // Login as Admin to obtain JWT auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    authToken = loginRes.body.data.token;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  // TAB 1: Shop Profile & Metal Stock
  describe('Tab 1: Shop Profile & Metal Stock', () => {
    it('GET & PUT /api/settings/shop - reads and updates shop profile', async () => {
      const getRes = await request(app)
        .get('/api/settings/shop')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBeDefined();

      const putRes = await request(app)
        .put('/api/settings/shop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Verified Jewel Store',
          legal_name: 'Verified Jewel Pvt Ltd',
          city: 'Mumbai',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.name).toBe('Verified Jewel Store');
    });

    it('GET & PUT /api/settings/invoice-columns - reads and updates column configuration', async () => {
      const getRes = await request(app)
        .get('/api/settings/invoice-columns')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.show_tunch).toBeDefined();

      const putRes = await request(app)
        .put('/api/settings/invoice-columns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ show_tag_no: true, show_wastage: true, show_badla: true });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.show_wastage).toBe(true);
    });

    it('GET & PUT /api/settings/metals - reads and toggles dealing metals', async () => {
      const getRes = await request(app)
        .get('/api/settings/metals')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body.data)).toBe(true);

      const toggleRes = await request(app)
        .put('/api/settings/metals/SILVER/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_active: false });
      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.code).toBe('SILVER');
    });
  });

  // TAB 2: General Parameters & Financial Year
  describe('Tab 2: General & Financial Year', () => {
    it('GET & PUT /api/settings/general - reads and saves formatting rules & precision decimals', async () => {
      const getRes = await request(app)
        .get('/api/settings/general')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.currency_symbol).toBe('₹');
      expect(getRes.body.data.weight_decimals).toBe(3);

      const putRes = await request(app)
        .put('/api/settings/general')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currency_symbol: '₹',
          currency_code: 'INR',
          date_format: 'DD/MM/YYYY',
          weight_decimals: 3,
          rate_decimals: 2,
          amount_decimals: 2,
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.currency_code).toBe('INR');
      expect(putRes.body.data.weight_decimals).toBe(3);
    });

    it('GET & PUT /api/settings/financial-year - reads and updates financial year definition', async () => {
      const getRes = await request(app)
        .get('/api/settings/financial-year')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.current_fy).toBeDefined();

      const putRes = await request(app)
        .put('/api/settings/financial-year')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_fy: '2026-27',
          start_date: '2026-04-01',
          end_date: '2027-03-31',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.current_fy).toBe('2026-27');
    });
  });

  // TAB 3: Billing & Numbering
  describe('Tab 3: Billing & Document Numbering', () => {
    it('GET & PUT /api/settings/billing - manages billing defaults and atomic numbering sequences', async () => {
      const getRes = await request(app)
        .get('/api/settings/billing')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.sequences).toBeDefined();
      expect(Array.isArray(getRes.body.data.sequences)).toBe(true);

      const putRes = await request(app)
        .put('/api/settings/billing')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          default_customer_type: 'RETAIL',
          default_payment_mode: 'CASH',
          default_invoice_notes: 'Thank you for shopping with us!',
          sequences: [
            { doc_type: 'INVOICE', prefix: 'INV', starting_number: 1, padding: 6, financial_year_reset: true },
          ],
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.default_customer_type).toBe('RETAIL');
    });
  });

  // TAB 4: GST & Taxes
  describe('Tab 4: GST & Taxes', () => {
    it('GET & PUT /api/settings/gst - reads and updates GST tax parameters', async () => {
      const getRes = await request(app)
        .get('/api/settings/gst')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.default_gst_rate).toBeDefined();

      const putRes = await request(app)
        .put('/api/settings/gst')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gst_enabled: true,
          default_gst_rate: 3,
          tax_mode: 'EXCLUSIVE',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.default_gst_rate).toBe(3);
      expect(putRes.body.data.tax_mode).toBe('EXCLUSIVE');
    });
  });

  // TAB 5: Payment Modes & Shop Receiving Accounts
  describe('Tab 5: Payment Modes & Shop Accounts', () => {
    it('GET & PUT /api/settings/payment-modes - manages accepted payment methods', async () => {
      const getRes = await request(app)
        .get('/api/settings/payment-modes')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body.data)).toBe(true);

      const toggleRes = await request(app)
        .put('/api/settings/payment-modes/CARD/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_active: false });
      expect(toggleRes.status).toBe(200);
    });

    it('GET & PUT /api/settings/receiving-accounts - manages receiving bank and cash accounts', async () => {
      const getRes = await request(app)
        .get('/api/settings/receiving-accounts')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body.data)).toBe(true);

      const putRes = await request(app)
        .put('/api/settings/receiving-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send([
          { account_name: 'Main Safe Cash Drawer', account_type: 'CASH', is_default: true, is_active: true },
        ]);
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // TAB 6: Metal Board Rates
  describe('Tab 6: Metal Rates', () => {
    it('GET /api/rates/current - retrieves current valuation board rates', async () => {
      const getRes = await request(app)
        .get('/api/rates/current')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body.data)).toBe(true);
    });
  });

  // TAB 7: Printing Layout
  describe('Tab 7: Printing Layout', () => {
    it('GET & PUT /api/settings/printing - reads and updates laser/thermal layout', async () => {
      const getRes = await request(app)
        .get('/api/settings/printing')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.page_size).toBeDefined();

      const putRes = await request(app)
        .put('/api/settings/printing')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          page_size: 'A4',
          customer_copy: true,
          shop_copy: false,
          show_logo: true,
          show_shop_name: true,
          show_address: true,
          show_phone: true,
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.page_size).toBe('A4');
    });
  });

  // TAB 8: Staff & Users
  describe('Tab 8: Staff Users & Access Control', () => {
    it('GET & POST /api/users - lists users and creates a staff user', async () => {
      const listRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'counter_staff_01',
          password: 'staff_pass_123',
          full_name: 'Counter Operator',
          role: 'STAFF',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.username).toBe('counter_staff_01');
    });
  });

  // TAB 9: Security & Passwords
  describe('Tab 9: Security, Passwords & Access Protection', () => {
    it('GET & PUT /api/settings/security - reads and updates security settings', async () => {
      const getRes = await request(app)
        .get('/api/settings/security')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.display_mode_pin).toBe('1234');
      expect(getRes.body.data.store_config_password).toBe('1234');
      expect(getRes.body.data.store_config_lock_enabled).toBe(true);

      const putRes = await request(app)
        .put('/api/settings/security')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_mode_pin: '4321',
          store_config_password: '4321',
          store_config_lock_enabled: true,
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.display_mode_pin).toBe('4321');
      expect(putRes.body.data.store_config_password).toBe('4321');
    });

    it('POST /api/settings/security/verify-config - validates store configuration password', async () => {
      const validRes = await request(app)
        .post('/api/settings/security/verify-config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: '4321' });
      expect(validRes.status).toBe(200);
      expect(validRes.body.data.valid).toBe(true);

      const invalidRes = await request(app)
        .post('/api/settings/security/verify-config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'wrong' });
      expect(invalidRes.status).toBe(200);
      expect(invalidRes.body.data.valid).toBe(false);
    });

    it('POST /api/settings/security/verify-display-mode - validates display mode PIN', async () => {
      const validRes = await request(app)
        .post('/api/settings/security/verify-display-mode')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: '4321' });
      expect(validRes.status).toBe(200);
      expect(validRes.body.data.valid).toBe(true);

      const invalidRes = await request(app)
        .post('/api/settings/security/verify-display-mode')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pin: '0000' });
      expect(invalidRes.status).toBe(200);
      expect(invalidRes.body.data.valid).toBe(false);
    });
  });

  // TAB 10: AMC & Offline License
  describe('Tab 10: AMC & License', () => {
    it('GET /api/settings/amc - verifies offline license status', async () => {
      const getRes = await request(app)
        .get('/api/settings/amc')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.is_valid).toBe(true);
      expect(getRes.body.data.plan).toBeDefined();
    });
  });

  // TAB 11: About & Database
  describe('Tab 11: About & Database Diagnostics', () => {
    it('GET /api/settings/about - returns software identity and build version', async () => {
      const getRes = await request(app)
        .get('/api/settings/about')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.app_name).toBeDefined();
      expect(getRes.body.data.app_version).toBeDefined();
    });

    it('GET /api/settings/database - returns SQLite database health & WAL status', async () => {
      const getRes = await request(app)
        .get('/api/settings/database')
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('ONLINE');
      expect(getRes.body.data.wal_mode).toBe(true);
    });
  });
});
