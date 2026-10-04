-- 002_masters_schema.sql
-- Jewel Suite: Masters & Core Reference Schema

-- 1. Metals Master
CREATE TABLE IF NOT EXISTS metals (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Metal Purities Master
CREATE TABLE IF NOT EXISTS metal_purities (
    id TEXT PRIMARY KEY,
    metal_id TEXT NOT NULL REFERENCES metals(id) ON DELETE RESTRICT,
    code TEXT NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    tunch_percent REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(metal_id, code)
);

-- 3. Metal Rates & History
CREATE TABLE IF NOT EXISTS metal_rates (
    id TEXT PRIMARY KEY,
    metal_id TEXT NOT NULL REFERENCES metals(id) ON DELETE RESTRICT,
    purity_id TEXT NOT NULL REFERENCES metal_purities(id) ON DELETE RESTRICT,
    rate REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'gram',
    effective_from TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Categories Master
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Products / Item Definitions Master
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    product_code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    default_metal TEXT,
    default_purity TEXT,
    default_unit TEXT NOT NULL DEFAULT 'g',
    hsn_code TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Customers Master
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    customer_code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    phone TEXT,
    alternate_phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gstin TEXT,
    customer_type TEXT NOT NULL DEFAULT 'RETAIL', -- RETAIL, WHOLESALE, GIRVI_CLIENT
    opening_balance REAL NOT NULL DEFAULT 0.0,
    opening_balance_type TEXT NOT NULL DEFAULT 'DEBIT', -- DEBIT, CREDIT
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Suppliers Master
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    supplier_code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gstin TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Karigars Master
CREATE TABLE IF NOT EXISTS karigars (
    id TEXT PRIMARY KEY,
    karigar_code TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    specialization TEXT NOT NULL DEFAULT 'GOLD', -- GOLD, SILVER, DIAMOND, POLISHING, SETTING, REPAIR, OTHER
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for lightning-fast search & filtering
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(is_active);

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(is_active);

CREATE INDEX IF NOT EXISTS idx_karigars_code ON karigars(karigar_code);
CREATE INDEX IF NOT EXISTS idx_karigars_name ON karigars(name);
CREATE INDEX IF NOT EXISTS idx_karigars_specialization ON karigars(specialization);
CREATE INDEX IF NOT EXISTS idx_karigars_status ON karigars(is_active);

CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_purities_metal ON metal_purities(metal_id);
CREATE INDEX IF NOT EXISTS idx_metal_rates_lookup ON metal_rates(metal_id, purity_id, effective_from DESC);
