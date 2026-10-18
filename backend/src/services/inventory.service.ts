import { z } from 'zod';
import { stockRepository, StockItemRecord, StockQueryParams } from '../repositories/stock.repository.js';
import { stockMovementRepository, StockMovementRecord, MovementQueryParams } from '../repositories/stock_movement.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { metalRepository } from '../repositories/metal.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Decimal } from 'decimal.js';
import { withTransaction, getDb } from '../database/connection/db.js';
import { toDecimal } from '../utils/precision.js';
import {
  calculateNetWeight,
  calculateFineWeight,
  calculateMetalValue,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from '../utils/jewelleryMath.js';
import {
  StockStatus,
  StockStatusType,
  MovementType,
  MovementTypeEnum,
  assertValidStatusTransition,
} from '../domain/stockStatus.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const createStockSchema = z
  .object({
    tag_no: z.string().min(1, 'Tag number is required').trim().toUpperCase(),
    product_id: z.string().min(1, 'Product is required'),
    metal_id: z.string().min(1, 'Metal is required'),
    purity_id: z.string().min(1, 'Purity is required'),

    gross_weight: z.number().nonnegative('Gross weight cannot be negative'),
    less_weight: z.number().nonnegative('Less weight cannot be negative').default(0),

    tunch_percent: z
      .number()
      .min(0, 'Tunch percent cannot be negative')
      .max(100, 'Tunch percent cannot exceed 100'),

    wastage_percent: z.number().min(0, 'Wastage percent cannot be negative').default(0),
    making_charge: z.number().min(0, 'Making charge cannot be negative').default(0),
    rate_per_gram: z.number().min(0, 'Rate per gram cannot be negative').default(0),

    acquisition_type: z.string().default('OPENING_STOCK'),
    acquisition_reference: z.string().trim().nullable().optional(),

    status: z.enum([
      StockStatus.IN_STOCK,
      StockStatus.RESERVED,
      StockStatus.WITH_KARIGAR,
      StockStatus.REPAIR,
    ]).default(StockStatus.IN_STOCK),

    huid: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .refine((data) => data.less_weight <= data.gross_weight, {
    message: 'Less weight cannot exceed gross weight',
    path: ['less_weight'],
  });

export const updateStockSchema = z.object({
  notes: z.string().trim().nullable().optional(),
  huid: z.string().trim().nullable().optional(),
  making_charge: z.number().min(0).optional(),
  wastage_percent: z.number().min(0).optional(),
});

export const changeStatusSchema = z.object({
  to_status: z.string().min(1, 'Target status is required'),
  notes: z.string().trim().nullable().optional(),
  reference_type: z.string().trim().nullable().optional(),
  reference_id: z.string().trim().nullable().optional(),
});

export interface ValuationSummaryGroup {
  metal_id: string;
  metal_code: string;
  metal_name: string;
  purity_id: string;
  purity_code: string;
  purity_name: string;
  item_count: number;
  gross_weight: number;
  less_weight: number;
  net_weight: number;
  fine_weight: number;
  current_rate: number;
  current_valuation: number;
  acquisition_value: number;
}

export interface StockValuationResponse {
  total_items: number;
  total_gross_weight: number;
  total_less_weight: number;
  total_net_weight: number;
  total_fine_weight: number;
  total_acquisition_value: number;
  total_current_valuation: number;
  groups: ValuationSummaryGroup[];
}

export class InventoryService {
  /**
   * Lists stock items with server-side filters and pagination
   */
  list(params: StockQueryParams): PaginatedResult<StockItemRecord> {
    return stockRepository.find(params);
  }

  /**
   * Retrieves single stock item by ID with master relations
   */
  getById(id: string): StockItemRecord {
    const item = stockRepository.findById(id);
    if (!item) throw new NotFoundError('Stock item not found');
    return item;
  }

  /**
   * Retrieves stock item by unique Tag Number
   */
  getByTag(tagNo: string): StockItemRecord {
    const item = stockRepository.findByTag(tagNo);
    if (!item) throw new NotFoundError(`Stock item with Tag '${tagNo}' not found`);
    return item;
  }

  /**
   * Creates an opening stock item and logs the immutable OPENING_STOCK movement
   * in a single atomic transaction.
   */
  createStockItem(data: unknown, userId?: string): StockItemRecord {
    const validated = createStockSchema.parse(data);

    // 1. Validate master relations
    const product = productRepository.findById(validated.product_id);
    if (!product) {
      throw new NotFoundError(`Product with ID '${validated.product_id}' does not exist`);
    }

    const metal = metalRepository.getMetalById(validated.metal_id);
    if (!metal) {
      throw new NotFoundError(`Metal with ID '${validated.metal_id}' does not exist`);
    }

    const purity = metalRepository.getPurityById(validated.purity_id);
    if (!purity) {
      throw new NotFoundError(`Metal purity with ID '${validated.purity_id}' does not exist`);
    }
    if (purity.metal_id !== validated.metal_id) {
      throw new BadRequestError(`Purity '${purity.code}' does not belong to metal '${metal.code}'`);
    }

    // 2. Enforce Tag Uniqueness
    const existingTag = stockRepository.findByTag(validated.tag_no);
    if (existingTag) {
      throw new ConflictError(`Jewellery Tag number '${validated.tag_no}' already exists in inventory`);
    }

    // 3. Centralized Jewellery Math
    const netWeight = calculateNetWeight(validated.gross_weight, validated.less_weight);
    const fineWeight = calculateFineWeight(netWeight, validated.tunch_percent);
    const metalValue = calculateMetalValue(fineWeight, validated.rate_per_gram);

    // 4. Atomic Transaction: Create Stock Item + Opening Stock Movement
    const createdItem = withTransaction((db) => {
      const item = stockRepository.create({
        ...validated,
        net_weight: netWeight,
        fine_weight: fineWeight,
        metal_value: metalValue,
        current_value: metalValue,
      });

      // Immutable movement entry
      stockMovementRepository.create({
        stock_item_id: item.id,
        movement_type: MovementType.OPENING_STOCK,
        reference_type: validated.acquisition_type || 'INVENTORY_OPENING',
        reference_id: validated.acquisition_reference || null,
        from_status: null,
        to_status: item.status,
        quantity: 1,
        gross_weight: item.gross_weight,
        net_weight: item.net_weight,
        fine_weight: item.fine_weight,
        notes: validated.notes || 'Initial opening stock intake',
        created_by: userId || null,
      });

      return item;
    });

    // 5. Audit Logging
    auditRepository.log({
      user_id: userId,
      action: 'STOCK_CREATED',
      entity_type: 'STOCK_ITEM',
      entity_id: createdItem.id,
      metadata: {
        tag_no: createdItem.tag_no,
        product: product.name,
        gross_weight: createdItem.gross_weight,
        net_weight: createdItem.net_weight,
        fine_weight: createdItem.fine_weight,
        rate: createdItem.rate_per_gram,
        metal_value: createdItem.metal_value,
      },
    });

    return stockRepository.findById(createdItem.id)!;
  }

  /**
   * Safely updates non-mathematical attributes of a stock item (e.g. notes, HUID, making charges)
   */
  update(id: string, data: unknown, userId?: string): StockItemRecord {
    const validated = updateStockSchema.parse(data);
    const existing = stockRepository.findById(id);
    if (!existing) throw new NotFoundError('Stock item not found');

    const updated = stockRepository.update(id, validated);
    if (!updated) throw new BadRequestError('Failed to update stock item');

    auditRepository.log({
      user_id: userId,
      action: 'STOCK_UPDATED',
      entity_type: 'STOCK_ITEM',
      entity_id: id,
      metadata: { tag_no: existing.tag_no, updates: validated },
    });

    return updated;
  }

  /**
   * Transitions stock status with strict transition rules and creates an immutable movement record.
   */
  changeStatus(id: string, data: unknown, userId?: string): StockItemRecord {
    const validated = changeStatusSchema.parse(data);
    const existing = stockRepository.findById(id);
    if (!existing) throw new NotFoundError('Stock item not found');

    const fromStatus = existing.status as StockStatusType;
    const toStatus = validated.to_status as StockStatusType;

    // Validate transition
    assertValidStatusTransition(fromStatus, toStatus);

    // Determine appropriate movement type
    let movementType: MovementTypeEnum = MovementType.ADJUSTMENT_IN;
    if (toStatus === StockStatus.REPAIR) {
      movementType = MovementType.REPAIR_OUT;
    } else if (fromStatus === StockStatus.REPAIR && toStatus === StockStatus.IN_STOCK) {
      movementType = MovementType.REPAIR_IN;
    } else if (toStatus === StockStatus.WITH_KARIGAR) {
      movementType = MovementType.KARIGAR_ISSUE;
    } else if (fromStatus === StockStatus.WITH_KARIGAR && toStatus === StockStatus.IN_STOCK) {
      movementType = MovementType.KARIGAR_RETURN;
    } else if (toStatus === StockStatus.SOLD) {
      movementType = MovementType.SALE_OUT;
    } else if (toStatus === StockStatus.EXCHANGED) {
      movementType = MovementType.EXCHANGE_OUT;
    } else if (toStatus === StockStatus.RETURNED) {
      movementType = MovementType.RETURN_IN;
    } else if (toStatus === StockStatus.DAMAGED || toStatus === StockStatus.ADJUSTED) {
      movementType = MovementType.ADJUSTMENT_OUT;
    } else if (fromStatus === StockStatus.ADJUSTED && toStatus === StockStatus.IN_STOCK) {
      movementType = MovementType.ADJUSTMENT_IN;
    } else if (fromStatus === StockStatus.RESERVED && toStatus === StockStatus.IN_STOCK) {
      movementType = MovementType.ADJUSTMENT_IN;
    }

    // Atomic update + movement
    const updated = withTransaction((db) => {
      const item = stockRepository.updateStatus(id, toStatus);
      if (!item) throw new BadRequestError('Failed to transition stock status');

      stockMovementRepository.create({
        stock_item_id: id,
        movement_type: movementType,
        reference_type: validated.reference_type || 'MANUAL_STATUS_CHANGE',
        reference_id: validated.reference_id || null,
        from_status: fromStatus,
        to_status: toStatus,
        quantity: 1,
        gross_weight: item.gross_weight,
        net_weight: item.net_weight,
        fine_weight: item.fine_weight,
        notes: validated.notes || `Status transitioned from ${fromStatus} to ${toStatus}`,
        created_by: userId || null,
      });

      return item;
    });

    auditRepository.log({
      user_id: userId,
      action: 'STOCK_MOVEMENT_CREATED',
      entity_type: 'STOCK_ITEM',
      entity_id: id,
      metadata: {
        tag_no: existing.tag_no,
        from_status: fromStatus,
        to_status: toStatus,
        movement_type: movementType,
      },
    });

    return updated;
  }

  /**
   * Retrieves all chronological movement audit records for a stock item
   */
  getMovements(stockItemId: string): StockMovementRecord[] {
    const item = stockRepository.findById(stockItemId);
    if (!item) throw new NotFoundError('Stock item not found');
    return stockMovementRepository.findByStockItemId(stockItemId);
  }

  /**
   * Retrieves paginated movements across all stock items
   */
  listMovements(params: MovementQueryParams): PaginatedResult<StockMovementRecord> {
    return stockMovementRepository.find(params);
  }

  /**
   * Calculates comprehensive stock valuation of all active (IN_STOCK) items:
   * Aggregates weights, acquisition value, and dynamic current market valuation
   * based on the latest daily Au/Ag metal rates.
   */
  getStockValuation(): StockValuationResponse {
    const db = getDb();

    // Query active items joined with current metal rates
    const sql = `
      SELECT 
        s.metal_id,
        m.code AS metal_code,
        m.name AS metal_name,
        s.purity_id,
        mp.code AS purity_code,
        mp.name AS purity_name,
        COUNT(s.id) AS item_count,
        SUM(s.gross_weight) AS total_gross,
        SUM(s.less_weight) AS total_less,
        SUM(s.net_weight) AS total_net,
        SUM(s.fine_weight) AS total_fine,
        SUM(s.metal_value) AS total_acq_value,
        (
          SELECT mr.rate 
          FROM metal_rates mr 
          WHERE mr.metal_id = s.metal_id AND mr.purity_id = s.purity_id 
          ORDER BY mr.effective_from DESC, mr.created_at DESC 
          LIMIT 1
        ) AS current_rate
      FROM stock_items s
      JOIN metals m ON s.metal_id = m.id
      JOIN metal_purities mp ON s.purity_id = mp.id
      WHERE s.status = 'IN_STOCK'
      GROUP BY s.metal_id, s.purity_id
      ORDER BY m.code ASC, mp.code ASC
    `;

    const rows = db.prepare(sql).all() as any[];

    let grandItems = 0;
    let grandGross = new Decimal(0);
    let grandLess = new Decimal(0);
    let grandNet = new Decimal(0);
    let grandFine = new Decimal(0);
    let grandAcquisition = new Decimal(0);
    let grandValuation = new Decimal(0);

    const groups: ValuationSummaryGroup[] = rows.map((r) => {
      const itemCount = Number(r.item_count || 0);
      const gross = roundWeight(Number(r.total_gross || 0));
      const less = roundWeight(Number(r.total_less || 0));
      const net = roundWeight(Number(r.total_net || 0));
      const fine = roundFineWeight(Number(r.total_fine || 0));
      const acqVal = roundCurrency(Number(r.total_acq_value || 0));
      const currentRate = Number(r.current_rate || 0);
      const currentVal = roundCurrency(toDecimal(fine).mul(toDecimal(currentRate)));

      grandItems += itemCount;
      grandGross = grandGross.plus(gross);
      grandLess = grandLess.plus(less);
      grandNet = grandNet.plus(net);
      grandFine = grandFine.plus(fine);
      grandAcquisition = grandAcquisition.plus(acqVal);
      grandValuation = grandValuation.plus(currentVal > 0 ? currentVal : acqVal);

      return {
        metal_id: r.metal_id,
        metal_code: r.metal_code,
        metal_name: r.metal_name,
        purity_id: r.purity_id,
        purity_code: r.purity_code,
        purity_name: r.purity_name,
        item_count: itemCount,
        gross_weight: gross,
        less_weight: less,
        net_weight: net,
        fine_weight: fine,
        current_rate: currentRate,
        current_valuation: currentVal > 0 ? currentVal : acqVal,
        acquisition_value: acqVal,
      };
    });

    return {
      total_items: grandItems,
      total_gross_weight: roundWeight(grandGross),
      total_less_weight: roundWeight(grandLess),
      total_net_weight: roundWeight(grandNet),
      total_fine_weight: roundFineWeight(grandFine),
      total_acquisition_value: roundCurrency(grandAcquisition),
      total_current_valuation: roundCurrency(grandValuation),
      groups,
    };
  }
}

export const inventoryService = new InventoryService();
