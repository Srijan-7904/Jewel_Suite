import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';

export interface CategoryRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive';
}

export class CategoryRepository {
  findById(id: string): CategoryRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRecord | undefined;
    return row || null;
  }

  findByCode(code: string): CategoryRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM categories WHERE code = ? COLLATE NOCASE').get(code) as CategoryRecord | undefined;
    return row || null;
  }

  findByName(name: string): CategoryRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM categories WHERE name = ? COLLATE NOCASE').get(name) as CategoryRecord | undefined;
    return row || null;
  }

  findAll(activeOnly = true): CategoryRecord[] {
    const db = getDb();
    const sql = activeOnly
      ? 'SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM categories ORDER BY name ASC';
    return db.prepare(sql).all() as CategoryRecord[];
  }

  find(params: CategoryQueryParams = {}): PaginatedResult<CategoryRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (params.search) {
      conditions.push('(name LIKE ? OR code LIKE ? OR description LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term);
    }

    if (params.status === 'active') {
      conditions.push('is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM categories ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataStmt = db.prepare(`
      SELECT * FROM categories
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `);
    const items = dataStmt.all(...values, pageSize, offset) as CategoryRecord[];

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
    name: string;
    code: string;
    description?: string | null;
    is_active?: number;
  }): CategoryRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO categories (id, name, code, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.code.toUpperCase(), data.description || null, is_active, now, now);

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<CategoryRecord, 'id' | 'created_at' | 'updated_at'>>): CategoryRecord | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.code !== undefined) {
      fields.push('code = ?');
      values.push(data.code.toUpperCase());
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  setActive(id: string, isActive: boolean): CategoryRecord | null {
    return this.update(id, { is_active: isActive ? 1 : 0 });
  }
}

export const categoryRepository = new CategoryRepository();
