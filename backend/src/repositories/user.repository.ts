import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  is_active: number;
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
    password_hash: string;
    role?: string;
    is_active?: number;
  }): UserRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const role = data.role || 'Admin';
    const isActive = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.username, data.password_hash, role, isActive, now, now);

    return this.findById(id)!;
  }

  count(): number {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
  }

  findAll(): Omit<UserRecord, 'password_hash'>[] {
    const db = getDb();
    return db.prepare('SELECT id, username, role, is_active, created_at, updated_at FROM users ORDER BY created_at ASC').all() as Omit<UserRecord, 'password_hash'>[];
  }
}

export const userRepository = new UserRepository();
