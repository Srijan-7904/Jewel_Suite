import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { repairService } from '../src/services/repair.service.js';
import { repairRepository } from '../src/repositories/repair.repository.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { karigarRepository } from '../src/repositories/karigar.repository.js';
import { stockRepository } from '../src/repositories/stock.repository.js';
import { stockMovementRepository } from '../src/repositories/stock_movement.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { StockStatus, MovementType } from '../src/domain/stockStatus.js';
import { RepairStatus, RepairOwnership } from '../src/domain/workshopStatus.js';

describe('Jewel Suite Part 7: Repair Management Domain Tests', () => {
  let testDb: DatabaseType;
  let customerId: string;
  let karigarId: string;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    const customer = customerRepository.create({
      name: 'Sunita Joshi',
      phone: '9820011223',
    });
    customerId = customer.id;

    const karigar = karigarRepository.create({
      name: 'Deepak Artisan',
      phone: '9820099887',
      specialization: 'Laser Soldering',
    });
    karigarId = karigar.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  it('customer-owned repair intake does NOT create or pollute shop stock (Section 28, 53)', () => {
    const stockCountBefore = stockRepository.count();

    const repair = repairService.createRepair({
      customer_id: customerId,
      ownership: 'CUSTOMER_OWNED',
      item_description: 'Antique Gold Bangle (Grandmother heirloom)',
      problem_description: 'Lock clasp broken and needs re-hinging',
      gross_weight: 18.5,
      net_weight: 18.5,
      estimated_cost: 650.0,
      priority: 'HIGH',
    });

    expect(repair.id).toBeDefined();
    expect(repair.repair_number).toMatch(/^REP-\d{4}-\d{6}$/);
    expect(repair.ownership).toBe(RepairOwnership.CUSTOMER_OWNED);
    expect(repair.status).toBe(RepairStatus.RECEIVED);

    // CRITICAL: Shop stock count MUST remain strictly unchanged!
    const stockCountAfter = stockRepository.count();
    expect(stockCountAfter).toBe(stockCountBefore);
  });

  it('shop-owned repair transitions stock status to REPAIR and logs REPAIR_OUT movement (Section 26, 38)', () => {
    const stock = stockRepository.findByTag('GOLD-R-001')!;
    expect(stock.status).toBe(StockStatus.IN_STOCK);

    const repair = repairService.createRepair({
      stock_item_id: stock.id,
      ownership: 'SHOP_OWNED',
      item_description: 'Classic Ring Solitaire',
      problem_description: 'Prong loose, diamond shake',
      estimated_cost: 300.0,
    });

    expect(repair.ownership).toBe(RepairOwnership.SHOP_OWNED);

    // Verify stock status updated to REPAIR
    const stockUpdated = stockRepository.findById(stock.id)!;
    expect(stockUpdated.status).toBe(StockStatus.REPAIR);

    // Verify REPAIR_OUT movement logged
    const movements = stockMovementRepository.findByStockItemId(stock.id);
    const repairOut = movements.find((m) => m.movement_type === MovementType.REPAIR_OUT);
    expect(repairOut).toBeDefined();
    expect(repairOut!.from_status).toBe(StockStatus.IN_STOCK);
    expect(repairOut!.to_status).toBe(StockStatus.REPAIR);
  });

  it('progresses repair workflow: RECEIVED -> ASSIGNED -> IN_REPAIR -> READY -> DELIVERED (Section 27, 29)', () => {
    const stock = stockRepository.findByTag('GOLD-B-003')!;

    // 1. Intake
    const repair = repairService.createRepair({
      stock_item_id: stock.id,
      ownership: 'SHOP_OWNED',
      item_description: 'Gold Bangle kada',
      problem_description: 'Scratch buffing & rhodium dip',
      estimated_cost: 500.0,
    });
    expect(repair.status).toBe(RepairStatus.RECEIVED);

    // 2. Assign to Karigar
    const assigned = repairService.assignRepair(repair.id, karigarId);
    expect(assigned.status).toBe(RepairStatus.ASSIGNED);
    expect(assigned.karigar_id).toBe(karigarId);

    // 3. Start work
    const started = repairService.startRepair(repair.id);
    expect(started.status).toBe(RepairStatus.IN_REPAIR);

    // 4. Complete work
    const completed = repairService.completeRepair(repair.id, 450.0, 'Rhodium dipped successfully');
    expect(completed.status).toBe(RepairStatus.READY);
    expect(completed.actual_cost).toBe(450.0);

    // 5. Deliver repair (returns shop-owned stock to IN_STOCK with REPAIR_IN movement)
    const delivered = repairService.deliverRepair(repair.id);
    expect(delivered.status).toBe(RepairStatus.DELIVERED);
    expect(delivered.delivered_date).toBeDefined();

    // Verify stock item is back in IN_STOCK
    const stockRestored = stockRepository.findById(stock.id)!;
    expect(stockRestored.status).toBe(StockStatus.IN_STOCK);

    const movements = stockMovementRepository.findByStockItemId(stock.id);
    const repairIn = movements.find((m) => m.movement_type === MovementType.REPAIR_IN);
    expect(repairIn).toBeDefined();
    expect(repairIn!.from_status).toBe(StockStatus.REPAIR);
    expect(repairIn!.to_status).toBe(StockStatus.IN_STOCK);
  });

  it('cancels a repair order and restores shop inventory if needed (Section 44)', () => {
    const stock = stockRepository.findByTag('SILVER-B-001')!;

    const repair = repairService.createRepair({
      stock_item_id: stock.id,
      ownership: 'SHOP_OWNED',
      item_description: 'Silver Bracelet',
      problem_description: 'Broken link',
    });

    const cancelled = repairService.cancelRepair(repair.id);
    expect(cancelled.status).toBe(RepairStatus.CANCELLED);

    const stockRestored = stockRepository.findById(stock.id)!;
    expect(stockRestored.status).toBe(StockStatus.IN_STOCK);
  });
});
