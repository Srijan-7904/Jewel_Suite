-- 014_add_multi_type_opening_balances.sql
-- Jewel Suite: Multi-Type Opening Balance for Customers across Monetary and Metal Ledgers

-- 1. Extend customers table with granular multi-type opening balance fields
ALTER TABLE customers ADD COLUMN opening_balance_date TEXT DEFAULT NULL;
ALTER TABLE customers ADD COLUMN opening_balance_ref TEXT DEFAULT NULL;
ALTER TABLE customers ADD COLUMN opening_balance_notes TEXT DEFAULT NULL;

-- Cash Opening Balance
ALTER TABLE customers ADD COLUMN opening_cash_balance REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN opening_cash_type TEXT NOT NULL DEFAULT 'DEBIT';

-- Bank / RTGS Opening Balance
ALTER TABLE customers ADD COLUMN opening_bank_balance REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN opening_bank_type TEXT NOT NULL DEFAULT 'DEBIT';

-- Gold Opening Balance
ALTER TABLE customers ADD COLUMN opening_gold_weight REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN opening_gold_type TEXT NOT NULL DEFAULT 'DEBIT';
ALTER TABLE customers ADD COLUMN opening_gold_purity_id TEXT DEFAULT NULL;
ALTER TABLE customers ADD COLUMN opening_gold_rate REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN opening_gold_value REAL NOT NULL DEFAULT 0.0;

-- Silver Opening Balance
ALTER TABLE customers ADD COLUMN opening_silver_weight REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN opening_silver_type TEXT NOT NULL DEFAULT 'DEBIT';
ALTER TABLE customers ADD COLUMN opening_silver_purity_id TEXT DEFAULT NULL;
ALTER TABLE customers ADD COLUMN opening_silver_rate REAL NOT NULL DEFAULT 0.0;
ALTER TABLE customers ADD COLUMN opening_silver_value REAL NOT NULL DEFAULT 0.0;

-- 2. Party Metal Ledger Entries Table
-- Central immutable metal ledger for tracking gold & silver physical weights, purities, and fine weight balances
CREATE TABLE IF NOT EXISTS party_metal_ledger_entries (
    id TEXT PRIMARY KEY,
    party_type TEXT NOT NULL CHECK(party_type IN ('CUSTOMER', 'SUPPLIER', 'KARIGAR', 'OTHER')),
    party_id TEXT NOT NULL,
    metal_id TEXT NOT NULL REFERENCES metals(id),
    purity_id TEXT REFERENCES metal_purities(id),
    
    entry_type TEXT NOT NULL CHECK(entry_type IN (
        'OPENING_BALANCE',
        'METAL_PAYMENT',
        'EXCHANGE_INWARD',
        'METAL_RETURN',
        'ADJUSTMENT',
        'SETTLEMENT',
        'OTHER'
    )),
    
    debit_credit TEXT NOT NULL CHECK(debit_credit IN ('DEBIT', 'CREDIT')),
    -- DEBIT = Customer owes metal to shop (receivable metal)
    -- CREDIT = Shop owes metal to customer (payable metal / advance metal)
    
    weight REAL NOT NULL CHECK(weight >= 0),
    purity_percent REAL,
    fine_weight REAL NOT NULL DEFAULT 0.0,
    balance_before REAL NOT NULL DEFAULT 0.0,
    balance_after REAL NOT NULL DEFAULT 0.0,
    
    valuation_rate REAL DEFAULT 0.0,
    valuation_amount REAL DEFAULT 0.0,
    
    reference_type TEXT,
    reference_id TEXT,
    reference_number TEXT,
    description TEXT,
    
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient metal ledger lookups
CREATE INDEX IF NOT EXISTS idx_metal_ledger_party ON party_metal_ledger_entries(party_type, party_id, metal_id);
CREATE INDEX IF NOT EXISTS idx_metal_ledger_created ON party_metal_ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_metal_ledger_entry_type ON party_metal_ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_metal_ledger_dc ON party_metal_ledger_entries(debit_credit);
