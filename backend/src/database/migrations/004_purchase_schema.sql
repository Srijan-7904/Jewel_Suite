-- 004_purchase_schema.sql
-- Jewel Suite: Purchase Billing & Stock Inward Schema

-- 1. Purchase Bills Table
CREATE TABLE IF NOT EXISTS purchase_bills (
    id TEXT PRIMARY KEY,
    purchase_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    
    purchase_date TEXT NOT NULL DEFAULT (date('now')),
    supplier_invoice_number TEXT,
    
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    taxable_amount REAL NOT NULL DEFAULT 0.0,
    
    gst_rate REAL NOT NULL DEFAULT 3.0,
    gst_amount REAL NOT NULL DEFAULT 0.0,
    
    round_off REAL NOT NULL DEFAULT 0.0,
    grand_total REAL NOT NULL DEFAULT 0.0,
    
    amount_paid REAL NOT NULL DEFAULT 0.0,
    balance_amount REAL NOT NULL DEFAULT 0.0,
    
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, FINALIZED, CANCELLED
    notes TEXT,
    
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Purchase Bill Items Table
CREATE TABLE IF NOT EXISTS purchase_bill_items (
    id TEXT PRIMARY KEY,
    purchase_bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    metal_id TEXT NOT NULL REFERENCES metals(id) ON DELETE RESTRICT,
    purity_id TEXT NOT NULL REFERENCES metal_purities(id) ON DELETE RESTRICT,
    
    tag_no TEXT NOT NULL COLLATE NOCASE,
    item_name TEXT NOT NULL,
    
    gross_weight REAL NOT NULL,
    less_weight REAL NOT NULL DEFAULT 0.0,
    net_weight REAL NOT NULL,
    
    tunch_percent REAL NOT NULL,
    fine_weight REAL NOT NULL,
    
    wastage_percent REAL NOT NULL DEFAULT 0.0,
    making_charge REAL NOT NULL DEFAULT 0.0,
    
    rate_per_gram REAL NOT NULL,
    metal_value REAL NOT NULL,
    item_amount REAL NOT NULL,
    
    huid TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Purchase Bill Payments Table
CREATE TABLE IF NOT EXISTS purchase_bill_payments (
    id TEXT PRIMARY KEY,
    purchase_bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    
    payment_mode TEXT NOT NULL, -- CASH, CARD, UPI, BANK, CREDIT
    amount REAL NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for Fast Querying & Verification
CREATE INDEX IF NOT EXISTS idx_purchase_bills_number ON purchase_bills(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier ON purchase_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_status ON purchase_bills(status);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON purchase_bills(purchase_date);

CREATE INDEX IF NOT EXISTS idx_purchase_items_bill ON purchase_bill_items(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_tag ON purchase_bill_items(tag_no);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_bill ON purchase_bill_payments(purchase_bill_id);
