import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';

export interface KarigarRecord {
  id: string;
  karigar_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  specialization: 'GOLD' | 'SILVER' | 'DIAMOND' | 'POLISHING' | 'SETTING' | 'REPAIR' | 'OTHER';
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface KarigarQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  specialization?: string;
  status?: 'all' | 'active' | 'inactive';
}

export class KarigarRepository {
  generateCode(): string {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM karigars').get() as { count: number };
    const nextNum = (countRow.count + 1).toString().padStart(4, '0');
    return `KRG-${nextNum}`;
  }

  findById(id: string): KarigarRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM karigars WHERE id = ?').get(id) as KarigarRecord | undefined;
    return row || null;
  }

  findByCode(code: string): KarigarRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM karigars WHERE karigar_code = ? COLLATE NOCASE').get(code) as KarigarRecord | undefined;
    return row || null;
  }

  find(params: KarigarQueryParams = {}): PaginatedResult<KarigarRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (params.search) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR karigar_code LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term);
    }

    if (params.specialization && params.specialization !== 'ALL') {
      conditions.push('specialization = ?');
      values.push(params.specialization);
    }

    if (params.status === 'active') {
      conditions.push('is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM karigars ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataStmt = db.prepare(`
      SELECT * FROM karigars
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const items = dataStmt.all(...values, pageSize, offset) as KarigarRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  create(data: {
    id?: string;
    karigar_code?: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    specialization?: 'GOLD' | 'SILVER' | 'DIAMOND' | 'POLISHING' | 'SETTING' | 'REPAIR' | 'OTHER';
    notes?: string | null;
    is_active?: number;
  }): KarigarRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const karigar_code = data.karigar_code || this.generateCode();
    const specialization = data.specialization || 'GOLD';
    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO karigars (
        id, karigar_code, name, phone, address, specialization,
        notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      karigar_code,
      data.name,
      data.phone || null,
      data.address || null,
      specialization,
      data.notes || null,
      is_active,
      now,
      now
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<KarigarRecord, 'id' | 'created_at' | 'updated_at'>>): KarigarRecord | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields: (keyof typeof data)[] = [
      'karigar_code', 'name', 'phone', 'address', 'specialization', 'notes', 'is_active'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field] as any);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE karigars SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  setActive(id: string, isActive: boolean): KarigarRecord | null {
    return this.update(id, { is_active: isActive ? 1 : 0 });
  }
}

export const karigarRepository = new KarigarRepository();
