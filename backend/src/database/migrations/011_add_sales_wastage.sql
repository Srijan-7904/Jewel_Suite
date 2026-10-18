-- 011_add_sales_wastage.sql
-- Jewel Suite: Add wastage calculation columns to sales_invoice_items and purchase_bill_items
-- Preserves existing finalized historical invoices with 0.0 defaults.

ALTER TABLE sales_invoice_items ADD COLUMN wastage_percent REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sales_invoice_items ADD COLUMN wastage_weight REAL NOT NULL DEFAULT 0.0;
ALTER TABLE sales_invoice_items ADD COLUMN wastage_amount REAL NOT NULL DEFAULT 0.0;

ALTER TABLE purchase_bill_items ADD COLUMN wastage_weight REAL NOT NULL DEFAULT 0.0;
ALTER TABLE purchase_bill_items ADD COLUMN wastage_amount REAL NOT NULL DEFAULT 0.0;
