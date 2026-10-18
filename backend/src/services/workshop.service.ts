import { z } from 'zod';
import {
  workshopRepository,
  WorkshopJobRecord,
  WorkshopJobDetailsRecord,
  WorkshopQueryParams,
} from '../repositories/workshop.repository.js';
import { karigarRepository } from '../repositories/karigar.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { stockRepository } from '../repositories/stock.repository.js';
import { stockMovementRepository } from '../repositories/stock_movement.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction } from '../database/connection/db.js';
import {
  JobStatus,
  JobType,
  JobPriority,
  assertValidJobTransition,
  JobStatusEnum,
  JobTypeEnum,
  JobPriorityEnum,
} from '../domain/workshopStatus.js';
import { StockStatus, MovementType, assertValidStatusTransition } from '../domain/stockStatus.js';
import { financeRepository } from '../repositories/finance.repository.js';
import { PartyType, EntryType, DebitCredit } from '../domain/finance.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { calculateNetWeight, calculateFineWeight, roundWeight, roundFineWeight } from '../utils/jewelleryMath.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const jobItemInputSchema = z.object({
  stock_item_id: z.string().optional(),
  tag_no: z.string().min(1, 'Tag number is required').trim().toUpperCase(),
  material_issued: z.string().trim().nullable().optional(),
  labour_charge: z.number().min(0).default(0),
  notes: z.string().trim().nullable().optional(),
});

export const createWorkshopJobSchema = z.object({
  job_type: z.enum(['REPAIR', 'MANUFACTURING', 'POLISHING', 'SETTING', 'ALTERATION', 'OTHER']),
  karigar_id: z.string().min(1, 'Karigar is required'),
  customer_id: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  expected_return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
  description: z.string().min(1, 'Description is required').trim(),
  instructions: z.string().trim().nullable().optional(),
  estimated_labour: z.number().min(0).default(0),
  estimated_weight: z.number().min(0).default(0),
  notes: z.string().trim().nullable().optional(),
  items: z.array(jobItemInputSchema).optional(),
});

export const updateWorkshopJobSchema = createWorkshopJobSchema.partial();

export const returnItemInputSchema = z.object({
  item_id: z.string().min(1, 'Job item ID is required'),
  return_gross_weight: z.number().positive('Return gross weight must be greater than zero'),
  return_less_weight: z.number().nonnegative('Return less weight cannot be negative').default(0),
  tunch_percent: z.number().min(0).max(100).optional(),
  material_returned: z.string().trim().nullable().optional(),
  labour_charge: z.number().min(0).optional(),
  notes: z.string().trim().nullable().optional(),
});

export const returnJobSchema = z.object({
  actual_return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  actual_labour: z.number().min(0).optional(),
  returned_items: z.array(returnItemInputSchema).min(1, 'At least one returned item is required'),
  notes: z.string().trim().nullable().optional(),
});

export class WorkshopService {
  /**
   * Creates a new workshop job in DRAFT status
   */
  createJob(data: unknown, userId?: string): WorkshopJobDetailsRecord {
    const validated = createWorkshopJobSchema.parse(data);

    // 1. Verify Karigar
    const karigar = karigarRepository.findById(validated.karigar_id);
    if (!karigar) throw new NotFoundError(`Karigar with ID '${validated.karigar_id}' not found`);

    // 2. Verify Customer if provided
    if (validated.customer_id) {
      const customer = customerRepository.findById(validated.customer_id);
      if (!customer) throw new NotFoundError(`Customer with ID '${validated.customer_id}' not found`);
    }

    // 3. Generate unique job number
    const job_number = workshopRepository.getNextJobNumber();

    const created = withTransaction(() => {
      const job = workshopRepository.create({
        job_number,
        job_type: validated.job_type as JobTypeEnum,
        karigar_id: validated.karigar_id,
        customer_id: validated.customer_id,
        priority: validated.priority as JobPriorityEnum,
        expected_return_date: validated.expected_return_date,
        description: validated.description,
        instructions: validated.instructions,
        estimated_labour: validated.estimated_labour,
        estimated_weight: validated.estimated_weight,
        notes: validated.notes,
        created_by: userId || null,
      });

      // Add items if provided
      if (validated.items && validated.items.length > 0) {
        for (const itemInput of validated.items) {
          const stock = stockRepository.findByTag(itemInput.tag_no);
          if (!stock) {
            throw new NotFoundError(`Stock item with tag '${itemInput.tag_no}' not found in inventory`);
          }
          if (stock.status !== StockStatus.IN_STOCK) {
            throw new BadRequestError(
              `Stock item '${itemInput.tag_no}' cannot be issued. Current status: '${stock.status}' (Must be IN_STOCK).`
            );
          }

          workshopRepository.addItem({
            workshop_job_id: job.id,
            stock_item_id: stock.id,
            tag_no: stock.tag_no,
            issue_gross_weight: stock.gross_weight,
            issue_less_weight: stock.less_weight,
            issue_net_weight: stock.net_weight,
            issue_fine_weight: stock.fine_weight,
            material_issued: itemInput.material_issued,
            labour_charge: itemInput.labour_charge,
            notes: itemInput.notes,
          });
        }
      }

      return workshopRepository.findById(job.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'WORKSHOP_JOB_CREATED',
      entity_type: 'WORKSHOP_JOB',
      entity_id: created.id,
      metadata: {
        job_number: created.job_number,
        karigar: karigar.name,
        job_type: created.job_type,
        item_count: created.items.length,
      },
    });

    return created;
  }

  /**
   * Adds an item to a draft workshop job
   */
  addItem(jobId: string, itemData: unknown, userId?: string): WorkshopJobDetailsRecord {
    const validated = jobItemInputSchema.parse(itemData);
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.READY_TO_ISSUE) {
      throw new BadRequestError(`Cannot add items to job with status '${job.status}'.`);
    }

    const stock = stockRepository.findByTag(validated.tag_no);
    if (!stock) {
      throw new NotFoundError(`Stock item with tag '${validated.tag_no}' not found in inventory`);
    }

    if (stock.status !== StockStatus.IN_STOCK) {
      throw new BadRequestError(
        `Stock item '${validated.tag_no}' cannot be issued. Current status: '${stock.status}' (Must be IN_STOCK).`
      );
    }

    const alreadyAdded = job.items.some((i) => i.tag_no === stock.tag_no);
    if (alreadyAdded) {
      throw new ConflictError(`Tag '${stock.tag_no}' is already included in this job`);
    }

    workshopRepository.addItem({
      workshop_job_id: jobId,
      stock_item_id: stock.id,
      tag_no: stock.tag_no,
      issue_gross_weight: stock.gross_weight,
      issue_less_weight: stock.less_weight,
      issue_net_weight: stock.net_weight,
      issue_fine_weight: stock.fine_weight,
      material_issued: validated.material_issued,
      labour_charge: validated.labour_charge,
      notes: validated.notes,
    });

    return workshopRepository.findById(jobId)!;
  }

  /**
   * Removes an item from a draft workshop job
   */
  removeItem(jobId: string, itemId: string, userId?: string): WorkshopJobDetailsRecord {
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.READY_TO_ISSUE) {
      throw new BadRequestError(`Cannot remove items from job with status '${job.status}'.`);
    }

    const item = workshopRepository.getItemById(itemId);
    if (!item || item.workshop_job_id !== jobId) {
      throw new NotFoundError('Job item not found');
    }

    workshopRepository.deleteItem(itemId);
    return workshopRepository.findById(jobId)!;
  }

  /**
   * ISSUES a job to a Karigar (Section 14, 15, 16, 45, 46)
   * 1. Validates job & karigar
   * 2. Checks all items are IN_STOCK
   * 3. Prevents double-issue
   * 4. Updates stock_items status -> WITH_KARIGAR
   * 5. Creates immutable KARIGAR_ISSUE movement
   * 6. Marks job ISSUED
   * 7. Atomically rolls back if anything fails
   */
  issueJob(jobId: string, userId?: string): WorkshopJobDetailsRecord {
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.READY_TO_ISSUE) {
      throw new BadRequestError(`Cannot issue job with status '${job.status}'. Only DRAFT/READY can be issued.`);
    }

    if (job.items.length === 0) {
      throw new BadRequestError('Cannot issue a job with no items. Please add at least one stock item.');
    }

    // Atomic Transaction
    const issued = withTransaction(() => {
      // 1. Verify stock availability and double-issue protection (Section 46)
      for (const item of job.items) {
        if (!item.stock_item_id) {
          throw new BadRequestError(`Job item '${item.tag_no}' is missing stock item linkage`);
        }

        const stock = stockRepository.findById(item.stock_item_id);
        if (!stock) {
          throw new NotFoundError(`Stock item for tag '${item.tag_no}' not found in inventory`);
        }

        if (stock.status !== StockStatus.IN_STOCK) {
          throw new ConflictError(
            `Tag ${item.tag_no} is no longer available for issue. Current status: ${stock.status}`
          );
        }
      }

      // 2. Perform status transition & stock movement logging
      const today = new Date().toISOString().split('T')[0];
      for (const item of job.items) {
        assertValidStatusTransition(StockStatus.IN_STOCK, StockStatus.WITH_KARIGAR);
        stockRepository.updateStatus(item.stock_item_id!, StockStatus.WITH_KARIGAR);

        stockMovementRepository.create({
          stock_item_id: item.stock_item_id!,
          movement_type: MovementType.KARIGAR_ISSUE,
          reference_type: 'WORKSHOP_JOB',
          reference_id: job.id,
          from_status: StockStatus.IN_STOCK,
          to_status: StockStatus.WITH_KARIGAR,
          quantity: 1,
          gross_weight: item.issue_gross_weight,
          net_weight: item.issue_net_weight,
          fine_weight: item.issue_fine_weight,
          notes: `Issued to Karigar ${job.karigar_name || 'Artisan'} on ${job.job_number}`,
          created_by: userId || null,
        });
      }

      // 3. Mark job ISSUED
      workshopRepository.updateStatus(job.id, JobStatus.ISSUED, { issue_date: today });

      return workshopRepository.findById(job.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'WORKSHOP_JOB_ISSUED',
      entity_type: 'WORKSHOP_JOB',
      entity_id: job.id,
      metadata: {
        job_number: job.job_number,
        karigar: job.karigar_name,
        item_count: job.items.length,
      },
    });

    return issued;
  }

  /**
   * Starts work on an issued job (ISSUED -> IN_PROGRESS)
   */
  startJob(jobId: string, userId?: string): WorkshopJobDetailsRecord {
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    assertValidJobTransition(job.status, JobStatus.IN_PROGRESS);
    workshopRepository.updateStatus(jobId, JobStatus.IN_PROGRESS);

    auditRepository.log({
      user_id: userId,
      action: 'WORKSHOP_JOB_STARTED',
      entity_type: 'WORKSHOP_JOB',
      entity_id: jobId,
      metadata: { job_number: job.job_number },
    });

    return workshopRepository.findById(jobId)!;
  }

  /**
   * RETURNS jewellery items from Karigar (Section 20, 21, 22, 23, 47)
   * 1. Validates return weights
   * 2. Calculates exact weight difference: issue_net_weight - return_net_weight
   * 3. Transitions stock status: WITH_KARIGAR -> IN_STOCK
   * 4. Logs immutable KARIGAR_RETURN movement
   * 5. Updates job status to RETURNED (or COMPLETED)
   * 6. Atomically commits
   */
  returnJob(jobId: string, data: unknown, userId?: string): WorkshopJobDetailsRecord {
    const validated = returnJobSchema.parse(data);
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    if (job.status !== JobStatus.ISSUED && job.status !== JobStatus.IN_PROGRESS) {
      throw new BadRequestError(`Cannot return job with status '${job.status}'. Only ISSUED/IN_PROGRESS can be returned.`);
    }

    const returned = withTransaction(() => {
      const today = validated.actual_return_date || new Date().toISOString().split('T')[0];
      let totalReturnedWeight = 0;

      for (const itemInput of validated.returned_items) {
        const item = job.items.find((i) => i.id === itemInput.item_id);
        if (!item) {
          throw new NotFoundError(`Job item with ID '${itemInput.item_id}' does not belong to job ${job.job_number}`);
        }

        const return_net_weight = calculateNetWeight(
          itemInput.return_gross_weight,
          itemInput.return_less_weight
        );

        // Derive fine weight using original item tunch ratio
        const tunch = itemInput.tunch_percent !== undefined
          ? itemInput.tunch_percent
          : item.issue_net_weight > 0
          ? (item.issue_fine_weight / item.issue_net_weight) * 100
          : 0;

        const return_fine_weight = calculateFineWeight(return_net_weight, tunch);
        const weight_difference = roundWeight(item.issue_net_weight - return_net_weight);

        totalReturnedWeight += return_net_weight;

        // Update item return details
        workshopRepository.updateItemReturn(item.id, {
          return_gross_weight: itemInput.return_gross_weight,
          return_less_weight: itemInput.return_less_weight,
          return_net_weight,
          return_fine_weight,
          weight_difference,
          material_returned: itemInput.material_returned,
          labour_charge: itemInput.labour_charge,
          notes: itemInput.notes,
        });

        // Return stock item to IN_STOCK and log movement
        if (item.stock_item_id) {
          assertValidStatusTransition(StockStatus.WITH_KARIGAR, StockStatus.IN_STOCK);
          stockRepository.updateStatus(item.stock_item_id, StockStatus.IN_STOCK);

          stockMovementRepository.create({
            stock_item_id: item.stock_item_id,
            movement_type: MovementType.KARIGAR_RETURN,
            reference_type: 'WORKSHOP_JOB',
            reference_id: job.id,
            from_status: StockStatus.WITH_KARIGAR,
            to_status: StockStatus.IN_STOCK,
            quantity: 1,
            gross_weight: itemInput.return_gross_weight,
            net_weight: return_net_weight,
            fine_weight: return_fine_weight,
            notes: `Returned from Karigar ${job.karigar_name || 'Artisan'} on ${job.job_number} (Weight Diff: ${weight_difference}g)`,
            created_by: userId || null,
          });
        }
      }

      workshopRepository.updateStatus(job.id, JobStatus.RETURNED, {
        actual_return_date: today,
        actual_labour: validated.actual_labour,
        returned_weight: roundWeight(totalReturnedWeight),
      });

      return workshopRepository.findById(job.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'WORKSHOP_JOB_RETURNED',
      entity_type: 'WORKSHOP_JOB',
      entity_id: job.id,
      metadata: {
        job_number: job.job_number,
        karigar: job.karigar_name,
        returned_items_count: validated.returned_items.length,
      },
    });

    return returned;
  }

  /**
   * Completes a workshop job (RETURNED -> COMPLETED)
   */
  completeJob(jobId: string, userId?: string): WorkshopJobDetailsRecord {
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    assertValidJobTransition(job.status, JobStatus.COMPLETED);

    return withTransaction(() => {
      workshopRepository.updateStatus(jobId, JobStatus.COMPLETED);

      // Part 8 Finance Integration: If labour recorded, credit karigar payable
      const labour = job.actual_labour > 0 ? job.actual_labour : job.estimated_labour;
      if (labour > 0) {
        financeRepository.createLedgerEntry({
          party_type: PartyType.KARIGAR,
          party_id: job.karigar_id,
          entry_type: EntryType.KARIGAR_LABOUR,
          debit_credit: DebitCredit.CREDIT,
          amount: labour,
          reference_type: 'WORKSHOP_JOB',
          reference_id: job.id,
          reference_number: job.job_number,
          description: `Karigar Labour on ${job.job_number} (${job.description})`,
          payment_method: null,
          created_by: userId || null,
        });
      }

      auditRepository.log({
        user_id: userId,
        action: 'WORKSHOP_JOB_COMPLETED',
        entity_type: 'WORKSHOP_JOB',
        entity_id: jobId,
        metadata: { job_number: job.job_number, labour },
      });

      return workshopRepository.findById(jobId)!;
    });
  }

  /**
   * Cancels a draft or ready workshop job
   */
  cancelJob(jobId: string, userId?: string): WorkshopJobDetailsRecord {
    const job = workshopRepository.findById(jobId);
    if (!job) throw new NotFoundError('Workshop job not found');

    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.READY_TO_ISSUE) {
      throw new BadRequestError(
        `Cannot cancel job with status '${job.status}'. Items already issued must be processed through Karigar Return.`
      );
    }

    workshopRepository.updateStatus(jobId, JobStatus.CANCELLED);

    auditRepository.log({
      user_id: userId,
      action: 'WORKSHOP_JOB_CANCELLED',
      entity_type: 'WORKSHOP_JOB',
      entity_id: jobId,
      metadata: { job_number: job.job_number },
    });

    return workshopRepository.findById(jobId)!;
  }

  getJobDetails(id: string): WorkshopJobDetailsRecord {
    const job = workshopRepository.findById(id);
    if (!job) throw new NotFoundError(`Workshop job '${id}' not found`);
    return job;
  }

  listJobs(params: WorkshopQueryParams): PaginatedResult<WorkshopJobRecord> {
    return workshopRepository.find(params);
  }

  getIssueRegister(params: WorkshopQueryParams): PaginatedResult<WorkshopJobRecord> {
    // Only jobs that have been issued, in progress, or returned
    return workshopRepository.find(params);
  }
}

export const workshopService = new WorkshopService();
