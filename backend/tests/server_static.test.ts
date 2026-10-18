import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bootstrapApp } from '../src/server.js';

describe('Server Health and Static File Serving (Render Full-Stack Deployment)', () => {
  it('GET /health returns 200 OK with connected database status', async () => {
    const app = await bootstrapApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('jewel-suite-backend');
    expect(res.body.database).toBe('connected');
  });

  it('GET / returns 200 OK and serves index.html with SPA root', async () => {
    const app = await bootstrapApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /billing/invoices (SPA route) returns 200 OK and serves index.html fallback', async () => {
    const app = await bootstrapApp();
    const res = await request(app).get('/billing/invoices');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /system/settings (SPA route) returns 200 OK and serves index.html fallback', async () => {
    const app = await bootstrapApp();
    const res = await request(app).get('/system/settings');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('GET /api/unknown-endpoint returns 404 JSON error instead of HTML', async () => {
    const app = await bootstrapApp();
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
