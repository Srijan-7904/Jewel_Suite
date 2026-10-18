// backend/src/repositories/savingScheme.repository.ts
// Jewel Suite: Central Saving Schemes Repository

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import {
  SavingScheme,
  SavingSchemeType,
  SavingSchemeInstallment,
  SavingSchemeStatus,
  InstallmentStatus,
} from '../domain/savingScheme.js';
import { PaginatedResult } from './customer.repository.js';
import { documentSequenceRepository } from './documentSequence.repository.js';

export interface SavingSchemeQueryParams {
  page?: number;
  pageSize?: number;
  customer_id?: string;
  scheme_type_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export class SavingSchemeRepository {
  /**
   * Generates next sequential scheme number: SCH-YYYY-000001
   */
  getNextSchemeNumber(): string {
    return documentSequenceRepository.getNextNumber('SAVING_SCHEME');
  }

  // --- Scheme Master Types ---

  findTypes(): SavingSchemeType[] {
    const db = getDb();
    return db
      .prepare(`SELECT * FROM saving_scheme_types WHERE is_active = 1 ORDER BY duration_months ASC, installment_amount ASC`)
      .all() as SavingSchemeType[];
  }

  findTypeById(id: string): SavingSchemeType | null {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM saving_scheme_types WHERE id = ?`).get(id) as
      | SavingSchemeType
      | undefined;
    return row || null;
  }

  createType(data: {
    id?: string;
    name: string;
    code: string;
    duration_months: number;
    installment_amount: number;
    maturity_benefit_type: string;
    maturity_benefit_value?: number;
    description?: string | null;
  }): SavingSchemeType {
    const db = getDb();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const maturity_benefit_value = data.maturity_benefit_value || 0;

    db.prepare(`
      INSERT INTO saving_scheme_types (
        id, name, code, duration_months, installment_amount,
        maturity_benefit_type, maturity_benefit_value, description,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      data.name,
      data.code,
      data.duration_months,
      data.installment_amount,
      data.maturity_benefit_type,
      maturity_benefit_value,
      data.description || null,
      now,
      now
    );

    return this.findTypeById(id)!;
  }

  // --- Enrolled Customer Schemes ---

  createScheme(data: {
    id?: string;
    scheme_number?: string;
    customer_id: string;
    scheme_type_id: string;
    start_date?: string;
    maturity_date: string;
    installment_amount: number;
    total_installments: number;
    paid_installments?: number;
    paid_amount?: number;
    maturity_amount?: number;
    status?: string;
    notes?: string | null;
    created_by?: string | null;
  }): SavingScheme {
    const db = getDb();
    const id = data.id || uuidv4();
    const scheme_number = data.scheme_number || this.getNextSchemeNumber();
    const now = new Date().toISOString();
    const start_date = data.start_date || now.substring(0, 10);
    const paid_installments = data.paid_installments || 0;
    const paid_amount = data.paid_amount || 0;
    const maturity_amount = data.maturity_amount || 0;
    const status = data.status || SavingSchemeStatus.ACTIVE;

    db.prepare(`
      INSERT INTO saving_schemes (
        id, scheme_number, customer_id, scheme_type_id,
        start_date, maturity_date, installment_amount, total_installments,
        paid_installments, paid_amount, maturity_amount, status,
        notes, created_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id,
      scheme_number,
      data.customer_id,
      data.scheme_type_id,
      start_date,
      data.maturity_date,
      data.installment_amount,
      data.total_installments,
      paid_installments,
      paid_amount,
      maturity_amount,
      status,
      data.notes || null,
      data.created_by || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  createInstallments(
    savingSchemeId: string,
    installments: {
      installment_number: number;
      due_date: string;
      amount_due: number;
    }[]
  ): void {
    const db = getDb();
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO saving_scheme_installments (
        id, saving_scheme_id, installment_number, due_date,
        amount_due, amount_paid, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 0.0, 'PENDING', ?)
    `);

    for (const inst of installments) {
      insertStmt.run(
        uuidv4(),
        savingSchemeId,
        inst.installment_number,
        inst.due_date,
        inst.amount_due,
        now
      );
    }
  }

  findById(id: string): SavingScheme | null {
    const db = getDb();
    const scheme = db
      .prepare(`
        SELECT s.*, 
               c.name as customer_name, c.phone as customer_phone,
               t.name as scheme_type_name, t.code as scheme_type_code
        FROM saving_schemes s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN saving_scheme_types t ON s.scheme_type_id = t.id
        WHERE s.id = ?
      `)
      .get(id) as SavingScheme | undefined;

    if (!scheme) return null;

    const installments = db
      .prepare(`
        SELECT * FROM saving_scheme_installments
        WHERE saving_scheme_id = ?
        ORDER BY installment_number ASC
      `)
      .all(id) as SavingSchemeInstallment[];

    scheme.installments = installments;
    return scheme;
  }

  findBySchemeNumber(schemeNumber: string): SavingScheme | null {
    const db = getDb();
    const row = db
      .prepare(`SELECT id FROM saving_schemes WHERE scheme_number = ?`)
      .get(schemeNumber) as { id: string } | undefined;
    if (!row) return null;
    return this.findById(row.id);
  }

  findInstallmentById(id: string): SavingSchemeInstallment | null {
    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM saving_scheme_installments WHERE id = ?`)
      .get(id) as SavingSchemeInstallment | undefined;
    return row || null;
  }

  updateInstallment(id: string, updates: Partial<SavingSchemeInstallment>): void {
    const db = getDb();
    const allowedFields = [
      'amount_paid',
      'payment_date',
      'payment_mode',
      'reference_number',
      'status',
      'finance_payment_id',
      'notes',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (setClauses.length > 0) {
      values.push(id);
      db.prepare(`
        UPDATE saving_scheme_installments
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `).run(...values);
    }
  }

  updateScheme(id: string, updates: Partial<SavingScheme>): SavingScheme {
    const db = getDb();
    const allowedFields = [
      'paid_installments',
      'paid_amount',
      'maturity_amount',
      'status',
      'maturity_payout_date',
      'maturity_notes',
      'notes',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = ?`);
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(`
        UPDATE saving_schemes
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    return this.findById(id)!;
  }

  findSchemes(params: SavingSchemeQueryParams = {}): PaginatedResult<SavingScheme> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];

    if (params.customer_id) {
      whereClauses.push('s.customer_id = ?');
      queryParams.push(params.customer_id);
    }

    if (params.scheme_type_id) {
      whereClauses.push('s.scheme_type_id = ?');
      queryParams.push(params.scheme_type_id);
    }

    if (params.status) {
      whereClauses.push('s.status = ?');
      queryParams.push(params.status);
    }

    if (params.from_date) {
      whereClauses.push('s.start_date >= ?');
      queryParams.push(params.from_date);
    }

    if (params.to_date) {
      whereClauses.push('s.start_date <= ?');
      queryParams.push(params.to_date);
    }

    if (params.search) {
      const searchTerm = `%${params.search.trim()}%`;
      whereClauses.push(`(
        s.scheme_number LIKE ? OR
        c.name LIKE ? OR
        c.phone LIKE ? OR
        t.name LIKE ?
      )`);
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db
      .prepare(`
        SELECT COUNT(*) as total 
        FROM saving_schemes s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN saving_scheme_types t ON s.scheme_type_id = t.id
        ${whereSql}
      `)
      .get(...queryParams) as { total: number };

    const total = countRow.total;
    const totalPages = Math.ceil(total / pageSize);

    const rows = db
      .prepare(`
        SELECT s.*, 
               c.name as customer_name, c.phone as customer_phone,
               t.name as scheme_type_name, t.code as scheme_type_code
        FROM saving_schemes s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN saving_scheme_types t ON s.scheme_type_id = t.id
        ${whereSql}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams, pageSize, offset) as SavingScheme[];

    return {
      items: rows,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  getCustomerSchemes(customerId: string): SavingScheme[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT s.*, 
               c.name as customer_name, c.phone as customer_phone,
               t.name as scheme_type_name, t.code as scheme_type_code
        FROM saving_schemes s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN saving_scheme_types t ON s.scheme_type_id = t.id
        WHERE s.customer_id = ?
        ORDER BY s.created_at DESC
      `)
      .all(customerId) as SavingScheme[];

    for (const row of rows) {
      row.installments = db
        .prepare(`
          SELECT * FROM saving_scheme_installments
          WHERE saving_scheme_id = ?
          ORDER BY installment_number ASC
        `)
        .all(row.id) as SavingSchemeInstallment[];
    }
    return rows;
  }
}

export const savingSchemeRepository = new SavingSchemeRepository();
