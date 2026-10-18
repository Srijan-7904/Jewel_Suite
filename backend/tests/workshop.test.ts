import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { workshopService } from '../src/services/workshop.service.js';
import { workshopRepository } from '../src/repositories/workshop.repository.js';
import { karigarRepository } from '../src/repositories/karigar.repository.js';
import { stockRepository } from '../src/repositories/stock.repository.js';
import { stockMovementRepository } from '../src/repositories/stock_movement.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { getDb } from '../src/database/connection/db.js';
import { BadRequestError, ConflictError } from '../src/utils/errors.js';
import { StockStatus, MovementType } from '../src/domain/stockStatus.js';
import { JobStatus } from '../src/domain/workshopStatus.js';

describe('Jewel Suite Part 7: Workshop & Karigar Jobs Domain Tests', () => {
  let testDb: DatabaseType;
  let karigarId: string;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    // Create demo karigar
    const karigar = karigarRepository.create({
      name: 'Rahul Goldsmith',
      phone: '9820055443',
      specialization: 'Stone Setting & Polishing',
    });
    karigarId = karigar.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  it('creates a workshop job in DRAFT status with unique number JOB-YYYY-000001 (Section 4, 8, 48)', () => {
    const job = workshopService.createJob({
      job_type: 'MANUFACTURING',
      karigar_id: karigarId,
      description: 'Manufacture 22K CZ Bridal Ring',
      priority: 'HIGH',
      estimated_labour: 1200.0,
      estimated_weight: 8.5,
      items: [
        {
          tag_no: 'GOLD-R-001',
          material_issued: 'Gold solder 0.2g',
        },
      ],
    });

    expect(job.id).toBeDefined();
    expect(job.job_number).toMatch(/^JOB-\d{4}-\d{6}$/);
    expect(job.status).toBe(JobStatus.DRAFT);
    expect(job.priority).toBe('HIGH');
    expect(job.items.length).toBe(1);

    const item = job.items[0];
    expect(item.tag_no).toBe('GOLD-R-001');
    expect(item.issue_gross_weight).toBe(8.5);
    expect(item.issue_net_weight).toBe(8.3);
    expect(item.material_issued).toBe('Gold solder 0.2g');
  });

  it('allows adding and removing stock items on a draft job', () => {
    const job = workshopService.createJob({
      job_type: 'POLISHING',
      karigar_id: karigarId,
      description: 'Polish Gold Bangles',
    });

    // Add first item
    const withItem = workshopService.addItem(job.id, {
      tag_no: 'GOLD-B-003',
    });
    expect(withItem.items.length).toBe(1);
    expect(withItem.items[0].tag_no).toBe('GOLD-B-003');

    // Remove item
    const afterRemove = workshopService.removeItem(job.id, withItem.items[0].id);
    expect(afterRemove.items.length).toBe(0);
  });

  it('issues job to Karigar: transitions stock to WITH_KARIGAR and creates KARIGAR_ISSUE movement (Section 14, 16, 49)', () => {
    const job = workshopService.createJob({
      job_type: 'REPAIR',
      karigar_id: karigarId,
      description: 'Resize ring and tighten stones',
      items: [
        {
          tag_no: 'GOLD-R-001',
        },
      ],
    });

    const issued = workshopService.issueJob(job.id);
    expect(issued.status).toBe(JobStatus.ISSUED);
    expect(issued.issue_date).toBeDefined();

    // 1. Verify stock item status updated to WITH_KARIGAR
    const stock = stockRepository.findByTag('GOLD-R-001');
    expect(stock!.status).toBe(StockStatus.WITH_KARIGAR);

    // 2. Verify KARIGAR_ISSUE movement created
    const movements = stockMovementRepository.findByStockItemId(stock!.id);
    const issueMove = movements.find((m) => m.movement_type === MovementType.KARIGAR_ISSUE);
    expect(issueMove).toBeDefined();
    expect(issueMove!.from_status).toBe(StockStatus.IN_STOCK);
    expect(issueMove!.to_status).toBe(StockStatus.WITH_KARIGAR);
    expect(issueMove!.reference_type).toBe('WORKSHOP_JOB');
    expect(issueMove!.reference_id).toBe(job.id);
  });

  it('enforces double-issue protection: cannot issue a stock item that is already WITH_KARIGAR (Section 46, 50)', () => {
    // Job 1 issues GOLD-R-001
    const job1 = workshopService.createJob({
      job_type: 'REPAIR',
      karigar_id: karigarId,
      description: 'Job 1',
      items: [{ tag_no: 'GOLD-R-001' }],
    });
    workshopService.issueJob(job1.id);

    // Job 2 attempts to issue GOLD-R-001
    expect(() =>
      workshopService.createJob({
        job_type: 'POLISHING',
        karigar_id: karigarId,
        description: 'Job 2 conflicting issue',
        items: [{ tag_no: 'GOLD-R-001' }],
      })
    ).toThrow(BadRequestError);
  });

  it('returns items from Karigar: reconciles weight difference and returns stock to IN_STOCK with KARIGAR_RETURN movement (Section 20, 21, 22, 49, 51)', () => {
    const job = workshopService.createJob({
      job_type: 'REPAIR',
      karigar_id: karigarId,
      description: 'Chain soldering',
      items: [{ tag_no: 'GOLD-N-002' }], // Issued: Gross = 24.75g, Net = 24.25g
    });

    workshopService.issueJob(job.id);
    workshopService.startJob(job.id);

    // Return with: Gross = 24.60g, Less = 0.50g => Net = 24.10g
    // Weight diff = 24.25g - 24.10g = 0.150g
    const returned = workshopService.returnJob(job.id, {
      actual_labour: 450.0,
      returned_items: [
        {
          item_id: job.items[0].id,
          return_gross_weight: 24.6,
          return_less_weight: 0.5,
          material_returned: '0.1g gold dust scrap',
        },
      ],
    });

    expect(returned.status).toBe(JobStatus.RETURNED);
    expect(returned.actual_labour).toBe(450.0);
    expect(returned.returned_weight).toBe(24.1);

    const item = returned.items[0];
    expect(item.return_net_weight).toBe(24.1);
    expect(item.weight_difference).toBe(0.15); // 0.15g difference stored
    expect(item.material_returned).toBe('0.1g gold dust scrap');

    // Verify stock item restored to IN_STOCK
    const stock = stockRepository.findByTag('GOLD-N-002');
    expect(stock!.status).toBe(StockStatus.IN_STOCK);

    // Verify KARIGAR_RETURN movement exists
    const movements = stockMovementRepository.findByStockItemId(stock!.id);
    const returnMove = movements.find((m) => m.movement_type === MovementType.KARIGAR_RETURN);
    expect(returnMove).toBeDefined();
    expect(returnMove!.from_status).toBe(StockStatus.WITH_KARIGAR);
    expect(returnMove!.to_status).toBe(StockStatus.IN_STOCK);
    expect(returnMove!.net_weight).toBe(24.1);
  });

  it('completes job successfully (Section 18, 48)', () => {
    const job = workshopService.createJob({
      job_type: 'POLISHING',
      karigar_id: karigarId,
      description: 'Quick polishing',
      items: [{ tag_no: 'SILVER-B-001' }],
    });

    workshopService.issueJob(job.id);
    workshopService.returnJob(job.id, {
      returned_items: [
        {
          item_id: job.items[0].id,
          return_gross_weight: 35.0,
          return_less_weight: 0.0,
        },
      ],
    });

    const completed = workshopService.completeJob(job.id);
    expect(completed.status).toBe(JobStatus.COMPLETED);
  });

  it('rolls back completely if a failure occurs during job issuing (Section 15, 52)', () => {
    const job = workshopService.createJob({
      job_type: 'REPAIR',
      karigar_id: karigarId,
      description: 'Rollback test job',
      items: [{ tag_no: 'GOLD-R-001' }],
    });

    // Force error in database during stock movement creation
    const db = getDb();
    db.prepare(`
      CREATE TRIGGER test_force_issue_abort
      BEFORE INSERT ON stock_movements
      WHEN NEW.movement_type = 'KARIGAR_ISSUE'
      BEGIN
        SELECT RAISE(FAIL, 'Simulated failure during issue movement');
      END;
    `).run();

    expect(() => workshopService.issueJob(job.id)).toThrow();

    db.prepare('DROP TRIGGER test_force_issue_abort').run();

    // Verify 100% rollback:
    // 1. Stock item must still be IN_STOCK
    const stock = stockRepository.findByTag('GOLD-R-001');
    expect(stock!.status).toBe(StockStatus.IN_STOCK);

    // 2. Job remains DRAFT
    const refreshed = workshopService.getJobDetails(job.id);
    expect(refreshed.status).toBe(JobStatus.DRAFT);
  });

  it('cancels draft job and logs audit (Section 44, 48)', () => {
    const job = workshopService.createJob({
      job_type: 'OTHER',
      karigar_id: karigarId,
      description: 'Cancelled job',
    });

    const cancelled = workshopService.cancelJob(job.id);
    expect(cancelled.status).toBe(JobStatus.CANCELLED);

    const logs = auditRepository.getRecent(10);
    expect(logs.some((l) => l.action === 'WORKSHOP_JOB_CANCELLED')).toBe(true);
  });
});
