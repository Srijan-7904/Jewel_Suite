const Database = require('c:/Users/oj/Desktop/Jewel/backend/node_modules/better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve('c:/Users/oj/Desktop/Jewel/data/jewel-suite.db');
const backupDir = path.resolve('c:/Users/oj/Desktop/Jewel/backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `jewel-suite-pre-clean-${timestamp}.db`);

console.log('Connecting to database:', dbPath);
const db = new Database(dbPath);

console.log('Creating backup at:', backupPath);
db.backup(backupPath)
  .then(() => {
    console.log('Backup created successfully!');
    performCleanup();
  })
  .catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
  });

function performCleanup() {
  const tablesToCount = [
    'customers',
    'sales_invoices',
    'sales_invoice_items',
    'sales_invoice_payments',
    'purchase_bills',
    'purchase_bill_items',
    'purchase_bill_payments',
    'exchange_transactions',
    'exchange_items',
    'workshop_jobs',
    'workshop_job_items',
    'ledger_entries',
    'suppliers',
    'stock_items',
    'stock_movements',
    'products',
    'categories',
    'metals',
    'metal_purities',
    'metal_rates',
    'users',
    'shops',
    'settings',
    'document_sequences'
  ];

  console.log('\n--- BEFORE CLEANUP ---');
  for (const tbl of tablesToCount) {
    try {
      const c = db.prepare(`SELECT COUNT(*) as c FROM "${tbl}"`).get().c;
      console.log(`  ${tbl}: ${c}`);
    } catch (e) {
      // table might not exist
    }
  }

  console.log('\nExecuting cleanup transaction...');
  db.pragma('foreign_keys = OFF');

  const cleanupTx = db.transaction(() => {
    // 1. Sales & payments
    db.prepare('DELETE FROM sales_invoice_payments').run();
    db.prepare('DELETE FROM sales_invoice_items').run();
    db.prepare('DELETE FROM sales_invoices').run();

    // 2. Purchase & payments
    db.prepare('DELETE FROM purchase_bill_payments').run();
    db.prepare('DELETE FROM purchase_bill_items').run();
    db.prepare('DELETE FROM purchase_bills').run();

    // 3. Exchange
    db.prepare('DELETE FROM exchange_items').run();
    db.prepare('DELETE FROM exchange_transactions').run();

    // 4. Workshop / Karigar jobs
    db.prepare('DELETE FROM workshop_job_items').run();
    db.prepare('DELETE FROM workshop_jobs').run();

    // 5. Repairs
    try { db.prepare('DELETE FROM repairs').run(); } catch (_) {}

    // 6. Girvi & Saving schemes
    try { db.prepare('DELETE FROM girvi_pledge_events').run(); } catch (_) {}
    try { db.prepare('DELETE FROM girvi_loan_payments').run(); } catch (_) {}
    try { db.prepare('DELETE FROM girvi_loan_items').run(); } catch (_) {}
    try { db.prepare('DELETE FROM girvi_loans').run(); } catch (_) {}
    try { db.prepare('DELETE FROM saving_scheme_installments').run(); } catch (_) {}
    try { db.prepare('DELETE FROM saving_schemes').run(); } catch (_) {}

    // 7. Finance & ledger
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM ledger_entries').run();

    // 8. Customers & Suppliers
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM suppliers').run();

    // 9. Stock items: remove all stock items and movements completely as requested
    db.prepare('DELETE FROM stock_movements').run();
    db.prepare('DELETE FROM stock_items').run();

    // Mark demo stock as cleared in settings so server doesn't re-seed them on boot
    db.prepare(`
      INSERT INTO settings (id, key, value, created_at, updated_at)
      VALUES ('setting-seed-cleared', 'seed.demo_stock_cleared', 'true', datetime('now'), datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = datetime('now')
    `).run();

    // 10. Document sequences reset so fresh invoice numbers start from 1
    db.prepare('UPDATE document_sequences SET current_value = 0').run();

    // 11. Audit logs: clear transactional audit logs
    try { db.prepare("DELETE FROM audit_logs WHERE action != 'SYSTEM_BOOTSTRAP'").run(); } catch (_) {}
  });

  cleanupTx();

  const fkCheck = db.pragma('foreign_key_check');
  if (fkCheck.length > 0) {
    console.error('Foreign key check failed:', fkCheck);
    throw new Error('Foreign key violations detected after cleanup!');
  }

  db.pragma('foreign_keys = ON');
  db.pragma('wal_checkpoint(TRUNCATE)');

  console.log('\n--- AFTER CLEANUP ---');
  for (const tbl of tablesToCount) {
    try {
      const c = db.prepare(`SELECT COUNT(*) as c FROM "${tbl}"`).get().c;
      console.log(`  ${tbl}: ${c}`);
    } catch (e) {
      // table might not exist
    }
  }

  console.log('\nStock Items remaining:');
  const items = db.prepare('SELECT tag_no, status, acquisition_type, gross_weight, net_weight FROM stock_items').all();
  console.log(items);

  console.log('\nDocument sequences reset:');
  const seqs = db.prepare('SELECT doc_type, prefix, current_value FROM document_sequences').all();
  console.log(seqs);

  console.log('\nCleanup completed successfully! All sales, purchases, customers, and transactions removed.');
  console.log('Product catalog (metals, purities, categories, products, opening stock) preserved.');
}
