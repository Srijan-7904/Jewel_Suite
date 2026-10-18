-- 009_reports_indexes.sql
-- Jewel Suite: Indexes for Reports Aggregation & Performance

CREATE INDEX IF NOT EXISTS idx_sales_invoices_date_status ON sales_invoices(invoice_date, status);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date_status ON purchase_bills(purchase_date, status);
CREATE INDEX IF NOT EXISTS idx_stock_items_status_metal ON stock_items(status, metal_id, purity_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date_type ON stock_movements(created_at, movement_type);
CREATE INDEX IF NOT EXISTS idx_girvi_loans_due_status ON girvi_loans(due_date, status);
CREATE INDEX IF NOT EXISTS idx_saving_installments_due_status ON saving_scheme_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_date_mode ON payments(payment_date, payment_mode);
