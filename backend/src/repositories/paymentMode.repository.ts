// backend/src/repositories/paymentMode.repository.ts
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PaymentModeConfig } from '../domain/settings.js';

interface PaymentModeRow {
  id: string;
  code: string;
  name: string;
  is_active: number;
  is_system: number;
  sort_order: number;
}

export class PaymentModeRepository {
  getAll(): PaymentModeConfig[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, code, name, is_active, is_system, sort_order
      FROM payment_modes
      ORDER BY sort_order ASC, name ASC
    `).all() as PaymentModeRow[];

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      is_active: r.is_active === 1,
      is_system: r.is_system === 1,
      sort_order: r.sort_order,
    }));
  }

  getActive(): PaymentModeConfig[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, code, name, is_active, is_system, sort_order
      FROM payment_modes
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `).all() as PaymentModeRow[];

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      is_active: true,
      is_system: r.is_system === 1,
      sort_order: r.sort_order,
    }));
  }

  getByCode(code: string): PaymentModeConfig | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM payment_modes WHERE code = ? COLLATE NOCASE').get(code) as PaymentModeRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      is_active: row.is_active === 1,
      is_system: row.is_system === 1,
      sort_order: row.sort_order,
    };
  }

  toggleActive(idOrCode: string, isActive: boolean): PaymentModeConfig | null {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE payment_modes
      SET is_active = ?, updated_at = ?
      WHERE id = ? OR code = ? COLLATE NOCASE
    `).run(isActive ? 1 : 0, now, idOrCode, idOrCode);

    const row = db.prepare('SELECT * FROM payment_modes WHERE id = ? OR code = ? COLLATE NOCASE').get(idOrCode, idOrCode) as PaymentModeRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      is_active: row.is_active === 1,
      is_system: row.is_system === 1,
      sort_order: row.sort_order,
    };
  }

  create(data: { code: string; name: string; sort_order?: number }): PaymentModeConfig {
    const db = getDb();
    const id = `pm-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const sortOrder = data.sort_order ?? 90;

    db.prepare(`
      INSERT INTO payment_modes (id, code, name, is_active, is_system, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, 1, 0, ?, ?, ?)
    `).run(id, data.code.toUpperCase().trim(), data.name.trim(), sortOrder, now, now);

    return {
      id,
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      is_active: true,
      is_system: false,
      sort_order: sortOrder,
    };
  }
}

export const paymentModeRepository = new PaymentModeRepository();
