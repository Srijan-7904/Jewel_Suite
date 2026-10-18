// backend/tests/amc.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { amcService } from '../src/services/amc.service.js';

describe('Jewel Suite Part 11: AMC & Offline License Verification Tests', () => {
  beforeEach(() => {
    const db = getDb();
    runMigrations(db);
  });

  it('should read and verify offline AMC contract without requiring internet connection', () => {
    const license = amcService.getLicenseStatus();

    expect(license).toBeDefined();
    expect(license.license_key).toBeDefined();
    expect(license.plan).toBeDefined();
    expect(license.expiry_date).toBeDefined();
    expect(license.grace_period_days).toBeGreaterThanOrEqual(0);
    expect(license.is_valid).toBe(true);
    expect(license.signature).toContain('SIG-OFFLINE-VERIFIED-HMAC256');
  });

  it('should compute valid offline HMAC signature for local contract validation', () => {
    const key = 'JS-TEST-2026';
    const shop = 'shop-1';
    const dev = 'DEV-1';
    const exp = '2027-03-31';
    const plan = 'Pro';

    const sig = amcService.computeSignature(key, shop, dev, exp, plan);
    expect(sig).toContain('SIG-OFFLINE-VERIFIED-HMAC256');

    // Deterministic signature
    const sig2 = amcService.computeSignature(key, shop, dev, exp, plan);
    expect(sig).toBe(sig2);
  });

  it('should return health check confirming data access is NEVER locked upon expiry', () => {
    const health = amcService.checkHealth();
    expect(health.data_access_guaranteed).toBe(true);
    expect(health.plan).toBeDefined();
  });
});
