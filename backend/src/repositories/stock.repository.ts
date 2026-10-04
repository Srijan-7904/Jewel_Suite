import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';

export interface StockItemRecord {
  id: string;
  tag_no: string;
  product_id: string;
  metal_id: string;
  purity_id: string;

  gross_weight: number;
  less_weight: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  wastage_percent: number;
  making_charge: number;

  rate_per_gram: number;
  metal_value: number;
  current_value: number | null;

  acquisition_type: string;
  acquisition_reference: string | null;

  status: string;
  huid: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;

  // Joined master fields
  product_code?: string;
  product_name?: string;
  category_id?: string;
  category_name?: string;
  category_code?: string;
  metal_code?: string;
  metal_name?: string;
  purity_code?: string;
  purity_name?: string;
  current_rate?: number | null;
  current_valuation?: number | null;
}

export interface CreateStockItemData {
  id?: string;
  tag_no: string;
  product_id: string;
  metal_id: string;
  purity_id: string;

  gross_weight: number;
  less_weight?: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  wastage_percent?: number;
  making_charge?: number;

  rate_per_gram?: number;
  metal_value?: number;
  current_value?: number | null;

  acquisition_type?: string;
  acquisition_reference?: string | null;

  status?: string;
  huid?: string | null;
  notes?: string | null;
}

export interface StockQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  product_id?: string;
  category_id?: string;
  metal_id?: string;
  metal_code?: string;
  purity_id?: string;
  purity_code?: string;
  status?: string;
}

export class StockRepository {
  private baseSelect = `
    SELECT 
      s.*,
      p.product_code,
      p.name AS product_name,
      p.category_id,
      c.name AS category_name,
      c.code AS category_code,
      m.code AS metal_code,
      m.name AS metal_name,
      mp.code AS purity_code,
      mp.name AS purity_name,
      (
        SELECT mr.rate 
        FROM metal_rates mr 
        WHERE mr.metal_id = s.metal_id AND mr.purity_id = s.purity_id 
        ORDER BY mr.effective_from DESC, mr.created_at DESC 
        LIMIT 1
      ) AS current_rate,
      ROUND(
        s.fine_weight * IFNULL(
          (
            SELECT mr.rate 
            FROM metal_rates mr 
            WHERE mr.metal_id = s.metal_id AND mr.purity_id = s.purity_id 
            ORDER BY mr.effective_from DESC, mr.created_at DESC 
            LIMIT 1
          ), 
          s.rate_per_gram
        ), 
        2
      ) AS current_valuation
    FROM stock_items s
    JOIN products p ON s.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN metals m ON s.metal_id = m.id
    JOIN metal_purities mp ON s.purity_id = mp.id
  `;

  create(data: CreateStockItemData): StockItemRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const tag_no = data.tag_no.trim().toUpperCase();

    const stmt = db.prepare(`
      INSERT INTO stock_items (
        id, tag_no, product_id, metal_id, purity_id,
        gross_weight, less_weight, net_weight,
        tunch_percent, fine_weight,
        wastage_percent, making_charge,
        rate_per_gram, metal_value, current_value,
        acquisition_type, acquisition_reference,
        status, huid, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      tag_no,
      data.product_id,
      data.metal_id,
      data.purity_id,
      data.gross_weight,
      data.less_weight ?? 0.0,
      data.net_weight,
      data.tunch_percent,
      data.fine_weight,
      data.wastage_percent ?? 0.0,
      data.making_charge ?? 0.0,
      data.rate_per_gram ?? 0.0,
      data.metal_value ?? 0.0,
      data.current_value ?? data.metal_value ?? 0.0,
      data.acquisition_type ?? 'OPENING_STOCK',
      data.acquisition_reference ?? null,
      data.status ?? 'IN_STOCK',
      data.huid ? data.huid.trim().toUpperCase() : null,
      data.notes ? data.notes.trim() : null
    );

    return this.findById(id)!;
  }

  findById(id: string): StockItemRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE s.id = ?`).get(id);
    return (row as StockItemRecord) || null;
  }

  findByTag(tagNo: string): StockItemRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE s.tag_no = ? COLLATE NOCASE`).get(tagNo.trim());
    return (row as StockItemRecord) || null;
  }

  updateStatus(id: string, newStatus: string): StockItemRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE stock_items 
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    const result = stmt.run(newStatus, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  update(id: string, updates: Partial<CreateStockItemData>): StockItemRecord | null {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.huid !== undefined) {
      fields.push('huid = ?');
      values.push(updates.huid ? updates.huid.trim().toUpperCase() : null);
    }
    if (updates.making_charge !== undefined) {
      fields.push('making_charge = ?');
      values.push(updates.making_charge);
    }
    if (updates.wastage_percent !== undefined) {
      fields.push('wastage_percent = ?');
      values.push(updates.wastage_percent);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const sql = `UPDATE stock_items SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.findById(id);
  }

  find(params: StockQueryParams): PaginatedResult<StockItemRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(`(
        s.tag_no LIKE ? OR 
        p.name LIKE ? OR 
        p.product_code LIKE ? OR 
        s.huid LIKE ?
      )`);
      args.push(term, term, term, term);
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push('s.status = ?');
      args.push(params.status);
    }

    if (params.product_id) {
      conditions.push('s.product_id = ?');
      args.push(params.product_id);
    }

    if (params.category_id && params.category_id !== 'ALL') {
      conditions.push('p.category_id = ?');
      args.push(params.category_id);
    }

    if (params.metal_id) {
      conditions.push('s.metal_id = ?');
      args.push(params.metal_id);
    }

    if (params.metal_code && params.metal_code !== 'ALL') {
      conditions.push('m.code = ? COLLATE NOCASE');
      args.push(params.metal_code);
    }

    if (params.purity_id) {
      conditions.push('s.purity_id = ?');
      args.push(params.purity_id);
    }

    if (params.purity_code && params.purity_code !== 'ALL') {
      conditions.push('mp.code = ? COLLATE NOCASE');
      args.push(params.purity_code);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countSql = `
      SELECT COUNT(*) AS total 
      FROM stock_items s
      JOIN products p ON s.product_id = p.id
      JOIN metals m ON s.metal_id = m.id
      JOIN metal_purities mp ON s.purity_id = mp.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // Items query
    const itemsSql = `
      ${this.baseSelect}
      ${whereClause}
      ORDER BY s.created_at DESC, s.tag_no ASC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as StockItemRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  count(status?: string): number {
    const db = getDb();
    if (status) {
      const row = db.prepare('SELECT COUNT(*) as count FROM stock_items WHERE status = ?').get(status) as { count: number };
      return row ? row.count : 0;
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM stock_items').get() as { count: number };
    return row ? row.count : 0;
  }
}

export const stockRepository = new StockRepository();
