// backend/src/repositories/user.repository.ts
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { UserDetail, UserRole } from '../domain/settings.js';

export interface UserRecord {
  id: string;
  username: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  password_hash: string;
  role: string;
  is_active: number;
  permissions?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  findById(id: string): UserRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
    return row || null;
  }

  findByUsername(username: string): UserRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserRecord | undefined;
    return row || null;
  }

  create(data: {
    id?: string;
    username: string;
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    password_hash: string;
    role?: string;
    is_active?: number;
    permissions?: string[];
  }): UserRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const role = data.role !== undefined ? data.role : 'Admin';
    const isActive = data.is_active !== undefined ? data.is_active : 1;
    const permissionsJson = data.permissions ? JSON.stringify(data.permissions) : '[]';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, full_name, phone, email, password_hash, role, is_active, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.username.trim(),
      data.full_name || null,
      data.phone || null,
      data.email || null,
      data.password_hash,
      role,
      isActive,
      permissionsJson,
      now,
      now
    );

    return this.findById(id)!;
  }

  count(): number {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
  }

  countActiveAdmins(): number {
    const db = getDb();
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE UPPER(role) = 'ADMIN' AND is_active = 1
    `).get() as { count: number };
    return result.count;
  }

  recordLogin(id: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, id);
  }

  updatePassword(id: string, password_hash: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(password_hash, now, id);
  }

  updateUser(id: string, data: {
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
    role?: UserRole;
    is_active?: boolean;
    permissions?: string[];
  }): UserDetail | null {
    const db = getDb();
    const user = this.findById(id);
    if (!user) return null;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.full_name !== undefined) {
      updates.push('full_name = ?');
      values.push(data.full_name);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role.toUpperCase());
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(data.permissions));
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.findUserDetail(id);
  }

  findUserDetail(id: string): UserDetail | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
    if (!row) return null;

    let permissions: string[] = [];
    if (row.permissions) {
      try {
        permissions = JSON.parse(row.permissions);
      } catch {
        permissions = [];
      }
    }

    return {
      id: row.id,
      username: row.username,
      full_name: row.full_name || null,
      phone: row.phone || null,
      email: row.email || null,
      role: (row.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF') as UserRole,
      is_active: row.is_active === 1,
      permissions,
      last_login_at: row.last_login_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  findAllUserDetails(): UserDetail[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as UserRecord[];

    return rows.map((row) => {
      let permissions: string[] = [];
      if (row.permissions) {
        try {
          permissions = JSON.parse(row.permissions);
        } catch {
          permissions = [];
        }
      }

      return {
        id: row.id,
        username: row.username,
        full_name: row.full_name || null,
        phone: row.phone || null,
        email: row.email || null,
        role: (row.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF') as UserRole,
        is_active: row.is_active === 1,
        permissions,
        last_login_at: row.last_login_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
  }

  findAll(): Omit<UserRecord, 'password_hash'>[] {
    const db = getDb();
    return db.prepare('SELECT id, username, full_name, phone, email, role, is_active, last_login_at, created_at, updated_at FROM users ORDER BY created_at ASC').all() as Omit<UserRecord, 'password_hash'>[];
  }
}

export const userRepository = new UserRepository();
