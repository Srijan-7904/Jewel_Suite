-- 010_settings_and_shop_schema.sql
-- Jewel Suite Part 11: Settings, AMC, Shop Configuration, Sequences & Payment Modes

-- 1. Extend shops table for full shop profile
ALTER TABLE shops ADD COLUMN legal_name TEXT;
ALTER TABLE shops ADD COLUMN owner_name TEXT;
ALTER TABLE shops ADD COLUMN city TEXT;
ALTER TABLE shops ADD COLUMN state TEXT;
ALTER TABLE shops ADD COLUMN pincode TEXT;
ALTER TABLE shops ADD COLUMN country TEXT DEFAULT 'India';
ALTER TABLE shops ADD COLUMN alternate_phone TEXT;
ALTER TABLE shops ADD COLUMN website TEXT;
ALTER TABLE shops ADD COLUMN gstin TEXT;
ALTER TABLE shops ADD COLUMN pan TEXT;
ALTER TABLE shops ADD COLUMN bank_name TEXT;
ALTER TABLE shops ADD COLUMN account_number TEXT;
ALTER TABLE shops ADD COLUMN ifsc TEXT;
ALTER TABLE shops ADD COLUMN upi_id TEXT;
ALTER TABLE shops ADD COLUMN logo_path TEXT;

-- 2. Extend users table for staff profile and permissions
ALTER TABLE users ADD COLUMN full_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN permissions TEXT; -- JSON array of strings

-- 3. Document Sequences for atomic, concurrency-safe numbering
CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type TEXT PRIMARY KEY, -- 'INVOICE', 'PURCHASE', 'REPAIR', 'EXCHANGE', 'WORKSHOP_JOB', 'GIRVI_LOAN', 'SAVING_SCHEME'
    prefix TEXT NOT NULL,
    starting_number INTEGER NOT NULL DEFAULT 1,
    current_value INTEGER NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 6,
    financial_year_reset INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default document sequences if not existing
INSERT OR IGNORE INTO document_sequences (doc_type, prefix, starting_number, current_value, padding, financial_year_reset, financial_year)
VALUES
  ('INVOICE', 'INV', 1, 0, 6, 1, '2026-27'),
  ('PURCHASE', 'PUR', 1, 0, 6, 1, '2026-27'),
  ('REPAIR', 'REP', 1, 0, 6, 1, '2026-27'),
  ('EXCHANGE', 'EX', 1, 0, 6, 1, '2026-27'),
  ('WORKSHOP_JOB', 'JOB', 1, 0, 6, 1, '2026-27'),
  ('GIRVI_LOAN', 'GL', 1, 0, 6, 1, '2026-27'),
  ('SAVING_SCHEME', 'SCH', 1, 0, 6, 1, '2026-27');

-- 4. Payment Modes Configuration table
CREATE TABLE IF NOT EXISTS payment_modes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO payment_modes (id, code, name, is_active, is_system, sort_order)
VALUES
  ('pm-cash', 'CASH', 'Cash Counter', 1, 1, 10),
  ('pm-card', 'CARD', 'Credit / Debit Card', 1, 1, 20),
  ('pm-upi', 'UPI', 'UPI / QR Code', 1, 1, 30),
  ('pm-bank', 'BANK', 'NEFT / RTGS / Bank Transfer', 1, 1, 40),
  ('pm-credit', 'CREDIT', 'Store Credit / Khata', 1, 1, 50),
  ('pm-gold', 'GOLD', 'Old Gold Exchange Val', 1, 1, 60),
  ('pm-silver', 'SILVER', 'Old Silver Exchange Val', 1, 1, 70),
  ('pm-other', 'OTHER', 'Other / Cheque', 1, 1, 80);

-- 5. AMC and Offline License Information table
CREATE TABLE IF NOT EXISTS amc_license (
    id TEXT PRIMARY KEY,
    license_key TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Jewel Suite Gold Pro',
    issued_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    grace_period_days INTEGER NOT NULL DEFAULT 15,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed initial valid 1-year offline license with grace period
INSERT OR IGNORE INTO amc_license (id, license_key, shop_id, device_id, plan, issued_date, expiry_date, grace_period_days, signature, status)
VALUES (
  'lic-initial-2026',
  'JS-GOLD-2026-9482-B4D1',
  'shop-default',
  'DEV-WIN-OFFLINE-POS-01',
  'Jewel Suite Gold Pro (Enterprise Offline)',
  '2026-04-01',
  '2027-03-31',
  15,
  'SIG-OFFLINE-VERIFIED-HMAC256-4b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
  'ACTIVE'
);

-- Index for payment modes & sequences
CREATE INDEX IF NOT EXISTS idx_payment_modes_active ON payment_modes(is_active);
CREATE INDEX IF NOT EXISTS idx_amc_license_expiry ON amc_license(expiry_date);
