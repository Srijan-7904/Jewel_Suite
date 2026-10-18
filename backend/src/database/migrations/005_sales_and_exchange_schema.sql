-- 005_sales_and_exchange_schema.sql
-- Jewel Suite: Retail Sales Invoices & Old Gold / Metal Exchange Schema

-- 1. Sales Invoices Table
CREATE TABLE IF NOT EXISTS sales_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    invoice_date TEXT NOT NULL DEFAULT (date('now')),
    
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    taxable_amount REAL NOT NULL DEFAULT 0.0,
    
    gst_rate REAL NOT NULL DEFAULT 3.0,
    gst_amount REAL NOT NULL DEFAULT 0.0,
    
    round_off REAL NOT NULL DEFAULT 0.0,
    grand_total REAL NOT NULL DEFAULT 0.0, -- Gross invoice amount after tax
    
    exchange_amount REAL NOT NULL DEFAULT 0.0, -- Total value of old gold exchanged
    net_payable REAL NOT NULL DEFAULT 0.0,     -- grand_total - exchange_amount
    
    amount_paid REAL NOT NULL DEFAULT 0.0,
    balance_amount REAL NOT NULL DEFAULT 0.0,
    
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, FINALIZED, CANCELLED
    notes TEXT,
    
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Sales Invoice Items Table (New stock items sold to customer)
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id TEXT PRIMARY KEY,
    sales_invoice_id TEXT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    stock_item_id TEXT REFERENCES stock_items(id) ON DELETE RESTRICT,
    
    tag_no TEXT NOT NULL COLLATE NOCASE,
    item_name TEXT NOT NULL,
    metal_id TEXT NOT NULL REFERENCES metals(id) ON DELETE RESTRICT,
    purity_id TEXT NOT NULL REFERENCES metal_purities(id) ON DELETE RESTRICT,
    
    gross_weight REAL NOT NULL,
    less_weight REAL NOT NULL DEFAULT 0.0,
    net_weight REAL NOT NULL,
    
    tunch_percent REAL NOT NULL,
    fine_weight REAL NOT NULL,
    
    rate_per_gram REAL NOT NULL,
    metal_value REAL NOT NULL,
    making_charge REAL NOT NULL DEFAULT 0.0,
    item_amount REAL NOT NULL,
    
    huid TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Sales Invoice Payments Table
CREATE TABLE IF NOT EXISTS sales_invoice_payments (
    id TEXT PRIMARY KEY,
    sales_invoice_id TEXT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    
    payment_mode TEXT NOT NULL, -- CASH, CARD, UPI, BANK, CREDIT
    amount REAL NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Exchange Transactions Table (Old jewellery / scrap metal received from customer)
CREATE TABLE IF NOT EXISTS exchange_transactions (
    id TEXT PRIMARY KEY,
    exchange_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. EX-2026-000001
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_invoice_id TEXT REFERENCES sales_invoices(id) ON DELETE SET NULL,
    
    exchange_date TEXT NOT NULL DEFAULT (date('now')),
    
    total_gross_weight REAL NOT NULL DEFAULT 0.0,
    total_net_weight REAL NOT NULL DEFAULT 0.0,
    total_fine_weight REAL NOT NULL DEFAULT 0.0,
    total_metal_value REAL NOT NULL DEFAULT 0.0,
    total_deduction_amount REAL NOT NULL DEFAULT 0.0,
    total_exchange_value REAL NOT NULL DEFAULT 0.0,
    
    payout_amount REAL NOT NULL DEFAULT 0.0, -- For standalone exchange payouts if any
    
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, FINALIZED, CANCELLED
    notes TEXT,
    
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Exchange Items Table
CREATE TABLE IF NOT EXISTS exchange_items (
    id TEXT PRIMARY KEY,
    exchange_transaction_id TEXT NOT NULL REFERENCES exchange_transactions(id) ON DELETE CASCADE,
    
    source_type TEXT NOT NULL DEFAULT 'CUSTOMER_JEWELLERY', -- LOOSE_METAL, CUSTOMER_JEWELLERY
    stock_item_id TEXT REFERENCES stock_items(id) ON DELETE SET NULL,
    
    metal_id TEXT NOT NULL REFERENCES metals(id) ON DELETE RESTRICT,
    purity_id TEXT NOT NULL REFERENCES metal_purities(id) ON DELETE RESTRICT,
    product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
    
    item_name TEXT NOT NULL,
    tag_no TEXT NOT NULL COLLATE NOCASE,
    
    gross_weight REAL NOT NULL,
    less_weight REAL NOT NULL DEFAULT 0.0,
    net_weight REAL NOT NULL,
    
    tunch_percent REAL NOT NULL,
    fine_weight REAL NOT NULL,
    
    exchange_rate REAL NOT NULL,
    metal_value REAL NOT NULL,
    
    deduction_percent REAL NOT NULL DEFAULT 0.0,
    deduction_amount REAL NOT NULL DEFAULT 0.0,
    exchange_value REAL NOT NULL,
    
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoices_number ON sales_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_sales_items_invoice ON sales_invoice_items(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_tag ON sales_invoice_items(tag_no);
CREATE INDEX IF NOT EXISTS idx_sales_items_stock ON sales_invoice_items(stock_item_id);

CREATE INDEX IF NOT EXISTS idx_sales_payments_invoice ON sales_invoice_payments(sales_invoice_id);

CREATE INDEX IF NOT EXISTS idx_exchange_transactions_number ON exchange_transactions(exchange_number);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_customer ON exchange_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_invoice ON exchange_transactions(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_status ON exchange_transactions(status);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_date ON exchange_transactions(exchange_date);

CREATE INDEX IF NOT EXISTS idx_exchange_items_transaction ON exchange_items(exchange_transaction_id);
CREATE INDEX IF NOT EXISTS idx_exchange_items_tag ON exchange_items(tag_no);
CREATE INDEX IF NOT EXISTS idx_exchange_items_stock ON exchange_items(stock_item_id);
