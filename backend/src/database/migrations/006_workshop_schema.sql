-- 006_workshop_schema.sql
-- Jewel Suite: Workshop, Karigar Jobs & Repair Management Schema

-- 1. Workshop Jobs Table
CREATE TABLE IF NOT EXISTS workshop_jobs (
    id TEXT PRIMARY KEY,
    job_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. JOB-2026-000001
    job_type TEXT NOT NULL, -- REPAIR, MANUFACTURING, POLISHING, SETTING, ALTERATION, OTHER
    
    karigar_id TEXT NOT NULL REFERENCES karigars(id) ON DELETE RESTRICT,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, READY_TO_ISSUE, ISSUED, IN_PROGRESS, RETURNED, QUALITY_CHECK, COMPLETED, CANCELLED
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    
    issue_date TEXT,
    expected_return_date TEXT,
    actual_return_date TEXT,
    
    description TEXT NOT NULL,
    instructions TEXT,
    
    estimated_labour REAL NOT NULL DEFAULT 0.0,
    actual_labour REAL NOT NULL DEFAULT 0.0,
    
    estimated_weight REAL NOT NULL DEFAULT 0.0,
    returned_weight REAL NOT NULL DEFAULT 0.0,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Workshop Job Items Table (Track individual jewellery items issued & returned)
CREATE TABLE IF NOT EXISTS workshop_job_items (
    id TEXT PRIMARY KEY,
    workshop_job_id TEXT NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
    stock_item_id TEXT REFERENCES stock_items(id) ON DELETE RESTRICT,
    
    tag_no TEXT NOT NULL COLLATE NOCASE,
    
    issue_gross_weight REAL NOT NULL,
    issue_less_weight REAL NOT NULL DEFAULT 0.0,
    issue_net_weight REAL NOT NULL,
    issue_fine_weight REAL NOT NULL,
    
    return_gross_weight REAL,
    return_less_weight REAL,
    return_net_weight REAL,
    return_fine_weight REAL,
    
    weight_difference REAL NOT NULL DEFAULT 0.0, -- issue_net_weight - return_net_weight
    
    material_issued TEXT,
    material_returned TEXT,
    
    labour_charge REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Repairs Table
CREATE TABLE IF NOT EXISTS repairs (
    id TEXT PRIMARY KEY,
    repair_number TEXT UNIQUE NOT NULL COLLATE NOCASE, -- e.g. REP-2026-000001
    
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    stock_item_id TEXT REFERENCES stock_items(id) ON DELETE RESTRICT,
    karigar_id TEXT REFERENCES karigars(id) ON DELETE SET NULL,
    
    ownership TEXT NOT NULL DEFAULT 'CUSTOMER_OWNED', -- CUSTOMER_OWNED, SHOP_OWNED
    item_description TEXT NOT NULL,
    
    metal_id TEXT REFERENCES metals(id) ON DELETE SET NULL,
    purity_id TEXT REFERENCES metal_purities(id) ON DELETE SET NULL,
    
    gross_weight REAL NOT NULL DEFAULT 0.0,
    net_weight REAL NOT NULL DEFAULT 0.0,
    
    problem_description TEXT NOT NULL,
    instructions TEXT,
    repair_type TEXT NOT NULL DEFAULT 'REPAIR',
    
    status TEXT NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, ASSIGNED, IN_REPAIR, READY, DELIVERED, CANCELLED
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    
    received_date TEXT NOT NULL DEFAULT (date('now')),
    expected_completion TEXT,
    delivered_date TEXT,
    
    estimated_cost REAL NOT NULL DEFAULT 0.0,
    actual_cost REAL NOT NULL DEFAULT 0.0,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_number ON workshop_jobs(job_number);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_karigar ON workshop_jobs(karigar_id);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_customer ON workshop_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_status ON workshop_jobs(status);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_type ON workshop_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_workshop_jobs_issue_date ON workshop_jobs(issue_date);

CREATE INDEX IF NOT EXISTS idx_workshop_items_job ON workshop_job_items(workshop_job_id);
CREATE INDEX IF NOT EXISTS idx_workshop_items_stock ON workshop_job_items(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_workshop_items_tag ON workshop_job_items(tag_no);

CREATE INDEX IF NOT EXISTS idx_repairs_number ON repairs(repair_number);
CREATE INDEX IF NOT EXISTS idx_repairs_customer ON repairs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_stock ON repairs(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_repairs_karigar ON repairs(karigar_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_received ON repairs(received_date);
