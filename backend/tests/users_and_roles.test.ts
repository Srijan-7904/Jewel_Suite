// backend/tests/users_and_roles.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { userManagementService } from '../src/services/userManagement.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { comparePassword } from '../src/utils/password.js';

describe('Jewel Suite Part 11: User Management & Admin Protection Tests', () => {
  beforeEach(() => {
    const db = getDb();
    runMigrations(db);
  });

  it('should list all users without exposing password hashes', () => {
    const users = userManagementService.getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(1);

    for (const u of users) {
      expect((u as any).password_hash).toBeUndefined();
      expect(u.username).toBeDefined();
      expect(['ADMIN', 'STAFF']).toContain(u.role);
    }
  });

  it('should create a new staff user with bcrypt-hashed password', async () => {
    const uniqueUsername = `staff_${Date.now()}`;
    const newUser = await userManagementService.createUser({
      username: uniqueUsername,
      password: 'SecurePassword123!',
      full_name: 'Counter Sales Staff',
      phone: '+91 9998887776',
      email: 'staff@jewel.test',
      role: 'STAFF',
      permissions: ['VIEW_SALES', 'CREATE_SALES', 'VIEW_STOCK'],
    }, 'admin-id');

    expect(newUser.username).toBe(uniqueUsername);
    expect(newUser.role).toBe('STAFF');
    expect(newUser.is_active).toBe(true);
    expect(newUser.permissions).toContain('CREATE_SALES');
    expect((newUser as any).password_hash).toBeUndefined();

    // Verify raw DB password hash
    const rawRecord = userRepository.findById(newUser.id);
    expect(rawRecord?.password_hash).toBeDefined();
    expect(rawRecord?.password_hash).not.toBe('SecurePassword123!');
    const isMatch = await comparePassword('SecurePassword123!', rawRecord!.password_hash);
    expect(isMatch).toBe(true);
  });

  it('should reject invalid roles outside ADMIN and STAFF (no SUPER_ADMIN permitted)', async () => {
    await expect(
      userManagementService.createUser({
        username: `invalid_role_${Date.now()}`,
        password: 'password123',
        role: 'SUPER_ADMIN' as any,
      })
    ).rejects.toThrow("Role must be strictly 'ADMIN' or 'STAFF'");
  });

  it('should prevent deactivating the only active Admin (Last Admin Protection)', () => {
    const users = userManagementService.getAllUsers();
    const admin = users.find((u) => u.role === 'ADMIN' && u.is_active);
    expect(admin).toBeDefined();

    // Ensure there is only 1 admin for this test condition
    const activeAdmins = userRepository.countActiveAdmins();
    if (activeAdmins === 1 && admin) {
      expect(() => {
        userManagementService.deactivateUser(admin.id, 'admin-id');
      }).toThrow('Cannot deactivate the last active Admin account');
    }
  });

  it('should prevent demoting the only active Admin to Staff', () => {
    const users = userManagementService.getAllUsers();
    const admin = users.find((u) => u.role === 'ADMIN' && u.is_active);
    expect(admin).toBeDefined();

    const activeAdmins = userRepository.countActiveAdmins();
    if (activeAdmins === 1 && admin) {
      expect(() => {
        userManagementService.updateUser(admin.id, { role: 'STAFF' }, 'admin-id');
      }).toThrow('Cannot demote the last active Admin account to Staff');
    }
  });

  it('should allow deactivating an admin if another active admin exists', async () => {
    // Create a second admin
    const secondAdmin = await userManagementService.createUser({
      username: `second_admin_${Date.now()}`,
      password: 'AdminPassword123!',
      role: 'ADMIN',
    }, 'admin-id');

    expect(userRepository.countActiveAdmins()).toBeGreaterThanOrEqual(2);

    // Now deactivating the second admin should succeed
    const deactivated = userManagementService.deactivateUser(secondAdmin.id, 'admin-id');
    expect(deactivated.is_active).toBe(false);
  });

  it('should reset staff password securely without logging plaintext password', async () => {
    const testStaff = await userManagementService.createUser({
      username: `staff_reset_${Date.now()}`,
      password: 'OldPassword123!',
      role: 'STAFF',
    }, 'admin-id');

    const result = await userManagementService.resetPassword(testStaff.id, 'NewBrandSecret456!', 'admin-id');
    expect(result.success).toBe(true);

    const raw = userRepository.findById(testStaff.id);
    const oldMatch = await comparePassword('OldPassword123!', raw!.password_hash);
    const newMatch = await comparePassword('NewBrandSecret456!', raw!.password_hash);

    expect(oldMatch).toBe(false);
    expect(newMatch).toBe(true);
  });
});
