import { z } from 'zod';
import {
  purchaseRepository,
  PurchaseBillRecord,
  PurchaseBillDetailsRecord,
  PurchaseQueryParams,
} from '../repositories/purchase.repository.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { metalRepository } from '../repositories/metal.repository.js';
import { stockRepository } from '../repositories/stock.repository.js';
import { stockMovementRepository } from '../repositories/stock_movement.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction } from '../database/connection/db.js';
import { calculatePurchaseItem, calculatePurchaseTotals } from '../utils/purchaseMath.js';
import { MovementType, StockStatus } from '../domain/stockStatus.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const purchaseItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  metal_id: z.string().min(1, 'Metal is required'),
  purity_id: z.string().min(1, 'Purity is required'),
  tag_no: z.string().min(1, 'Tag number is required').trim().toUpperCase(),
  gross_weight: z.number().positive('Gross weight must be greater than zero'),
  less_weight: z.number().nonnegative('Less weight cannot be negative').default(0),
  tunch_percent: z
    .number()
    .min(0, 'Tunch percent cannot be negative')
    .max(100, 'Tunch percent cannot exceed 100'),
  wastage_percent: z.number().min(0, 'Wastage percent cannot be negative').default(0),
  making_charge: z.number().min(0, 'Making charge cannot be negative').default(0),
  rate_per_gram: z.number().positive('Purchase rate per gram must be greater than zero'),
  huid: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const purchasePaymentSchema = z.object({
  payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'BANK', 'CREDIT']),
  amount: z.number().positive('Payment amount must be greater than zero'),
  reference_number: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const createPurchaseSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  supplier_invoice_number: z.string().trim().nullable().optional(),
  discount_amount: z.number().min(0).default(0),
  gst_rate: z.number().min(0).default(3.0),
  notes: z.string().trim().nullable().optional(),
  items: z.array(purchaseItemSchema).optional(),
  payments: z.array(purchasePaymentSchema).optional(),
});

export const updatePurchaseSchema = createPurchaseSchema.partial();

export class PurchaseService {
  /**
   * Creates a new purchase bill in DRAFT state
   */
  createDraft(data: unknown, userId?: string): PurchaseBillDetailsRecord {
    const validated = createPurchaseSchema.parse(data);

    // 1. Verify supplier
    const supplier = supplierRepository.findById(validated.supplier_id);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID '${validated.supplier_id}' does not exist`);
    }

    // 2. Generate unique purchase number
    const purchase_number = purchaseRepository.getNextPurchaseNumber();

    // 3. Atomically create bill + items + payments inside transaction
    const created = withTransaction(() => {
      const bill = purchaseRepository.create({
        purchase_number,
        supplier_id: validated.supplier_id,
        purchase_date: validated.purchase_date,
        supplier_invoice_number: validated.supplier_invoice_number,
        discount_amount: validated.discount_amount,
        gst_rate: validated.gst_rate,
        notes: validated.notes,
        status: 'DRAFT',
        created_by: userId || null,
      });

      // Insert items if provided
      if (validated.items && validated.items.length > 0) {
        for (const itemInput of validated.items) {
          const product = productRepository.findById(itemInput.product_id);
          if (!product) throw new NotFoundError(`Product '${itemInput.product_id}' not found`);

          const calc = calculatePurchaseItem({
            gross_weight: itemInput.gross_weight,
            less_weight: itemInput.less_weight,
            tunch_percent: itemInput.tunch_percent,
            rate_per_gram: itemInput.rate_per_gram,
            making_charge: itemInput.making_charge,
            wastage_percent: itemInput.wastage_percent,
          });

          purchaseRepository.createItem({
            purchase_bill_id: bill.id,
            product_id: itemInput.product_id,
            metal_id: itemInput.metal_id,
            purity_id: itemInput.purity_id,
            tag_no: itemInput.tag_no,
            item_name: product.name,
            gross_weight: itemInput.gross_weight,
            less_weight: itemInput.less_weight,
            net_weight: calc.net_weight,
            tunch_percent: itemInput.tunch_percent,
            fine_weight: calc.fine_weight,
            wastage_percent: itemInput.wastage_percent,
            making_charge: itemInput.making_charge,
            rate_per_gram: itemInput.rate_per_gram,
            metal_value: calc.metal_value,
            item_amount: calc.item_amount,
            huid: itemInput.huid,
            notes: itemInput.notes,
          });
        }
      }

      // Insert payments if provided
      if (validated.payments && validated.payments.length > 0) {
        for (const paymentInput of validated.payments) {
          purchaseRepository.createPayment({
            purchase_bill_id: bill.id,
            payment_mode: paymentInput.payment_mode,
            amount: paymentInput.amount,
            reference_number: paymentInput.reference_number,
            notes: paymentInput.notes,
          });
        }
      }

      // Recalculate totals
      this.recalculateBillTotals(bill.id);

      return purchaseRepository.findById(bill.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'PURCHASE_CREATED',
      entity_type: 'PURCHASE_BILL',
      entity_id: created.id,
      metadata: {
        purchase_number: created.purchase_number,
        supplier: supplier.name,
        grand_total: created.grand_total,
      },
    });

    return created;
  }

  /**
   * Updates draft purchase bill metadata or totals
   */
  updateDraft(id: string, data: unknown, userId?: string): PurchaseBillDetailsRecord {
    const validated = updatePurchaseSchema.parse(data);
    const existing = purchaseRepository.findById(id);
    if (!existing) throw new NotFoundError('Purchase bill not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot modify purchase bill with status '${existing.status}'. Only DRAFT bills can be edited.`);
    }

    if (validated.supplier_id) {
      const supplier = supplierRepository.findById(validated.supplier_id);
      if (!supplier) throw new NotFoundError(`Supplier with ID '${validated.supplier_id}' not found`);
    }

    purchaseRepository.update(id, {
      supplier_id: validated.supplier_id,
      purchase_date: validated.purchase_date,
      supplier_invoice_number: validated.supplier_invoice_number,
      discount_amount: validated.discount_amount,
      gst_rate: validated.gst_rate,
      notes: validated.notes,
    });

    this.recalculateBillTotals(id);

    auditRepository.log({
      user_id: userId,
      action: 'PURCHASE_UPDATED',
      entity_type: 'PURCHASE_BILL',
      entity_id: id,
      metadata: { purchase_number: existing.purchase_number },
    });

    return purchaseRepository.findById(id)!;
  }

  /**
   * Adds an item to a draft purchase bill
   */
  addItem(billId: string, itemData: unknown, userId?: string): PurchaseBillDetailsRecord {
    const validated = purchaseItemSchema.parse(itemData);
    const existing = purchaseRepository.findById(billId);
    if (!existing) throw new NotFoundError('Purchase bill not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('Cannot add items to a finalized or cancelled purchase bill');
    }

    // Verify master records
    const product = productRepository.findById(validated.product_id);
    if (!product) throw new NotFoundError(`Product '${validated.product_id}' does not exist`);

    const metal = metalRepository.getMetalById(validated.metal_id);
    if (!metal) throw new NotFoundError(`Metal '${validated.metal_id}' does not exist`);

    const purity = metalRepository.getPurityById(validated.purity_id);
    if (!purity) throw new NotFoundError(`Purity '${validated.purity_id}' does not exist`);

    // Check duplicate tag within existing draft items
    const duplicateDraftTag = existing.items.some(
      (it) => it.tag_no.toUpperCase() === validated.tag_no.toUpperCase()
    );
    if (duplicateDraftTag) {
      throw new ConflictError(`Tag '${validated.tag_no}' is already in this purchase bill`);
    }

    // Check if tag already exists in stock
    const existingStock = stockRepository.findByTag(validated.tag_no);
    if (existingStock) {
      throw new ConflictError(`Tag '${validated.tag_no}' already exists in inventory`);
    }

    const calc = calculatePurchaseItem({
      gross_weight: validated.gross_weight,
      less_weight: validated.less_weight,
      tunch_percent: validated.tunch_percent,
      rate_per_gram: validated.rate_per_gram,
      making_charge: validated.making_charge,
      wastage_percent: validated.wastage_percent,
    });

    purchaseRepository.createItem({
      purchase_bill_id: billId,
      product_id: validated.product_id,
      metal_id: validated.metal_id,
      purity_id: validated.purity_id,
      tag_no: validated.tag_no,
      item_name: product.name,
      gross_weight: validated.gross_weight,
      less_weight: validated.less_weight,
      net_weight: calc.net_weight,
      tunch_percent: validated.tunch_percent,
      fine_weight: calc.fine_weight,
      wastage_percent: validated.wastage_percent,
      making_charge: validated.making_charge,
      rate_per_gram: validated.rate_per_gram,
      metal_value: calc.metal_value,
      item_amount: calc.item_amount,
      huid: validated.huid,
      notes: validated.notes,
    });

    this.recalculateBillTotals(billId);

    return purchaseRepository.findById(billId)!;
  }

  /**
   * Removes an item from a draft purchase bill
   */
  removeItem(billId: string, itemId: string, userId?: string): PurchaseBillDetailsRecord {
    const existing = purchaseRepository.findById(billId);
    if (!existing) throw new NotFoundError('Purchase bill not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('Cannot remove items from a finalized or cancelled purchase bill');
    }

    const deleted = purchaseRepository.deleteItem(itemId);
    if (!deleted) throw new NotFoundError('Purchase item not found');

    this.recalculateBillTotals(billId);

    return purchaseRepository.findById(billId)!;
  }

  /**
   * Adds a payment entry to a purchase bill
   */
  addPayment(billId: string, paymentData: unknown, userId?: string): PurchaseBillDetailsRecord {
    const validated = purchasePaymentSchema.parse(paymentData);
    const existing = purchaseRepository.findById(billId);
    if (!existing) throw new NotFoundError('Purchase bill not found');

    purchaseRepository.createPayment({
      purchase_bill_id: billId,
      payment_mode: validated.payment_mode,
      amount: validated.amount,
      reference_number: validated.reference_number,
      notes: validated.notes,
    });

    this.recalculateBillTotals(billId);

    auditRepository.log({
      user_id: userId,
      action: 'PURCHASE_PAYMENT_ADDED',
      entity_type: 'PURCHASE_BILL',
      entity_id: billId,
      metadata: {
        mode: validated.payment_mode,
        amount: validated.amount,
      },
    });

    return purchaseRepository.findById(billId)!;
  }

  /**
   * FINALIZES a purchase bill in an atomic transaction:
   * 1. Validates purchase is DRAFT and has items
   * 2. Verifies unique tags against active inventory
   * 3. Creates stock_items with status = IN_STOCK and acquisition_type = PURCHASE
   * 4. Creates stock_movements with movement_type = PURCHASE_IN
   * 5. Recalculates final totals and marks bill FINALIZED
   * 6. Completely rolls back if any item fails
   */
  finalizePurchase(id: string, userId?: string): PurchaseBillDetailsRecord {
    const bill = purchaseRepository.findById(id);
    if (!bill) throw new NotFoundError('Purchase bill not found');

    if (bill.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot finalize purchase bill with status '${bill.status}'. Only DRAFT bills can be finalized.`);
    }

    if (bill.items.length === 0) {
      throw new BadRequestError('Purchase bill contains no items to inward. Please add at least one item before finalizing.');
    }

    // Atomic Transaction for Inward Stock + Movement + Bill Finalization
    const finalized = withTransaction(() => {
      // 1. Tag duplication pre-flight check
      for (const item of bill.items) {
        const existingStock = stockRepository.findByTag(item.tag_no);
        if (existingStock) {
          throw new ConflictError(
            `Tag '${item.tag_no}' already exists in inventory. Duplicate tags are prohibited.`
          );
        }
      }

      // 2. Inward Stock Creation & Movement Logging
      for (const item of bill.items) {
        const stockItem = stockRepository.create({
          tag_no: item.tag_no,
          product_id: item.product_id,
          metal_id: item.metal_id,
          purity_id: item.purity_id,
          gross_weight: item.gross_weight,
          less_weight: item.less_weight,
          net_weight: item.net_weight,
          tunch_percent: item.tunch_percent,
          fine_weight: item.fine_weight,
          wastage_percent: item.wastage_percent,
          making_charge: item.making_charge,
          rate_per_gram: item.rate_per_gram, // Immutable purchase acquisition rate
          metal_value: item.metal_value,
          current_value: item.metal_value,
          acquisition_type: 'PURCHASE',
          acquisition_reference: bill.purchase_number,
          status: StockStatus.IN_STOCK,
          huid: item.huid,
          notes: item.notes || `Purchased on ${bill.purchase_number} from ${bill.supplier_name || 'supplier'}`,
        });

        // Record immutable PURCHASE_IN movement
        stockMovementRepository.create({
          stock_item_id: stockItem.id,
          movement_type: MovementType.PURCHASE_IN,
          reference_type: 'PURCHASE_BILL',
          reference_id: bill.id,
          from_status: null,
          to_status: StockStatus.IN_STOCK,
          quantity: 1,
          gross_weight: item.gross_weight,
          net_weight: item.net_weight,
          fine_weight: item.fine_weight,
          notes: `Inward stock from supplier purchase ${bill.purchase_number} (Invoice: ${bill.supplier_invoice_number || 'N/A'})`,
          created_by: userId || null,
        });
      }

      // 3. Recalculate totals and mark finalized
      this.recalculateBillTotals(bill.id);
      purchaseRepository.updateStatus(bill.id, 'FINALIZED');

      return purchaseRepository.findById(bill.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'PURCHASE_FINALIZED',
      entity_type: 'PURCHASE_BILL',
      entity_id: bill.id,
      metadata: {
        purchase_number: bill.purchase_number,
        supplier: bill.supplier_name,
        item_count: bill.items.length,
        grand_total: finalized.grand_total,
        amount_paid: finalized.amount_paid,
        balance_payable: finalized.balance_amount,
      },
    });

    return finalized;
  }

  /**
   * Cancels a DRAFT purchase bill. Finalized purchases cannot be cancelled.
   */
  cancelPurchase(id: string, userId?: string): PurchaseBillDetailsRecord {
    const bill = purchaseRepository.findById(id);
    if (!bill) throw new NotFoundError('Purchase bill not found');

    if (bill.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot cancel purchase bill with status '${bill.status}'. Only DRAFT bills can be cancelled.`);
    }

    purchaseRepository.updateStatus(id, 'CANCELLED');

    auditRepository.log({
      user_id: userId,
      action: 'PURCHASE_CANCELLED',
      entity_type: 'PURCHASE_BILL',
      entity_id: id,
      metadata: { purchase_number: bill.purchase_number },
    });

    return purchaseRepository.findById(id)!;
  }

  getById(id: string): PurchaseBillDetailsRecord {
    const bill = purchaseRepository.findById(id);
    if (!bill) throw new NotFoundError('Purchase bill not found');
    return bill;
  }

  list(params: PurchaseQueryParams): PaginatedResult<PurchaseBillRecord> {
    return purchaseRepository.find(params);
  }

  getPurchasesBySupplier(supplierId: string): PurchaseBillRecord[] {
    const supplier = supplierRepository.findById(supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');
    return purchaseRepository.getPurchasesBySupplier(supplierId);
  }

  /**
   * Helper: recalculates bill totals and commits to purchase_bills row
   */
  private recalculateBillTotals(billId: string): void {
    const bill = purchaseRepository.findById(billId);
    if (!bill) return;

    const items = purchaseRepository.getItems(billId);
    const payments = purchaseRepository.getPayments(billId);

    const totals = calculatePurchaseTotals({
      items,
      discount_amount: bill.discount_amount,
      gst_rate: bill.gst_rate,
      payments,
    });

    purchaseRepository.update(billId, {
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      taxable_amount: totals.taxable_amount,
      gst_rate: totals.gst_rate,
      gst_amount: totals.gst_amount,
      round_off: totals.round_off,
      grand_total: totals.grand_total,
      amount_paid: totals.amount_paid,
      balance_amount: totals.balance_amount,
    });
  }
}

export const purchaseService = new PurchaseService();
