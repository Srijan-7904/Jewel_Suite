import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import express from 'express';
import { bootstrapApp } from '../src/server.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Part 7: Workshop & Repair API Integration Tests', () => {
  let app: express.Application;
  let testDb: DatabaseType;
  let authToken: string;
  let karigarId: string;
  let customerId: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    app = await bootstrapApp();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = loginRes.body.data.token;

    // Create Karigar
    const kRes = await request(app)
      .post('/api/karigars')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Gopal Karigar',
        phone: '9811223344',
        specialization: 'GOLD',
      });
    karigarId = kRes.body.data.id;

    // Create Customer
    const cRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Pooja Hegde',
        phone: '9844001122',
        city: 'Bangalore',
      });
    customerId = cRes.body.data.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb) {
      testDb.close();
    }
  });

  it('POST /api/workshop/jobs creates a draft job', async () => {
    const res = await request(app)
      .post('/api/workshop/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        job_type: 'MANUFACTURING',
        karigar_id: karigarId,
        customer_id: customerId,
        description: 'Handmade bridal choker set',
        priority: 'URGENT',
        estimated_labour: 3500.0,
        items: [
          {
            tag_no: 'GOLD-N-002',
            material_issued: '0.5g gold wire',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.job_number).toMatch(/^JOB-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.items.length).toBe(1);
  });

  it('GET /api/workshop/jobs returns paginated jobs', async () => {
    const res = await request(app)
      .get('/api/workshop/jobs')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/workshop/jobs/:id/issue issues job and returns items', async () => {
    // 1. Create job
    const createRes = await request(app)
      .post('/api/workshop/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        job_type: 'POLISHING',
        karigar_id: karigarId,
        description: 'Bangle polishing',
        items: [{ tag_no: 'GOLD-B-003' }],
      });
    const jobId = createRes.body.data.id;
    const itemId = createRes.body.data.items[0].id;

    // 2. Issue
    const issueRes = await request(app)
      .post(`/api/workshop/jobs/${jobId}/issue`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.data.status).toBe('ISSUED');

    // 3. Return
    const returnRes = await request(app)
      .post(`/api/workshop/jobs/${jobId}/return`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        returned_items: [
          {
            item_id: itemId,
            return_gross_weight: 16.15,
            return_less_weight: 0.0,
          },
        ],
        actual_labour: 250.0,
      });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.status).toBe('RETURNED');
  });

  it('POST /api/repairs and workflow endpoints (assign, complete, deliver)', async () => {
    // 1. Intake customer repair
    const intakeRes = await request(app)
      .post('/api/repairs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        ownership: 'CUSTOMER_OWNED',
        item_description: 'Ruby studded pendant',
        problem_description: 'Loose stone needs laser prong setting',
        gross_weight: 6.2,
        estimated_cost: 400.0,
      });

    expect(intakeRes.status).toBe(201);
    expect(intakeRes.body.data.repair_number).toMatch(/^REP-\d{4}-\d{6}$/);
    const repairId = intakeRes.body.data.id;

    // 2. Assign to karigar
    const assignRes = await request(app)
      .post(`/api/repairs/${repairId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ karigar_id: karigarId });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.status).toBe('ASSIGNED');

    // 3. Complete
    const completeRes = await request(app)
      .post(`/api/repairs/${repairId}/complete`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ actual_cost: 380.0 });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('READY');

    // 4. Deliver
    const deliverRes = await request(app)
      .post(`/api/repairs/${repairId}/deliver`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe('DELIVERED');
  });
});
