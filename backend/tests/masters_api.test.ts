import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { hashPassword } from '../src/utils/password.js';

describe('Jewel Suite Masters API & Authorization Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let adminToken: string;
  let staffToken: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    // 1. Login as Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.data.token;

    // 2. Create BillingStaff user and log in
    const staffHash = await hashPassword('staff123');
    userRepository.create({
      username: 'billing_staff',
      password_hash: staffHash,
      role: 'BillingStaff',
      is_active: 1,
    });

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'billing_staff', password: 'staff123' });
    staffToken = staffLogin.body.data.token;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  it('GET /api/rates/current - should return current live metal rates for all staff', async () => {
    const res = await request(app)
      .get('/api/rates/current')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/rates - should allow Admin to update metal rates', async () => {
    // Fetch metals & purities
    const currentRatesRes = await request(app)
      .get('/api/rates/current')
      .set('Authorization', `Bearer ${adminToken}`);
    const rateItem = currentRatesRes.body.data[0];

    const updateRes = await request(app)
      .post('/api/rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        metal_id: rateItem.metal_id,
        purity_id: rateItem.purity_id,
        rate: 8200.0,
        unit: 'gram',
      });

    expect(updateRes.status).toBe(201);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.rate).toBe(8200.0);
  });

  it('POST /api/rates - should REJECT non-admin staff with 403 Forbidden', async () => {
    const currentRatesRes = await request(app)
      .get('/api/rates/current')
      .set('Authorization', `Bearer ${staffToken}`);
    const rateItem = currentRatesRes.body.data[0];

    const unauthorizedRes = await request(app)
      .post('/api/rates')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        metal_id: rateItem.metal_id,
        purity_id: rateItem.purity_id,
        rate: 9999.0,
        unit: 'gram',
      });

    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.success).toBe(false);
    expect(unauthorizedRes.body.error.code).toBe('FORBIDDEN');
  });

  it('POST & GET /api/customers - should create and paginate customer list', async () => {
    const createRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Vikas Gupta',
        phone: '9820000001',
        customer_type: 'RETAIL',
        city: 'Jaipur',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('Vikas Gupta');

    const listRes = await request(app)
      .get('/api/customers?search=Vikas')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.length).toBe(1);
    expect(listRes.body.data.items[0].name).toBe('Vikas Gupta');
  });

  it('POST & GET /api/suppliers - should manage supplier directory', async () => {
    const createRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Shreeji Ornaments Ltd',
        phone: '02299887766',
        city: 'Ahmedabad',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('Shreeji Ornaments Ltd');
  });

  it('POST & GET /api/karigars - should manage workshop artisans', async () => {
    const createRes = await request(app)
      .post('/api/karigars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Manish Goldsmith',
        specialization: 'GOLD',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('Manish Goldsmith');
  });

  it('POST & GET /api/products - should create product with category validation', async () => {
    // Get category
    const catRes = await request(app)
      .get('/api/categories/all')
      .set('Authorization', `Bearer ${staffToken}`);
    const ringCat = catRes.body.data.find((c: any) => c.code === 'RNG');

    const productRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Royal Heritage Kada',
        category_id: ringCat.id,
        default_metal: 'GOLD',
        default_purity: '22K',
      });

    expect(productRes.status).toBe(201);
    expect(productRes.body.data.name).toBe('Royal Heritage Kada');
  });
});
