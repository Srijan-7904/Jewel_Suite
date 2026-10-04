import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';

export interface SettingRecord {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export class SettingRepository {
  get(key: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  set(key: string, value: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO settings (id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(uuidv4(), key, value, now, now);
  }

  getAll(): Record<string, string> {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }
}

export const settingRepository = new SettingRepository();
