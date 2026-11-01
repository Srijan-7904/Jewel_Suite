import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';

export interface SupplierRecord {
  id: string;
  supplier_code: string;
  name: string;
  contact_person?: string | null;
  phone: string | null;
  alternate_phone?: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;

  // Granular Multi-Type Opening Balances
  opening_balance: number;
  opening_balance_type: 'DEBIT' | 'CREDIT';
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

  // Live Balances (Closed / Current)
  current_balance?: number;
  gold_balance_grams?: number;
  silver_balance_grams?: number;

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
  private ensureSupplierColumns(): void {
    const db = getDb();
    const columns = [
      "ALTER TABLE suppliers ADD COLUMN contact_person TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN alternate_phone TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_balance_type TEXT NOT NULL DEFAULT 'CREDIT'",
      "ALTER TABLE suppliers ADD COLUMN opening_balance_date TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN opening_balance_ref TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN opening_balance_notes TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN opening_cash_balance REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_cash_type TEXT NOT NULL DEFAULT 'CREDIT'",
      "ALTER TABLE suppliers ADD COLUMN opening_bank_balance REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_bank_type TEXT NOT NULL DEFAULT 'CREDIT'",
      "ALTER TABLE suppliers ADD COLUMN opening_gold_weight REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_gold_type TEXT NOT NULL DEFAULT 'CREDIT'",
      "ALTER TABLE suppliers ADD COLUMN opening_gold_purity_id TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN opening_gold_rate REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_gold_value REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_silver_weight REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_silver_type TEXT NOT NULL DEFAULT 'CREDIT'",
      "ALTER TABLE suppliers ADD COLUMN opening_silver_purity_id TEXT DEFAULT NULL",
      "ALTER TABLE suppliers ADD COLUMN opening_silver_rate REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE suppliers ADD COLUMN opening_silver_value REAL NOT NULL DEFAULT 0.0"
    ];
    for (const sql of columns) {
      try {
        db.exec(sql);
      } catch {
        // column already exists
      }
    }
  }

  private getSupplierBaseQuery(whereClause: string = ''): string {
    return `
      SELECT 
        s.*,
        gp.name AS opening_gold_purity_name,
        sp.name AS opening_silver_purity_name,
        COALESCE(
          (SELECT balance_after FROM ledger_entries 
           WHERE party_type = 'SUPPLIER' AND party_id = s.id 
           ORDER BY created_at DESC, rowid DESC LIMIT 1),
          (CASE WHEN s.opening_balance_type = 'CREDIT' THEN s.opening_balance ELSE -s.opening_balance END)
        ) AS current_balance,
        COALESCE(
          (SELECT balance_after FROM party_metal_ledger_entries 
           WHERE party_type = 'SUPPLIER' AND party_id = s.id 
             AND metal_id = (SELECT id FROM metals WHERE code = 'GOLD' COLLATE NOCASE LIMIT 1)
           ORDER BY created_at DESC, rowid DESC LIMIT 1),
          (CASE WHEN s.opening_gold_type = 'CREDIT' THEN s.opening_gold_weight ELSE -s.opening_gold_weight END)
        ) AS gold_balance_grams,
        COALESCE(
          (SELECT balance_after FROM party_metal_ledger_entries 
           WHERE party_type = 'SUPPLIER' AND party_id = s.id 
             AND metal_id = (SELECT id FROM metals WHERE code = 'SILVER' COLLATE NOCASE LIMIT 1)
           ORDER BY created_at DESC, rowid DESC LIMIT 1),
          (CASE WHEN s.opening_silver_type = 'CREDIT' THEN s.opening_silver_weight ELSE -s.opening_silver_weight END)
        ) AS silver_balance_grams
      FROM suppliers s
      LEFT JOIN metal_purities gp ON gp.id = s.opening_gold_purity_id
      LEFT JOIN metal_purities sp ON sp.id = s.opening_silver_purity_id
      ${whereClause}
    `;
  }

  generateCode(): string {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM suppliers').get() as { count: number };
    const nextNum = (countRow.count + 1).toString().padStart(4, '0');
    return `SUPP-${nextNum}`;
  }

  findById(id: string): SupplierRecord | null {
    this.ensureSupplierColumns();
    const db = getDb();
    const query = this.getSupplierBaseQuery('WHERE s.id = ?');
    const row = db.prepare(query).get(id) as SupplierRecord | undefined;
    return row || null;
  }

  findByCode(code: string): SupplierRecord | null {
    this.ensureSupplierColumns();
    const db = getDb();
    const query = this.getSupplierBaseQuery('WHERE s.supplier_code = ? COLLATE NOCASE');
    const row = db.prepare(query).get(code) as SupplierRecord | undefined;
    return row || null;
  }

  find(params: SupplierQueryParams = {}): PaginatedResult<SupplierRecord> {
    this.ensureSupplierColumns();
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (params.search) {
      conditions.push('(s.name LIKE ? OR s.phone LIKE ? OR s.supplier_code LIKE ? OR s.email LIKE ? OR s.contact_person LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term, term);
    }

    if (params.status === 'active') {
      conditions.push('s.is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('s.is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM suppliers s ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataQuery = `
      ${this.getSupplierBaseQuery(whereClause)}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataStmt = db.prepare(dataQuery);
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
    contact_person?: string | null;
    phone?: string | null;
    alternate_phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
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
  }): SupplierRecord {
    this.ensureSupplierColumns();
    const db = getDb();
    const id = data.id || uuidv4();
    const supplier_code = data.supplier_code || this.generateCode();
    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    const opening_balance = data.opening_balance !== undefined ? data.opening_balance : 0;
    const opening_balance_type = data.opening_balance_type || 'CREDIT';
    const opening_cash_balance = data.opening_cash_balance !== undefined ? data.opening_cash_balance : 0;
    const opening_cash_type = data.opening_cash_type || 'CREDIT';
    const opening_bank_balance = data.opening_bank_balance !== undefined ? data.opening_bank_balance : 0;
    const opening_bank_type = data.opening_bank_type || 'CREDIT';
    const opening_gold_weight = data.opening_gold_weight !== undefined ? data.opening_gold_weight : 0;
    const opening_gold_type = data.opening_gold_type || 'CREDIT';
    const opening_silver_weight = data.opening_silver_weight !== undefined ? data.opening_silver_weight : 0;
    const opening_silver_type = data.opening_silver_type || 'CREDIT';

    db.prepare(`
      INSERT INTO suppliers (
        id, supplier_code, name, contact_person, phone, alternate_phone, email, address,
        city, state, pincode, gstin,
        opening_balance, opening_balance_type, opening_balance_date, opening_balance_ref, opening_balance_notes,
        opening_cash_balance, opening_cash_type, opening_bank_balance, opening_bank_type,
        opening_gold_weight, opening_gold_type, opening_gold_purity_id, opening_gold_rate, opening_gold_value,
        opening_silver_weight, opening_silver_type, opening_silver_purity_id, opening_silver_rate, opening_silver_value,
        notes, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id,
      supplier_code,
      data.name,
      data.contact_person || null,
      data.phone || null,
      data.alternate_phone || null,
      data.email || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.pincode || null,
      data.gstin || null,
      opening_balance,
      opening_balance_type,
      data.opening_balance_date || null,
      data.opening_balance_ref || null,
      data.opening_balance_notes || null,
      opening_cash_balance,
      opening_cash_type,
      opening_bank_balance,
      opening_bank_type,
      opening_gold_weight,
      opening_gold_type,
      data.opening_gold_purity_id || null,
      data.opening_gold_rate || 0,
      data.opening_gold_value || 0,
      opening_silver_weight,
      opening_silver_type,
      data.opening_silver_purity_id || null,
      data.opening_silver_rate || 0,
      data.opening_silver_value || 0,
      data.notes || null,
      is_active,
      now,
      now
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<SupplierRecord, 'id' | 'created_at' | 'updated_at'>>): SupplierRecord | null {
    this.ensureSupplierColumns();
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields: (keyof typeof data)[] = [
      'supplier_code', 'name', 'contact_person', 'phone', 'alternate_phone', 'email', 'address',
      'city', 'state', 'pincode', 'gstin', 'notes', 'is_active',
      'opening_balance', 'opening_balance_type', 'opening_balance_date', 'opening_balance_ref', 'opening_balance_notes',
      'opening_cash_balance', 'opening_cash_type', 'opening_bank_balance', 'opening_bank_type',
      'opening_gold_weight', 'opening_gold_type', 'opening_gold_purity_id', 'opening_gold_rate', 'opening_gold_value',
      'opening_silver_weight', 'opening_silver_type', 'opening_silver_purity_id', 'opening_silver_rate', 'opening_silver_value'
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
