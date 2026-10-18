import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { exchangeService } from '../src/services/exchange.service.js';
import { salesService } from '../src/services/sales.service.js';
import { exchangeRepository } from '../src/repositories/exchange.repository.js';
import { salesRepository } from '../src/repositories/sales.repository.js';
import { stockRepository } from '../src/repositories/stock.repository.js';
import { stockMovementRepository } from '../src/repositories/stock_movement.repository.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { metalRepository } from '../src/repositories/metal.repository.js';
import { rateService } from '../src/services/rate.service.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { getDb } from '../src/database/connection/db.js';
import { BadRequestError, ConflictError } from '../src/utils/errors.js';
import { StockStatus, MovementType } from '../src/domain/stockStatus.js';

describe('Jewel Suite Part 6: Exchange & Retail Sale Integration Domain Tests', () => {
  let testDb: DatabaseType;
  let customerId: string;
  let goldMetalId: string;
  let purity22kId: string;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    // Create a demo customer
    const customer = customerRepository.create({
      name: 'Ramesh Patil',
      phone: '9876500001',
      city: 'Pune',
    });
    customerId = customer.id;

    // Retrieve Gold 22K metal & purity
    const metals = metalRepository.getMetals();
    const gold = metals.find((m) => m.code === 'GOLD')!;
    goldMetalId = gold.id;
    const purities = metalRepository.getPuritiesByMetal(gold.id);
    const p22k = purities.find((p) => p.code === '22K')!;
    purity22kId = p22k.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
  });

  describe('Exchange Lifecycle & Standalone Inward (Section 1-17, 34-39)', () => {
    it('creates an exchange draft with unique number format EX-YYYY-000001', () => {
      const draft = exchangeService.createDraft({
        customer_id: customerId,
        exchange_date: '2026-10-04',
        items: [
          {
            source_type: 'CUSTOMER_JEWELLERY',
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Old Gold Mangalsutra',
            tag_no: 'EX-TEST-001',
            gross_weight: 15.5,
            less_weight: 0.5,
            tunch_percent: 91.67,
            exchange_rate: 7000.0,
            deduction_percent: 2.0,
          },
        ],
      });

      expect(draft.id).toBeDefined();
      expect(draft.exchange_number).toMatch(/^EX-\d{4}-\d{6}$/);
      expect(draft.status).toBe('DRAFT');
      expect(draft.items.length).toBe(1);

      const item = draft.items[0];
      expect(item.net_weight).toBe(15.0);
      expect(item.fine_weight).toBe(13.7505);
      expect(item.metal_value).toBe(96253.5);
      expect(item.deduction_percent).toBe(2.0);
      expect(item.deduction_amount).toBe(1925.07);
      expect(item.exchange_value).toBe(94328.43);
      expect(draft.total_exchange_value).toBe(94328.43);
    });

    it('updates draft metadata and recalculates totals upon adding/removing items', () => {
      const draft = exchangeService.createDraft({
        customer_id: customerId,
        notes: 'Initial draft note',
      });

      // Add first item
      const withItem1 = exchangeService.addItem(draft.id, {
        source_type: 'LOOSE_METAL',
        metal_id: goldMetalId,
        purity_id: purity22kId,
        item_name: 'Scrap Gold Ring',
        tag_no: 'EX-SCRAP-001',
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 75.0, // 18K
        exchange_rate: 7000.0,
      });

      expect(withItem1.items.length).toBe(1);
      expect(withItem1.total_exchange_value).toBe(52500.0); // 10g * 75% * 7000

      // Add second item
      const withItem2 = exchangeService.addItem(draft.id, {
        source_type: 'CUSTOMER_JEWELLERY',
        metal_id: goldMetalId,
        purity_id: purity22kId,
        item_name: 'Old Chain',
        tag_no: 'EX-SCRAP-002',
        gross_weight: 5.0,
        less_weight: 0.0,
        tunch_percent: 100.0,
        exchange_rate: 7000.0,
      });

      expect(withItem2.items.length).toBe(2);
      expect(withItem2.total_exchange_value).toBe(52500.0 + 35000.0); // 87500.0

      // Remove first item
      const afterRemove = exchangeService.removeItem(draft.id, withItem2.items[0].id);
      expect(afterRemove.items.length).toBe(1);
      expect(afterRemove.total_exchange_value).toBe(35000.0);
    });

    it('finalizes standalone exchange and inward stock with EXCHANGE_IN movements (Section 15, 17, 35)', () => {
      const draft = exchangeService.createDraft({
        customer_id: customerId,
        items: [
          {
            source_type: 'CUSTOMER_JEWELLERY',
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Old Gold Necklace',
            tag_no: 'EX-N-001',
            gross_weight: 20.0,
            less_weight: 0.0,
            tunch_percent: 91.67,
            exchange_rate: 7190.0,
          },
        ],
      });

      const finalized = exchangeService.finalizeExchange(draft.id);
      expect(finalized.status).toBe('FINALIZED');

      // 1. Verify stock item was created in inventory
      const stockItem = stockRepository.findByTag('EX-N-001');
      expect(stockItem).not.toBeNull();
      expect(stockItem!.status).toBe(StockStatus.IN_STOCK);
      expect(stockItem!.acquisition_type).toBe('EXCHANGE');
      expect(stockItem!.acquisition_reference).toBe(finalized.exchange_number);
      expect(stockItem!.net_weight).toBe(20.0);
      expect(stockItem!.fine_weight).toBe(18.334);
      expect(stockItem!.rate_per_gram).toBe(7190.0);

      // 2. Verify stock movement was created
      const movements = stockMovementRepository.findByStockItemId(stockItem!.id);
      expect(movements.length).toBe(1);
      expect(movements[0].movement_type).toBe(MovementType.EXCHANGE_IN);
      expect(movements[0].to_status).toBe(StockStatus.IN_STOCK);
      expect(movements[0].reference_type).toBe('EXCHANGE');
      expect(movements[0].reference_id).toBe(finalized.id);

      // 3. Verify audit trail logged
      const logs = auditRepository.getRecent(20);
      expect(logs.some((l) => l.action === 'EXCHANGE_FINALIZED')).toBe(true);
      expect(logs.some((l) => l.action === 'EXCHANGE_STOCK_CREATED')).toBe(true);
    });

    it('enforces duplicate tag protection: fails finalization if tag exists in inventory (Section 27, 39)', () => {
      // Seed existing stock item with tag 'GOLD-R-001'
      const existing = stockRepository.findByTag('GOLD-R-001');
      expect(existing).not.toBeNull();

      // Create draft with same tag
      const draft = exchangeService.createDraft({
        customer_id: customerId,
        items: [
          {
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Conflicting Tag',
            tag_no: 'GOLD-R-001',
            gross_weight: 10.0,
            tunch_percent: 91.67,
            exchange_rate: 7000.0,
          },
        ],
      });

      // Finalization must fail
      expect(() => exchangeService.finalizeExchange(draft.id)).toThrow(ConflictError);

      // Verify draft status is untouched
      const refreshed = exchangeService.getExchangeDetails(draft.id);
      expect(refreshed.status).toBe('DRAFT');
    });

    it('performs atomic rollback: partial failure leaves NO stock items and NO movements (Section 40)', () => {
      const draft = exchangeService.createDraft({
        customer_id: customerId,
        items: [
          {
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Valid Old Item 1',
            tag_no: 'EX-RB-001',
            gross_weight: 10.0,
            tunch_percent: 91.67,
            exchange_rate: 7000.0,
          },
          {
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Valid Old Item 2',
            tag_no: 'EX-RB-002',
            gross_weight: 5.0,
            tunch_percent: 91.67,
            exchange_rate: 7000.0,
          },
        ],
      });

      // Force an error during the second stock creation by mocking or corrupting tag
      const db = getDb();
      // Temporarily insert a trigger or pre-existing duplicate that causes error during loop
      db.prepare(`
        CREATE TRIGGER test_force_abort
        BEFORE INSERT ON stock_items
        WHEN NEW.tag_no = 'EX-RB-002'
        BEGIN
          SELECT RAISE(FAIL, 'Simulated disk/database failure');
        END;
      `).run();

      expect(() => exchangeService.finalizeExchange(draft.id)).toThrow();

      // Clean up trigger
      db.prepare('DROP TRIGGER test_force_abort').run();

      // Verify 100% ROLLBACK
      expect(stockRepository.findByTag('EX-RB-001')).toBeNull();
      expect(stockRepository.findByTag('EX-RB-002')).toBeNull();

      const refreshed = exchangeService.getExchangeDetails(draft.id);
      expect(refreshed.status).toBe('DRAFT');
    });

    it('preserves historical exchange rate when market rates change (Section 31, 44)', () => {
      const draft = exchangeService.createDraft({
        customer_id: customerId,
        items: [
          {
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Historical Rate Item',
            tag_no: 'EX-HIST-01',
            gross_weight: 10.0,
            tunch_percent: 100.0,
            exchange_rate: 7000.0,
          },
        ],
      });

      const finalized = exchangeService.finalizeExchange(draft.id);
      expect(finalized.items[0].exchange_rate).toBe(7000.0);
      expect(finalized.total_exchange_value).toBe(70000.0);

      // Now update market metal rate to ₹7500/g
      rateService.createRate({
        metal_id: goldMetalId,
        purity_id: purity22kId,
        rate: 7500.0,
        unit: 'gram',
      });

      // Verify historical exchange remains ₹7000/g
      const refreshed = exchangeService.getExchangeDetails(finalized.id);
      expect(refreshed.items[0].exchange_rate).toBe(7000.0);
      expect(refreshed.total_exchange_value).toBe(70000.0);

      const stock = stockRepository.findByTag('EX-HIST-01');
      expect(stock!.rate_per_gram).toBe(7000.0);
    });

    it('allows cancelling a draft exchange but prevents modifying finalized exchange', () => {
      const draft = exchangeService.createDraft({ customer_id: customerId });
      const cancelled = exchangeService.cancelDraft(draft.id);
      expect(cancelled.status).toBe('CANCELLED');

      expect(() =>
        exchangeService.addItem(draft.id, {
          metal_id: goldMetalId,
          purity_id: purity22kId,
          item_name: 'Should Fail',
          gross_weight: 5.0,
          tunch_percent: 90,
          exchange_rate: 7000,
        })
      ).toThrow(BadRequestError);
    });
  });

  describe('Combined Sale + Exchange Atomicity (Section 11, 12, 19, 20, 29, 33, 43)', () => {
    it('finalizes sale with exchange in ONE atomic transaction with correct tax, payable, and movements', () => {
      // Find an in-stock jewellery item: GOLD-R-001 (value approx ~₹54705)
      const stockToSell = stockRepository.findByTag('GOLD-R-001');
      expect(stockToSell).not.toBeNull();
      expect(stockToSell!.status).toBe(StockStatus.IN_STOCK);

      // Create Sale invoice with new item + old gold exchange + payment tender
      // New Sale: 1 item @ ₹60,000
      // Old Gold: 1 item @ ₹25,000
      // Tax: GST 3% on ₹60,000 = ₹1,800 => Grand Total = ₹61,800
      // Exchange Deduction = ₹25,000 => Net Payable = ₹36,800
      // Cash payment = ₹36,800 => Balance = ₹0
      const invoice = salesService.createDraft({
        customer_id: customerId,
        items: [
          {
            stock_item_id: stockToSell!.id,
            tag_no: stockToSell!.tag_no,
            item_name: 'Gold Ring Classic',
            metal_id: goldMetalId,
            purity_id: purity22kId,
            gross_weight: 8.5,
            less_weight: 0.2,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
            making_charge: 6739.8, // metal_value = 53260.2, total = 60000.0
          },
        ],
        exchange_items: [
          {
            source_type: 'CUSTOMER_JEWELLERY',
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Customer Old Gold Bangle',
            tag_no: 'EX-SALE-001',
            gross_weight: 5.0,
            less_weight: 0.0,
            tunch_percent: 71.43, // fine wt approx 3.5715g
            exchange_rate: 7000.0, // metal val = 25000.5
            deduction_amount: 0.5, // round to 25000.0
          },
        ],
        payments: [
          {
            payment_mode: 'CASH',
            amount: 36800.0,
          },
        ],
      });

      expect(invoice.subtotal).toBe(60000.0);
      expect(invoice.gst_amount).toBe(1800.0);
      expect(invoice.grand_total).toBe(61800.0);
      expect(invoice.exchange_amount).toBe(25000.0);
      expect(invoice.net_payable).toBe(36800.0);
      expect(invoice.amount_paid).toBe(36800.0);
      expect(invoice.balance_amount).toBe(0.0);

      // FINALIZE SALE (owns the complete combined transaction)
      const finalized = salesService.finalizeSale(invoice.id);
      expect(finalized.status).toBe('FINALIZED');

      // 1. Verify old metal item was inwarded into inventory
      const inwardStock = stockRepository.findByTag('EX-SALE-001');
      expect(inwardStock).not.toBeNull();
      expect(inwardStock!.status).toBe(StockStatus.IN_STOCK);
      expect(inwardStock!.acquisition_type).toBe('EXCHANGE');

      const exMovements = stockMovementRepository.findByStockItemId(inwardStock!.id);
      expect(exMovements.length).toBe(1);
      expect(exMovements[0].movement_type).toBe(MovementType.EXCHANGE_IN);

      // 2. Verify sold item was updated to SOLD and SALE_OUT movement created
      const soldStock = stockRepository.findByTag('GOLD-R-001');
      expect(soldStock!.status).toBe(StockStatus.SOLD);

      const saleMovements = stockMovementRepository.findByStockItemId(soldStock!.id);
      expect(saleMovements.some((m) => m.movement_type === MovementType.SALE_OUT)).toBe(true);

      // 3. Verify linked exchange transaction is also finalized
      const linkedEx = exchangeRepository.findByInvoiceId(invoice.id);
      expect(linkedEx).not.toBeNull();
      expect(linkedEx!.status).toBe('FINALIZED');
    });

    it('rolls back both sale and exchange if a stock failure occurs during finalization (Section 29, 40)', () => {
      const stockToSell = stockRepository.findByTag('GOLD-N-002');
      expect(stockToSell!.status).toBe(StockStatus.IN_STOCK);

      const invoice = salesService.createDraft({
        customer_id: customerId,
        items: [
          {
            stock_item_id: stockToSell!.id,
            tag_no: stockToSell!.tag_no,
            item_name: 'Necklace',
            metal_id: goldMetalId,
            purity_id: purity22kId,
            gross_weight: 24.75,
            tunch_percent: 91.67,
            rate_per_gram: 7190,
          },
        ],
        exchange_items: [
          {
            metal_id: goldMetalId,
            purity_id: purity22kId,
            item_name: 'Failing Old Gold',
            tag_no: 'EX-FAIL-01',
            gross_weight: 5.0,
            tunch_percent: 90,
            exchange_rate: 7000,
          },
        ],
      });

      // Force failure during stock insertion
      const db = getDb();
      db.prepare(`
        CREATE TRIGGER test_force_sale_abort
        BEFORE INSERT ON stock_items
        WHEN NEW.tag_no = 'EX-FAIL-01'
        BEGIN
          SELECT RAISE(FAIL, 'Simulated failure inside combined sale+exchange transaction');
        END;
      `).run();

      expect(() => salesService.finalizeSale(invoice.id)).toThrow();

      db.prepare('DROP TRIGGER test_force_sale_abort').run();

      // Check rollbacks:
      // 1. Sold item must still be IN_STOCK
      const recheckedSold = stockRepository.findByTag('GOLD-N-002');
      expect(recheckedSold!.status).toBe(StockStatus.IN_STOCK);

      // 2. Old gold stock must NOT exist
      expect(stockRepository.findByTag('EX-FAIL-01')).toBeNull();

      // 3. Invoice remains DRAFT
      const recheckedInv = salesService.getInvoiceDetails(invoice.id);
      expect(recheckedInv.status).toBe('DRAFT');

      // 4. Linked exchange remains DRAFT
      const recheckedEx = exchangeRepository.findByInvoiceId(invoice.id);
      expect(recheckedEx!.status).toBe('DRAFT');
    });
  });
});
