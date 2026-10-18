// backend/tests/settings_api.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { bootstrapApp } from '../src/server.js';
import type { Application } from 'express';

describe('Jewel Suite Part 11: Settings & User Management HTTP API Tests', () => {
  let app: Application;
  let adminToken: string;
  let staffToken: string;
  let createdStaffId: string;

  beforeAll(async () => {
    app = await bootstrapApp();

    // 1. Login as default Admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.token;
    expect(adminToken).toBeDefined();

    // 2. Create a Staff user via admin API
    const staffUsername = `staff_api_${Date.now()}`;
    const createStaffRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: staffUsername,
        password: 'StaffPassword123!',
        full_name: 'Counter Billing Executive',
        role: 'STAFF',
        permissions: ['VIEW_SALES', 'CREATE_SALES'],
      });

    expect(createStaffRes.status).toBe(201);
    createdStaffId = createStaffRes.body.data.id;

    // 3. Login as the newly created Staff
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: staffUsername, password: 'StaffPassword123!' });

    expect(staffLoginRes.status).toBe(200);
    staffToken = staffLoginRes.body.data.token;
  });

  describe('Authentication & Role-Based Access Control', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/settings/shop');
      expect(res.status).toBe(401);
    });

    it('should allow staff to VIEW shop profile but FORBID staff from updating it (403)', async () => {
      // View succeeds
      const viewRes = await request(app)
        .get('/api/settings/shop')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(viewRes.status).toBe(200);

      // Update forbidden for STAFF
      const updateRes = await request(app)
        .put('/api/settings/shop')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacked Shop Name' });
      expect(updateRes.status).toBe(403);
    });

    it('should forbid staff from accessing user management endpoints (403)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('should forbid staff from viewing database system info (403)', async () => {
      const res = await request(app)
        .get('/api/settings/database')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Shop Profile & Logo Endpoints', () => {
    it('GET /api/settings/shop - returns shop profile', async () => {
      const res = await request(app)
        .get('/api/settings/shop')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBeDefined();
    });

    it('PUT /api/settings/shop - updates shop profile as Admin', async () => {
      const res = await request(app)
        .put('/api/settings/shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Jewel Suite Flagship',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          gstin: '27AAAAA0000A1Z5',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Jewel Suite Flagship');
      expect(res.body.data.city).toBe('Mumbai');
    });

    it('POST /api/settings/shop/logo - uploads base64 shop logo', async () => {
      const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const res = await request(app)
        .post('/api/settings/shop/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          base64Data: dummyBase64,
          mimeType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.logo_path).toBe('logo.png');
    });

    it('GET /api/settings/shop/logo - serves shop logo file', async () => {
      const res = await request(app)
        .get('/api/settings/shop/logo')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
    });
  });

  describe('General, Financial Year, Billing & GST Endpoints', () => {
    it('GET /api/settings/general and PUT /api/settings/general', async () => {
      const getRes = await request(app)
        .get('/api/settings/general')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);

      const putRes = await request(app)
        .put('/api/settings/general')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currency_symbol: '₹',
          weight_decimals: 3,
          rate_decimals: 2,
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.currency_symbol).toBe('₹');
    });

    it('GET & PUT /api/settings/financial-year', async () => {
      const getRes = await request(app)
        .get('/api/settings/financial-year')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);

      const putRes = await request(app)
        .put('/api/settings/financial-year')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          current_fy: '2026-27',
          start_date: '2026-04-01',
          end_date: '2027-03-31',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.current_fy).toBe('2026-27');
    });

    it('GET & PUT /api/settings/billing', async () => {
      const getRes = await request(app)
        .get('/api/settings/billing')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.sequences).toBeDefined();

      const putRes = await request(app)
        .put('/api/settings/billing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          default_customer_type: 'RETAIL',
          default_gst_rate: 3,
        });
      expect(putRes.status).toBe(200);
    });

    it('GET & PUT /api/settings/gst', async () => {
      const getRes = await request(app)
        .get('/api/settings/gst')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);

      const putRes = await request(app)
        .put('/api/settings/gst')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gst_enabled: true,
          default_gst_rate: 3,
          tax_mode: 'EXCLUSIVE',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.tax_mode).toBe('EXCLUSIVE');
    });
  });

  describe('Payment Modes & Printing Endpoints', () => {
    it('GET /api/settings/payment-modes and PUT toggle', async () => {
      const getRes = await request(app)
        .get('/api/settings/payment-modes')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.length).toBeGreaterThanOrEqual(8);

      // Toggle UPI inactive then active
      const toggleOff = await request(app)
        .put('/api/settings/payment-modes/UPI/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });
      expect(toggleOff.status).toBe(200);
      expect(toggleOff.body.data.is_active).toBe(false);

      const toggleOn = await request(app)
        .put('/api/settings/payment-modes/UPI/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: true });
      expect(toggleOn.status).toBe(200);
      expect(toggleOn.body.data.is_active).toBe(true);
    });

    it('PUT /api/settings/payment-modes/CASH/toggle - rejects deactivating CASH (400)', async () => {
      const res = await request(app)
        .put('/api/settings/payment-modes/CASH/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Physical CASH payment mode cannot be deactivated');
    });

    it('GET & PUT /api/settings/printing', async () => {
      const getRes = await request(app)
        .get('/api/settings/printing')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);

      const putRes = await request(app)
        .put('/api/settings/printing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          show_logo: true,
          page_size: 'A4',
          invoice_footer: 'Thank you for choosing Jewel Suite',
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.invoice_footer).toBe('Thank you for choosing Jewel Suite');
    });
  });

  describe('AMC, Database, and About Endpoints', () => {
    it('GET /api/settings/amc - returns verified license contract', async () => {
      const res = await request(app)
        .get('/api/settings/amc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBeDefined();
      expect(res.body.data.is_valid).toBe(true);
    });

    it('GET /api/settings/database - returns database size, location, and WAL status', async () => {
      const res = await request(app)
        .get('/api/settings/database')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ONLINE');
      expect(res.body.data.wal_mode).toBe(true);
      expect(res.body.data.location).toBeDefined();
    });

    it('GET /api/settings/about - returns software version without hardcoding', async () => {
      const res = await request(app)
        .get('/api/settings/about')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.app_name).toContain('Jewel Suite');
      expect(res.body.data.app_version).toBe('1.0.0');
    });
  });

  describe('User Management Endpoints', () => {
    it('GET /api/users - lists all users for Admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('PUT /api/users/:id - updates staff user profile and permissions', async () => {
      const res = await request(app)
        .put(`/api/users/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'Lead Billing Specialist',
          permissions: ['VIEW_SALES', 'CREATE_SALES', 'VIEW_STOCK', 'MANAGE_CUSTOMERS'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.full_name).toBe('Lead Billing Specialist');
      expect(res.body.data.permissions).toContain('MANAGE_CUSTOMERS');
    });

    it('POST /api/users/:id/reset-password - resets staff password', async () => {
      const res = await request(app)
        .post(`/api/users/${createdStaffId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'BrandNewPassword999!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login with new password works
      const staffUser = (await request(app).get(`/api/users/${createdStaffId}`).set('Authorization', `Bearer ${adminToken}`)).body.data;
      const verifyLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: staffUser.username, password: 'BrandNewPassword999!' });

      expect(verifyLogin.status).toBe(200);
    });

    it('POST /api/users/:id/deactivate - deactivates staff account', async () => {
      const res = await request(app)
        .post(`/api/users/${createdStaffId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);

      // Verify deactivated account cannot log in
      const staffUser = (await request(app).get(`/api/users/${createdStaffId}`).set('Authorization', `Bearer ${adminToken}`)).body.data;
      const failLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: staffUser.username, password: 'BrandNewPassword999!' });

      expect(failLogin.status).toBe(401);
      expect(failLogin.body.error.message).toContain('deactivated');
    });
  });
});
