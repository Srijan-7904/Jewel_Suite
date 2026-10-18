// backend/src/repositories/girvi.repository.ts
// Jewel Suite: Central Girvi & Pledged Jewellery Repository

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import {
  GirviLoan,
  GirviLoanItem,
  GirviLoanPayment,
  GirviPledgeEvent,
  GirviLoanStatus,
  GirviPledgeStatus,
} from '../domain/girvi.js';
import { PaginatedResult } from './customer.repository.js';
import { documentSequenceRepository } from './documentSequence.repository.js';

export interface GirviQueryParams {
  page?: number;
  pageSize?: number;
  customer_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface GirviMetrics {
  active_loans_count: number;
  total_principal_outstanding: number;
  total_interest_accrued: number;
  overdue_loans_count: number;
  total_pledged_value: number;
  total_repaid_amount: number;
}

export class GirviRepository {
  /**
   * Generates next sequential loan number: GL-YYYY-000001
   */
  getNextLoanNumber(): string {
    return documentSequenceRepository.getNextNumber('GIRVI_LOAN');
  }

  /**
   * Generates next sequential repayment voucher number: GLP-YYYY-000001
   */
  getNextPaymentNumber(): string {
    const db = getDb();
    const currentYear = new Date().getFullYear();
    const prefix = `GLP-${currentYear}-`;

    const row = db
      .prepare(
        `SELECT payment_number FROM girvi_loan_payments 
         WHERE payment_number LIKE ? 
         ORDER BY payment_number DESC LIMIT 1`
      )
      .get(`${prefix}%`) as { payment_number: string } | undefined;

    if (!row) {
      return `${prefix}000001`;
    }

    const currentSeq = parseInt(row.payment_number.substring(prefix.length), 10) || 0;
    return `${prefix}${String(currentSeq + 1).padStart(6, '0')}`;
  }

  createLoan(data: {
    id?: string;
    loan_number?: string;
    customer_id: string;
    loan_date?: string;
    due_date: string;
    principal_amount: number;
    interest_rate: number;
    interest_type: string;
    processing_fee?: number;
    other_charges?: number;
    total_interest?: number;
    total_charges?: number;
    total_repaid?: number;
    outstanding_amount?: number;
    status?: string;
    ltv_percent?: number;
    max_allowed_loan?: number;
    is_overridden?: number;
    override_reason?: string | null;
    notes?: string | null;
    created_by?: string | null;
  }): GirviLoan {
    const db = getDb();
    const id = data.id || uuidv4();
    const loan_number = data.loan_number || this.getNextLoanNumber();
    const now = new Date().toISOString();
    const loan_date = data.loan_date || now.substring(0, 10);
    const processing_fee = data.processing_fee || 0;
    const other_charges = data.other_charges || 0;
    const total_charges = data.total_charges ?? (processing_fee + other_charges);
    const total_interest = data.total_interest || 0;
    const total_repaid = data.total_repaid || 0;
    const outstanding_amount =
      data.outstanding_amount ?? (data.principal_amount + total_interest + total_charges - total_repaid);
    const status = data.status || GirviLoanStatus.DRAFT;
    const ltv_percent = data.ltv_percent ?? 75.0;
    const max_allowed_loan = data.max_allowed_loan || 0;
    const is_overridden = data.is_overridden || 0;

    db.prepare(`
      INSERT INTO girvi_loans (
        id, loan_number, customer_id, loan_date, due_date,
        principal_amount, interest_rate, interest_type,
        processing_fee, other_charges, total_interest, total_charges,
        total_repaid, outstanding_amount, status,
        ltv_percent, max_allowed_loan, is_overridden, override_reason,
        notes, created_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id,
      loan_number,
      data.customer_id,
      loan_date,
      data.due_date,
      data.principal_amount,
      data.interest_rate,
      data.interest_type,
      processing_fee,
      other_charges,
      total_interest,
      total_charges,
      total_repaid,
      outstanding_amount,
      status,
      ltv_percent,
      max_allowed_loan,
      is_overridden,
      data.override_reason || null,
      data.notes || null,
      data.created_by || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  createLoanItem(data: {
    id?: string;
    loan_id: string;
    source_type?: string;
    stock_item_id?: string | null;
    description: string;
    tag_no?: string | null;
    metal_id?: string | null;
    purity_id?: string | null;
    gross_weight: number;
    less_weight?: number;
    net_weight: number;
    tunch_percent: number;
    fine_weight: number;
    valuation_rate: number;
    valuation_amount: number;
    pledged_value?: number;
    status?: string;
    notes?: string | null;
  }): GirviLoanItem {
    const db = getDb();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const source_type = data.source_type || 'CUSTOMER_ITEM';
    const less_weight = data.less_weight || 0;
    const pledged_value = data.pledged_value ?? data.valuation_amount;
    const status = data.status || GirviPledgeStatus.PLEDGED;

    db.prepare(`
      INSERT INTO girvi_loan_items (
        id, loan_id, source_type, stock_item_id, description, tag_no,
        metal_id, purity_id, gross_weight, less_weight, net_weight,
        tunch_percent, fine_weight, valuation_rate, valuation_amount,
        pledged_value, status, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      id,
      data.loan_id,
      source_type,
      data.stock_item_id || null,
      data.description,
      data.tag_no || null,
      data.metal_id || null,
      data.purity_id || null,
      data.gross_weight,
      less_weight,
      data.net_weight,
      data.tunch_percent,
      data.fine_weight,
      data.valuation_rate,
      data.valuation_amount,
      pledged_value,
      status,
      data.notes || null,
      now,
      now
    );

    return {
      id,
      loan_id: data.loan_id,
      source_type,
      stock_item_id: data.stock_item_id || null,
      description: data.description,
      tag_no: data.tag_no || null,
      metal_id: data.metal_id || null,
      purity_id: data.purity_id || null,
      gross_weight: data.gross_weight,
      less_weight,
      net_weight: data.net_weight,
      tunch_percent: data.tunch_percent,
      fine_weight: data.fine_weight,
      valuation_rate: data.valuation_rate,
      valuation_amount: data.valuation_amount,
      pledged_value,
      status,
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    };
  }

  createPayment(data: {
    id?: string;
    loan_id: string;
    payment_number?: string;
    payment_date?: string;
    principal_amount?: number;
    interest_amount?: number;
    charges_amount?: number;
    total_amount: number;
    payment_mode: string;
    reference_number?: string | null;
    finance_payment_id?: string | null;
    notes?: string | null;
    created_by?: string | null;
  }): GirviLoanPayment {
    const db = getDb();
    const id = data.id || uuidv4();
    const payment_number = data.payment_number || this.getNextPaymentNumber();
    const now = new Date().toISOString();
    const payment_date = data.payment_date || now.substring(0, 10);
    const principal_amount = data.principal_amount || 0;
    const interest_amount = data.interest_amount || 0;
    const charges_amount = data.charges_amount || 0;

    db.prepare(`
      INSERT INTO girvi_loan_payments (
        id, loan_id, payment_number, payment_date,
        principal_amount, interest_amount, charges_amount, total_amount,
        payment_mode, reference_number, finance_payment_id,
        notes, created_by, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      id,
      data.loan_id,
      payment_number,
      payment_date,
      principal_amount,
      interest_amount,
      charges_amount,
      data.total_amount,
      data.payment_mode,
      data.reference_number || null,
      data.finance_payment_id || null,
      data.notes || null,
      data.created_by || null,
      now
    );

    return {
      id,
      loan_id: data.loan_id,
      payment_number,
      payment_date,
      principal_amount,
      interest_amount,
      charges_amount,
      total_amount: data.total_amount,
      payment_mode: data.payment_mode,
      reference_number: data.reference_number || null,
      finance_payment_id: data.finance_payment_id || null,
      notes: data.notes || null,
      created_by: data.created_by || null,
      created_at: now,
    };
  }

  createPledgeEvent(data: {
    id?: string;
    loan_id: string;
    loan_item_id?: string | null;
    event_type: string;
    event_date?: string;
    description: string;
    created_by?: string | null;
  }): GirviPledgeEvent {
    const db = getDb();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const event_date = data.event_date || now;

    db.prepare(`
      INSERT INTO girvi_pledge_events (
        id, loan_id, loan_item_id, event_type, event_date,
        description, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.loan_id,
      data.loan_item_id || null,
      data.event_type,
      event_date,
      data.description,
      data.created_by || null,
      now
    );

    return {
      id,
      loan_id: data.loan_id,
      loan_item_id: data.loan_item_id || null,
      event_type: data.event_type,
      event_date,
      description: data.description,
      created_by: data.created_by || null,
      created_at: now,
    };
  }

  findById(id: string): GirviLoan | null {
    const db = getDb();
    const loan = db
      .prepare(
        `SELECT l.*, c.name as customer_name, c.phone as customer_phone
         FROM girvi_loans l
         LEFT JOIN customers c ON l.customer_id = c.id
         WHERE l.id = ?`
      )
      .get(id) as GirviLoan | undefined;

    if (!loan) return null;

    // Load items
    const items = db
      .prepare(
        `SELECT i.*, m.name as metal_name, p.name as purity_name
         FROM girvi_loan_items i
         LEFT JOIN metals m ON i.metal_id = m.id
         LEFT JOIN metal_purities p ON i.purity_id = p.id
         WHERE i.loan_id = ?
         ORDER BY i.created_at ASC`
      )
      .all(id) as GirviLoanItem[];

    // Load payments
    const payments = db
      .prepare(
        `SELECT * FROM girvi_loan_payments
         WHERE loan_id = ?
         ORDER BY payment_date DESC, created_at DESC`
      )
      .all(id) as GirviLoanPayment[];

    // Load pledge events
    const pledge_events = db
      .prepare(
        `SELECT * FROM girvi_pledge_events
         WHERE loan_id = ?
         ORDER BY event_date ASC, created_at ASC`
      )
      .all(id) as GirviPledgeEvent[];

    loan.items = items;
    loan.payments = payments;
    loan.pledge_events = pledge_events;

    return loan;
  }

  findByLoanNumber(loanNumber: string): GirviLoan | null {
    const db = getDb();
    const row = db.prepare('SELECT id FROM girvi_loans WHERE loan_number = ?').get(loanNumber) as
      | { id: string }
      | undefined;
    if (!row) return null;
    return this.findById(row.id);
  }

  updateLoan(id: string, updates: Partial<GirviLoan>): GirviLoan {
    const db = getDb();
    const allowedFields = [
      'due_date',
      'principal_amount',
      'interest_rate',
      'interest_type',
      'processing_fee',
      'other_charges',
      'total_interest',
      'total_charges',
      'total_repaid',
      'outstanding_amount',
      'status',
      'ltv_percent',
      'max_allowed_loan',
      'is_overridden',
      'override_reason',
      'disbursement_date',
      'disbursed_by',
      'closure_date',
      'closed_by',
      'closure_notes',
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
        UPDATE girvi_loans
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    return this.findById(id)!;
  }

  updateLoanItem(id: string, updates: Partial<GirviLoanItem>): void {
    const db = getDb();
    const allowedFields = ['status', 'release_date', 'released_by', 'release_notes', 'notes'];
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
        UPDATE girvi_loan_items
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `).run(...values);
    }
  }

  findLoans(params: GirviQueryParams = {}): PaginatedResult<GirviLoan> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];

    if (params.customer_id) {
      whereClauses.push('l.customer_id = ?');
      queryParams.push(params.customer_id);
    }

    if (params.status) {
      whereClauses.push('l.status = ?');
      queryParams.push(params.status);
    }

    if (params.from_date) {
      whereClauses.push('l.loan_date >= ?');
      queryParams.push(params.from_date);
    }

    if (params.to_date) {
      whereClauses.push('l.loan_date <= ?');
      queryParams.push(params.to_date);
    }

    if (params.search) {
      const searchTerm = `%${params.search.trim()}%`;
      whereClauses.push(`(
        l.loan_number LIKE ? OR
        c.name LIKE ? OR
        c.phone LIKE ? OR
        EXISTS (SELECT 1 FROM girvi_loan_items it WHERE it.loan_id = l.id AND (it.description LIKE ? OR it.tag_no LIKE ?))
      )`);
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db
      .prepare(`
        SELECT COUNT(*) as total 
        FROM girvi_loans l
        LEFT JOIN customers c ON l.customer_id = c.id
        ${whereSql}
      `)
      .get(...queryParams) as { total: number };

    const total = countRow.total;
    const totalPages = Math.ceil(total / pageSize);

    const rows = db
      .prepare(`
        SELECT l.*, c.name as customer_name, c.phone as customer_phone
        FROM girvi_loans l
        LEFT JOIN customers c ON l.customer_id = c.id
        ${whereSql}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams, pageSize, offset) as GirviLoan[];

    // Attach items summary to rows
    for (const row of rows) {
      const items = db
        .prepare(`
          SELECT i.*, m.name as metal_name, p.name as purity_name
          FROM girvi_loan_items i
          LEFT JOIN metals m ON i.metal_id = m.id
          LEFT JOIN metal_purities p ON i.purity_id = p.id
          WHERE i.loan_id = ?
        `)
        .all(row.id) as GirviLoanItem[];
      row.items = items;
    }

    return {
      items: rows,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  getMetrics(): GirviMetrics {
    const db = getDb();
    const today = new Date().toISOString().substring(0, 10);

    const loanStats = db
      .prepare(`
        SELECT 
          COUNT(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE') THEN 1 END) as active_loans_count,
          COALESCE(SUM(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE') THEN outstanding_amount ELSE 0 END), 0) as total_principal_outstanding,
          COALESCE(SUM(total_interest), 0) as total_interest_accrued,
          COUNT(CASE WHEN status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE') AND due_date < ? THEN 1 END) as overdue_loans_count,
          COALESCE(SUM(total_repaid), 0) as total_repaid_amount
        FROM girvi_loans
      `)
      .get(today) as {
        active_loans_count: number;
        total_principal_outstanding: number;
        total_interest_accrued: number;
        overdue_loans_count: number;
        total_repaid_amount: number;
      };

    const itemStats = db
      .prepare(`
        SELECT COALESCE(SUM(i.valuation_amount), 0) as total_pledged_value
        FROM girvi_loan_items i
        JOIN girvi_loans l ON i.loan_id = l.id
        WHERE l.status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')
          AND i.status = 'PLEDGED'
      `)
      .get() as { total_pledged_value: number };

    return {
      active_loans_count: loanStats.active_loans_count || 0,
      total_principal_outstanding: Number((loanStats.total_principal_outstanding || 0).toFixed(2)),
      total_interest_accrued: Number((loanStats.total_interest_accrued || 0).toFixed(2)),
      overdue_loans_count: loanStats.overdue_loans_count || 0,
      total_pledged_value: Number((itemStats.total_pledged_value || 0).toFixed(2)),
      total_repaid_amount: Number((loanStats.total_repaid_amount || 0).toFixed(2)),
    };
  }

  getCustomerLoans(customerId: string): GirviLoan[] {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT l.*, c.name as customer_name, c.phone as customer_phone
        FROM girvi_loans l
        LEFT JOIN customers c ON l.customer_id = c.id
        WHERE l.customer_id = ?
        ORDER BY l.created_at DESC
      `)
      .all(customerId) as GirviLoan[];

    for (const row of rows) {
      row.items = db
        .prepare(`SELECT * FROM girvi_loan_items WHERE loan_id = ?`)
        .all(row.id) as GirviLoanItem[];
    }
    return rows;
  }
}

export const girviRepository = new GirviRepository();
