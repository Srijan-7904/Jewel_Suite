import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';
import { v4 as uuidv4 } from 'uuid';
import { JobTypeEnum, JobStatusEnum, JobPriorityEnum } from '../domain/workshopStatus.js';
import { documentSequenceRepository } from './documentSequence.repository.js';

export interface WorkshopJobRecord {
  id: string;
  job_number: string;
  job_type: JobTypeEnum;
  karigar_id: string;
  customer_id: string | null;

  status: JobStatusEnum;
  priority: JobPriorityEnum;

  issue_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;

  description: string;
  instructions: string | null;

  estimated_labour: number;
  actual_labour: number;

  estimated_weight: number;
  returned_weight: number;

  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined master fields
  karigar_name?: string;
  karigar_phone?: string;
  karigar_specialization?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  creator_name?: string | null;
  item_count?: number;
}

export interface WorkshopJobItemRecord {
  id: string;
  workshop_job_id: string;
  stock_item_id: string | null;
  tag_no: string;

  issue_gross_weight: number;
  issue_less_weight: number;
  issue_net_weight: number;
  issue_fine_weight: number;

  return_gross_weight: number | null;
  return_less_weight: number | null;
  return_net_weight: number | null;
  return_fine_weight: number | null;

  weight_difference: number;
  material_issued: string | null;
  material_returned: string | null;

  labour_charge: number;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined stock fields
  product_name?: string;
  metal_code?: string;
  purity_code?: string;
}

export interface WorkshopJobDetailsRecord extends WorkshopJobRecord {
  items: WorkshopJobItemRecord[];
}

export interface CreateWorkshopJobData {
  id?: string;
  job_number: string;
  job_type: JobTypeEnum;
  karigar_id: string;
  customer_id?: string | null;
  priority?: JobPriorityEnum;
  expected_return_date?: string | null;
  description: string;
  instructions?: string | null;
  estimated_labour?: number;
  estimated_weight?: number;
  notes?: string | null;
  created_by?: string | null;
}

export interface CreateWorkshopJobItemData {
  id?: string;
  workshop_job_id: string;
  stock_item_id?: string | null;
  tag_no: string;
  issue_gross_weight: number;
  issue_less_weight?: number;
  issue_net_weight: number;
  issue_fine_weight: number;
  material_issued?: string | null;
  labour_charge?: number;
  notes?: string | null;
}

export interface WorkshopQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  karigar_id?: string;
  customer_id?: string;
  job_type?: string;
  status?: string;
  priority?: string;
  from_date?: string;
  to_date?: string;
}

export class WorkshopRepository {
  private baseSelect = `
    SELECT 
      wj.*,
      k.name AS karigar_name,
      k.phone AS karigar_phone,
      k.specialization AS karigar_specialization,
      c.name AS customer_name,
      c.phone AS customer_phone,
      u.username AS creator_name,
      (SELECT COUNT(*) FROM workshop_job_items WHERE workshop_job_id = wj.id) AS item_count
    FROM workshop_jobs wj
    JOIN karigars k ON wj.karigar_id = k.id
    LEFT JOIN customers c ON wj.customer_id = c.id
    LEFT JOIN users u ON wj.created_by = u.id
  `;

  getNextJobNumber(): string {
    return documentSequenceRepository.getNextNumber('WORKSHOP_JOB');
  }

  create(data: CreateWorkshopJobData): WorkshopJobRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const job_number = data.job_number.trim().toUpperCase();

    const stmt = db.prepare(`
      INSERT INTO workshop_jobs (
        id, job_number, job_type, karigar_id, customer_id,
        status, priority, issue_date, expected_return_date, actual_return_date,
        description, instructions, estimated_labour, actual_labour,
        estimated_weight, returned_weight, notes, created_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        'DRAFT', ?, NULL, ?, NULL,
        ?, ?, ?, 0.0,
        ?, 0.0, ?, ?,
        datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      job_number,
      data.job_type,
      data.karigar_id,
      data.customer_id || null,
      data.priority || 'NORMAL',
      data.expected_return_date || null,
      data.description.trim(),
      data.instructions ? data.instructions.trim() : null,
      data.estimated_labour ?? 0.0,
      data.estimated_weight ?? 0.0,
      data.notes ? data.notes.trim() : null,
      data.created_by || null
    );

    return this.findSummaryById(id)!;
  }

  update(id: string, updates: Partial<CreateWorkshopJobData>): WorkshopJobRecord | null {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.job_type !== undefined) {
      fields.push('job_type = ?');
      values.push(updates.job_type);
    }
    if (updates.karigar_id !== undefined) {
      fields.push('karigar_id = ?');
      values.push(updates.karigar_id);
    }
    if (updates.customer_id !== undefined) {
      fields.push('customer_id = ?');
      values.push(updates.customer_id || null);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.expected_return_date !== undefined) {
      fields.push('expected_return_date = ?');
      values.push(updates.expected_return_date || null);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description.trim());
    }
    if (updates.instructions !== undefined) {
      fields.push('instructions = ?');
      values.push(updates.instructions ? updates.instructions.trim() : null);
    }
    if (updates.estimated_labour !== undefined) {
      fields.push('estimated_labour = ?');
      values.push(updates.estimated_labour);
    }
    if (updates.estimated_weight !== undefined) {
      fields.push('estimated_weight = ?');
      values.push(updates.estimated_weight);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes ? updates.notes.trim() : null);
    }

    if (fields.length === 0) return this.findSummaryById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE workshop_jobs SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.findSummaryById(id);
  }

  updateStatus(
    id: string,
    status: JobStatusEnum,
    extra: {
      issue_date?: string | null;
      actual_return_date?: string | null;
      actual_labour?: number;
      returned_weight?: number;
    } = {}
  ): boolean {
    const db = getDb();
    const fields = ['status = ?'];
    const values: any[] = [status];

    if (extra.issue_date !== undefined) {
      fields.push('issue_date = ?');
      values.push(extra.issue_date);
    }
    if (extra.actual_return_date !== undefined) {
      fields.push('actual_return_date = ?');
      values.push(extra.actual_return_date);
    }
    if (extra.actual_labour !== undefined) {
      fields.push('actual_labour = ?');
      values.push(extra.actual_labour);
    }
    if (extra.returned_weight !== undefined) {
      fields.push('returned_weight = ?');
      values.push(extra.returned_weight);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE workshop_jobs SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM workshop_jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findSummaryById(id: string): WorkshopJobRecord | null {
    const db = getDb();
    const row = db.prepare(`${this.baseSelect} WHERE wj.id = ?`).get(id);
    return (row as WorkshopJobRecord) || null;
  }

  findById(id: string): WorkshopJobDetailsRecord | null {
    const summary = this.findSummaryById(id);
    if (!summary) return null;

    const items = this.getItemsByJobId(id);
    return {
      ...summary,
      items,
    };
  }

  findByNumber(jobNumber: string): WorkshopJobDetailsRecord | null {
    const db = getDb();
    const row = db
      .prepare(`${this.baseSelect} WHERE wj.job_number = ? COLLATE NOCASE`)
      .get(jobNumber.trim());
    if (!row) return null;

    const summary = row as WorkshopJobRecord;
    const items = this.getItemsByJobId(summary.id);
    return {
      ...summary,
      items,
    };
  }

  find(params: WorkshopQueryParams): PaginatedResult<WorkshopJobRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(`(
        wj.job_number LIKE ? OR 
        k.name LIKE ? OR 
        c.name LIKE ? OR 
        wj.description LIKE ? OR
        EXISTS (SELECT 1 FROM workshop_job_items wji WHERE wji.workshop_job_id = wj.id AND wji.tag_no LIKE ?)
      )`);
      args.push(term, term, term, term, term);
    }

    if (params.karigar_id) {
      conditions.push('wj.karigar_id = ?');
      args.push(params.karigar_id);
    }

    if (params.customer_id) {
      conditions.push('wj.customer_id = ?');
      args.push(params.customer_id);
    }

    if (params.job_type && params.job_type !== 'ALL') {
      conditions.push('wj.job_type = ?');
      args.push(params.job_type);
    }

    if (params.status && params.status !== 'ALL') {
      conditions.push('wj.status = ?');
      args.push(params.status);
    }

    if (params.priority && params.priority !== 'ALL') {
      conditions.push('wj.priority = ?');
      args.push(params.priority);
    }

    if (params.from_date) {
      conditions.push('(wj.issue_date >= ? OR wj.created_at >= ?)');
      args.push(params.from_date, params.from_date);
    }

    if (params.to_date) {
      conditions.push('(wj.issue_date <= ? OR wj.created_at <= ?)');
      args.push(params.to_date, params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total 
      FROM workshop_jobs wj
      JOIN karigars k ON wj.karigar_id = k.id
      LEFT JOIN customers c ON wj.customer_id = c.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...args) as { total: number };
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const itemsSql = `
      ${this.baseSelect}
      ${whereClause}
      ORDER BY wj.created_at DESC, wj.job_number DESC
      LIMIT ? OFFSET ?
    `;
    const items = db.prepare(itemsSql).all(...args, pageSize, offset) as WorkshopJobRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // --- Job Items Sub-Entity Methods ---

  addItem(data: CreateWorkshopJobItemData): WorkshopJobItemRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const tag_no = data.tag_no.trim().toUpperCase();

    const stmt = db.prepare(`
      INSERT INTO workshop_job_items (
        id, workshop_job_id, stock_item_id, tag_no,
        issue_gross_weight, issue_less_weight, issue_net_weight, issue_fine_weight,
        return_gross_weight, return_less_weight, return_net_weight, return_fine_weight,
        weight_difference, material_issued, material_returned,
        labour_charge, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        NULL, NULL, NULL, NULL,
        0.0, ?, NULL,
        ?, ?, datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      id,
      data.workshop_job_id,
      data.stock_item_id || null,
      tag_no,
      data.issue_gross_weight,
      data.issue_less_weight ?? 0.0,
      data.issue_net_weight,
      data.issue_fine_weight,
      data.material_issued || null,
      data.labour_charge ?? 0.0,
      data.notes ? data.notes.trim() : null
    );

    return this.getItemById(id)!;
  }

  updateItemReturn(
    itemId: string,
    returnData: {
      return_gross_weight: number;
      return_less_weight: number;
      return_net_weight: number;
      return_fine_weight: number;
      weight_difference: number;
      material_returned?: string | null;
      labour_charge?: number;
      notes?: string | null;
    }
  ): void {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE workshop_job_items SET
        return_gross_weight = ?,
        return_less_weight = ?,
        return_net_weight = ?,
        return_fine_weight = ?,
        weight_difference = ?,
        material_returned = IFNULL(?, material_returned),
        labour_charge = IFNULL(?, labour_charge),
        notes = IFNULL(?, notes),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      returnData.return_gross_weight,
      returnData.return_less_weight,
      returnData.return_net_weight,
      returnData.return_fine_weight,
      returnData.weight_difference,
      returnData.material_returned ?? null,
      returnData.labour_charge ?? null,
      returnData.notes ?? null,
      itemId
    );
  }

  deleteItem(itemId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM workshop_job_items WHERE id = ?').run(itemId);
    return result.changes > 0;
  }

  getItemById(itemId: string): WorkshopJobItemRecord | null {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT 
          wji.*,
          p.name AS product_name,
          m.code AS metal_code,
          mp.code AS purity_code
        FROM workshop_job_items wji
        LEFT JOIN stock_items si ON wji.stock_item_id = si.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN metals m ON si.metal_id = m.id
        LEFT JOIN metal_purities mp ON si.purity_id = mp.id
        WHERE wji.id = ?
      `)
      .get(itemId);

    return (row as WorkshopJobItemRecord) || null;
  }

  getItemsByJobId(jobId: string): WorkshopJobItemRecord[] {
    const db = getDb();
    return db
      .prepare(`
        SELECT 
          wji.*,
          p.name AS product_name,
          m.code AS metal_code,
          mp.code AS purity_code
        FROM workshop_job_items wji
        LEFT JOIN stock_items si ON wji.stock_item_id = si.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN metals m ON si.metal_id = m.id
        LEFT JOIN metal_purities mp ON si.purity_id = mp.id
        WHERE wji.workshop_job_id = ?
        ORDER BY wji.created_at ASC
      `)
      .all(jobId) as WorkshopJobItemRecord[];
  }
}

export const workshopRepository = new WorkshopRepository();
