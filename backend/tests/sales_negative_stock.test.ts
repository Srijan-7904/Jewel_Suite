import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { getDb } from '../src/database/connection/db.js';
import { salesService } from '../src/services/sales.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { stockRepository } from '../src/repositories/stock.repository.js';
import { stockMovementRepository } from '../src/repositories/stock_movement.repository.js';
import { reportsService } from '../src/services/reports.service.js';

describe('Jewel Suite: Tally-style Negative Stock & Un-inwarded Counter Sales', () => {
  let testDb: DatabaseType;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    customerRepository.create({
      name: 'Sunil Verma',
      phone: '9876543210',
      customer_type: 'RETAIL',
      address: 'Shop 4, Market Road',
    });
  });

  it('allows counter sale of an item not in stock, creating a negative stock movement and auto-mapped product', () => {
    const db = getDb();
    const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
    const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
    const p22k = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

    // 1. Create a sale draft for an item that does NOT exist in stock_items
    const draft = salesService.createDraft({
      customer_id: customer.id,
      invoice_date: '2026-11-10',
      items: [
        {
          item_name: 'Custom Antique Mangalsutra',
          metal_id: gold.id,
          purity_id: p22k.id,
          gross_weight: 15.5,
          less_weight: 0.5,
          tunch_percent: 91.67,
          rate_per_gram: 7200,
          wastage_percent: 4.0,
          making_charge: 1200,
        },
      ],
      payments: [
        {
          payment_mode: 'CASH',
          amount: 50000,
        },
      ],
    });

    expect(draft.id).toBeDefined();
    expect(draft.items[0].net_weight).toBe(15.0);

    // 2. Finalize sale - must NOT fail on foreign keys and must record negative stock
    const finalized = salesService.finalizeSale(draft.id);
    expect(finalized.status).toBe('FINALIZED');

    // 3. Verify that stock item was created with acquisition_type NEGATIVE_STOCK and valid product_id
    const soldItem = finalized.items[0];
    expect(soldItem.stock_item_id).toBeTruthy();

    const stockItem = stockRepository.findById(soldItem.stock_item_id!);
    expect(stockItem).toBeDefined();
    expect(stockItem?.acquisition_type).toBe('NEGATIVE_STOCK');
    expect(stockItem?.status).toBe('SOLD');
    expect(stockItem?.product_id).toBeTruthy();

    // Verify foreign key integrity: product exists in products table
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(stockItem!.product_id) as any;
    expect(product).toBeDefined();
    expect(product.name).toBe('Custom Antique Mangalsutra');

    // 4. Verify stock movement was recorded with quantity -1 and SALE_OUT
    const movements = stockMovementRepository.findByStockItemId(stockItem!.id);
    expect(movements.length).toBeGreaterThanOrEqual(1);
    const saleMovement = movements.find((m) => m.movement_type === 'SALE_OUT');
    expect(saleMovement).toBeDefined();
    expect(saleMovement?.quantity).toBe(-1);
    expect(saleMovement?.reference_type).toBe('SALES_INVOICE');
    expect(saleMovement?.reference_id).toBe(finalized.id);

    // 5. Verify reports reflect the sale
    const reportData = reportsService.getStockValuationReport();
    expect(reportData).toBeDefined();
  });
});
