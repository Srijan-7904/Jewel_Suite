import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';

import { purchaseService } from '../src/services/purchase.service.js';
import { rateService } from '../src/services/rate.service.js';
import { supplierRepository } from '../src/repositories/supplier.repository.js';
import { productRepository } from '../src/repositories/product.repository.js';
import { metalRepository } from '../src/repositories/metal.repository.js';
import { stockRepository } from '../src/repositories/stock.repository.js';
import { stockMovementRepository } from '../src/repositories/stock_movement.repository.js';
import { purchaseRepository } from '../src/repositories/purchase.repository.js';
import { MovementType, StockStatus } from '../src/domain/stockStatus.js';
import { ConflictError, BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite Part 5: Purchase Billing & Stock Inward Domain Tests', () => {
  let testDb: DatabaseType;
  let supplierId: string;
  let productId: string;
  let goldId: string;
  let p22kId: string;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    // Create a testing supplier
    const supplier = supplierRepository.create({
      supplier_code: 'SUP-ZAVERI',
      name: 'Zaveri Bullion & Ornaments',
      phone: '9820011223',
      gstin: '27AAAAA0000A1Z5',
    });
    supplierId = supplier.id;

    // Get masters
    const products = productRepository.find({ pageSize: 1 });
    productId = products.items[0].id;

    const metals = metalRepository.getMetals();
    const gold = metals.find((m) => m.code === 'GOLD')!;
    goldId = gold.id;

    const purities = metalRepository.getPuritiesByMetal(gold.id);
    const p22k = purities.find((p) => p.code === '22K')!;
    p22kId = p22k.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  describe('Draft Purchase Lifecycle (Section 6, 34, 35, 48)', () => {
    it('should create a draft purchase bill with sequential purchase number', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        supplier_invoice_number: 'INV-ZAV-889',
        discount_amount: 1000.0,
        gst_rate: 3.0,
        notes: 'Testing draft purchase order',
      });

      expect(draft.id).toBeDefined();
      expect(draft.purchase_number).toMatch(/^PUR-\d{4}-\d{6}$/);
      expect(draft.status).toBe('DRAFT');
      expect(draft.supplier_name).toBe('Zaveri Bullion & Ornaments');
      expect(draft.items.length).toBe(0);
      expect(draft.grand_total).toBe(0);
    });

    it('should add and remove items from draft purchase and update totals', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
      });

      // Add item 1
      const withItem = purchaseService.addItem(draft.id, {
        product_id: productId,
        metal_id: goldId,
        purity_id: p22kId,
        tag_no: 'PUR-TAG-001',
        gross_weight: 10.0,
        less_weight: 0.5,
        tunch_percent: 91.67,
        rate_per_gram: 7000.0,
        making_charge: 1000.0,
      });

      expect(withItem.items.length).toBe(1);
      expect(withItem.subtotal).toBeGreaterThan(0);
      expect(withItem.grand_total).toBeGreaterThan(0);

      // Remove item 1
      const itemId = withItem.items[0].id;
      const withoutItem = purchaseService.removeItem(draft.id, itemId);

      expect(withoutItem.items.length).toBe(0);
      expect(withoutItem.subtotal).toBe(0);
      expect(withoutItem.grand_total).toBe(0);
    });

    it('should allow cancelling a draft purchase bill', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
      });

      const cancelled = purchaseService.cancelPurchase(draft.id);
      expect(cancelled.status).toBe('CANCELLED');

      // Modifying cancelled purchase must fail
      expect(() => {
        purchaseService.updateDraft(draft.id, { notes: 'Attempted edit' });
      }).toThrow(BadRequestError);
    });
  });

  describe('Purchase Finalization & Stock Inwarding (Section 25, 29, 30, 31, 49)', () => {
    it('should finalize purchase, create stock_items (IN_STOCK), and create PURCHASE_IN movements', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        supplier_invoice_number: 'SUP-INV-101',
        gst_rate: 3.0,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'INWARD-G-101',
            gross_weight: 12.0,
            less_weight: 0.5,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
            making_charge: 1200.0,
            notes: 'Purchased bridal ring',
          },
        ],
        payments: [
          {
            payment_mode: 'CASH',
            amount: 50000.0,
          },
        ],
      });

      // Verify stock does NOT exist while in DRAFT
      expect(stockRepository.findByTag('INWARD-G-101')).toBeNull();

      // Finalize
      const finalized = purchaseService.finalizePurchase(draft.id);
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.amount_paid).toBe(50000.0);
      expect(finalized.balance_amount).toBe(finalized.grand_total - 50000.0);

      // Verify stock_items record was created
      const stock = stockRepository.findByTag('INWARD-G-101');
      expect(stock).not.toBeNull();
      expect(stock!.status).toBe(StockStatus.IN_STOCK);
      expect(stock!.acquisition_type).toBe('PURCHASE');
      expect(stock!.acquisition_reference).toBe(finalized.purchase_number);
      expect(stock!.net_weight).toBe(11.5);
      expect(stock!.fine_weight).toBe(10.5421);
      expect(stock!.rate_per_gram).toBe(7000.0);

      // Verify stock_movements record exists with PURCHASE_IN
      const movements = stockMovementRepository.findByStockItemId(stock!.id);
      expect(movements.length).toBe(1);
      expect(movements[0].movement_type).toBe(MovementType.PURCHASE_IN);
      expect(movements[0].reference_type).toBe('PURCHASE_BILL');
      expect(movements[0].reference_id).toBe(finalized.id);
      expect(movements[0].to_status).toBe(StockStatus.IN_STOCK);
    });

    it('should reject modifying an already finalized purchase bill (Section 35)', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'INWARD-G-102',
            gross_weight: 8.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
        ],
      });

      purchaseService.finalizePurchase(draft.id);

      // Attempt to modify finalized bill
      expect(() => {
        purchaseService.updateDraft(draft.id, { notes: 'Cannot update' });
      }).toThrow(BadRequestError);

      // Attempt to cancel finalized bill
      expect(() => {
        purchaseService.cancelPurchase(draft.id);
      }).toThrow(BadRequestError);
    });
  });

  describe('Duplicate Tag Protection (Section 27 & 50)', () => {
    it('should reject finalization if a tag already exists in inventory and rollback cleanly', () => {
      // 'GOLD-R-001' already exists from demo seed data
      const existing = stockRepository.findByTag('GOLD-R-001');
      expect(existing).not.toBeNull();

      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'GOLD-R-001', // Duplicate tag!
            gross_weight: 10.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
        ],
      });

      // Finalization must fail
      expect(() => {
        purchaseService.finalizePurchase(draft.id);
      }).toThrow(ConflictError);

      // Verify bill remains in DRAFT status
      const checkBill = purchaseRepository.findById(draft.id)!;
      expect(checkBill.status).toBe('DRAFT');
    });
  });

  describe('Atomic Rollback Safety (Section 26 & 51)', () => {
    it('should completely rollback all stock items, movements, and bill status if any stock creation fails', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'ROLLBACK-PUR-1',
            gross_weight: 10.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'ROLLBACK-PUR-2',
            gross_weight: 15.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
        ],
      });

      // Mock movement repository to simulate a hardware/disk error during item 2 movement insertion
      let callCount = 0;
      const originalCreateMovement = stockMovementRepository.create;
      stockMovementRepository.create = (data) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Simulated database write error on item 2 movement');
        }
        return originalCreateMovement.call(stockMovementRepository, data);
      };

      try {
        expect(() => {
          purchaseService.finalizePurchase(draft.id);
        }).toThrow('Simulated database write error');

        // Rollback check: Neither item 1 nor item 2 should exist in stock_items
        expect(stockRepository.findByTag('ROLLBACK-PUR-1')).toBeNull();
        expect(stockRepository.findByTag('ROLLBACK-PUR-2')).toBeNull();

        // Bill must still be in DRAFT state
        const bill = purchaseRepository.findById(draft.id)!;
        expect(bill.status).toBe('DRAFT');
      } finally {
        stockMovementRepository.create = originalCreateMovement;
      }
    });
  });

  describe('Historical Purchase Rate Preservation (Section 11 & 52)', () => {
    it('should preserve purchase rate and stock acquisition rate when metal rates change later', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'HISTORICAL-G-01',
            gross_weight: 10.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0, // Historical purchase rate
          },
        ],
      });

      const finalized = purchaseService.finalizePurchase(draft.id);
      expect(finalized.items[0].rate_per_gram).toBe(7000.0);

      // Now change live market rate to ₹7,500
      rateService.createRate({
        metal_id: goldId,
        purity_id: p22kId,
        rate: 7500.0,
        unit: 'gram',
      });

      // Verify purchase bill STILL shows ₹7,000
      const billAfterRateChange = purchaseRepository.findById(draft.id)!;
      expect(billAfterRateChange.items[0].rate_per_gram).toBe(7000.0);

      // Verify stock item STILL preserves historical acquisition rate ₹7,000
      const stockItem = stockRepository.findByTag('HISTORICAL-G-01')!;
      expect(stockItem.rate_per_gram).toBe(7000.0);

      // But current live market rate on stock item reflects ₹7,500
      expect(stockItem.current_rate).toBe(7500.0);
    });
  });

  describe('Multiple Items Inwarding (Section 28 & 53)', () => {
    it('should inward multiple items atomically (3 stock items + 3 movements + 1 finalized bill)', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'MULTI-G-01',
            gross_weight: 10.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'MULTI-G-02',
            gross_weight: 12.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'MULTI-G-03',
            gross_weight: 15.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
        ],
      });

      const finalized = purchaseService.finalizePurchase(draft.id);
      expect(finalized.status).toBe('FINALIZED');

      // Verify 3 stock items exist
      const s1 = stockRepository.findByTag('MULTI-G-01');
      const s2 = stockRepository.findByTag('MULTI-G-02');
      const s3 = stockRepository.findByTag('MULTI-G-03');
      expect(s1).not.toBeNull();
      expect(s2).not.toBeNull();
      expect(s3).not.toBeNull();

      // Verify movements
      expect(stockMovementRepository.findByStockItemId(s1!.id)[0].movement_type).toBe(MovementType.PURCHASE_IN);
      expect(stockMovementRepository.findByStockItemId(s2!.id)[0].movement_type).toBe(MovementType.PURCHASE_IN);
      expect(stockMovementRepository.findByStockItemId(s3!.id)[0].movement_type).toBe(MovementType.PURCHASE_IN);
    });
  });

  describe('Supplier Purchase History & Payable (Section 24, 37)', () => {
    it('should expose purchase history for a supplier and accurately calculate payable balance', () => {
      const draft = purchaseService.createDraft({
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            metal_id: goldId,
            purity_id: p22kId,
            tag_no: 'SUP-HIST-01',
            gross_weight: 10.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7000.0,
          },
        ],
        payments: [
          {
            payment_mode: 'BANK',
            amount: 25000.0,
          },
        ],
      });

      const finalized = purchaseService.finalizePurchase(draft.id);
      const supplierPurchases = purchaseService.getPurchasesBySupplier(supplierId);

      expect(supplierPurchases.length).toBeGreaterThanOrEqual(1);
      const matched = supplierPurchases.find((p) => p.id === finalized.id);
      expect(matched).toBeDefined();
      expect(matched!.amount_paid).toBe(25000.0);
      expect(matched!.balance_amount).toBe(finalized.grand_total - 25000.0);
    });
  });
});
