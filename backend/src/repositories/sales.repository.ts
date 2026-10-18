import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';
import { documentSequenceRepository } from './documentSequence.repository.js';

export interface SalesInvoiceRecord {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;

  subtotal: number;
  discount_amount: number;
  taxable_amount: number;

  gst_rate: number;
  gst_amount: number;

  round_off: number;
  grand_total: number;

  exchange_amount: number;
  net_payable: number;

  amount_paid: number;
  balance_amount: number;

  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  notes: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  customer_name?: string;
  customer_code?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  creator_name?: string | null;
}

export interface SalesInvoiceItemRecord {
  id: string;
  sales_invoice_id: string;
  stock_item_id: string | null;

  tag_no: string;
  item_name: string;
  metal_id: string;
  purity_id: string;

  gross_weight: number;
  less_weight: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  wastage_percent: number;
  wastage_weight: number;
  wastage_amount: number;

  rate_per_gram: number;
  metal_value: number;
  making_charge: number;
  item_amount: number;

  huid: string | null;
  notes: string | null;
  created_at: string;

  // Joined fields
  metal_code?: string;
  metal_name?: string;
  purity_code?: string;
  purity_name?: string;

  // Frontend compatibility alias fields
  metal_rate?: number;
  making_charges?: number;
  item_total?: number;
}

export interface SalesInvoicePaymentRecord {
  id: string;
  sales_invoice_id: string;
  payment_mode: string;
  amount: number;
  metal_weight?: number | null;
  metal_rate?: number | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface SalesInvoiceDetailsRecord extends SalesInvoiceRecord {
  items: SalesInvoiceItemRecord[];
  payments: SalesInvoicePaymentRecord[];
}

export interface CreateSalesInvoiceData {
  id?: string;
  invoice_number: string;
  customer_id: string;
  invoice_date?: string;
  discount_amount?: number;
  gst_rate?: number;
  exchange_amount?: number;
  notes?: string | null;
  status?: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  created_by?: string | null;
}

export interface CreateSalesInvoiceItemData {
  id?: string;
  sales_invoice_id: string;
  stock_item_id?: string | null;
  tag_no: string;
  item_name: string;
  metal_id: string;
  purity_id: string;
  gross_weight: number;
  less_weight?: number;
  net_weight: number;
  tunch_percent: number;
  fine_weight: number;
  wastage_percent?: number;
  wastage_weight?: number;
  wastage_amount?: number;
  rate_per_gram: number;
  metal_value: number;
  making_charge?: number;
  item_amount: number;
  huid?: string | null;
  notes?: string | null;
}

export interface CreateSalesPaymentData {
  id?: string;
  sales_invoice_id: string;
  payment_mode: string;
  amount: number;
  metal_weight?: number | null;
  metal_rate?: number | null;
  reference_number?: string | null;
  notes?: string | null;
}

export interface SalesQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customer_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export class SalesRepository {
  private baseSelect = `
    SELECT 
      si.*,
      c.name AS customer_name,
      c.customer_code,
      c.phone AS customer_phone,
      c.email AS customer_email,
      c.address AS customer_address,
      u.username AS creator_name
    FROM sales_invoices si
    JOIN customers c ON si.customer_id = c.id
    LEFT JOIN users u ON si.created_by = u.id
  `;

  getNextInvoiceNumber(): string {
    return documentSequenceRepository.getNextNumber('INVOICE');
  }

  create(data: CreateSalesInvoiceData): SalesInvoiceRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const invoice_number = data.invoice_number.trim().toUpperCase();
    const invoice_date = data.invoice_date || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO sales_invoices (
        id, invoice_number, customer_id, invoice_date,
        subtotal, discount_amount, taxable_amount,
        gst_rate, gst_amount, round_off, grand_total,
        exchange_amount, net_payable, amount_paid, balance_amount,
        status, notes, created_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        0.0, ?, 0.0,
        ?, 0.0, 0.0, 0.0,
        ?, 0.0, 0.0, 0.0,
        ?, ?, ?,
        datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      invoice_number,
      data.customer_id,
      invoice_date,
      data.discount_amount ?? 0.0,
      data.gst_rate ?? 3.0,
      data.exchange_amount ?? 0.0,
      data.status || 'DRAFT',
      data.notes ? data.notes.trim() : null,
      data.created_by || null
    );

    return this.findSummaryById(id)!;
  }

  update(id: string, updates: Partial<CreateSalesInvoiceData>): SalesInvoiceRecord | null {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.customer_id !== undefined) {
      fields.push('customer_id = ?');
      values.push(updates.customer_id);
    }
    if (updates.invoice_date !== undefined) {
      fields.push('invoice_date = ?');
      values.push(updates.invoice_date);
    }
    if (updates.discount_amount !== undefined) {
      fields.push('discount_amount = ?');
      values.push(updates.discount_amount);
    }
    if (updates.gst_rate !== undefined) {
      fields.push('gst_rate = ?');
      values.push(updates.gst_rate);
    }
    if (updates.exchange_amount !== undefined) {
      fields.push('exchange_amount = ?');
      values.push(updates.exchange_amount);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes ? updates.notes.trim() : null);
    }

    if (fields.length === 0) return this.findSummaryById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE sales_invoices SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.findSummaryById(id);
  }

  updateTotals(
    id: string,
    totals: {
      subtotal: number;
      discount_amount: number;
      taxable_amount: number;
      gst_rate: number;
      gst_amount: number;
      round_off: number;
      grand_total: number;
      exchange_amount: number;
      net_payable: number;
      amount_paid: number;
      balance_amount: number;
    }
  ): void {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE sales_invoices SET
        subtotal = ?,
        discount_amount = ?,
        taxable_amount = ?,
        gst_rate = ?,
        gst_amount = ?,
        round_off = ?,
        grand_total = ?,
        exchange_amount = ?,
        net_payable = ?,
        amount_paid = ?,
        balance_amount = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      totals.subtotal,
      totals.discount_amount,
      totals.taxable_amount,
      totals.gst_rate,
      totals.gst_amount,
      totals.round_off,
      totals.grand_total,
      totals.exchange_amount,
      totals.net_payable,
      totals.amount_paid,
      totals.balance_amount,
      id
    );
  }

  updateStatus(id: string, status: 'DRAFT' | 'FINALIZED' | 'CANCELLED'): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE sales_invoices SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
    return result.changes > 0;
  }

  findSummaryById(id: string): SalesInvoiceRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE si.id = ?`).get(id);
    return (row as SalesInvoiceRecord) || null;
  }

  findById(id: string): SalesInvoiceDetailsRecord | null {
    const summary = this.findSummaryById(id);
    if (!summary) return null;

    const items = this.getItemsByInvoiceId(id);
    const payments = this.getPaymentsByInvoiceId(id);

    return {
      ...summary,
      items,
      payments,
    };
  }

  findByNumber(invoiceNumber: string): SalesInvoiceDetailsRecord | null {
    const db = getDb();
    const row = db
      .prepare(`${this.baseSelect} WHERE si.invoice_number = ? COLLATE NOCASE`)
      .get(invoiceNumber.trim());
    if (!row) return null;

    const summary = row as SalesInvoiceRecord;
    const items = this.getItemsByInvoiceId(summary.id);
    const payments = this.getPaymentsByInvoiceId(summary.id);

    return {
      ...summary,
      items,
      payments,
    };
  }

  find(params: SalesQueryParams): PaginatedResult<SalesInvoiceRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(`(
        si.invoice_number LIKE ? OR 
        c.name LIKE ? OR 
        c.phone LIKE ?
      )`);
      args.push(term, term, term);
    }

    if (params.customer_id) {
      conditions.push('si.customer_id = ?');
      args.push(params.customer_id);
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push('si.status = ?');
      args.push(params.status);
    }

    if (params.from_date) {
      conditions.push('si.invoice_date >= ?');
      args.push(params.from_date);
    }

    if (params.to_date) {
      conditions.push('si.invoice_date <= ?');
      args.push(params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total 
      FROM sales_invoices si
      JOIN customers c ON si.customer_id = c.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const itemsSql = `
      ${this.baseSelect}
      ${whereClause}
      ORDER BY si.invoice_date DESC, si.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as SalesInvoiceRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // --- Invoice Items Sub-Entity ---

  createItem(data: CreateSalesInvoiceItemData): SalesInvoiceItemRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const tag_no = data.tag_no.trim().toUpperCase();

    const stmt = db.prepare(`
      INSERT INTO sales_invoice_items (
        id, sales_invoice_id, stock_item_id, tag_no, item_name,
        metal_id, purity_id, gross_weight, less_weight, net_weight,
        tunch_percent, fine_weight, wastage_percent, wastage_weight,
        wastage_amount, rate_per_gram, metal_value, making_charge,
        item_amount, huid, notes, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, datetime('now')
      )
    `);

    stmt.run(
      id,
      data.sales_invoice_id,
      data.stock_item_id || null,
      tag_no,
      data.item_name.trim(),
      data.metal_id,
      data.purity_id,
      data.gross_weight,
      data.less_weight ?? 0.0,
      data.net_weight,
      data.tunch_percent,
      data.fine_weight,
      data.wastage_percent ?? 0.0,
      data.wastage_weight ?? 0.0,
      data.wastage_amount ?? 0.0,
      data.rate_per_gram,
      data.metal_value,
      data.making_charge ?? 0.0,
      data.item_amount,
      data.huid || null,
      data.notes ? data.notes.trim() : null
    );

    return this.getItemById(id)!;
  }

  getItemById(id: string): SalesInvoiceItemRecord | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT 
          sii.*,
          m.code AS metal_code,
          m.name AS metal_name,
          mp.code AS purity_code,
          mp.name AS purity_name
        FROM sales_invoice_items sii
        JOIN metals m ON sii.metal_id = m.id
        JOIN metal_purities mp ON sii.purity_id = mp.id
        WHERE sii.id = ?
      `)
      .get(id) as SalesInvoiceItemRecord | undefined;

    if (!row) return null;
    return {
      ...row,
      wastage_percent: row.wastage_percent ?? 0.0,
      wastage_weight: row.wastage_weight ?? 0.0,
      wastage_amount: row.wastage_amount ?? 0.0,
      metal_rate: row.rate_per_gram,
      making_charges: row.making_charge,
      item_total: row.item_amount,
    };
  }

  getItemsByInvoiceId(invoiceId: string): SalesInvoiceItemRecord[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT 
          sii.*,
          m.code AS metal_code,
          m.name AS metal_name,
          mp.code AS purity_code,
          mp.name AS purity_name
        FROM sales_invoice_items sii
        JOIN metals m ON sii.metal_id = m.id
        JOIN metal_purities mp ON sii.purity_id = mp.id
        WHERE sii.sales_invoice_id = ?
        ORDER BY sii.created_at ASC
      `)
      .all(invoiceId) as SalesInvoiceItemRecord[];

    return rows.map((r) => ({
      ...r,
      wastage_percent: r.wastage_percent ?? 0.0,
      wastage_weight: r.wastage_weight ?? 0.0,
      wastage_amount: r.wastage_amount ?? 0.0,
      metal_rate: r.rate_per_gram,
      making_charges: r.making_charge,
      item_total: r.item_amount,
    }));
  }

  deleteItem(itemId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM sales_invoice_items WHERE id = ?').run(itemId);
    return result.changes > 0;
  }

  // --- Payments Sub-Entity ---

  createPayment(data: CreateSalesPaymentData): SalesInvoicePaymentRecord {
    const db = getDb();
    const id = data.id || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO sales_invoice_payments (
        id, sales_invoice_id, payment_mode, amount, metal_weight, metal_rate, reference_number, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      id,
      data.sales_invoice_id,
      data.payment_mode,
      data.amount,
      data.metal_weight ?? null,
      data.metal_rate ?? null,
      data.reference_number || null,
      data.notes ? data.notes.trim() : null
    );

    const row = db.prepare('SELECT * FROM sales_invoice_payments WHERE id = ?').get(id);
    return row as SalesInvoicePaymentRecord;
  }

  getPaymentsByInvoiceId(invoiceId: string): SalesInvoicePaymentRecord[] {
    const db = getDb();
    return db
      .prepare('SELECT * FROM sales_invoice_payments WHERE sales_invoice_id = ? ORDER BY created_at ASC')
      .all(invoiceId) as SalesInvoicePaymentRecord[];
  }

  deletePayment(paymentId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM sales_invoice_payments WHERE id = ?').run(paymentId);
    return result.changes > 0;
  }
}

export const salesRepository = new SalesRepository();
