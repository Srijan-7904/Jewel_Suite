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
  
  // Granular Multi-Type Opening Balances
  opening_balance_date?: string | null;
  opening_balance_ref?: string | null;
  opening_balance_notes?: string | null;

  opening_cash_balance?: number;
  opening_cash_type?: 'DEBIT' | 'CREDIT';

  opening_bank_balance?: number;
  opening_bank_type?: 'DEBIT' | 'CREDIT';

  opening_gold_weight?: number;
  opening_gold_type?: 'DEBIT' | 'CREDIT';
  opening_gold_purity_id?: string | null;
  opening_gold_purity_name?: string | null;
  opening_gold_rate?: number;
  opening_gold_value?: number;

  opening_silver_weight?: number;
  opening_silver_type?: 'DEBIT' | 'CREDIT';
  opening_silver_purity_id?: string | null;
  opening_silver_purity_name?: string | null;
  opening_silver_rate?: number;
  opening_silver_value?: number;

  // Live Balances
  current_balance?: number;
  gold_balance_grams?: number;
  silver_balance_grams?: number;

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
  private getCustomerBaseQuery(whereClause = ''): string {
    return `
      SELECT 
        c.*,
        gp.name AS opening_gold_purity_name,
        sp.name AS opening_silver_purity_name,
        COALESCE(
          (SELECT balance_after FROM ledger_entries 
           WHERE party_type = 'CUSTOMER' AND party_id = c.id 
           ORDER BY created_at DESC, rowid DESC LIMIT 1),
          (CASE WHEN c.opening_balance_type = 'DEBIT' THEN c.opening_balance ELSE -c.opening_balance END)
        ) AS current_balance,
        COALESCE(
          (SELECT balance_after FROM party_metal_ledger_entries 
           WHERE party_type = 'CUSTOMER' AND party_id = c.id 
             AND metal_id = (SELECT id FROM metals WHERE code = 'GOLD' COLLATE NOCASE LIMIT 1)
           ORDER BY created_at DESC, rowid DESC LIMIT 1),
          0.0
        ) AS gold_balance_grams,
        COALESCE(
          (SELECT balance_after FROM party_metal_ledger_entries 
           WHERE party_type = 'CUSTOMER' AND party_id = c.id 
             AND metal_id = (SELECT id FROM metals WHERE code = 'SILVER' COLLATE NOCASE LIMIT 1)
           ORDER BY created_at DESC, rowid DESC LIMIT 1),
          0.0
        ) AS silver_balance_grams
      FROM customers c
      LEFT JOIN metal_purities gp ON gp.id = c.opening_gold_purity_id
      LEFT JOIN metal_purities sp ON sp.id = c.opening_silver_purity_id
      ${whereClause}
    `;
  }

  generateCode(): string {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
    const nextNum = (countRow.count + 1).toString().padStart(4, '0');
    return `CUST-${nextNum}`;
  }

  findById(id: string): CustomerRecord | null {
    const db = getDb();
    const query = this.getCustomerBaseQuery('WHERE c.id = ?');
    const row = db.prepare(query).get(id) as CustomerRecord | undefined;
    return row || null;
  }

  findByCode(code: string): CustomerRecord | null {
    const db = getDb();
    const query = this.getCustomerBaseQuery('WHERE c.customer_code = ? COLLATE NOCASE');
    const row = db.prepare(query).get(code) as CustomerRecord | undefined;
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
      conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? OR c.email LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term);
    }

    if (params.customer_type && params.customer_type !== 'ALL') {
      conditions.push('c.customer_type = ?');
      values.push(params.customer_type);
    }

    if (params.status === 'active') {
      conditions.push('c.is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('c.is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM customers c ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataStmt = db.prepare(`
      ${this.getCustomerBaseQuery(whereClause)}
      ORDER BY c.created_at DESC
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
    opening_balance_date?: string | null;
    opening_balance_ref?: string | null;
    opening_balance_notes?: string | null;
    opening_cash_balance?: number;
    opening_cash_type?: 'DEBIT' | 'CREDIT';
    opening_bank_balance?: number;
    opening_bank_type?: 'DEBIT' | 'CREDIT';
    opening_gold_weight?: number;
    opening_gold_type?: 'DEBIT' | 'CREDIT';
    opening_gold_purity_id?: string | null;
    opening_gold_rate?: number;
    opening_gold_value?: number;
    opening_silver_weight?: number;
    opening_silver_type?: 'DEBIT' | 'CREDIT';
    opening_silver_purity_id?: string | null;
    opening_silver_rate?: number;
    opening_silver_value?: number;
    notes?: string | null;
    is_active?: number;
  }): CustomerRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const customer_code = data.customer_code || this.generateCode();
    const customer_type = data.customer_type || 'RETAIL';
    const opening_balance = data.opening_balance !== undefined ? data.opening_balance : 0;
    const opening_balance_type = data.opening_balance_type || 'DEBIT';

    const opening_balance_date = data.opening_balance_date || null;
    const opening_balance_ref = data.opening_balance_ref || null;
    const opening_balance_notes = data.opening_balance_notes || null;

    const opening_cash_balance = data.opening_cash_balance !== undefined ? data.opening_cash_balance : 0;
    const opening_cash_type = data.opening_cash_type || 'DEBIT';

    const opening_bank_balance = data.opening_bank_balance !== undefined ? data.opening_bank_balance : 0;
    const opening_bank_type = data.opening_bank_type || 'DEBIT';

    const opening_gold_weight = data.opening_gold_weight !== undefined ? data.opening_gold_weight : 0;
    const opening_gold_type = data.opening_gold_type || 'DEBIT';
    const opening_gold_purity_id = data.opening_gold_purity_id || null;
    const opening_gold_rate = data.opening_gold_rate !== undefined ? data.opening_gold_rate : 0;
    const opening_gold_value = data.opening_gold_value !== undefined ? data.opening_gold_value : 0;

    const opening_silver_weight = data.opening_silver_weight !== undefined ? data.opening_silver_weight : 0;
    const opening_silver_type = data.opening_silver_type || 'DEBIT';
    const opening_silver_purity_id = data.opening_silver_purity_id || null;
    const opening_silver_rate = data.opening_silver_rate !== undefined ? data.opening_silver_rate : 0;
    const opening_silver_value = data.opening_silver_value !== undefined ? data.opening_silver_value : 0;

    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO customers (
        id, customer_code, name, phone, alternate_phone, email, address,
        city, state, pincode, gstin, customer_type, opening_balance,
        opening_balance_type,
        opening_balance_date, opening_balance_ref, opening_balance_notes,
        opening_cash_balance, opening_cash_type,
        opening_bank_balance, opening_bank_type,
        opening_gold_weight, opening_gold_type, opening_gold_purity_id, opening_gold_rate, opening_gold_value,
        opening_silver_weight, opening_silver_type, opening_silver_purity_id, opening_silver_rate, opening_silver_value,
        notes, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
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
      opening_balance_date,
      opening_balance_ref,
      opening_balance_notes,
      opening_cash_balance,
      opening_cash_type,
      opening_bank_balance,
      opening_bank_type,
      opening_gold_weight,
      opening_gold_type,
      opening_gold_purity_id,
      opening_gold_rate,
      opening_gold_value,
      opening_silver_weight,
      opening_silver_type,
      opening_silver_purity_id,
      opening_silver_rate,
      opening_silver_value,
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
      'opening_balance', 'opening_balance_type',
      'opening_balance_date', 'opening_balance_ref', 'opening_balance_notes',
      'opening_cash_balance', 'opening_cash_type',
      'opening_bank_balance', 'opening_bank_type',
      'opening_gold_weight', 'opening_gold_type', 'opening_gold_purity_id', 'opening_gold_rate', 'opening_gold_value',
      'opening_silver_weight', 'opening_silver_type', 'opening_silver_purity_id', 'opening_silver_rate', 'opening_silver_value',
      'notes', 'is_active'
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
