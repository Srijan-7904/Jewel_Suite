// backend/src/services/userManagement.service.ts
import { userRepository } from '../repositories/user.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { hashPassword } from '../utils/password.js';
import { UserDetail, UserRole, STAFF_PERMISSIONS } from '../domain/settings.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export interface CreateUserInput {
  username: string;
  password: string;
  full_name?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  permissions?: string[];
}

export interface UpdateUserInput {
  full_name?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
  permissions?: string[];
}

export class UserManagementService {
  getAllUsers(): UserDetail[] {
    return userRepository.findAllUserDetails();
  }

  getUserById(id: string): UserDetail {
    const user = userRepository.findUserDetail(id);
    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }
    return user;
  }

  async createUser(input: CreateUserInput, adminUserId?: string): Promise<UserDetail> {
    const username = input.username?.trim();
    if (!username || username.length < 3) {
      throw new BadRequestError('Username must be at least 3 characters long', 'VALIDATION_ERROR');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      throw new BadRequestError('Username can only contain letters, numbers, hyphens, and underscores', 'VALIDATION_ERROR');
    }

    const existing = userRepository.findByUsername(username);
    if (existing) {
      throw new BadRequestError(`Username '${username}' is already taken`, 'USER_EXISTS');
    }

    const password = input.password;
    if (!password || password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters long', 'VALIDATION_ERROR');
    }

    const requestedRole = (input.role || 'STAFF').toUpperCase() as UserRole;
    if (requestedRole !== 'ADMIN' && requestedRole !== 'STAFF') {
      throw new BadRequestError("Role must be strictly 'ADMIN' or 'STAFF'. Super Admin role does not exist.", 'INVALID_ROLE');
    }

    // Filter valid permissions
    const permissions = input.permissions
      ? input.permissions.filter((p) => (STAFF_PERMISSIONS as readonly string[]).includes(p))
      : [];

    const passwordHash = await hashPassword(password);

    const created = userRepository.create({
      username,
      password_hash: passwordHash,
      full_name: input.full_name?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      role: requestedRole,
      is_active: 1,
      permissions: requestedRole === 'ADMIN' ? [...STAFF_PERMISSIONS] : permissions,
    });

    auditRepository.log({
      user_id: adminUserId,
      action: 'USER_CREATED',
      entity_type: 'USER',
      entity_id: created.id,
      metadata: { username: created.username, role: created.role },
    });

    return userRepository.findUserDetail(created.id)!;
  }

  updateUser(id: string, input: UpdateUserInput, adminUserId?: string): UserDetail {
    const existing = userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    const isCurrentAdmin = existing.role.toUpperCase() === 'ADMIN';

    // 1. Role Change Check
    if (input.role) {
      const targetRole = input.role.toUpperCase() as UserRole;
      if (targetRole !== 'ADMIN' && targetRole !== 'STAFF') {
        throw new BadRequestError("Role must be strictly 'ADMIN' or 'STAFF'", 'INVALID_ROLE');
      }

      // Check last admin demotion
      if (isCurrentAdmin && targetRole === 'STAFF') {
        const activeAdmins = userRepository.countActiveAdmins();
        if (activeAdmins <= 1) {
          throw new BadRequestError('Cannot demote the last active Admin account to Staff. At least one active Admin must exist.', 'LAST_ADMIN_PROTECTION');
        }
      }
    }

    // 2. Active Status Check
    if (input.is_active === false && isCurrentAdmin && existing.is_active === 1) {
      const activeAdmins = userRepository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new BadRequestError('Cannot deactivate the last active Admin account. At least one active Admin must remain active.', 'LAST_ADMIN_PROTECTION');
      }
    }

    const updated = userRepository.updateUser(id, {
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      role: input.role,
      is_active: input.is_active,
      permissions: input.permissions,
    });

    if (!updated) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    if (input.role && input.role !== existing.role) {
      auditRepository.log({
        user_id: adminUserId,
        action: 'USER_ROLE_CHANGED',
        entity_type: 'USER',
        entity_id: id,
        metadata: { from: existing.role, to: input.role },
      });
    }

    if (input.is_active !== undefined && (input.is_active ? 1 : 0) !== existing.is_active) {
      auditRepository.log({
        user_id: adminUserId,
        action: input.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity_type: 'USER',
        entity_id: id,
        metadata: { username: existing.username, is_active: input.is_active },
      });
    }

    return updated;
  }

  async resetPassword(id: string, newPassword: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
    const existing = userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestError('New password must be at least 6 characters long', 'VALIDATION_ERROR');
    }

    const passwordHash = await hashPassword(newPassword);
    userRepository.updatePassword(id, passwordHash);

    auditRepository.log({
      user_id: adminUserId,
      action: 'PASSWORD_RESET',
      entity_type: 'USER',
      entity_id: id,
      metadata: { username: existing.username, reset_by: adminUserId },
    });

    return {
      success: true,
      message: `Password for user '${existing.username}' has been successfully reset.`,
    };
  }

  deactivateUser(id: string, adminUserId?: string): UserDetail {
    return this.updateUser(id, { is_active: false }, adminUserId);
  }
}

export const userManagementService = new UserManagementService();
