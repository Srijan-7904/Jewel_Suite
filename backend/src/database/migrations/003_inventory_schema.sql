-- 003_inventory_schema.sql
-- Jewel Suite: Jewellery Inventory & Stock Movements Schema

-- 1. Stock Items Table
-- Tracks individual physical jewellery items with precise weights, purity, tunch, and commercial acquisition data.
CREATE TABLE IF NOT EXISTS stock_items (
    id TEXT PRIMARY KEY,
    tag_no TEXT UNIQUE NOT NULL COLLATE NOCASE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    metal_id TEXT NOT NULL REFERENCES metals(id) ON DELETE RESTRICT,
    purity_id TEXT NOT NULL REFERENCES metal_purities(id) ON DELETE RESTRICT,
    
    gross_weight REAL NOT NULL,
    less_weight REAL NOT NULL DEFAULT 0.0,
    net_weight REAL NOT NULL,
    
    tunch_percent REAL NOT NULL,
    fine_weight REAL NOT NULL,
    
    wastage_percent REAL NOT NULL DEFAULT 0.0,
    making_charge REAL NOT NULL DEFAULT 0.0,
    
    rate_per_gram REAL NOT NULL DEFAULT 0.0,
    metal_value REAL NOT NULL DEFAULT 0.0,
    current_value REAL,
    
    acquisition_type TEXT NOT NULL DEFAULT 'OPENING_STOCK', -- OPENING_STOCK, PURCHASE, EXCHANGE, WORKSHOP
    acquisition_reference TEXT,
    
    status TEXT NOT NULL DEFAULT 'IN_STOCK', -- IN_STOCK, SOLD, EXCHANGED, REPAIR, WITH_KARIGAR, RESERVED, RETURNED, ADJUSTED, DAMAGED
    huid TEXT, -- Hallmark Unique Identification Number
    notes TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Stock Movements Table
-- Immutable audit log for every change of location, status, or lifecycle event of a physical jewellery item.
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    
    movement_type TEXT NOT NULL, -- OPENING_STOCK, PURCHASE_IN, SALE_OUT, EXCHANGE_IN, EXCHANGE_OUT, REPAIR_OUT, REPAIR_IN, KARIGAR_ISSUE, KARIGAR_RETURN, RETURN_IN, ADJUSTMENT_IN, ADJUSTMENT_OUT
    
    reference_type TEXT, -- e.g. INVENTORY_OPENING, MANUAL_ADJUSTMENT, INVOICE, KARIGAR_JOB
    reference_id TEXT,
    
    from_status TEXT,
    to_status TEXT NOT NULL,
    
    quantity INTEGER NOT NULL DEFAULT 1,
    gross_weight REAL NOT NULL,
    net_weight REAL NOT NULL,
    fine_weight REAL NOT NULL,
    
    notes TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_stock_items_tag ON stock_items(tag_no);
CREATE INDEX IF NOT EXISTS idx_stock_items_status ON stock_items(status);
CREATE INDEX IF NOT EXISTS idx_stock_items_product ON stock_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_metal ON stock_items(metal_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_purity ON stock_items(purity_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_created ON stock_items(created_at);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
