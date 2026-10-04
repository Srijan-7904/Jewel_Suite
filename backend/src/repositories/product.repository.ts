import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PaginatedResult } from './customer.repository.js';

export interface ProductRecord {
  id: string;
  product_code: string;
  name: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  description: string | null;
  default_metal: string | null;
  default_purity: string | null;
  default_unit: string;
  hsn_code: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category_id?: string;
  metal?: string;
  purity?: string;
  status?: 'all' | 'active' | 'inactive';
}

export class ProductRepository {
  generateCode(): string {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    const nextNum = (countRow.count + 1).toString().padStart(4, '0');
    return `PRD-${nextNum}`;
  }

  findById(id: string): ProductRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT p.*, c.name as category_name, c.code as category_code
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id) as ProductRecord | undefined;
    return row || null;
  }

  findByCode(code: string): ProductRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT p.*, c.name as category_name, c.code as category_code
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.product_code = ? COLLATE NOCASE
    `).get(code) as ProductRecord | undefined;
    return row || null;
  }

  find(params: ProductQueryParams = {}): PaginatedResult<ProductRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (params.search) {
      conditions.push('(p.name LIKE ? OR p.product_code LIKE ? OR p.description LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term);
    }

    if (params.category_id && params.category_id !== 'ALL') {
      conditions.push('p.category_id = ?');
      values.push(params.category_id);
    }

    if (params.metal && params.metal !== 'ALL') {
      conditions.push('p.default_metal = ?');
      values.push(params.metal);
    }

    if (params.purity && params.purity !== 'ALL') {
      conditions.push('p.default_purity = ?');
      values.push(params.purity);
    }

    if (params.status === 'active') {
      conditions.push('p.is_active = 1');
    } else if (params.status === 'inactive') {
      conditions.push('p.is_active = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM products p ${whereClause}`);
    const totalRow = countStmt.get(...values) as { total: number };
    const total = totalRow.total;

    const dataStmt = db.prepare(`
      SELECT p.*, c.name as category_name, c.code as category_code
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT ? OFFSET ?
    `);
    const items = dataStmt.all(...values, pageSize, offset) as ProductRecord[];

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
    product_code?: string;
    name: string;
    category_id: string;
    description?: string | null;
    default_metal?: string | null;
    default_purity?: string | null;
    default_unit?: string;
    hsn_code?: string | null;
    is_active?: number;
  }): ProductRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const product_code = data.product_code || this.generateCode();
    const default_unit = data.default_unit || 'g';
    const is_active = data.is_active !== undefined ? data.is_active : 1;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO products (
        id, product_code, name, category_id, description,
        default_metal, default_purity, default_unit, hsn_code,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      product_code,
      data.name,
      data.category_id,
      data.description || null,
      data.default_metal || null,
      data.default_purity || null,
      default_unit,
      data.hsn_code || null,
      is_active,
      now,
      now
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'>>): ProductRecord | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields: (keyof typeof data)[] = [
      'product_code', 'name', 'category_id', 'description',
      'default_metal', 'default_purity', 'default_unit', 'hsn_code', 'is_active'
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

    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  setActive(id: string, isActive: boolean): ProductRecord | null {
    return this.update(id, { is_active: isActive ? 1 : 0 });
  }
}

export const productRepository = new ProductRepository();
