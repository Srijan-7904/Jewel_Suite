import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';
import { documentSequenceRepository } from './documentSequence.repository.js';

export interface ExchangeTransactionRecord {
  id: string;
  exchange_number: string;
  customer_id: string;
  sales_invoice_id: string | null;
  exchange_date: string;

  total_gross_weight: number;
  total_net_weight: number;
  total_fine_weight: number;
  total_metal_value: number;
  total_deduction_amount: number;
  total_exchange_value: number;
  payout_amount: number;

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
  invoice_number?: string | null;
  creator_name?: string | null;
}

export interface ExchangeItemRecord {
  id: string;
  exchange_transaction_id: string;
  source_type: 'LOOSE_METAL' | 'CUSTOMER_JEWELLERY';
  stock_item_id: string | null;

  metal_id: string;
  purity_id: string;
  product_id?: string | null;

  item_name: string;
  tag_no: string;

  gross_weight: number;
  less_weight: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  exchange_rate: number;
  metal_value: number;

  deduction_percent: number;
  deduction_amount: number;
  exchange_value: number;

  notes: string | null;
  created_at: string;

  // Joined fields
  metal_code?: string;
  metal_name?: string;
  purity_code?: string;
  purity_name?: string;
}

export interface ExchangeTransactionDetailsRecord extends ExchangeTransactionRecord {
  items: ExchangeItemRecord[];
}

export interface CreateExchangeTransactionData {
  id?: string;
  exchange_number: string;
  customer_id: string;
  sales_invoice_id?: string | null;
  exchange_date?: string;
  notes?: string | null;
  payout_amount?: number;
  status?: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  created_by?: string | null;
}

export interface CreateExchangeItemData {
  id?: string;
  exchange_transaction_id: string;
  source_type?: 'LOOSE_METAL' | 'CUSTOMER_JEWELLERY';
  stock_item_id?: string | null;
  metal_id: string;
  purity_id: string;
  product_id?: string | null;
  item_name: string;
  tag_no: string;
  gross_weight: number;
  less_weight?: number;
  net_weight: number;
  tunch_percent: number;
  fine_weight: number;
  exchange_rate: number;
  metal_value: number;
  deduction_percent?: number;
  deduction_amount?: number;
  exchange_value: number;
  notes?: string | null;
}

export interface ExchangeQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customer_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export class ExchangeRepository {
  private baseSelect = `
    SELECT 
      e.*,
      c.name AS customer_name,
      c.customer_code,
      c.phone AS customer_phone,
      c.email AS customer_email,
      si.invoice_number,
      u.username AS creator_name
    FROM exchange_transactions e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN sales_invoices si ON e.sales_invoice_id = si.id
    LEFT JOIN users u ON e.created_by = u.id
  `;

  /**
   * Generates a unique exchange number in EX-YYYY-000001 sequence.
   */
  getNextExchangeNumber(): string {
    return documentSequenceRepository.getNextNumber('EXCHANGE');
  }

  /**
   * Generates a unique inward stock tag for exchanged scrap metal.
   * e.g., EX-G-000001, EX-S-000001
   */
  getNextExchangeTag(metalCode: string = 'G'): string {
    const db = getDb();
    const mLetter = metalCode.charAt(0).toUpperCase();
    const prefix = `EX-${mLetter}-`;

    // Check highest tag across stock_items and exchange_items
    const stockRow = db
      .prepare(
        `SELECT tag_no FROM stock_items 
         WHERE tag_no LIKE ? 
         ORDER BY tag_no DESC LIMIT 1`
      )
      .get(`${prefix}%`) as { tag_no: string } | undefined;

    const exchangeRow = db
      .prepare(
        `SELECT tag_no FROM exchange_items 
         WHERE tag_no LIKE ? 
         ORDER BY tag_no DESC LIMIT 1`
      )
      .get(`${prefix}%`) as { tag_no: string } | undefined;

    let maxNum = 0;
    if (stockRow) {
      const num = parseInt(stockRow.tag_no.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    if (exchangeRow) {
      const num = parseInt(exchangeRow.tag_no.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    return `${prefix}${(maxNum + 1).toString().padStart(6, '0')}`;
  }

  create(data: CreateExchangeTransactionData): ExchangeTransactionRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const exchange_number = data.exchange_number.trim().toUpperCase();
    const exchange_date = data.exchange_date || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO exchange_transactions (
        id, exchange_number, customer_id, sales_invoice_id, exchange_date,
        total_gross_weight, total_net_weight, total_fine_weight,
        total_metal_value, total_deduction_amount, total_exchange_value,
        payout_amount, status, notes, created_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      exchange_number,
      data.customer_id,
      data.sales_invoice_id || null,
      exchange_date,
      data.payout_amount ?? 0.0,
      data.status || 'DRAFT',
      data.notes ? data.notes.trim() : null,
      data.created_by || null
    );

    return this.findSummaryById(id)!;
  }

  update(id: string, updates: Partial<CreateExchangeTransactionData>): ExchangeTransactionRecord | null {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.customer_id !== undefined) {
      fields.push('customer_id = ?');
      values.push(updates.customer_id);
    }
    if (updates.sales_invoice_id !== undefined) {
      fields.push('sales_invoice_id = ?');
      values.push(updates.sales_invoice_id || null);
    }
    if (updates.exchange_date !== undefined) {
      fields.push('exchange_date = ?');
      values.push(updates.exchange_date);
    }
    if (updates.payout_amount !== undefined) {
      fields.push('payout_amount = ?');
      values.push(updates.payout_amount);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes ? updates.notes.trim() : null);
    }

    if (fields.length === 0) return this.findSummaryById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE exchange_transactions SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.findSummaryById(id);
  }

  updateTotals(
    id: string,
    totals: {
      total_gross_weight: number;
      total_net_weight: number;
      total_fine_weight: number;
      total_metal_value: number;
      total_deduction_amount: number;
      total_exchange_value: number;
      payout_amount?: number;
    }
  ): void {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE exchange_transactions SET
        total_gross_weight = ?,
        total_net_weight = ?,
        total_fine_weight = ?,
        total_metal_value = ?,
        total_deduction_amount = ?,
        total_exchange_value = ?,
        payout_amount = IFNULL(?, payout_amount),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      totals.total_gross_weight,
      totals.total_net_weight,
      totals.total_fine_weight,
      totals.total_metal_value,
      totals.total_deduction_amount,
      totals.total_exchange_value,
      totals.payout_amount !== undefined ? totals.payout_amount : null,
      id
    );
  }

  updateStatus(id: string, status: 'DRAFT' | 'FINALIZED' | 'CANCELLED'): boolean {
    const db = getDb();
    const result = db
      .prepare("UPDATE exchange_transactions SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM exchange_transactions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findSummaryById(id: string): ExchangeTransactionRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE e.id = ?`).get(id);
    return (row as ExchangeTransactionRecord) || null;
  }

  findById(id: string): ExchangeTransactionDetailsRecord | null {
    const summary = this.findSummaryById(id);
    if (!summary) return null;

    const items = this.getItemsByExchangeId(id);
    return {
      ...summary,
      items,
    };
  }

  findByNumber(exchangeNumber: string): ExchangeTransactionDetailsRecord | null {
    const db = getDb();
    const row = db
      .prepare(`${this.baseSelect} WHERE e.exchange_number = ? COLLATE NOCASE`)
      .get(exchangeNumber.trim());
    if (!row) return null;

    const summary = row as ExchangeTransactionRecord;
    const items = this.getItemsByExchangeId(summary.id);
    return {
      ...summary,
      items,
    };
  }

  findByInvoiceId(invoiceId: string): ExchangeTransactionDetailsRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE e.sales_invoice_id = ?`).get(invoiceId);
    if (!row) return null;

    const summary = row as ExchangeTransactionRecord;
    const items = this.getItemsByExchangeId(summary.id);
    return {
      ...summary,
      items,
    };
  }

  findByCustomer(customerId: string): ExchangeTransactionRecord[] {
    const db = getDb();
    return db
      .prepare(`${this.baseSelect} WHERE e.customer_id = ? ORDER BY e.exchange_date DESC, e.created_at DESC`)
      .all(customerId) as ExchangeTransactionRecord[];
  }

  find(params: ExchangeQueryParams): PaginatedResult<ExchangeTransactionRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(`(
        e.exchange_number LIKE ? OR 
        c.name LIKE ? OR 
        c.phone LIKE ? OR 
        si.invoice_number LIKE ?
      )`);
      args.push(term, term, term, term);
    }

    if (params.customer_id) {
      conditions.push('e.customer_id = ?');
      args.push(params.customer_id);
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push('e.status = ?');
      args.push(params.status);
    }

    if (params.from_date) {
      conditions.push('e.exchange_date >= ?');
      args.push(params.from_date);
    }

    if (params.to_date) {
      conditions.push('e.exchange_date <= ?');
      args.push(params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total 
      FROM exchange_transactions e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN sales_invoices si ON e.sales_invoice_id = si.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const itemsSql = `
      ${this.baseSelect}
      ${whereClause}
      ORDER BY e.exchange_date DESC, e.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as ExchangeTransactionRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // --- Exchange Items Sub-Entity Methods ---

  createItem(data: CreateExchangeItemData): ExchangeItemRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const tag_no = data.tag_no.trim().toUpperCase();

    const stmt = db.prepare(`
      INSERT INTO exchange_items (
        id, exchange_transaction_id, source_type, stock_item_id,
        metal_id, purity_id, product_id, item_name, tag_no,
        gross_weight, less_weight, net_weight,
        tunch_percent, fine_weight,
        exchange_rate, metal_value,
        deduction_percent, deduction_amount, exchange_value,
        notes, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, datetime('now')
      )
    `);

    stmt.run(
      id,
      data.exchange_transaction_id,
      data.source_type || 'CUSTOMER_JEWELLERY',
      data.stock_item_id || null,
      data.metal_id,
      data.purity_id,
      data.product_id || null,
      data.item_name.trim(),
      tag_no,
      data.gross_weight,
      data.less_weight ?? 0.0,
      data.net_weight,
      data.tunch_percent,
      data.fine_weight,
      data.exchange_rate,
      data.metal_value,
      data.deduction_percent ?? 0.0,
      data.deduction_amount ?? 0.0,
      data.exchange_value,
      data.notes ? data.notes.trim() : null
    );

    return this.getItemById(id)!;
  }

  getItemById(id: string): ExchangeItemRecord | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT 
          ei.*,
          m.code AS metal_code,
          m.name AS metal_name,
          mp.code AS purity_code,
          mp.name AS purity_name
        FROM exchange_items ei
        JOIN metals m ON ei.metal_id = m.id
        JOIN metal_purities mp ON ei.purity_id = mp.id
        WHERE ei.id = ?
      `)
      .get(id);

    return (row as ExchangeItemRecord) || null;
  }

  getItemsByExchangeId(exchangeId: string): ExchangeItemRecord[] {
    const db = getDb();
    return db
      .prepare(`
        SELECT 
          ei.*,
          m.code AS metal_code,
          m.name AS metal_name,
          mp.code AS purity_code,
          mp.name AS purity_name
        FROM exchange_items ei
        JOIN metals m ON ei.metal_id = m.id
        JOIN metal_purities mp ON ei.purity_id = mp.id
        WHERE ei.exchange_transaction_id = ?
        ORDER BY ei.created_at ASC
      `)
      .all(exchangeId) as ExchangeItemRecord[];
  }

  updateItemStockId(itemId: string, stockItemId: string): void {
    const db = getDb();
    db.prepare('UPDATE exchange_items SET stock_item_id = ? WHERE id = ?').run(stockItemId, itemId);
  }

  deleteItem(itemId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM exchange_items WHERE id = ?').run(itemId);
    return result.changes > 0;
  }
}

export const exchangeRepository = new ExchangeRepository();
