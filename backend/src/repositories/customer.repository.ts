import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';

export interface CustomerRecord {
  id: string;
  customer_code: string;
  name: string;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  customer_type: 'RETAIL' | 'WHOLESALE' | 'GIRVI_CLIENT';
  opening_balance: number;
  opening_balance_type: 'DEBIT' | 'CREDIT';
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customer_type?: string;
  status?: 'all' | 'active' | 'inactive';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class CustomerRepository {
  generateCode(): string {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
    const nextNum = (countRow.count + 1).toString().padStart(4, '0');
    return `CUST-${nextNum}`;
  }

  findById(id: string): CustomerRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRecord | undefined;
    return row || null;
  }

  findByCode(code: string): CustomerRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM customers WHERE customer_code = ? COLLATE NOCASE').get(code) as CustomerRecord | undefined;
    return row || null;
  }

  find(params: CustomerQueryParams = {}): PaginatedResult<CustomerRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (params.search) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR customer_code LIKE ? OR email LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term);
    }

    if (params.customer_type && params.customer_type !== 'ALL') {
      conditions.push('customer_type = ?');
      values.push(params.customer_type);
    }

    if (params.status === 'active') {
      conditions.push('is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM customers ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataStmt = db.prepare(`
      SELECT * FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const items = dataStmt.all(...values, pageSize, offset) as CustomerRecord[];

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
    customer_code?: string;
    name: string;
    phone?: string | null;
    alternate_phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
    customer_type?: 'RETAIL' | 'WHOLESALE' | 'GIRVI_CLIENT';
    opening_balance?: number;
    opening_balance_type?: 'DEBIT' | 'CREDIT';
    notes?: string | null;
    is_active?: number;
  }): CustomerRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const customer_code = data.customer_code || this.generateCode();
    const customer_type = data.customer_type || 'RETAIL';
    const opening_balance = data.opening_balance !== undefined ? data.opening_balance : 0;
    const opening_balance_type = data.opening_balance_type || 'DEBIT';
    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO customers (
        id, customer_code, name, phone, alternate_phone, email, address,
        city, state, pincode, gstin, customer_type, opening_balance,
        opening_balance_type, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customer_code,
      data.name,
      data.phone || null,
      data.alternate_phone || null,
      data.email || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.pincode || null,
      data.gstin || null,
      customer_type,
      opening_balance,
      opening_balance_type,
      data.notes || null,
      is_active,
      now,
      now
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<CustomerRecord, 'id' | 'created_at' | 'updated_at'>>): CustomerRecord | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields: (keyof typeof data)[] = [
      'customer_code', 'name', 'phone', 'alternate_phone', 'email',
      'address', 'city', 'state', 'pincode', 'gstin', 'customer_type',
      'opening_balance', 'opening_balance_type', 'notes', 'is_active'
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

    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  setActive(id: string, isActive: boolean): CustomerRecord | null {
    return this.update(id, { is_active: isActive ? 1 : 0 });
  }
}

export const customerRepository = new CustomerRepository();
