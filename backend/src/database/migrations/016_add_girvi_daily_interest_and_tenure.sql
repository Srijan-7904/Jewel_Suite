-- 016_add_girvi_daily_interest_and_tenure.sql
-- Jewel Suite: Support Daily Interest Rate (DAILY_PERCENT e.g. 2%/Day), Net Disbursed / Paid Amount, Upfront Deductions, and Tenures (3D, 7D, 15D, 30D, 180D, 365D)

PRAGMA foreign_keys = OFF;

-- 0. Fix legacy typo in girvi_loan_items if it references 'purities' instead of 'metal_purities'
CREATE TABLE IF NOT EXISTS girvi_loan_items_new (
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

INSERT INTO girvi_loan_items_new SELECT * FROM girvi_loan_items;
DROP TABLE girvi_loan_items;
ALTER TABLE girvi_loan_items_new RENAME TO girvi_loan_items;

-- 1. Create new girvi_loans table with expanded interest_type and new fields
CREATE TABLE IF NOT EXISTS girvi_loans_new (
    id TEXT PRIMARY KEY,
    loan_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    
    loan_date TEXT NOT NULL DEFAULT (date('now')),
    due_date TEXT NOT NULL,
    
    principal_amount REAL NOT NULL CHECK(principal_amount > 0),
    interest_rate REAL NOT NULL CHECK(interest_rate >= 0),
    interest_type TEXT NOT NULL CHECK(interest_type IN ('DAILY_PERCENT', 'MONTHLY_PERCENT', 'ANNUAL_PERCENT', 'FLAT_AMOUNT')),
    
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
    disbursed_amount REAL,
    upfront_deduction REAL NOT NULL DEFAULT 0.0,
    tenure_days INTEGER,
    tenure_period TEXT,
    
    closure_date TEXT,
    closed_by TEXT REFERENCES users(id),
    closure_notes TEXT,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Migrate existing loans into new table
INSERT INTO girvi_loans_new (
    id, loan_number, customer_id, loan_date, due_date, principal_amount,
    interest_rate, interest_type, processing_fee, other_charges,
    total_interest, total_charges, total_repaid, outstanding_amount,
    status, ltv_percent, max_allowed_loan, is_overridden, override_reason,
    disbursement_date, disbursed_by, disbursed_amount, upfront_deduction, tenure_days, tenure_period,
    closure_date, closed_by, closure_notes, notes, created_by, created_at, updated_at
)
SELECT 
    id, loan_number, customer_id, loan_date, due_date, principal_amount,
    interest_rate, interest_type, processing_fee, other_charges,
    total_interest, total_charges, total_repaid, outstanding_amount,
    status, ltv_percent, max_allowed_loan, is_overridden, override_reason,
    disbursement_date, disbursed_by, principal_amount, 0.0, NULL, NULL,
    closure_date, closed_by, closure_notes, notes, created_by, created_at, updated_at
FROM girvi_loans;

-- 3. Drop old table and rename new
DROP TABLE girvi_loans;
ALTER TABLE girvi_loans_new RENAME TO girvi_loans;

-- 4. Recreate Indexes
CREATE INDEX IF NOT EXISTS idx_girvi_loans_number ON girvi_loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_customer ON girvi_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_status ON girvi_loans(status);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_dates ON girvi_loans(loan_date, due_date);

PRAGMA foreign_keys = ON;
