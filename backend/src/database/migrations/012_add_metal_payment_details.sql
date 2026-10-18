-- 012_add_metal_payment_details.sql
-- Jewel Suite: Add metal weight and rate columns to sales_invoice_payments for Gold and Silver tender.
-- Also expands payments and ledger_entries CHECK constraints to allow 'GOLD', 'SILVER', 'OTHER'.

ALTER TABLE sales_invoice_payments ADD COLUMN metal_weight REAL DEFAULT NULL;
ALTER TABLE sales_invoice_payments ADD COLUMN metal_rate REAL DEFAULT NULL;

-- Expand payments table check constraint to support GOLD, SILVER, OTHER
CREATE TABLE IF NOT EXISTS payments_new (
    id TEXT PRIMARY KEY,
    payment_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
    party_type TEXT NOT NULL CHECK(party_type IN ('CUSTOMER', 'SUPPLIER', 'KARIGAR', 'OTHER')),
    party_id TEXT NOT NULL,
    payment_type TEXT NOT NULL CHECK(payment_type IN ('RECEIPT', 'PAYMENT')),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'CARD', 'UPI', 'BANK', 'CREDIT', 'GOLD', 'SILVER', 'OTHER')),
    amount REAL NOT NULL CHECK(amount > 0),
    reference_number TEXT,
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO payments_new SELECT * FROM payments;
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

-- Expand ledger_entries table check constraint to support GOLD, SILVER, OTHER
CREATE TABLE IF NOT EXISTS ledger_entries_new (
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
    reference_type TEXT,
    reference_id TEXT,
    reference_number TEXT,
    description TEXT,
    payment_method TEXT CHECK(payment_method IN ('CASH', 'CARD', 'UPI', 'BANK', 'CREDIT', 'GOLD', 'SILVER', 'OTHER') OR payment_method IS NULL),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ledger_entries_new SELECT * FROM ledger_entries;
DROP TABLE ledger_entries;
ALTER TABLE ledger_entries_new RENAME TO ledger_entries;

CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_entries(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
