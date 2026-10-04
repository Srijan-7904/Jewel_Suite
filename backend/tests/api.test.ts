import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite API Endpoints Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  it('GET /api/system/health - should return online status and database connected', async () => {
    const res = await request(app).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ONLINE');
    expect(res.body.data.database).toBe('CONNECTED');
    expect(res.body.data.mode).toBe('OFFLINE_FIRST');
  });

  it('POST /api/auth/login - should fail with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/login - should succeed with seeded admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('admin');
    expect(res.body.data.user.role).toBe('Admin');
    expect(res.body.data.token).toBeDefined();

    const token = res.body.data.token;

    // Test GET /api/auth/me with token
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.username).toBe('admin');

    // Test POST /api/auth/logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });

  it('GET /api/auth/me - should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
