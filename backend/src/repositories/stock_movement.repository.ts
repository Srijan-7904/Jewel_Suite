import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';

export interface StockMovementRecord {
  id: string;
  stock_item_id: string;
  tag_no?: string;
  movement_type: string;
  reference_type: string | null;
  reference_id: string | null;
  from_status: string | null;
  to_status: string;
  quantity: number;
  gross_weight: number;
  net_weight: number;
  fine_weight: number;
  notes: string | null;
  created_by: string | null;
  created_by_username?: string | null;
  created_at: string;
}

export interface CreateMovementData {
  id?: string;
  stock_item_id: string;
  movement_type: string;
  reference_type?: string | null;
  reference_id?: string | null;
  from_status?: string | null;
  to_status: string;
  quantity?: number;
  gross_weight: number;
  net_weight: number;
  fine_weight: number;
  notes?: string | null;
  created_by?: string | null;
}

export interface MovementQueryParams {
  page?: number;
  pageSize?: number;
  stock_item_id?: string;
  movement_type?: string;
}

export class StockMovementRepository {
  create(data: CreateMovementData): StockMovementRecord {
    const db = getDb();
    const id = data.id || uuidv4();

    const stmt = db.prepare(`
      INSERT INTO stock_movements (
        id, stock_item_id, movement_type,
        reference_type, reference_id,
        from_status, to_status,
        quantity, gross_weight, net_weight, fine_weight,
        notes, created_by, created_at
      ) VALUES (
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, datetime('now')
      )
    `);

    stmt.run(
      id,
      data.stock_item_id,
      data.movement_type,
      data.reference_type ?? null,
      data.reference_id ?? null,
      data.from_status ?? null,
      data.to_status,
      data.quantity ?? 1,
      data.gross_weight,
      data.net_weight,
      data.fine_weight,
      data.notes ? data.notes.trim() : null,
      data.created_by ?? null
    );

    const created = this.findById(id);
    return created!;
  }

  findById(id: string): StockMovementRecord | null {
    const db = getDb();
    const sql = `
      SELECT 
        sm.*,
        s.tag_no,
        u.username AS created_by_username
      FROM stock_movements sm
      JOIN stock_items s ON sm.stock_item_id = s.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.id = ?
    `;
    const row = db.prepare(sql).get(id);
    return (row as StockMovementRecord) || null;
  }

  findByStockItemId(stockItemId: string): StockMovementRecord[] {
    const db = getDb();
    const sql = `
      SELECT 
        sm.*,
        s.tag_no,
        u.username AS created_by_username
      FROM stock_movements sm
      JOIN stock_items s ON sm.stock_item_id = s.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.stock_item_id = ?
      ORDER BY sm.created_at ASC
    `;
    return db.prepare(sql).all(stockItemId) as StockMovementRecord[];
  }

  find(params: MovementQueryParams): PaginatedResult<StockMovementRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.stock_item_id) {
      conditions.push('sm.stock_item_id = ?');
      args.push(params.stock_item_id);
    }

    if (params.movement_type && params.movement_type !== 'ALL') {
      conditions.push('sm.movement_type = ?');
      args.push(params.movement_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM stock_movements sm
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const itemsSql = `
      SELECT 
        sm.*,
        s.tag_no,
        u.username AS created_by_username
      FROM stock_movements sm
      JOIN stock_items s ON sm.stock_item_id = s.id
      LEFT JOIN users u ON sm.created_by = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as StockMovementRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

export const stockMovementRepository = new StockMovementRepository();
