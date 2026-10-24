-- 013_add_payment_source_details.sql
-- Jewel Suite: Add payer type, payer name, payer bank, received in, and party reference to sales_invoice_payments
-- Also add payer_name, payer_bank, and received_in to payments table for complete finance auditing.

ALTER TABLE sales_invoice_payments ADD COLUMN payer_type TEXT DEFAULT 'CUSTOMER';
ALTER TABLE sales_invoice_payments ADD COLUMN payer_name TEXT DEFAULT NULL;
ALTER TABLE sales_invoice_payments ADD COLUMN payer_bank TEXT DEFAULT NULL;
ALTER TABLE sales_invoice_payments ADD COLUMN received_in TEXT DEFAULT NULL;
ALTER TABLE sales_invoice_payments ADD COLUMN payer_party_id TEXT DEFAULT NULL;

ALTER TABLE payments ADD COLUMN payer_name TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN payer_bank TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN received_in TEXT DEFAULT NULL;

-- Indexes for payer querying and account audit reconciliation
CREATE INDEX IF NOT EXISTS idx_sales_payments_payer ON sales_invoice_payments(payer_type, payer_party_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_received_in ON sales_invoice_payments(received_in);
CREATE INDEX IF NOT EXISTS idx_payments_received_in ON payments(received_in);
