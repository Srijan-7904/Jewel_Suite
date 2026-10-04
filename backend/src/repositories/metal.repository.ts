import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';

export interface MetalRecord {
  id: string;
  code: string;
  name: string;
  is_active: number;
  created_at: string;
}

export interface MetalPurityRecord {
  id: string;
  metal_id: string;
  metal_code?: string;
  metal_name?: string;
  code: string;
  name: string;
  tunch_percent: number | null;
  is_active: number;
  created_at: string;
}

export interface MetalRateRecord {
  id: string;
  metal_id: string;
  purity_id: string;
  rate: number;
  unit: string;
  effective_from: string;
  created_by: string | null;
  created_at: string;
}

export interface CurrentRateRecord {
  id: string;
  metal_id: string;
  metal_code: string;
  metal_name: string;
  purity_id: string;
  purity_code: string;
  purity_name: string;
  tunch_percent: number | null;
  rate: number;
  unit: string;
  effective_from: string;
  created_by: string | null;
  created_by_username: string | null;
  created_at: string;
}

export class MetalRepository {
  // Metals
  getMetals(activeOnly = true): MetalRecord[] {
    const db = getDb();
    const sql = activeOnly
      ? 'SELECT * FROM metals WHERE is_active = 1 ORDER BY code ASC'
      : 'SELECT * FROM metals ORDER BY code ASC';
    return db.prepare(sql).all() as MetalRecord[];
  }

  getMetalById(id: string): MetalRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM metals WHERE id = ?').get(id) as MetalRecord | undefined;
    return row || null;
  }

  // Purities
  getPuritiesByMetal(metalId: string, activeOnly = true): MetalPurityRecord[] {
    const db = getDb();
    const sql = activeOnly
      ? 'SELECT * FROM metal_purities WHERE metal_id = ? AND is_active = 1 ORDER BY code ASC'
      : 'SELECT * FROM metal_purities WHERE metal_id = ? ORDER BY code ASC';
    return db.prepare(sql).all(metalId) as MetalPurityRecord[];
  }

  getAllPurities(activeOnly = true): MetalPurityRecord[] {
    const db = getDb();
    const sql = `
      SELECT p.*, m.code as metal_code, m.name as metal_name
      FROM metal_purities p
      JOIN metals m ON p.metal_id = m.id
      ${activeOnly ? 'WHERE p.is_active = 1 AND m.is_active = 1' : ''}
      ORDER BY m.code ASC, p.code ASC
    `;
    return db.prepare(sql).all() as MetalPurityRecord[];
  }

  getPurityById(id: string): MetalPurityRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT p.*, m.code as metal_code, m.name as metal_name
      FROM metal_purities p
      JOIN metals m ON p.metal_id = m.id
      WHERE p.id = ?
    `).get(id) as MetalPurityRecord | undefined;
    return row || null;
  }

  // Rates
  getCurrentRates(): CurrentRateRecord[] {
    const db = getDb();
    // Subquery: Get the most recent rate for each metal_id + purity_id combination
    const sql = `
      WITH LatestRates AS (
        SELECT r.*,
               ROW_NUMBER() OVER (
                 PARTITION BY r.metal_id, r.purity_id
                 ORDER BY r.effective_from DESC, r.created_at DESC
               ) as rn
        FROM metal_rates r
      )
      SELECT
        lr.id,
        m.id as metal_id,
        m.code as metal_code,
        m.name as metal_name,
        p.id as purity_id,
        p.code as purity_code,
        p.name as purity_name,
        p.tunch_percent,
        lr.rate,
        lr.unit,
        lr.effective_from,
        lr.created_by,
        u.username as created_by_username,
        lr.created_at
      FROM metal_purities p
      JOIN metals m ON p.metal_id = m.id
      LEFT JOIN LatestRates lr ON lr.metal_id = m.id AND lr.purity_id = p.id AND lr.rn = 1
      LEFT JOIN users u ON lr.created_by = u.id
      WHERE m.is_active = 1 AND p.is_active = 1
      ORDER BY m.code ASC, p.code ASC
    `;
    return db.prepare(sql).all() as CurrentRateRecord[];
  }

  getRateHistory(purityId?: string, metalId?: string, limit = 50): CurrentRateRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (purityId) {
      conditions.push('r.purity_id = ?');
      values.push(purityId);
    }

    if (metalId) {
      conditions.push('r.metal_id = ?');
      values.push(metalId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        r.id,
        m.id as metal_id,
        m.code as metal_code,
        m.name as metal_name,
        p.id as purity_id,
        p.code as purity_code,
        p.name as purity_name,
        p.tunch_percent,
        r.rate,
        r.unit,
        r.effective_from,
        r.created_by,
        u.username as created_by_username,
        r.created_at
      FROM metal_rates r
      JOIN metals m ON r.metal_id = m.id
      JOIN metal_purities p ON r.purity_id = p.id
      LEFT JOIN users u ON r.created_by = u.id
      ${whereClause}
      ORDER BY r.effective_from DESC, r.created_at DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(...values, limit) as CurrentRateRecord[];
  }

  getRateById(id: string): MetalRateRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM metal_rates WHERE id = ?').get(id) as MetalRateRecord | undefined;
    return row || null;
  }

  createRate(data: {
    id?: string;
    metal_id: string;
    purity_id: string;
    rate: number;
    unit?: string;
    effective_from?: string;
    created_by?: string | null;
  }): MetalRateRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const unit = data.unit || 'gram';
    const effective_from = data.effective_from || new Date().toISOString();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO metal_rates (id, metal_id, purity_id, rate, unit, effective_from, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.metal_id, data.purity_id, data.rate, unit, effective_from, data.created_by || null, now);

    return this.getRateById(id)!;
  }
}

export const metalRepository = new MetalRepository();
