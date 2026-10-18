-- 008_girvi_and_saving_schemes_schema.sql
-- Jewel Suite: Girvi / Pledged Jewellery Loans & Saving Schemes Schema

-- 1. Girvi Loans Table
CREATE TABLE IF NOT EXISTS girvi_loans (
    id TEXT PRIMARY KEY,
    loan_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. GL-2026-000001
    customer_id TEXT NOT NULL REFERENCES customers(id),
    
    loan_date TEXT NOT NULL DEFAULT (date('now')),
    due_date TEXT NOT NULL,
    
    principal_amount REAL NOT NULL CHECK(principal_amount > 0),
    interest_rate REAL NOT NULL CHECK(interest_rate >= 0),
    interest_type TEXT NOT NULL CHECK(interest_type IN ('MONTHLY_PERCENT', 'ANNUAL_PERCENT', 'FLAT_AMOUNT')),
    
    processing_fee REAL NOT NULL DEFAULT 0.0 CHECK(processing_fee >= 0),
    other_charges REAL NOT NULL DEFAULT 0.0 CHECK(other_charges >= 0),
    
    total_interest REAL NOT NULL DEFAULT 0.0 CHECK(total_interest >= 0),
    total_charges REAL NOT NULL DEFAULT 0.0 CHECK(total_charges >= 0),
    total_repaid REAL NOT NULL DEFAULT 0.0 CHECK(total_repaid >= 0),
    outstanding_amount REAL NOT NULL DEFAULT 0.0 CHECK(outstanding_amount >= 0),
    
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'ACTIVE', 'PARTIALLY_PAID', 'OVERDUE', 'CLOSED', 'DEFAULTED', 'CANCELLED')),
    
    ltv_percent REAL NOT NULL DEFAULT 75.0,
    max_allowed_loan REAL NOT NULL DEFAULT 0.0,
    is_overridden INTEGER NOT NULL DEFAULT 0,
    override_reason TEXT,
    
    disbursement_date TEXT,
    disbursed_by TEXT REFERENCES users(id),
    
    closure_date TEXT,
    closed_by TEXT REFERENCES users(id),
    closure_notes TEXT,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Girvi Pledged Jewellery Items Table
-- Critical Domain Rule: Pledged jewellery belongs to the CUSTOMER, not normal shop inventory.
CREATE TABLE IF NOT EXISTS girvi_loan_items (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES girvi_loans(id) ON DELETE CASCADE,
    
    source_type TEXT NOT NULL DEFAULT 'CUSTOMER_ITEM' CHECK(source_type IN ('CUSTOMER_ITEM', 'SHOP_STOCK')),
    stock_item_id TEXT REFERENCES stock_items(id) ON DELETE SET NULL,
    
    description TEXT NOT NULL,
    tag_no TEXT,
    
    metal_id TEXT REFERENCES metals(id) ON DELETE SET NULL,
    purity_id TEXT REFERENCES metal_purities(id) ON DELETE SET NULL,
    
    gross_weight REAL NOT NULL CHECK(gross_weight > 0),
    less_weight REAL NOT NULL DEFAULT 0.0 CHECK(less_weight >= 0),
    net_weight REAL NOT NULL CHECK(net_weight > 0),
    tunch_percent REAL NOT NULL CHECK(tunch_percent >= 0 AND tunch_percent <= 100),
    fine_weight REAL NOT NULL CHECK(fine_weight >= 0),
    
    valuation_rate REAL NOT NULL CHECK(valuation_rate >= 0),
    valuation_amount REAL NOT NULL CHECK(valuation_amount >= 0),
    pledged_value REAL NOT NULL CHECK(pledged_value >= 0),
    
    status TEXT NOT NULL DEFAULT 'PLEDGED' CHECK(status IN ('PLEDGED', 'RELEASED', 'FORFEITED')),
    
    release_date TEXT,
    released_by TEXT REFERENCES users(id),
    release_notes TEXT,
    
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Girvi Loan Repayments Table
CREATE TABLE IF NOT EXISTS girvi_loan_payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES girvi_loans(id) ON DELETE CASCADE,
    payment_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. GLP-2026-000001
    
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    
    principal_amount REAL NOT NULL DEFAULT 0.0 CHECK(principal_amount >= 0),
    interest_amount REAL NOT NULL DEFAULT 0.0 CHECK(interest_amount >= 0),
    charges_amount REAL NOT NULL DEFAULT 0.0 CHECK(charges_amount >= 0),
    total_amount REAL NOT NULL CHECK(total_amount > 0),
    
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'CARD', 'UPI', 'BANK', 'CREDIT')),
    reference_number TEXT,
    
    finance_payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Girvi Pledge Events / Custody Audit Trail Table
CREATE TABLE IF NOT EXISTS girvi_pledge_events (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES girvi_loans(id) ON DELETE CASCADE,
    loan_item_id TEXT REFERENCES girvi_loan_items(id) ON DELETE SET NULL,
    
    event_type TEXT NOT NULL CHECK(event_type IN ('PLEDGED', 'RELEASED', 'FORFEITED', 'ADJUSTED')),
    event_date TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT NOT NULL,
    
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Saving Scheme Types (Master Definitions)
CREATE TABLE IF NOT EXISTS saving_scheme_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    
    duration_months INTEGER NOT NULL CHECK(duration_months > 0),
    installment_amount REAL NOT NULL CHECK(installment_amount > 0),
    
    maturity_benefit_type TEXT NOT NULL CHECK(maturity_benefit_type IN ('NONE', 'FIXED', 'PERCENTAGE', 'BONUS')),
    maturity_benefit_value REAL NOT NULL DEFAULT 0.0 CHECK(maturity_benefit_value >= 0),
    
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Customer Enrolled Saving Schemes Table
CREATE TABLE IF NOT EXISTS saving_schemes (
    id TEXT PRIMARY KEY,
    scheme_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. SCH-2026-000001
    
    customer_id TEXT NOT NULL REFERENCES customers(id),
    scheme_type_id TEXT NOT NULL REFERENCES saving_scheme_types(id),
    
    start_date TEXT NOT NULL DEFAULT (date('now')),
    maturity_date TEXT NOT NULL,
    
    installment_amount REAL NOT NULL CHECK(installment_amount > 0),
    total_installments INTEGER NOT NULL CHECK(total_installments > 0),
    
    paid_installments INTEGER NOT NULL DEFAULT 0 CHECK(paid_installments >= 0),
    paid_amount REAL NOT NULL DEFAULT 0.0 CHECK(paid_amount >= 0),
    maturity_amount REAL NOT NULL DEFAULT 0.0 CHECK(maturity_amount >= 0),
    
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'MATURED', 'COMPLETED', 'CANCELLED', 'DEFAULTED')),
    
    maturity_payout_date TEXT,
    maturity_notes TEXT,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Saving Scheme Installments Schedule Table
CREATE TABLE IF NOT EXISTS saving_scheme_installments (
    id TEXT PRIMARY KEY,
    saving_scheme_id TEXT NOT NULL REFERENCES saving_schemes(id) ON DELETE CASCADE,
    
    installment_number INTEGER NOT NULL CHECK(installment_number > 0),
    due_date TEXT NOT NULL,
    
    amount_due REAL NOT NULL CHECK(amount_due > 0),
    amount_paid REAL NOT NULL DEFAULT 0.0 CHECK(amount_paid >= 0),
    
    payment_date TEXT,
    payment_mode TEXT CHECK(payment_mode IN ('CASH', 'CARD', 'UPI', 'BANK', 'CREDIT') OR payment_mode IS NULL),
    reference_number TEXT,
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED')),
    finance_payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
    
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_girvi_loans_cust ON girvi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_num ON girvi_loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_status ON girvi_loans(status);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_dates ON girvi_loans(loan_date, due_date);

CREATE INDEX IF NOT EXISTS idx_girvi_items_loan ON girvi_loan_items(loan_id);
CREATE INDEX IF NOT EXISTS idx_girvi_items_status ON girvi_loan_items(status);
CREATE INDEX IF NOT EXISTS idx_girvi_items_tag ON girvi_loan_items(tag_no);

CREATE INDEX IF NOT EXISTS idx_girvi_payments_loan ON girvi_loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_girvi_payments_date ON girvi_loan_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_girvi_events_loan ON girvi_pledge_events(loan_id);

CREATE INDEX IF NOT EXISTS idx_saving_schemes_cust ON saving_schemes(customer_id);
CREATE INDEX IF NOT EXISTS idx_saving_schemes_type ON saving_schemes(scheme_type_id);
CREATE INDEX IF NOT EXISTS idx_saving_schemes_status ON saving_schemes(status);

CREATE INDEX IF NOT EXISTS idx_saving_inst_scheme ON saving_scheme_installments(saving_scheme_id);
CREATE INDEX IF NOT EXISTS idx_saving_inst_status ON saving_scheme_installments(status);
CREATE INDEX IF NOT EXISTS idx_saving_inst_due ON saving_scheme_installments(due_date);

-- Seed Initial Saving Scheme Types (Standard Indian Jewellery Gold Chits)
INSERT OR IGNORE INTO saving_scheme_types (id, name, code, duration_months, installment_amount, maturity_benefit_type, maturity_benefit_value, description, is_active)
VALUES 
    ('sst-gold-11plus1-5k', 'Swarna 11+1 Bonus Plan (₹5,000/mo)', 'SWARNA-5K', 11, 5000.0, 'BONUS', 1.0, 'Pay 11 monthly installments of ₹5,000; the shop contributes the 12th installment as bonus upon jewellery purchase.', 1),
    ('sst-gold-11plus1-2k', 'Swarna 11+1 Mini Plan (₹2,000/mo)', 'SWARNA-2K', 11, 2000.0, 'BONUS', 1.0, 'Pay 11 monthly installments of ₹2,000; 12th installment free as redemption bonus.', 1),
    ('sst-dhanvarsha-10k', 'Dhanvarsha Gold Saver (₹10,000/mo)', 'DHAN-10K', 12, 10000.0, 'PERCENTAGE', 8.5, '12-month wealth saver with 8.5% total bonus benefit on accumulated gold value at maturity.', 1);
