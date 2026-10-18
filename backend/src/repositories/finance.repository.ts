// backend/src/repositories/finance.repository.ts
// Jewel Suite: Central Finance & Ledger Repository

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { PartyType, EntryType, DebitCredit, PaymentType, PaymentMode, calculateNextBalance } from '../domain/finance.js';
import { PaginatedResult } from './customer.repository.js';

export interface LedgerEntryRecord {
  id: string;
  party_type: PartyType | string;
  party_id: string;
  party_name?: string;
  party_code?: string;
  entry_type: EntryType | string;
  debit_credit: DebitCredit | string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  description: string | null;
  payment_method: PaymentMode | string | null;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
}

export interface CreateLedgerEntryData {
  id?: string;
  party_type: PartyType | string;
  party_id: string;
  entry_type: EntryType | string;
  debit_credit: DebitCredit | string;
  amount: number;
  reference_type?: string | null;
  reference_id?: string | null;
  reference_number?: string | null;
  description?: string | null;
  payment_method?: PaymentMode | string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface PaymentRecord {
  id: string;
  payment_number: string;
  party_type: PartyType | string;
  party_id: string;
  party_name?: string;
  party_code?: string;
  payment_type: PaymentType | string;
  payment_mode: PaymentMode | string;
  amount: number;
  reference_number: string | null;
  payment_date: string;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
}

export interface CreatePaymentData {
  id?: string;
  payment_number?: string;
  party_type: PartyType | string;
  party_id: string;
  payment_type: PaymentType | string;
  payment_mode: PaymentMode | string;
  amount: number;
  reference_number?: string | null;
  payment_date?: string;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface LedgerQueryParams {
  page?: number;
  pageSize?: number;
  party_type?: string;
  party_id?: string;
  entry_type?: string;
  debit_credit?: string;
  payment_method?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface PaymentQueryParams {
  page?: number;
  pageSize?: number;
  party_type?: string;
  party_id?: string;
  payment_type?: string;
  payment_mode?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface CashBookQueryParams {
  page?: number;
  pageSize?: number;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface CashBookRow {
  id: string;
  date: string;
  reference_number: string;
  description: string;
  party_type: string;
  party_id: string;
  party_name: string;
  cash_in: number;
  cash_out: number;
  running_balance: number;
}

export class FinanceRepository {
  /**
   * Generates next sequential payment number: REC-YYYY-000001 or PAY-YYYY-000001
   */
  getNextPaymentNumber(paymentType: PaymentType | string): string {
    const db = getDb();
    const currentYear = new Date().getFullYear();
    const prefix = paymentType === PaymentType.RECEIPT ? `REC-${currentYear}-` : `PAY-${currentYear}-`;

    const row = db
      .prepare(
        `SELECT payment_number FROM payments 
         WHERE payment_number LIKE ? 
         ORDER BY payment_number DESC LIMIT 1`
      )
      .get(`${prefix}%`) as { payment_number: string } | undefined;

    if (!row) {
      return `${prefix}000001`;
    }

    const lastNumStr = row.payment_number.replace(prefix, '');
    const lastNum = parseInt(lastNumStr, 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefix}${nextNum.toString().padStart(6, '0')}`;
  }

  /**
   * Returns current latest balance for a party from the ledger.
   * If no entries exist, returns 0.0.
   */
  getLatestPartyBalance(partyType: string, partyId: string): number {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT balance_after FROM ledger_entries 
         WHERE party_type = ? AND party_id = ? 
         ORDER BY created_at DESC, rowid DESC LIMIT 1`
      )
      .get(partyType, partyId) as { balance_after: number } | undefined;

    return row ? Number(row.balance_after) : 0.0;
  }

  /**
   * Creates an immutable ledger entry.
   * Automatically calculates balance_before and balance_after.
   */
  createLedgerEntry(data: CreateLedgerEntryData): LedgerEntryRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const balanceBefore = this.getLatestPartyBalance(data.party_type, data.party_id);
    const balanceAfter = calculateNextBalance(
      data.party_type,
      balanceBefore,
      data.debit_credit,
      data.amount
    );

    const createdAt = data.created_at || new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(
      `INSERT INTO ledger_entries (
        id, party_type, party_id, entry_type, debit_credit,
        amount, balance_before, balance_after,
        reference_type, reference_id, reference_number,
        description, payment_method, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.party_type,
      data.party_id,
      data.entry_type,
      data.debit_credit,
      data.amount,
      balanceBefore,
      balanceAfter,
      data.reference_type || null,
      data.reference_id || null,
      data.reference_number || null,
      data.description || null,
      data.payment_method || null,
      data.created_by || null,
      createdAt
    );

    return this.getLedgerEntryById(id)!;
  }

  getLedgerEntryById(id: string): LedgerEntryRecord | undefined {
    const db = getDb();
    return db
      .prepare(
        `SELECT 
          l.*,
          CASE 
            WHEN l.party_type = 'CUSTOMER' THEN c.name 
            WHEN l.party_type = 'SUPPLIER' THEN s.name 
            WHEN l.party_type = 'KARIGAR' THEN k.name 
            ELSE l.party_id 
          END AS party_name,
          CASE 
            WHEN l.party_type = 'CUSTOMER' THEN c.customer_code 
            WHEN l.party_type = 'SUPPLIER' THEN s.supplier_code 
            WHEN l.party_type = 'KARIGAR' THEN k.karigar_code 
            ELSE NULL 
          END AS party_code,
          u.username AS creator_name
        FROM ledger_entries l
        LEFT JOIN customers c ON l.party_id = c.id
        LEFT JOIN suppliers s ON l.party_id = s.id
        LEFT JOIN karigars k ON l.party_id = k.id
        LEFT JOIN users u ON l.created_by = u.id
        WHERE l.id = ?`
      )
      .get(id) as LedgerEntryRecord | undefined;
  }

  findLedgerEntries(params: LedgerQueryParams): PaginatedResult<LedgerEntryRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.party_type) {
      conditions.push('l.party_type = ?');
      args.push(params.party_type);
    }

    if (params.party_id) {
      conditions.push('l.party_id = ?');
      args.push(params.party_id);
    }

    if (params.entry_type) {
      conditions.push('l.entry_type = ?');
      args.push(params.entry_type);
    }

    if (params.debit_credit) {
      conditions.push('l.debit_credit = ?');
      args.push(params.debit_credit);
    }

    if (params.payment_method) {
      conditions.push('l.payment_method = ?');
      args.push(params.payment_method);
    }

    if (params.from_date) {
      conditions.push('l.created_at >= ?');
      args.push(`${params.from_date} 00:00:00`);
    }

    if (params.to_date) {
      conditions.push('l.created_at <= ?');
      args.push(`${params.to_date} 23:59:59`);
    }

    if (params.search) {
      conditions.push('(l.reference_number LIKE ? OR l.description LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR k.name LIKE ?)');
      const s = `%${params.search}%`;
      args.push(s, s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM ledger_entries l
         LEFT JOIN customers c ON l.party_id = c.id
         LEFT JOIN suppliers s ON l.party_id = s.id
         LEFT JOIN karigars k ON l.party_id = k.id
         ${whereClause}`
      )
      .get(...args) as { count: number };

    const total = countRow.count;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = db
      .prepare(
        `SELECT 
          l.*,
          CASE 
            WHEN l.party_type = 'CUSTOMER' THEN c.name 
            WHEN l.party_type = 'SUPPLIER' THEN s.name 
            WHEN l.party_type = 'KARIGAR' THEN k.name 
            ELSE l.party_id 
          END AS party_name,
          CASE 
            WHEN l.party_type = 'CUSTOMER' THEN c.customer_code 
            WHEN l.party_type = 'SUPPLIER' THEN s.supplier_code 
            WHEN l.party_type = 'KARIGAR' THEN k.karigar_code 
            ELSE NULL 
          END AS party_code,
          u.username AS creator_name
        FROM ledger_entries l
        LEFT JOIN customers c ON l.party_id = c.id
        LEFT JOIN suppliers s ON l.party_id = s.id
        LEFT JOIN karigars k ON l.party_id = k.id
        LEFT JOIN users u ON l.created_by = u.id
        ${whereClause}
        ORDER BY l.created_at DESC, l.rowid DESC
        LIMIT ? OFFSET ?`
      )
      .all(...args, pageSize, offset) as LedgerEntryRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Retrieves full statement metrics for a specific party.
   */
  getPartyStatement(partyType: string, partyId: string, fromDate?: string, toDate?: string) {
    const db = getDb();
    const conditions: string[] = ['party_type = ?', 'party_id = ?'];
    const args: any[] = [partyType, partyId];

    if (fromDate) {
      conditions.push('created_at >= ?');
      args.push(`${fromDate} 00:00:00`);
    }
    if (toDate) {
      conditions.push('created_at <= ?');
      args.push(`${toDate} 23:59:59`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const totals = db
      .prepare(
        `SELECT 
          SUM(CASE WHEN debit_credit = 'DEBIT' THEN amount ELSE 0 END) AS total_debit,
          SUM(CASE WHEN debit_credit = 'CREDIT' THEN amount ELSE 0 END) AS total_credit,
          COUNT(*) as entry_count
         FROM ledger_entries
         ${whereClause}`
      )
      .get(...args) as { total_debit: number | null; total_credit: number | null; entry_count: number };

    // Get current overall balance
    const currentBalance = this.getLatestPartyBalance(partyType, partyId);

    return {
      total_debit: Number(totals.total_debit || 0),
      total_credit: Number(totals.total_credit || 0),
      entry_count: totals.entry_count,
      current_balance: currentBalance,
    };
  }

  /**
   * Creates a payment voucher in payments table.
   */
  createPayment(data: CreatePaymentData): PaymentRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const paymentNumber = data.payment_number || this.getNextPaymentNumber(data.payment_type);
    const paymentDate = data.payment_date || new Date().toISOString().substring(0, 10);
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(
      `INSERT INTO payments (
        id, payment_number, party_type, party_id,
        payment_type, payment_mode, amount,
        reference_number, payment_date, reference_type,
        reference_id, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      paymentNumber,
      data.party_type,
      data.party_id,
      data.payment_type,
      data.payment_mode,
      data.amount,
      data.reference_number || null,
      paymentDate,
      data.reference_type || null,
      data.reference_id || null,
      data.notes || null,
      data.created_by || null,
      createdAt
    );

    return this.getPaymentById(id)!;
  }

  getPaymentById(id: string): PaymentRecord | undefined {
    const db = getDb();
    return db
      .prepare(
        `SELECT 
          p.*,
          CASE 
            WHEN p.party_type = 'CUSTOMER' THEN c.name 
            WHEN p.party_type = 'SUPPLIER' THEN s.name 
            WHEN p.party_type = 'KARIGAR' THEN k.name 
            ELSE p.party_id 
          END AS party_name,
          CASE 
            WHEN p.party_type = 'CUSTOMER' THEN c.customer_code 
            WHEN p.party_type = 'SUPPLIER' THEN s.supplier_code 
            WHEN p.party_type = 'KARIGAR' THEN k.karigar_code 
            ELSE NULL 
          END AS party_code,
          u.username AS creator_name
        FROM payments p
        LEFT JOIN customers c ON p.party_id = c.id
        LEFT JOIN suppliers s ON p.party_id = s.id
        LEFT JOIN karigars k ON p.party_id = k.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?`
      )
      .get(id) as PaymentRecord | undefined;
  }

  findPayments(params: PaymentQueryParams): PaginatedResult<PaymentRecord> {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: any[] = [];

    if (params.party_type) {
      conditions.push('p.party_type = ?');
      args.push(params.party_type);
    }

    if (params.party_id) {
      conditions.push('p.party_id = ?');
      args.push(params.party_id);
    }

    if (params.payment_type) {
      conditions.push('p.payment_type = ?');
      args.push(params.payment_type);
    }

    if (params.payment_mode) {
      conditions.push('p.payment_mode = ?');
      args.push(params.payment_mode);
    }

    if (params.from_date) {
      conditions.push('p.payment_date >= ?');
      args.push(params.from_date);
    }

    if (params.to_date) {
      conditions.push('p.payment_date <= ?');
      args.push(params.to_date);
    }

    if (params.search) {
      conditions.push('(p.payment_number LIKE ? OR p.reference_number LIKE ? OR p.notes LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR k.name LIKE ?)');
      const s = `%${params.search}%`;
      args.push(s, s, s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM payments p
         LEFT JOIN customers c ON p.party_id = c.id
         LEFT JOIN suppliers s ON p.party_id = s.id
         LEFT JOIN karigars k ON p.party_id = k.id
         ${whereClause}`
      )
      .get(...args) as { count: number };

    const total = countRow.count;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = db
      .prepare(
        `SELECT 
          p.*,
          CASE 
            WHEN p.party_type = 'CUSTOMER' THEN c.name 
            WHEN p.party_type = 'SUPPLIER' THEN s.name 
            WHEN p.party_type = 'KARIGAR' THEN k.name 
            ELSE p.party_id 
          END AS party_name,
          CASE 
            WHEN p.party_type = 'CUSTOMER' THEN c.customer_code 
            WHEN p.party_type = 'SUPPLIER' THEN s.supplier_code 
            WHEN p.party_type = 'KARIGAR' THEN k.karigar_code 
            ELSE NULL 
          END AS party_code,
          u.username AS creator_name
        FROM payments p
        LEFT JOIN customers c ON p.party_id = c.id
        LEFT JOIN suppliers s ON p.party_id = s.id
        LEFT JOIN karigars k ON p.party_id = k.id
        LEFT JOIN users u ON p.created_by = u.id
        ${whereClause}
        ORDER BY p.payment_date DESC, p.created_at DESC
        LIMIT ? OFFSET ?`
      )
      .all(...args, pageSize, offset) as PaymentRecord[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Cash Book query:
   * Only includes transactions where payment mode / method is CASH.
   * Calculates running cash balance chronologically.
   */
  getCashBook(params: CashBookQueryParams): {
    items: CashBookRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    opening_balance: number;
    closing_balance: number;
    total_cash_in: number;
    total_cash_out: number;
  } {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));

    // Fetch all cash transactions from ledger_entries
    const conditions: string[] = ["l.payment_method = 'CASH'"];
    const args: any[] = [];

    if (params.from_date) {
      conditions.push("l.created_at >= ?");
      args.push(`${params.from_date} 00:00:00`);
    }

    if (params.to_date) {
      conditions.push("l.created_at <= ?");
      args.push(`${params.to_date} 23:59:59`);
    }

    if (params.search) {
      conditions.push("(l.reference_number LIKE ? OR l.description LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR k.name LIKE ?)");
      const s = `%${params.search}%`;
      args.push(s, s, s, s, s);
    }

    // Opening cash balance before from_date
    let openingCash = 0;
    if (params.from_date) {
      const prior = db.prepare(
        `SELECT 
          SUM(CASE 
            WHEN l.party_type = 'CUSTOMER' AND l.debit_credit = 'CREDIT' THEN l.amount 
            WHEN l.party_type IN ('SUPPLIER', 'KARIGAR') AND l.debit_credit = 'CREDIT' THEN -l.amount 
            WHEN l.party_type IN ('SUPPLIER', 'KARIGAR') AND l.debit_credit = 'DEBIT' THEN -l.amount
            WHEN l.entry_type = 'SALE_PAYMENT' THEN l.amount
            WHEN l.entry_type IN ('PURCHASE_PAYMENT', 'KARIGAR_PAYMENT') THEN -l.amount
            ELSE 0 
          END) AS net_prior
         FROM ledger_entries l
         WHERE l.payment_method = 'CASH' AND l.created_at < ?`
      ).get(`${params.from_date} 00:00:00`) as { net_prior: number | null };
      openingCash = Number(prior?.net_prior || 0);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const allRows = db
      .prepare(
        `SELECT 
          l.id,
          l.created_at AS date,
          COALESCE(l.reference_number, l.id) AS reference_number,
          l.description,
          l.party_type,
          l.party_id,
          l.entry_type,
          l.debit_credit,
          l.amount,
          CASE 
            WHEN l.party_type = 'CUSTOMER' THEN c.name 
            WHEN l.party_type = 'SUPPLIER' THEN s.name 
            WHEN l.party_type = 'KARIGAR' THEN k.name 
            ELSE l.party_id 
          END AS party_name
        FROM ledger_entries l
        LEFT JOIN customers c ON l.party_id = c.id
        LEFT JOIN suppliers s ON l.party_id = s.id
        LEFT JOIN karigars k ON l.party_id = k.id
        ${whereClause}
        ORDER BY l.created_at ASC, l.rowid ASC`
      )
      .all(...args) as any[];

    let running = openingCash;
    let totalCashIn = 0;
    let totalCashOut = 0;

    const calculatedRows: CashBookRow[] = allRows.map((r) => {
      // In Jewel Suite accounting:
      // Customer payment received = Cash In
      // Supplier / Karigar payment paid = Cash Out
      let cashIn = 0;
      let cashOut = 0;

      if (r.entry_type === EntryType.SALE_PAYMENT || (r.party_type === PartyType.CUSTOMER && r.debit_credit === DebitCredit.CREDIT)) {
        cashIn = r.amount;
        totalCashIn += cashIn;
        running += cashIn;
      } else if (
        r.entry_type === EntryType.PURCHASE_PAYMENT ||
        r.entry_type === EntryType.KARIGAR_PAYMENT ||
        (r.party_type === PartyType.SUPPLIER && r.debit_credit === DebitCredit.DEBIT) ||
        (r.party_type === PartyType.KARIGAR && r.debit_credit === DebitCredit.DEBIT)
      ) {
        cashOut = r.amount;
        totalCashOut += cashOut;
        running -= cashOut;
      } else if (r.entry_type === EntryType.ADJUSTMENT) {
        if (r.debit_credit === DebitCredit.CREDIT) {
          cashIn = r.amount;
          totalCashIn += cashIn;
          running += cashIn;
        } else {
          cashOut = r.amount;
          totalCashOut += cashOut;
          running -= cashOut;
        }
      }

      return {
        id: r.id,
        date: r.date,
        reference_number: r.reference_number,
        description: r.description || `${r.entry_type} (${r.party_type})`,
        party_type: r.party_type,
        party_id: r.party_id,
        party_name: r.party_name || 'Counter Party',
        cash_in: Number(cashIn.toFixed(2)),
        cash_out: Number(cashOut.toFixed(2)),
        running_balance: Number(running.toFixed(2)),
      };
    });

    const total = calculatedRows.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    // Show newest first on page or chronological
    const pagedItems = calculatedRows.slice().reverse().slice((page - 1) * pageSize, page * pageSize);

    return {
      items: pagedItems,
      total,
      page,
      pageSize,
      totalPages,
      opening_balance: Number(openingCash.toFixed(2)),
      closing_balance: Number(running.toFixed(2)),
      total_cash_in: Number(totalCashIn.toFixed(2)),
      total_cash_out: Number(totalCashOut.toFixed(2)),
    };
  }

  /**
   * System-wide Finance Overview / Metrics
   */
  getFinanceMetrics() {
    const db = getDb();

    // 1. Total Customer Receivables (sum of all positive balances)
    const customerBalances = db
      .prepare(
        `SELECT party_id, balance_after 
         FROM ledger_entries 
         WHERE party_type = 'CUSTOMER'
         AND rowid IN (
           SELECT MAX(rowid) FROM ledger_entries WHERE party_type = 'CUSTOMER' GROUP BY party_id
         )`
      )
      .all() as { balance_after: number }[];

    let totalReceivables = 0;
    for (const row of customerBalances) {
      if (row.balance_after > 0) {
        totalReceivables += row.balance_after;
      }
    }

    // 2. Total Supplier Payables (sum of all positive payables)
    const supplierBalances = db
      .prepare(
        `SELECT party_id, balance_after 
         FROM ledger_entries 
         WHERE party_type = 'SUPPLIER'
         AND rowid IN (
           SELECT MAX(rowid) FROM ledger_entries WHERE party_type = 'SUPPLIER' GROUP BY party_id
         )`
      )
      .all() as { balance_after: number }[];

    let totalSupplierPayables = 0;
    for (const row of supplierBalances) {
      if (row.balance_after > 0) {
        totalSupplierPayables += row.balance_after;
      }
    }

    // 3. Total Karigar Payables (sum of all positive payables)
    const karigarBalances = db
      .prepare(
        `SELECT party_id, balance_after 
         FROM ledger_entries 
         WHERE party_type = 'KARIGAR'
         AND rowid IN (
           SELECT MAX(rowid) FROM ledger_entries WHERE party_type = 'KARIGAR' GROUP BY party_id
         )`
      )
      .all() as { balance_after: number }[];

    let totalKarigarPayables = 0;
    for (const row of karigarBalances) {
      if (row.balance_after > 0) {
        totalKarigarPayables += row.balance_after;
      }
    }

    // 4. Physical Cash Balance:
    // Cash Receipts - Cash Payments
    const cashRow = db
      .prepare(
        `SELECT 
          SUM(CASE 
            WHEN entry_type = 'SALE_PAYMENT' THEN amount 
            WHEN party_type = 'CUSTOMER' AND debit_credit = 'CREDIT' THEN amount 
            ELSE 0 
          END) AS total_in,
          SUM(CASE 
            WHEN entry_type IN ('PURCHASE_PAYMENT', 'KARIGAR_PAYMENT') THEN amount 
            WHEN party_type IN ('SUPPLIER', 'KARIGAR') AND debit_credit = 'DEBIT' THEN amount 
            ELSE 0 
          END) AS total_out
         FROM ledger_entries
         WHERE payment_method = 'CASH'`
      )
      .get() as { total_in: number | null; total_out: number | null };

    const totalCashIn = Number(cashRow?.total_in || 0);
    const totalCashOut = Number(cashRow?.total_out || 0);
    const cashBalance = Number((totalCashIn - totalCashOut).toFixed(2));

    // 5. Today's Collections (all modes)
    const todayCollectionsRow = db
      .prepare(
        `SELECT SUM(amount) AS sum_amount 
         FROM payments 
         WHERE payment_type = 'RECEIPT' AND payment_date = date('now')`
      )
      .get() as { sum_amount: number | null };
    const todayCollections = Number(todayCollectionsRow?.sum_amount || 0);

    // 6. Today's Payments (all modes)
    const todayPaymentsRow = db
      .prepare(
        `SELECT SUM(amount) AS sum_amount 
         FROM payments 
         WHERE payment_type = 'PAYMENT' AND payment_date = date('now')`
      )
      .get() as { sum_amount: number | null };
    const todayPayments = Number(todayPaymentsRow?.sum_amount || 0);

    // 7. Today's Sales
    const todaySalesRow = db
      .prepare(
        `SELECT SUM(grand_total) AS sum_sales 
         FROM sales_invoices 
         WHERE invoice_date = date('now') AND status = 'FINALIZED'`
      )
      .get() as { sum_sales: number | null };
    const todaySales = Number(todaySalesRow?.sum_sales || 0);

    return {
      total_receivables: Number(totalReceivables.toFixed(2)),
      total_payables: Number((totalSupplierPayables + totalKarigarPayables).toFixed(2)),
      supplier_payables: Number(totalSupplierPayables.toFixed(2)),
      karigar_payables: Number(totalKarigarPayables.toFixed(2)),
      cash_balance: cashBalance,
      today_collections: todayCollections,
      today_payments: todayPayments,
      today_sales: todaySales,
    };
  }
}

export const financeRepository = new FinanceRepository();
