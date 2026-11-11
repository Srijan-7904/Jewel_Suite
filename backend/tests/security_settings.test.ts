// backend/tests/security_settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { settingsService } from '../src/services/settings.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { hashPassword } from '../src/utils/password.js';
import { authService } from '../src/services/auth.service.js';

describe('Store Configuration Security, Credentials & Pin Verification Tests', () => {
  beforeEach(async () => {
    const db = getDb();
    runMigrations(db);

    // Ensure clean admin user exists
    let admin = userRepository.findByUsername('admin');
    if (!admin) {
      const hashed = await hashPassword('admin123');
      admin = userRepository.create({
        username: 'admin',
        password_hash: hashed,
        role: 'ADMIN',
        full_name: 'Shop Administrator',
      });
    }
  });

  it('should return default security settings (PIN: 1234, config password: 1234, lock: true)', () => {
    const admin = userRepository.findByUsername('admin');
    const sec = settingsService.getSecuritySettings(admin?.id);

    expect(sec.display_mode_pin).toBe('1234');
    expect(sec.store_config_password).toBe('1234');
    expect(sec.store_config_lock_enabled).toBe(true);
    expect(sec.current_username).toBe('admin');
  });

  it('should verify display mode PIN correctly', () => {
    expect(settingsService.verifyDisplayModePin('1234')).toBe(true);
    expect(settingsService.verifyDisplayModePin(' 1234 ')).toBe(true);
    expect(settingsService.verifyDisplayModePin('wrong')).toBe(false);
  });

  it('should verify store configuration password correctly', () => {
    expect(settingsService.verifyConfigPassword('1234')).toBe(true);
    expect(settingsService.verifyConfigPassword(' 1234 ')).toBe(true);
    expect(settingsService.verifyConfigPassword('9999')).toBe(false);
  });

  it('should update Display Mode PIN and verify with new PIN', async () => {
    await settingsService.updateSecuritySettings({
      display_mode_pin: '5678',
    });

    expect(settingsService.verifyDisplayModePin('5678')).toBe(true);
    expect(settingsService.verifyDisplayModePin('1234')).toBe(false);

    // Reset back to 1234
    await settingsService.updateSecuritySettings({
      display_mode_pin: '1234',
    });
    expect(settingsService.verifyDisplayModePin('1234')).toBe(true);
  });

  it('should update Store Configuration password and verify with new password', async () => {
    await settingsService.updateSecuritySettings({
      store_config_password: 'supersecret',
    });

    expect(settingsService.verifyConfigPassword('supersecret')).toBe(true);
    expect(settingsService.verifyConfigPassword('1234')).toBe(false);

    // Reset back to 1234
    await settingsService.updateSecuritySettings({
      store_config_password: '1234',
    });
    expect(settingsService.verifyConfigPassword('1234')).toBe(true);
  });

  it('should bypass store configuration password verification when lock is disabled', async () => {
    await settingsService.updateSecuritySettings({
      store_config_lock_enabled: false,
    });

    // When lock is disabled, any password should pass
    expect(settingsService.verifyConfigPassword('any_random_pass')).toBe(true);

    // Re-enable lock
    await settingsService.updateSecuritySettings({
      store_config_lock_enabled: true,
    });
    expect(settingsService.verifyConfigPassword('any_random_pass')).toBe(false);
    expect(settingsService.verifyConfigPassword('1234')).toBe(true);
  });

  it('should allow updating admin login credentials and authenticate with new credentials', async () => {
    const admin = userRepository.findByUsername('admin');
    expect(admin).toBeDefined();

    await settingsService.updateSecuritySettings({
      username: 'master_admin',
      new_password: 'newpassword999',
    }, admin!.id);

    // Old username should no longer exist
    expect(userRepository.findByUsername('admin')).toBeNull();

    // New username should exist and authenticate
    const session = await authService.login({
      username: 'master_admin',
      password: 'newpassword999',
    });

    expect(session.user.username).toBe('master_admin');
    expect(session.token).toBeDefined();

    // Reset back to admin / admin123
    const newAdmin = userRepository.findByUsername('master_admin')!;
    await settingsService.updateSecuritySettings({
      username: 'admin',
      new_password: 'admin123',
    }, newAdmin.id);
  });

  it('should reject short Display Mode PIN and short login password', async () => {
    await expect(settingsService.updateSecuritySettings({
      display_mode_pin: '12',
    })).rejects.toThrow('Display Mode PIN must be at least 4 digits/characters long');

    await expect(settingsService.updateSecuritySettings({
      store_config_password: '12',
    })).rejects.toThrow('Store Configuration Password must be at least 4 characters long');

    const admin = userRepository.findByUsername('admin')!;
    await expect(settingsService.updateSecuritySettings({
      new_password: '123',
    }, admin.id)).rejects.toThrow('New login password must be at least 6 characters long');
  });
});

