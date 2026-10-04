import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';

export interface SupplierRecord {
  id: string;
  supplier_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive';
}

export class SupplierRepository {
  generateCode(): string {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM suppliers').get() as { count: number };
    const nextNum = (countRow.count + 1).toString().padStart(4, '0');
    return `SUPP-${nextNum}`;
  }

  findById(id: string): SupplierRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRecord | undefined;
    return row || null;
  }

  findByCode(code: string): SupplierRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM suppliers WHERE supplier_code = ? COLLATE NOCASE').get(code) as SupplierRecord | undefined;
    return row || null;
  }

  find(params: SupplierQueryParams = {}): PaginatedResult<SupplierRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (params.search) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR supplier_code LIKE ? OR email LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term);
    }

    if (params.status === 'active') {
      conditions.push('is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataStmt = db.prepare(`
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const items = dataStmt.all(...values, pageSize, offset) as SupplierRecord[];

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
    supplier_code?: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
    notes?: string | null;
    is_active?: number;
  }): SupplierRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const supplier_code = data.supplier_code || this.generateCode();
    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO suppliers (
        id, supplier_code, name, phone, email, address,
        city, state, pincode, gstin, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      supplier_code,
      data.name,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.pincode || null,
      data.gstin || null,
      data.notes || null,
      is_active,
      now,
      now
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<SupplierRecord, 'id' | 'created_at' | 'updated_at'>>): SupplierRecord | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields: (keyof typeof data)[] = [
      'supplier_code', 'name', 'phone', 'email', 'address',
      'city', 'state', 'pincode', 'gstin', 'notes', 'is_active'
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

    db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  setActive(id: string, isActive: boolean): SupplierRecord | null {
    return this.update(id, { is_active: isActive ? 1 : 0 });
  }
}

export const supplierRepository = new SupplierRepository();
