-- 015_add_supplier_multi_type_opening_balances.sql
-- Jewel Suite: Multi-Type Opening Balance for Suppliers across Monetary and Metal Ledgers

-- 1. Contact and alternate phone fields
ALTER TABLE suppliers ADD COLUMN contact_person TEXT DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN alternate_phone TEXT DEFAULT NULL;

-- 2. Extend suppliers table with granular multi-type opening balance fields
ALTER TABLE suppliers ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_balance_type TEXT NOT NULL DEFAULT 'CREDIT';
ALTER TABLE suppliers ADD COLUMN opening_balance_date TEXT DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN opening_balance_ref TEXT DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN opening_balance_notes TEXT DEFAULT NULL;

-- Cash Opening Balance
ALTER TABLE suppliers ADD COLUMN opening_cash_balance REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_cash_type TEXT NOT NULL DEFAULT 'CREDIT';

-- Bank / RTGS Opening Balance
ALTER TABLE suppliers ADD COLUMN opening_bank_balance REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_bank_type TEXT NOT NULL DEFAULT 'CREDIT';

-- Gold Opening Balance
ALTER TABLE suppliers ADD COLUMN opening_gold_weight REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_gold_type TEXT NOT NULL DEFAULT 'CREDIT';
ALTER TABLE suppliers ADD COLUMN opening_gold_purity_id TEXT DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN opening_gold_rate REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_gold_value REAL NOT NULL DEFAULT 0.0;

-- Silver Opening Balance
ALTER TABLE suppliers ADD COLUMN opening_silver_weight REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_silver_type TEXT NOT NULL DEFAULT 'CREDIT';
ALTER TABLE suppliers ADD COLUMN opening_silver_purity_id TEXT DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN opening_silver_rate REAL NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN opening_silver_value REAL NOT NULL DEFAULT 0.0;
