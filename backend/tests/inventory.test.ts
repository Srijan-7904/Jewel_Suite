import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';

import { inventoryService } from '../src/services/inventory.service.js';
import { rateService } from '../src/services/rate.service.js';
import { metalRepository } from '../src/repositories/metal.repository.js';
import { productRepository } from '../src/repositories/product.repository.js';
import { stockRepository } from '../src/repositories/stock.repository.js';
import { stockMovementRepository } from '../src/repositories/stock_movement.repository.js';
import { StockStatus, MovementType } from '../src/domain/stockStatus.js';
import { ConflictError, BadRequestError, NotFoundError } from '../src/utils/errors.js';

describe('Jewel Suite Part 3: Inventory Domain & Stock Service Tests', () => {
  let testDb: DatabaseType;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  describe('Stock Item Creation & Opening Movement', () => {
    it('should create opening stock item with auto-calculated weights and values', () => {
      const metals = metalRepository.getMetals();
      const gold = metals.find((m) => m.code === 'GOLD')!;
      const purities = metalRepository.getPuritiesByMetal(gold.id);
      const p22k = purities.find((p) => p.code === '22K')!;
      const products = productRepository.find({ pageSize: 1 });
      const product = products.items[0];

      const item = inventoryService.createStockItem({
        tag_no: 'TAG-TEST-100',
        product_id: product.id,
        metal_id: gold.id,
        purity_id: p22k.id,
        gross_weight: 12.0,
        less_weight: 0.5,
        tunch_percent: 91.67,
        rate_per_gram: 7200.0,
        making_charge: 1200.0,
        notes: 'Handcrafted testing ring',
      });

      expect(item.id).toBeDefined();
      expect(item.tag_no).toBe('TAG-TEST-100');
      expect(item.net_weight).toBe(11.5);
      expect(item.fine_weight).toBe(10.5421); // 11.5 * 91.67 / 100 = 10.54205 -> 10.5421
      expect(item.metal_value).toBe(75903.12); // 10.5421 * 7200 = 75903.12
      expect(item.status).toBe(StockStatus.IN_STOCK);

      // Verify exactly ONE opening movement was recorded
      const movements = inventoryService.getMovements(item.id);
      expect(movements.length).toBe(1);
      expect(movements[0].movement_type).toBe(MovementType.OPENING_STOCK);
      expect(movements[0].to_status).toBe(StockStatus.IN_STOCK);
      expect(movements[0].net_weight).toBe(11.5);
    });

    it('should enforce unique tag_no and reject duplicates with ConflictError', () => {
      const metals = metalRepository.getMetals();
      const gold = metals.find((m) => m.code === 'GOLD')!;
      const p22k = metalRepository.getPuritiesByMetal(gold.id).find((p) => p.code === '22K')!;
      const product = productRepository.find({ pageSize: 1 }).items[0];

      inventoryService.createStockItem({
        tag_no: 'DUP-TAG-99',
        product_id: product.id,
        metal_id: gold.id,
        purity_id: p22k.id,
        gross_weight: 5.0,
        less_weight: 0,
        tunch_percent: 91.67,
        rate_per_gram: 7000.0,
      });

      expect(() => {
        inventoryService.createStockItem({
          tag_no: 'DUP-TAG-99',
          product_id: product.id,
          metal_id: gold.id,
          purity_id: p22k.id,
          gross_weight: 6.0,
          less_weight: 0,
          tunch_percent: 91.67,
          rate_per_gram: 7000.0,
        });
      }).toThrow(ConflictError);
    });

    it('should reject invalid purity/metal mismatch', () => {
      const metals = metalRepository.getMetals();
      const gold = metals.find((m) => m.code === 'GOLD')!;
      const silver = metals.find((m) => m.code === 'SILVER')!;
      const silverPurity = metalRepository.getPuritiesByMetal(silver.id)[0];
      const product = productRepository.find({ pageSize: 1 }).items[0];

      expect(() => {
        inventoryService.createStockItem({
          tag_no: 'MISMATCH-TAG',
          product_id: product.id,
          metal_id: gold.id,
          purity_id: silverPurity.id, // Mismatch: Silver purity for Gold metal
          gross_weight: 10.0,
          less_weight: 0,
          tunch_percent: 92.5,
          rate_per_gram: 5000.0,
        });
      }).toThrow(BadRequestError);
    });
  });

  describe('Atomic Transaction Rollback (Section 16 & 37)', () => {
    it('should rollback stock item creation completely if movement creation fails', () => {
      const metals = metalRepository.getMetals();
      const gold = metals.find((m) => m.code === 'GOLD')!;
      const p22k = metalRepository.getPuritiesByMetal(gold.id).find((p) => p.code === '22K')!;
      const product = productRepository.find({ pageSize: 1 }).items[0];

      // Simulate a failure during movement insertion by mocking repository
      const originalCreate = stockMovementRepository.create;
      stockMovementRepository.create = () => {
        throw new Error('Simulated disk failure during movement insertion');
      };

      try {
        expect(() => {
          inventoryService.createStockItem({
            tag_no: 'ROLLBACK-TAG-1',
            product_id: product.id,
            metal_id: gold.id,
            purity_id: p22k.id,
            gross_weight: 15.0,
            less_weight: 0,
            tunch_percent: 91.67,
            rate_per_gram: 7200.0,
          });
        }).toThrow('Simulated disk failure');

        // Verify stock item does NOT exist in database after rollback
        const found = stockRepository.findByTag('ROLLBACK-TAG-1');
        expect(found).toBeNull();
      } finally {
        stockMovementRepository.create = originalCreate;
      }
    });
  });

  describe('Stock Status Transitions & Movements (Section 11, 14, 17)', () => {
    it('should allow valid transitions (IN_STOCK -> REPAIR -> IN_STOCK) and record audit movements', () => {
      const item = stockRepository.findByTag('GOLD-R-001')!;
      expect(item.status).toBe(StockStatus.IN_STOCK);

      // 1. Transition to REPAIR
      const repairItem = inventoryService.changeStatus(item.id, {
        to_status: StockStatus.REPAIR,
        notes: 'Stone prong loose, sent for laser repair',
      });
      expect(repairItem.status).toBe(StockStatus.REPAIR);

      // 2. Return to IN_STOCK
      const restockedItem = inventoryService.changeStatus(item.id, {
        to_status: StockStatus.IN_STOCK,
        notes: 'Repaired by workshop and returned to inventory tray',
      });
      expect(restockedItem.status).toBe(StockStatus.IN_STOCK);

      // Check movements audit trail
      const movements = inventoryService.getMovements(item.id);
      expect(movements.length).toBe(3); // OPENING_STOCK + REPAIR_OUT + REPAIR_IN
      expect(movements[1].movement_type).toBe(MovementType.REPAIR_OUT);
      expect(movements[1].from_status).toBe(StockStatus.IN_STOCK);
      expect(movements[1].to_status).toBe(StockStatus.REPAIR);

      expect(movements[2].movement_type).toBe(MovementType.REPAIR_IN);
      expect(movements[2].from_status).toBe(StockStatus.REPAIR);
      expect(movements[2].to_status).toBe(StockStatus.IN_STOCK);
    });

    it('should allow sending to karigar (WITH_KARIGAR) and receiving back', () => {
      const item = stockRepository.findByTag('GOLD-B-003')!;

      inventoryService.changeStatus(item.id, {
        to_status: StockStatus.WITH_KARIGAR,
        notes: 'Dispatched for hand engraving',
      });

      const updated = stockRepository.findById(item.id)!;
      expect(updated.status).toBe(StockStatus.WITH_KARIGAR);

      inventoryService.changeStatus(item.id, {
        to_status: StockStatus.IN_STOCK,
        notes: 'Received back after engraving completed',
      });

      const restocked = stockRepository.findById(item.id)!;
      expect(restocked.status).toBe(StockStatus.IN_STOCK);
    });

    it('should block invalid status transitions (e.g. SOLD directly back to IN_STOCK)', () => {
      const item = stockRepository.findByTag('SILVER-B-001')!;

      // First transition to SOLD
      inventoryService.changeStatus(item.id, {
        to_status: StockStatus.SOLD,
        notes: 'Sold on retail invoice',
      });

      // Attempt invalid transition SOLD -> IN_STOCK directly
      expect(() => {
        inventoryService.changeStatus(item.id, {
          to_status: StockStatus.IN_STOCK,
          notes: 'Illegal revert attempt',
        });
      }).toThrow(BadRequestError);
    });
  });

  describe('Stock Valuation & Live Rate Dynamic Recalculation (Section 10, 28, 39)', () => {
    it('should calculate live stock valuation correctly from current active rates', () => {
      const valuation = inventoryService.getStockValuation();

      expect(valuation.total_items).toBeGreaterThanOrEqual(4);
      expect(valuation.total_gross_weight).toBeGreaterThan(0);
      expect(valuation.total_fine_weight).toBeGreaterThan(0);
      expect(valuation.total_current_valuation).toBeGreaterThan(0);

      // Verify grouped breakdown
      const goldGroup = valuation.groups.find((g) => g.metal_code === 'GOLD' && g.purity_code === '22K');
      expect(goldGroup).toBeDefined();
      expect(goldGroup!.item_count).toBe(3); // GOLD-R-001, GOLD-N-002, GOLD-B-003
      expect(goldGroup!.current_rate).toBe(7190.0);
    });

    it('should dynamically update valuation when metal rates change without rewriting historical acquisition rate', () => {
      const itemBefore = stockRepository.findByTag('GOLD-R-001')!;
      const originalAcquisitionRate = itemBefore.rate_per_gram;
      const originalMetalValue = itemBefore.metal_value;

      // Update Gold 22K rate from 7190 to 7500
      const metals = metalRepository.getMetals();
      const gold = metals.find((m) => m.code === 'GOLD')!;
      const p22k = metalRepository.getPuritiesByMetal(gold.id).find((p) => p.code === '22K')!;

      rateService.createRate({
        metal_id: gold.id,
        purity_id: p22k.id,
        rate: 7500.0,
        unit: 'gram',
      });

      // Item's historical acquisition rate and metal value MUST remain unchanged
      const itemAfter = stockRepository.findByTag('GOLD-R-001')!;
      expect(itemAfter.rate_per_gram).toBe(originalAcquisitionRate);
      expect(itemAfter.metal_value).toBe(originalMetalValue);

      // But current valuation must reflect the new 7500 rate
      expect(itemAfter.current_rate).toBe(7500.0);
      expect(itemAfter.current_valuation).toBe(Math.round(itemAfter.fine_weight * 7500 * 100) / 100);

      // Global valuation response also reflects the updated rate
      const newValuation = inventoryService.getStockValuation();
      const goldGroup = newValuation.groups.find((g) => g.metal_code === 'GOLD' && g.purity_code === '22K')!;
      expect(goldGroup.current_rate).toBe(7500.0);
      expect(goldGroup.current_valuation).toBe(Math.round(goldGroup.fine_weight * 7500 * 100) / 100);
    });
  });
});
