import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { hashPassword, comparePassword } from '../src/utils/password.js';
import { UserRepository } from '../src/repositories/user.repository.js';
import { ShopRepository } from '../src/repositories/shop.repository.js';
import { SettingRepository } from '../src/repositories/setting.repository.js';
import { AuditRepository } from '../src/repositories/audit.repository.js';
import { AuthService } from '../src/services/auth.service.js';
import { UnauthorizedError } from '../src/utils/errors.js';
import * as dbModule from '../src/database/connection/db.js';

describe('Jewel Suite Foundation & Database Architecture Tests', () => {
  let testDb: DatabaseType;

  beforeEach(() => {
    // Create an in-memory database for isolated testing
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');

    // Set testDb as active DB
    dbModule.setDb(testDb);
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  // 1. Database Initialization
  it('1. should initialize SQLite database with foreign keys and WAL pragma support', () => {
    expect(testDb).toBeDefined();
    expect(testDb.open).toBe(true);

    const fkStatus = testDb.pragma('foreign_keys', { simple: true });
    expect(fkStatus).toBe(1);
  });

  // 2. Migration Execution
  it('2. should execute migrations automatically and record them in schema_migrations', () => {
    const result = runMigrations(testDb);

    expect(result.appliedCount).toBeGreaterThan(0);
    expect(result.appliedMigrations).toContain('001_initial_schema.sql');

    // Verify tables exist
    const tables = testDb.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
    `).all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('schema_migrations');
    expect(tableNames).toContain('shops');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('audit_logs');

    // Second run should apply 0 migrations (idempotent)
    const secondRun = runMigrations(testDb);
    expect(secondRun.appliedCount).toBe(0);
  });

  // 3. User Creation
  it('3. should create a user and persist them in SQLite', async () => {
    runMigrations(testDb);
    const userRepo = new UserRepository();

    const passwordHash = await hashPassword('securePass123');
    const user = userRepo.create({
      username: 'test_jeweller',
      password_hash: passwordHash,
      role: 'Admin',
      is_active: 1,
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe('test_jeweller');
    expect(user.role).toBe('Admin');
    expect(user.is_active).toBe(1);

    const fetched = userRepo.findById(user.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.username).toBe('test_jeweller');
  });

  // 4. Password Hashing
  it('4. should properly hash and verify passwords using bcrypt', async () => {
    const plain = 'secret_master_password';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);

    const isCorrect = await comparePassword(plain, hash);
    expect(isCorrect).toBe(true);

    const isWrong = await comparePassword('wrong_password', hash);
    expect(isWrong).toBe(false);
  });

  // 5. Login Success
  it('5. should authenticate active user and return JWT session token', async () => {
    runMigrations(testDb);
    const userRepo = new UserRepository();
    const auth = new AuthService();

    const passwordHash = await hashPassword('adminPassword');
    userRepo.create({
      username: 'admin',
      password_hash: passwordHash,
      role: 'Admin',
      is_active: 1,
    });

    const session = await auth.login({
      username: 'admin',
      password: 'adminPassword',
    });

    expect(session.user).toBeDefined();
    expect(session.user.username).toBe('admin');
    expect(session.user.role).toBe('Admin');
    expect((session.user as any).password_hash).toBeUndefined();
    expect(session.token).toBeDefined();
    expect(typeof session.token).toBe('string');
  });

  // 6. Login Failure
  it('6. should reject invalid credentials or inactive user accounts', async () => {
    runMigrations(testDb);
    const userRepo = new UserRepository();
    const auth = new AuthService();

    const passwordHash = await hashPassword('activePassword');
    userRepo.create({
      username: 'inactive_staff',
      password_hash: passwordHash,
      role: 'BillingStaff',
      is_active: 0,
    });

    // Case A: Wrong password
    await expect(auth.login({
      username: 'inactive_staff',
      password: 'wrongPassword',
    })).rejects.toThrow(UnauthorizedError);

    // Case B: Non-existent user
    await expect(auth.login({
      username: 'ghost_user',
      password: 'anyPassword',
    })).rejects.toThrow(UnauthorizedError);

    // Case C: Deactivated account with correct password
    await expect(auth.login({
      username: 'inactive_staff',
      password: 'activePassword',
    })).rejects.toThrow(UnauthorizedError);
  });

  // 7. Repository & Database Connection
  it('7. should perform CRUD operations on Shop, Settings, and Audit repositories', () => {
    runMigrations(testDb);
    const shopRepo = new ShopRepository();
    const settingRepo = new SettingRepository();
    const auditRepo = new AuditRepository();

    // Shop
    const shop = shopRepo.create({
      name: 'Kalyan Goldsmiths',
      address: 'Jewel Street 12',
      phone: '+91 99999 88888',
      email: 'info@kalyan.local',
    });
    expect(shop.name).toBe('Kalyan Goldsmiths');

    // Settings
    settingRepo.set('rate_update_interval', '60');
    expect(settingRepo.get('rate_update_interval')).toBe('60');

    // Audit Log
    auditRepo.log({
      action: 'RATE_UPDATED',
      entity_type: 'SETTING',
      metadata: { previous: '30', updated: '60' },
    });

    const recentLogs = auditRepo.getRecent(10);
    expect(recentLogs.length).toBeGreaterThan(0);
    expect(recentLogs[0].action).toBe('RATE_UPDATED');
  });

  // 8. Transaction Rollback
  it('8. should rollback entire transaction when an operation throws an error', () => {
    runMigrations(testDb);
    const settingRepo = new SettingRepository();

    expect(() => {
      const tx = testDb.transaction(() => {
        settingRepo.set('tx_test_key', 'initial_value');

        // Force a failure
        throw new Error('Simulated transaction failure during billing calculation');
      });

      tx();
    }).toThrow('Simulated transaction failure');

    // Value should NOT have been persisted
    const val = settingRepo.get('tx_test_key');
    expect(val).toBeNull();
  });
});
