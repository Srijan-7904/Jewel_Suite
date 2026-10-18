import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';
import { RepairStatusEnum, RepairOwnershipEnum, JobPriorityEnum } from '../domain/workshopStatus.js';
import { documentSequenceRepository } from './documentSequence.repository.js';

export interface RepairRecord {
  id: string;
  repair_number: string;
  customer_id: string | null;
  stock_item_id: string | null;
  karigar_id: string | null;

  ownership: RepairOwnershipEnum;
  item_description: string;

  metal_id: string | null;
  purity_id: string | null;

  gross_weight: number;
  net_weight: number;

  problem_description: string;
  instructions: string | null;
  repair_type: string;

  status: RepairStatusEnum;
  priority: JobPriorityEnum;

  received_date: string;
  expected_completion: string | null;
  delivered_date: string | null;

  estimated_cost: number;
  actual_cost: number;

  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  customer_name?: string | null;
  customer_phone?: string | null;
  karigar_name?: string | null;
  karigar_phone?: string | null;
  stock_tag_no?: string | null;
  metal_code?: string | null;
  metal_name?: string | null;
  purity_code?: string | null;
  purity_name?: string | null;
  creator_name?: string | null;
}

export interface CreateRepairData {
  id?: string;
  repair_number: string;
  customer_id?: string | null;
  stock_item_id?: string | null;
  karigar_id?: string | null;
  ownership?: RepairOwnershipEnum;
  item_description: string;
  metal_id?: string | null;
  purity_id?: string | null;
  gross_weight?: number;
  net_weight?: number;
  problem_description: string;
  instructions?: string | null;
  repair_type?: string;
  priority?: JobPriorityEnum;
  received_date?: string;
  expected_completion?: string | null;
  estimated_cost?: number;
  notes?: string | null;
  created_by?: string | null;
}

export interface RepairQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customer_id?: string;
  karigar_id?: string;
  ownership?: string;
  status?: string;
  priority?: string;
  from_date?: string;
  to_date?: string;
}

export class RepairRepository {
  private baseSelect = `
    SELECT 
      r.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      k.name AS karigar_name,
      k.phone AS karigar_phone,
      si.tag_no AS stock_tag_no,
      m.code AS metal_code,
      m.name AS metal_name,
      mp.code AS purity_code,
      mp.name AS purity_name,
      u.username AS creator_name
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    LEFT JOIN karigars k ON r.karigar_id = k.id
    LEFT JOIN stock_items si ON r.stock_item_id = si.id
    LEFT JOIN metals m ON r.metal_id = m.id
    LEFT JOIN metal_purities mp ON r.purity_id = mp.id
    LEFT JOIN users u ON r.created_by = u.id
  `;

  getNextRepairNumber(): string {
    return documentSequenceRepository.getNextNumber('REPAIR');
  }

  create(data: CreateRepairData): RepairRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const repair_number = data.repair_number.trim().toUpperCase();
    const received_date = data.received_date || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO repairs (
        id, repair_number, customer_id, stock_item_id, karigar_id,
        ownership, item_description, metal_id, purity_id,
        gross_weight, net_weight, problem_description, instructions,
        repair_type, status, priority, received_date, expected_completion,
        delivered_date, estimated_cost, actual_cost, notes, created_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, 'RECEIVED', ?, ?, ?,
        NULL, ?, 0.0, ?, ?,
        datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      repair_number,
      data.customer_id || null,
      data.stock_item_id || null,
      data.karigar_id || null,
      data.ownership || 'CUSTOMER_OWNED',
      data.item_description.trim(),
      data.metal_id || null,
      data.purity_id || null,
      data.gross_weight ?? 0.0,
      data.net_weight ?? 0.0,
      data.problem_description.trim(),
      data.instructions ? data.instructions.trim() : null,
      data.repair_type || 'REPAIR',
      data.priority || 'NORMAL',
      received_date,
      data.expected_completion || null,
      data.estimated_cost ?? 0.0,
      data.notes ? data.notes.trim() : null,
      data.created_by || null
    );

    return this.findById(id)!;
  }

  update(id: string, updates: Partial<CreateRepairData>): RepairRecord | null {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.customer_id !== undefined) {
      fields.push('customer_id = ?');
      values.push(updates.customer_id || null);
    }
    if (updates.karigar_id !== undefined) {
      fields.push('karigar_id = ?');
      values.push(updates.karigar_id || null);
    }
    if (updates.item_description !== undefined) {
      fields.push('item_description = ?');
      values.push(updates.item_description.trim());
    }
    if (updates.metal_id !== undefined) {
      fields.push('metal_id = ?');
      values.push(updates.metal_id || null);
    }
    if (updates.purity_id !== undefined) {
      fields.push('purity_id = ?');
      values.push(updates.purity_id || null);
    }
    if (updates.gross_weight !== undefined) {
      fields.push('gross_weight = ?');
      values.push(updates.gross_weight);
    }
    if (updates.net_weight !== undefined) {
      fields.push('net_weight = ?');
      values.push(updates.net_weight);
    }
    if (updates.problem_description !== undefined) {
      fields.push('problem_description = ?');
      values.push(updates.problem_description.trim());
    }
    if (updates.instructions !== undefined) {
      fields.push('instructions = ?');
      values.push(updates.instructions ? updates.instructions.trim() : null);
    }
    if (updates.expected_completion !== undefined) {
      fields.push('expected_completion = ?');
      values.push(updates.expected_completion || null);
    }
    if (updates.estimated_cost !== undefined) {
      fields.push('estimated_cost = ?');
      values.push(updates.estimated_cost);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes ? updates.notes.trim() : null);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE repairs SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.findById(id);
  }

  updateStatus(
    id: string,
    status: RepairStatusEnum,
    extra: {
      karigar_id?: string | null;
      actual_cost?: number;
      delivered_date?: string | null;
      notes?: string | null;
    } = {}
  ): boolean {
    const db = getDb();
    const fields = ['status = ?'];
    const values: any[] = [status];

    if (extra.karigar_id !== undefined) {
      fields.push('karigar_id = ?');
      values.push(extra.karigar_id || null);
    }
    if (extra.actual_cost !== undefined) {
      fields.push('actual_cost = ?');
      values.push(extra.actual_cost);
    }
    if (extra.delivered_date !== undefined) {
      fields.push('delivered_date = ?');
      values.push(extra.delivered_date);
    }
    if (extra.notes !== undefined) {
      fields.push('notes = ?');
      values.push(extra.notes ? extra.notes.trim() : null);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE repairs SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM repairs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findById(id: string): RepairRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE r.id = ?`).get(id);
    return (row as RepairRecord) || null;
  }

  findByNumber(repairNumber: string): RepairRecord | null {
    const db = getDb();
    const row = db
      .prepare(`${this.baseSelect} WHERE r.repair_number = ? COLLATE NOCASE`)
      .get(repairNumber.trim());
    return (row as RepairRecord) || null;
  }

  find(params: RepairQueryParams): PaginatedResult<RepairRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(`(
        r.repair_number LIKE ? OR 
        r.item_description LIKE ? OR 
        r.problem_description LIKE ? OR 
        c.name LIKE ? OR 
        k.name LIKE ? OR 
        si.tag_no LIKE ?
      )`);
      args.push(term, term, term, term, term, term);
    }

    if (params.customer_id) {
      conditions.push('r.customer_id = ?');
      args.push(params.customer_id);
    }

    if (params.karigar_id) {
      conditions.push('r.karigar_id = ?');
      args.push(params.karigar_id);
    }

    if (params.ownership && params.ownership !== 'ALL') {
      conditions.push('r.ownership = ?');
      args.push(params.ownership);
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push('r.status = ?');
      args.push(params.status);
    }

    if (params.priority && params.priority !== 'ALL') {
      conditions.push('r.priority = ?');
      args.push(params.priority);
    }

    if (params.from_date) {
      conditions.push('r.received_date >= ?');
      args.push(params.from_date);
    }

    if (params.to_date) {
      conditions.push('r.received_date <= ?');
      args.push(params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total 
      FROM repairs r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN karigars k ON r.karigar_id = k.id
      LEFT JOIN stock_items si ON r.stock_item_id = si.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const itemsSql = `
      ${this.baseSelect}
      ${whereClause}
      ORDER BY r.received_date DESC, r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as RepairRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

export const repairRepository = new RepairRepository();
