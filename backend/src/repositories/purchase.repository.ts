import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';

export interface PurchaseBillRecord {
  id: string;
  purchase_number: string;
  supplier_id: string;
  purchase_date: string;
  supplier_invoice_number: string | null;

  subtotal: number;
  discount_amount: number;
  taxable_amount: number;

  gst_rate: number;
  gst_amount: number;

  round_off: number;
  grand_total: number;

  amount_paid: number;
  balance_amount: number;

  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  notes: string | null;

  created_by: string | null;
  created_by_username?: string | null;
  supplier_name?: string;
  supplier_code?: string;
  supplier_phone?: string | null;
  supplier_gstin?: string | null;

  created_at: string;
  updated_at: string;
}

export interface PurchaseBillItemRecord {
  id: string;
  purchase_bill_id: string;

  product_id: string;
  product_name?: string;
  product_code?: string;
  category_name?: string;

  metal_id: string;
  metal_code?: string;
  metal_name?: string;

  purity_id: string;
  purity_code?: string;
  purity_name?: string;

  tag_no: string;
  item_name: string;

  gross_weight: number;
  less_weight: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  wastage_percent: number;
  making_charge: number;

  rate_per_gram: number;
  metal_value: number;
  item_amount: number;

  huid: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseBillPaymentRecord {
  id: string;
  purchase_bill_id: string;
  payment_mode: string;
  amount: number;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseBillDetailsRecord extends PurchaseBillRecord {
  items: PurchaseBillItemRecord[];
  payments: PurchaseBillPaymentRecord[];
}

export interface PurchaseQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  supplier_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export class PurchaseRepository {
  /**
   * Generates next consecutive purchase bill sequence for the current calendar year.
   * Format: PUR-YYYY-000001
   */
  getNextPurchaseNumber(): string {
    const db = getDb();
    const currentYear = new Date().getFullYear();
    const prefix = `PUR-${currentYear}-`;

    const row = db.prepare(`
      SELECT purchase_number 
      FROM purchase_bills 
      WHERE purchase_number LIKE ? 
      ORDER BY purchase_number DESC 
      LIMIT 1
    `).get(`${prefix}%`) as { purchase_number: string } | undefined;

    if (!row) {
      return `${prefix}000001`;
    }

    const lastNumStr = row.purchase_number.replace(prefix, '');
    const lastNum = parseInt(lastNumStr, 10);
    const nextSeq = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefix}${nextSeq.toString().padStart(6, '0')}`;
  }

  create(data: {
    id?: string;
    purchase_number: string;
    supplier_id: string;
    purchase_date?: string;
    supplier_invoice_number?: string | null;
    subtotal?: number;
    discount_amount?: number;
    taxable_amount?: number;
    gst_rate?: number;
    gst_amount?: number;
    round_off?: number;
    grand_total?: number;
    amount_paid?: number;
    balance_amount?: number;
    status?: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
    notes?: string | null;
    created_by?: string | null;
  }): PurchaseBillRecord {
    const db = getDb();
    const id = data.id || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO purchase_bills (
        id, purchase_number, supplier_id, purchase_date, supplier_invoice_number,
        subtotal, discount_amount, taxable_amount,
        gst_rate, gst_amount, round_off, grand_total,
        amount_paid, balance_amount, status, notes,
        created_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, IFNULL(?, date('now')), ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, IFNULL(?, 'DRAFT'), ?,
        ?, datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      data.purchase_number,
      data.supplier_id,
      data.purchase_date ?? null,
      data.supplier_invoice_number ?? null,
      data.subtotal ?? 0.0,
      data.discount_amount ?? 0.0,
      data.taxable_amount ?? 0.0,
      data.gst_rate ?? 3.0,
      data.gst_amount ?? 0.0,
      data.round_off ?? 0.0,
      data.grand_total ?? 0.0,
      data.amount_paid ?? 0.0,
      data.balance_amount ?? 0.0,
      data.status ?? 'DRAFT',
      data.notes ? data.notes.trim() : null,
      data.created_by ?? null
    );

    return this.findById(id)!;
  }

  findById(id: string): PurchaseBillDetailsRecord | null {
    const db = getDb();
    const sql = `
      SELECT 
        pb.*,
        s.name AS supplier_name,
        s.supplier_code,
        s.phone AS supplier_phone,
        s.gstin AS supplier_gstin,
        u.username AS created_by_username
      FROM purchase_bills pb
      JOIN suppliers s ON pb.supplier_id = s.id
      LEFT JOIN users u ON pb.created_by = u.id
      WHERE pb.id = ?
    `;

    const bill = db.prepare(sql).get(id) as PurchaseBillRecord | undefined;
    if (!bill) return null;

    const items = this.getItems(id);
    const payments = this.getPayments(id);

    return {
      ...bill,
      items,
      payments,
    };
  }

  findByNumber(purchaseNumber: string): PurchaseBillDetailsRecord | null {
    const db = getDb();
    const sql = `
      SELECT 
        pb.*,
        s.name AS supplier_name,
        s.supplier_code,
        s.phone AS supplier_phone,
        s.gstin AS supplier_gstin,
        u.username AS created_by_username
      FROM purchase_bills pb
      JOIN suppliers s ON pb.supplier_id = s.id
      LEFT JOIN users u ON pb.created_by = u.id
      WHERE pb.purchase_number = ? COLLATE NOCASE
    `;

    const bill = db.prepare(sql).get(purchaseNumber.trim()) as PurchaseBillRecord | undefined;
    if (!bill) return null;

    const items = this.getItems(bill.id);
    const payments = this.getPayments(bill.id);

    return {
      ...bill,
      items,
      payments,
    };
  }

  update(id: string, updates: Partial<PurchaseBillRecord>): PurchaseBillRecord | null {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    const allowed = [
      'supplier_id',
      'purchase_date',
      'supplier_invoice_number',
      'subtotal',
      'discount_amount',
      'taxable_amount',
      'gst_rate',
      'gst_amount',
      'round_off',
      'grand_total',
      'amount_paid',
      'balance_amount',
      'status',
      'notes',
    ];

    for (const key of allowed) {
      if ((updates as any)[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const sql = `UPDATE purchase_bills SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    return this.findById(id);
  }

  updateStatus(id: string, status: string): PurchaseBillRecord | null {
    const db = getDb();
    db.prepare("UPDATE purchase_bills SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    return this.findById(id);
  }

  find(params: PurchaseQueryParams): PaginatedResult<PurchaseBillRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(`(
        pb.purchase_number LIKE ? OR 
        pb.supplier_invoice_number LIKE ? OR 
        s.name LIKE ? OR 
        s.supplier_code LIKE ?
      )`);
      args.push(term, term, term, term);
    }

    if (params.supplier_id) {
      conditions.push('pb.supplier_id = ?');
      args.push(params.supplier_id);
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push('pb.status = ?');
      args.push(params.status);
    }

    if (params.startDate) {
      conditions.push('pb.purchase_date >= ?');
      args.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push('pb.purchase_date <= ?');
      args.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total 
      FROM purchase_bills pb
      JOIN suppliers s ON pb.supplier_id = s.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const itemsSql = `
      SELECT 
        pb.*,
        s.name AS supplier_name,
        s.supplier_code,
        s.phone AS supplier_phone,
        s.gstin AS supplier_gstin,
        u.username AS created_by_username
      FROM purchase_bills pb
      JOIN suppliers s ON pb.supplier_id = s.id
      LEFT JOIN users u ON pb.created_by = u.id
      ${whereClause}
      ORDER BY pb.purchase_date DESC, pb.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as PurchaseBillRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // --- Purchase Items ---

  createItem(itemData: {
    id?: string;
    purchase_bill_id: string;
    product_id: string;
    metal_id: string;
    purity_id: string;
    tag_no: string;
    item_name: string;
    gross_weight: number;
    less_weight?: number;
    net_weight: number;
    tunch_percent: number;
    fine_weight: number;
    wastage_percent?: number;
    making_charge?: number;
    rate_per_gram: number;
    metal_value: number;
    item_amount: number;
    huid?: string | null;
    notes?: string | null;
  }): PurchaseBillItemRecord {
    const db = getDb();
    const id = itemData.id || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO purchase_bill_items (
        id, purchase_bill_id, product_id, metal_id, purity_id,
        tag_no, item_name, gross_weight, less_weight, net_weight,
        tunch_percent, fine_weight, wastage_percent, making_charge,
        rate_per_gram, metal_value, item_amount,
        huid, notes, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, datetime('now')
      )
    `);

    stmt.run(
      id,
      itemData.purchase_bill_id,
      itemData.product_id,
      itemData.metal_id,
      itemData.purity_id,
      itemData.tag_no.trim().toUpperCase(),
      itemData.item_name.trim(),
      itemData.gross_weight,
      itemData.less_weight ?? 0.0,
      itemData.net_weight,
      itemData.tunch_percent,
      itemData.fine_weight,
      itemData.wastage_percent ?? 0.0,
      itemData.making_charge ?? 0.0,
      itemData.rate_per_gram,
      itemData.metal_value,
      itemData.item_amount,
      itemData.huid ? itemData.huid.trim().toUpperCase() : null,
      itemData.notes ? itemData.notes.trim() : null
    );

    return db.prepare('SELECT * FROM purchase_bill_items WHERE id = ?').get(id) as PurchaseBillItemRecord;
  }

  deleteItem(itemId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM purchase_bill_items WHERE id = ?').run(itemId);
    return result.changes > 0;
  }

  deleteItemsByBillId(billId: string): void {
    const db = getDb();
    db.prepare('DELETE FROM purchase_bill_items WHERE purchase_bill_id = ?').run(billId);
  }

  getItems(billId: string): PurchaseBillItemRecord[] {
    const db = getDb();
    const sql = `
      SELECT 
        pbi.*,
        p.name AS product_name,
        p.product_code,
        c.name AS category_name,
        m.code AS metal_code,
        m.name AS metal_name,
        mp.code AS purity_code,
        mp.name AS purity_name
      FROM purchase_bill_items pbi
      JOIN products p ON pbi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN metals m ON pbi.metal_id = m.id
      JOIN metal_purities mp ON pbi.purity_id = mp.id
      WHERE pbi.purchase_bill_id = ?
      ORDER BY pbi.created_at ASC
    `;
    return db.prepare(sql).all(billId) as PurchaseBillItemRecord[];
  }

  // --- Purchase Payments ---

  createPayment(paymentData: {
    id?: string;
    purchase_bill_id: string;
    payment_mode: string;
    amount: number;
    reference_number?: string | null;
    notes?: string | null;
  }): PurchaseBillPaymentRecord {
    const db = getDb();
    const id = paymentData.id || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO purchase_bill_payments (
        id, purchase_bill_id, payment_mode, amount,
        reference_number, notes, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, datetime('now')
      )
    `);

    stmt.run(
      id,
      paymentData.purchase_bill_id,
      paymentData.payment_mode,
      paymentData.amount,
      paymentData.reference_number ? paymentData.reference_number.trim() : null,
      paymentData.notes ? paymentData.notes.trim() : null
    );

    return db.prepare('SELECT * FROM purchase_bill_payments WHERE id = ?').get(id) as PurchaseBillPaymentRecord;
  }

  deletePaymentsByBillId(billId: string): void {
    const db = getDb();
    db.prepare('DELETE FROM purchase_bill_payments WHERE purchase_bill_id = ?').run(billId);
  }

  getPayments(billId: string): PurchaseBillPaymentRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM purchase_bill_payments 
      WHERE purchase_bill_id = ? 
      ORDER BY created_at ASC
    `).all(billId) as PurchaseBillPaymentRecord[];
  }

  getPurchasesBySupplier(supplierId: string): PurchaseBillRecord[] {
    const db = getDb();
    return db.prepare(`
      SELECT pb.*, s.name as supplier_name, s.supplier_code
      FROM purchase_bills pb
      JOIN suppliers s ON pb.supplier_id = s.id
      WHERE pb.supplier_id = ?
      ORDER BY pb.purchase_date DESC, pb.created_at DESC
    `).all(supplierId) as PurchaseBillRecord[];
  }
}

export const purchaseRepository = new PurchaseRepository();
