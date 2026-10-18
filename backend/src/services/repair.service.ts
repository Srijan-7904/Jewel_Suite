import { z } from 'zod';
import {
  repairRepository,
  RepairRecord,
  RepairQueryParams,
} from '../repositories/repair.repository.js';
import { karigarRepository } from '../repositories/karigar.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { stockRepository } from '../repositories/stock.repository.js';
import { stockMovementRepository } from '../repositories/stock_movement.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction } from '../database/connection/db.js';
import {
  RepairStatus,
  RepairOwnership,
  JobPriority,
  assertValidRepairTransition,
  RepairStatusEnum,
  RepairOwnershipEnum,
  JobPriorityEnum,
} from '../domain/workshopStatus.js';
import { StockStatus, MovementType, assertValidStatusTransition } from '../domain/stockStatus.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const createRepairSchema = z.object({
  customer_id: z.string().nullable().optional(),
  stock_item_id: z.string().nullable().optional(),
  karigar_id: z.string().nullable().optional(),
  ownership: z.enum(['CUSTOMER_OWNED', 'SHOP_OWNED']).default('CUSTOMER_OWNED'),
  item_description: z.string().min(1, 'Item description is required').trim(),
  metal_id: z.string().nullable().optional(),
  purity_id: z.string().nullable().optional(),
  gross_weight: z.number().nonnegative().default(0),
  net_weight: z.number().nonnegative().default(0),
  problem_description: z.string().min(1, 'Problem description is required').trim(),
  instructions: z.string().trim().nullable().optional(),
  repair_type: z.string().default('REPAIR'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  expected_completion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
  estimated_cost: z.number().min(0).default(0),
  notes: z.string().trim().nullable().optional(),
});

export const updateRepairSchema = createRepairSchema.partial();

export class RepairService {
  /**
   * Intakes a new repair order (Section 25, 26, 28)
   * Disables automatic stock injection for customer-owned jewellery!
   */
  createRepair(data: unknown, userId?: string): RepairRecord {
    const validated = createRepairSchema.parse(data);

    // Validate customer if provided
    if (validated.customer_id) {
      const customer = customerRepository.findById(validated.customer_id);
      if (!customer) throw new NotFoundError(`Customer with ID '${validated.customer_id}' not found`);
    }

    // Validate karigar if provided
    if (validated.karigar_id) {
      const karigar = karigarRepository.findById(validated.karigar_id);
      if (!karigar) throw new NotFoundError(`Karigar with ID '${validated.karigar_id}' not found`);
    }

    // Generate unique repair number
    const repair_number = repairRepository.getNextRepairNumber();

    const created = withTransaction(() => {
      // If shop-owned, verify and transition stock status
      if (validated.ownership === RepairOwnership.SHOP_OWNED) {
        if (!validated.stock_item_id) {
          throw new BadRequestError('Shop-owned repair requires selecting a stock item');
        }

        const stock = stockRepository.findById(validated.stock_item_id);
        if (!stock) throw new NotFoundError(`Stock item '${validated.stock_item_id}' not found`);
        if (stock.status !== StockStatus.IN_STOCK) {
          throw new BadRequestError(
            `Stock item '${stock.tag_no}' cannot be sent to repair. Current status: '${stock.status}' (Must be IN_STOCK).`
          );
        }

        assertValidStatusTransition(StockStatus.IN_STOCK, StockStatus.REPAIR);
        stockRepository.updateStatus(stock.id, StockStatus.REPAIR);

        stockMovementRepository.create({
          stock_item_id: stock.id,
          movement_type: MovementType.REPAIR_OUT,
          reference_type: 'REPAIR',
          reference_id: repair_number,
          from_status: StockStatus.IN_STOCK,
          to_status: StockStatus.REPAIR,
          quantity: 1,
          gross_weight: stock.gross_weight,
          net_weight: stock.net_weight,
          fine_weight: stock.fine_weight,
          notes: `Sent for repair: ${validated.problem_description}`,
          created_by: userId || null,
        });
      }

      // Create repair ticket
      const repair = repairRepository.create({
        repair_number,
        customer_id: validated.customer_id,
        stock_item_id: validated.stock_item_id,
        karigar_id: validated.karigar_id,
        ownership: validated.ownership as RepairOwnershipEnum,
        item_description: validated.item_description,
        metal_id: validated.metal_id,
        purity_id: validated.purity_id,
        gross_weight: validated.gross_weight,
        net_weight: validated.net_weight,
        problem_description: validated.problem_description,
        instructions: validated.instructions,
        repair_type: validated.repair_type,
        priority: validated.priority as JobPriorityEnum,
        expected_completion: validated.expected_completion,
        estimated_cost: validated.estimated_cost,
        notes: validated.notes,
        created_by: userId || null,
      });

      return repair;
    });

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_CREATED',
      entity_type: 'REPAIR',
      entity_id: created.id,
      metadata: {
        repair_number: created.repair_number,
        ownership: created.ownership,
        item: created.item_description,
      },
    });

    return created;
  }

  updateRepair(id: string, data: unknown, userId?: string): RepairRecord {
    const validated = updateRepairSchema.parse(data);
    const existing = repairRepository.findById(id);
    if (!existing) throw new NotFoundError('Repair order not found');

    if (existing.status === RepairStatus.DELIVERED || existing.status === RepairStatus.CANCELLED) {
      throw new BadRequestError(`Cannot edit repair with status '${existing.status}'`);
    }

    if (validated.karigar_id) {
      const karigar = karigarRepository.findById(validated.karigar_id);
      if (!karigar) throw new NotFoundError(`Karigar with ID '${validated.karigar_id}' not found`);
    }

    repairRepository.update(id, validated as any);

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_UPDATED',
      entity_type: 'REPAIR',
      entity_id: id,
      metadata: { repair_number: existing.repair_number },
    });

    return repairRepository.findById(id)!;
  }

  /**
   * Assigns repair to a Karigar (RECEIVED -> ASSIGNED)
   */
  assignRepair(id: string, karigarId: string, userId?: string): RepairRecord {
    const repair = repairRepository.findById(id);
    if (!repair) throw new NotFoundError('Repair order not found');

    const karigar = karigarRepository.findById(karigarId);
    if (!karigar) throw new NotFoundError(`Karigar with ID '${karigarId}' not found`);

    assertValidRepairTransition(repair.status, RepairStatus.ASSIGNED);
    repairRepository.updateStatus(id, RepairStatus.ASSIGNED, { karigar_id: karigarId });

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_ASSIGNED',
      entity_type: 'REPAIR',
      entity_id: id,
      metadata: {
        repair_number: repair.repair_number,
        karigar: karigar.name,
      },
    });

    return repairRepository.findById(id)!;
  }

  /**
   * Starts work on a repair (ASSIGNED -> IN_REPAIR)
   */
  startRepair(id: string, userId?: string): RepairRecord {
    const repair = repairRepository.findById(id);
    if (!repair) throw new NotFoundError('Repair order not found');

    assertValidRepairTransition(repair.status, RepairStatus.IN_REPAIR);
    repairRepository.updateStatus(id, RepairStatus.IN_REPAIR);

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_STARTED',
      entity_type: 'REPAIR',
      entity_id: id,
      metadata: { repair_number: repair.repair_number },
    });

    return repairRepository.findById(id)!;
  }

  /**
   * Completes work on a repair (IN_REPAIR -> READY)
   */
  completeRepair(id: string, actualCost?: number, notes?: string, userId?: string): RepairRecord {
    const repair = repairRepository.findById(id);
    if (!repair) throw new NotFoundError('Repair order not found');

    assertValidRepairTransition(repair.status, RepairStatus.READY);
    repairRepository.updateStatus(id, RepairStatus.READY, {
      actual_cost: actualCost !== undefined ? actualCost : repair.estimated_cost,
      notes,
    });

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_COMPLETED',
      entity_type: 'REPAIR',
      entity_id: id,
      metadata: {
        repair_number: repair.repair_number,
        actual_cost: actualCost,
      },
    });

    return repairRepository.findById(id)!;
  }

  /**
   * Delivers completed repair (READY -> DELIVERED)
   * If shop-owned, returns stock item to IN_STOCK with REPAIR_IN movement!
   */
  deliverRepair(id: string, userId?: string): RepairRecord {
    const repair = repairRepository.findById(id);
    if (!repair) throw new NotFoundError('Repair order not found');

    assertValidRepairTransition(repair.status, RepairStatus.DELIVERED);

    const delivered = withTransaction(() => {
      const today = new Date().toISOString().split('T')[0];

      if (repair.ownership === RepairOwnership.SHOP_OWNED && repair.stock_item_id) {
        assertValidStatusTransition(StockStatus.REPAIR, StockStatus.IN_STOCK);
        stockRepository.updateStatus(repair.stock_item_id, StockStatus.IN_STOCK);

        const stock = stockRepository.findById(repair.stock_item_id);
        if (stock) {
          stockMovementRepository.create({
            stock_item_id: stock.id,
            movement_type: MovementType.REPAIR_IN,
            reference_type: 'REPAIR',
            reference_id: repair.id,
            from_status: StockStatus.REPAIR,
            to_status: StockStatus.IN_STOCK,
            quantity: 1,
            gross_weight: stock.gross_weight,
            net_weight: stock.net_weight,
            fine_weight: stock.fine_weight,
            notes: `Repair completed and returned to stock: ${repair.repair_number}`,
            created_by: userId || null,
          });
        }
      }

      repairRepository.updateStatus(id, RepairStatus.DELIVERED, { delivered_date: today });
      return repairRepository.findById(id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_DELIVERED',
      entity_type: 'REPAIR',
      entity_id: id,
      metadata: {
        repair_number: repair.repair_number,
        ownership: repair.ownership,
      },
    });

    return delivered;
  }

  /**
   * Cancels a repair order
   */
  cancelRepair(id: string, userId?: string): RepairRecord {
    const repair = repairRepository.findById(id);
    if (!repair) throw new NotFoundError('Repair order not found');

    if (repair.status === RepairStatus.DELIVERED || repair.status === RepairStatus.CANCELLED) {
      throw new BadRequestError(`Cannot cancel repair with status '${repair.status}'`);
    }

    const cancelled = withTransaction(() => {
      // If shop-owned and in REPAIR, restore to IN_STOCK
      if (repair.ownership === RepairOwnership.SHOP_OWNED && repair.stock_item_id) {
        const stock = stockRepository.findById(repair.stock_item_id);
        if (stock && stock.status === StockStatus.REPAIR) {
          stockRepository.updateStatus(stock.id, StockStatus.IN_STOCK);
        }
      }

      repairRepository.updateStatus(id, RepairStatus.CANCELLED);
      return repairRepository.findById(id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'REPAIR_CANCELLED',
      entity_type: 'REPAIR',
      entity_id: id,
      metadata: { repair_number: repair.repair_number },
    });

    return cancelled;
  }

  getRepairDetails(id: string): RepairRecord {
    const repair = repairRepository.findById(id);
    if (!repair) throw new NotFoundError(`Repair ticket '${id}' not found`);
    return repair;
  }

  listRepairs(params: RepairQueryParams): PaginatedResult<RepairRecord> {
    return repairRepository.find(params);
  }
}

export const repairService = new RepairService();
