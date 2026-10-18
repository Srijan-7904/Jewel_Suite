-- 007_finance_schema.sql
-- Jewel Suite: Central Finance, Cr/Dr Ledger & Payments Schema

-- 1. Ledger Entries Table (Single central immutable ledger for all parties)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    party_type TEXT NOT NULL CHECK(party_type IN ('CUSTOMER', 'SUPPLIER', 'KARIGAR', 'GIRVI_CLIENT', 'OTHER')),
    party_id TEXT NOT NULL,
    
    entry_type TEXT NOT NULL CHECK(entry_type IN (
        'SALE',
        'SALE_PAYMENT',
        'PURCHASE',
        'PURCHASE_PAYMENT',
        'OPENING_BALANCE',
        'ADJUSTMENT',
        'KARIGAR_LABOUR',
        'KARIGAR_PAYMENT',
        'REFUND',
        'OTHER'
    )),
    
    debit_credit TEXT NOT NULL CHECK(debit_credit IN ('DEBIT', 'CREDIT')),
    amount REAL NOT NULL CHECK(amount >= 0),
    balance_before REAL NOT NULL DEFAULT 0.0,
    balance_after REAL NOT NULL DEFAULT 0.0,
    
    reference_type TEXT, -- SALES_INVOICE, PURCHASE_BILL, WORKSHOP_JOB, PAYMENT, OPENING_BALANCE, ADJUSTMENT, REPAIR
    reference_id TEXT,
    reference_number TEXT,
    
    description TEXT,
    payment_method TEXT CHECK(payment_method IN ('CASH', 'CARD', 'UPI', 'BANK', 'CREDIT') OR payment_method IS NULL),
    
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Central Payments Table (Vouchers for money received or paid by shop)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. REC-2026-000001, PAY-2026-000001
    
    party_type TEXT NOT NULL CHECK(party_type IN ('CUSTOMER', 'SUPPLIER', 'KARIGAR', 'OTHER')),
    party_id TEXT NOT NULL,
    
    payment_type TEXT NOT NULL CHECK(payment_type IN ('RECEIPT', 'PAYMENT')),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'CARD', 'UPI', 'BANK', 'CREDIT')),
    amount REAL NOT NULL CHECK(amount > 0),
    
    reference_number TEXT, -- External transaction reference (UTR, Cheque No, Transaction ID)
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    
    reference_type TEXT, -- SALES_INVOICE, PURCHASE_BILL, WORKSHOP_JOB, DIRECT
    reference_id TEXT,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for lightning-fast party statements, search & date range filters
CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_entries(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_dc ON ledger_entries(debit_credit);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_payment_method ON ledger_entries(payment_method);

CREATE INDEX IF NOT EXISTS idx_payments_number ON payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_mode ON payments(payment_mode);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(reference_type, reference_id);
