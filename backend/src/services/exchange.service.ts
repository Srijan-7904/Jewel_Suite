import { z } from 'zod';
import {
  exchangeRepository,
  ExchangeTransactionRecord,
  ExchangeTransactionDetailsRecord,
  ExchangeQueryParams,
} from '../repositories/exchange.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { metalRepository } from '../repositories/metal.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { stockRepository } from '../repositories/stock.repository.js';
import { stockMovementRepository } from '../repositories/stock_movement.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction, getDb } from '../database/connection/db.js';
import { calculateExchangeItem, calculateExchangeTotals } from '../utils/exchangeMath.js';
import { MovementType, StockStatus } from '../domain/stockStatus.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const exchangeItemSchema = z.object({
  source_type: z.enum(['LOOSE_METAL', 'CUSTOMER_JEWELLERY']).default('CUSTOMER_JEWELLERY'),
  metal_id: z.string().min(1, 'Metal is required'),
  purity_id: z.string().min(1, 'Purity is required'),
  product_id: z.string().nullable().optional(),
  item_name: z.string().min(1, 'Item description is required').trim(),
  tag_no: z.string().trim().toUpperCase().optional(),
  gross_weight: z.number().positive('Gross weight must be greater than zero'),
  less_weight: z.number().nonnegative('Less weight cannot be negative').default(0),
  tunch_percent: z
    .number()
    .min(0, 'Tunch percent cannot be negative')
    .max(100, 'Tunch percent cannot exceed 100'),
  exchange_rate: z.number().positive('Exchange rate per gram must be greater than zero'),
  deduction_percent: z.number().min(0).max(100).optional(),
  deduction_amount: z.number().min(0).optional(),
  notes: z.string().trim().nullable().optional(),
});

export const createExchangeSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  exchange_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  sales_invoice_id: z.string().nullable().optional(),
  payout_amount: z.number().min(0).default(0),
  notes: z.string().trim().nullable().optional(),
  items: z.array(exchangeItemSchema).optional(),
});

export const updateExchangeSchema = createExchangeSchema.partial();

export class ExchangeService {
  /**
   * Helper to resolve or fallback a scrap/old-gold product_id for stock tracking
   */
  private resolveScrapProductId(metalCode: string, providedProductId?: string | null): string {
    if (providedProductId) {
      const product = productRepository.findById(providedProductId);
      if (product) return product.id;
    }

    const db = getDb();
    const isSilver = metalCode.toUpperCase().includes('SILVER') || metalCode.toUpperCase() === 'SILVER';
    const scrapCode = isSilver ? 'PRD-SCRAP-SILVER' : 'PRD-SCRAP-GOLD';

    const scrapProduct = db.prepare('SELECT id FROM products WHERE product_code = ?').get(scrapCode) as
      | { id: string }
      | undefined;

    if (scrapProduct) return scrapProduct.id;

    // Fallback: any product in DB
    const anyProd = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: string } | undefined;
    if (anyProd) return anyProd.id;

    throw new BadRequestError('No valid product found in catalog to map scrap jewellery item');
  }

  /**
   * Creates a new Exchange transaction draft
   */
  createDraft(data: unknown, userId?: string): ExchangeTransactionDetailsRecord {
    const validated = createExchangeSchema.parse(data);

    // 1. Verify customer
    const customer = customerRepository.findById(validated.customer_id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${validated.customer_id}' does not exist`);
    }

    // 2. Generate unique exchange number
    const exchange_number = exchangeRepository.getNextExchangeNumber();

    // 3. Atomically create transaction + items
    const created = withTransaction(() => {
      const exchange = exchangeRepository.create({
        exchange_number,
        customer_id: validated.customer_id,
        sales_invoice_id: validated.sales_invoice_id,
        exchange_date: validated.exchange_date,
        payout_amount: validated.payout_amount,
        notes: validated.notes,
        status: 'DRAFT',
        created_by: userId || null,
      });

      // Insert items if provided
      if (validated.items && validated.items.length > 0) {
        for (const itemInput of validated.items) {
          const metal = metalRepository.getMetalById(itemInput.metal_id);
          if (!metal) throw new NotFoundError(`Metal '${itemInput.metal_id}' does not exist`);

          const purity = metalRepository.getPurityById(itemInput.purity_id);
          if (!purity) throw new NotFoundError(`Purity '${itemInput.purity_id}' does not exist`);

          const tag_no = itemInput.tag_no && itemInput.tag_no.trim()
            ? itemInput.tag_no.trim().toUpperCase()
            : exchangeRepository.getNextExchangeTag(metal.code);

          const productId = this.resolveScrapProductId(metal.code, itemInput.product_id);

          const calc = calculateExchangeItem({
            gross_weight: itemInput.gross_weight,
            less_weight: itemInput.less_weight,
            tunch_percent: itemInput.tunch_percent,
            exchange_rate: itemInput.exchange_rate,
            deduction_percent: itemInput.deduction_percent,
            deduction_amount: itemInput.deduction_amount,
          });

          exchangeRepository.createItem({
            exchange_transaction_id: exchange.id,
            source_type: itemInput.source_type,
            metal_id: itemInput.metal_id,
            purity_id: itemInput.purity_id,
            product_id: productId,
            item_name: itemInput.item_name,
            tag_no,
            gross_weight: itemInput.gross_weight,
            less_weight: itemInput.less_weight,
            net_weight: calc.net_weight,
            tunch_percent: itemInput.tunch_percent,
            fine_weight: calc.fine_weight,
            exchange_rate: itemInput.exchange_rate,
            metal_value: calc.metal_value,
            deduction_percent: calc.deduction_percent,
            deduction_amount: calc.deduction_amount,
            exchange_value: calc.exchange_value,
            notes: itemInput.notes,
          });
        }
      }

      this.recalculateTotals(exchange.id);
      return exchangeRepository.findById(exchange.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'EXCHANGE_CREATED',
      entity_type: 'EXCHANGE_TRANSACTION',
      entity_id: created.id,
      metadata: {
        exchange_number: created.exchange_number,
        customer: customer.name,
        exchange_value: created.total_exchange_value,
      },
    });

    return created;
  }

  /**
   * Updates a draft exchange transaction
   */
  updateDraft(id: string, data: unknown, userId?: string): ExchangeTransactionDetailsRecord {
    const validated = updateExchangeSchema.parse(data);
    const existing = exchangeRepository.findById(id);
    if (!existing) throw new NotFoundError('Exchange transaction not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot modify exchange transaction with status '${existing.status}'. Only DRAFT transactions can be edited.`);
    }

    if (validated.customer_id) {
      const customer = customerRepository.findById(validated.customer_id);
      if (!customer) throw new NotFoundError(`Customer with ID '${validated.customer_id}' not found`);
    }

    exchangeRepository.update(id, {
      customer_id: validated.customer_id,
      sales_invoice_id: validated.sales_invoice_id,
      exchange_date: validated.exchange_date,
      payout_amount: validated.payout_amount,
      notes: validated.notes,
    });

    this.recalculateTotals(id);

    auditRepository.log({
      user_id: userId,
      action: 'EXCHANGE_UPDATED',
      entity_type: 'EXCHANGE_TRANSACTION',
      entity_id: id,
      metadata: { exchange_number: existing.exchange_number },
    });

    return exchangeRepository.findById(id)!;
  }

  /**
   * Adds an old metal item to a draft exchange transaction
   */
  addItem(exchangeId: string, itemData: unknown, userId?: string): ExchangeTransactionDetailsRecord {
    const validated = exchangeItemSchema.parse(itemData);
    const existing = exchangeRepository.findById(exchangeId);
    if (!existing) throw new NotFoundError('Exchange transaction not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('Cannot add items to a finalized or cancelled exchange transaction');
    }

    const metal = metalRepository.getMetalById(validated.metal_id);
    if (!metal) throw new NotFoundError(`Metal '${validated.metal_id}' does not exist`);

    const purity = metalRepository.getPurityById(validated.purity_id);
    if (!purity) throw new NotFoundError(`Purity '${validated.purity_id}' does not exist`);

    const tag_no = validated.tag_no && validated.tag_no.trim()
      ? validated.tag_no.trim().toUpperCase()
      : exchangeRepository.getNextExchangeTag(metal.code);

    // Check duplicate tag within existing draft items
    const duplicateDraftTag = existing.items.some(
      (it) => it.tag_no.toUpperCase() === tag_no.toUpperCase()
    );
    if (duplicateDraftTag) {
      throw new ConflictError(`Tag '${tag_no}' is already included in this exchange transaction`);
    }

    // Check if tag already exists in stock
    const existingStock = stockRepository.findByTag(tag_no);
    if (existingStock) {
      throw new ConflictError(`Tag '${tag_no}' already exists in inventory. Unique tag required.`);
    }

    const productId = this.resolveScrapProductId(metal.code, validated.product_id);

    const calc = calculateExchangeItem({
      gross_weight: validated.gross_weight,
      less_weight: validated.less_weight,
      tunch_percent: validated.tunch_percent,
      exchange_rate: validated.exchange_rate,
      deduction_percent: validated.deduction_percent,
      deduction_amount: validated.deduction_amount,
    });

    exchangeRepository.createItem({
      exchange_transaction_id: exchangeId,
      source_type: validated.source_type,
      metal_id: validated.metal_id,
      purity_id: validated.purity_id,
      product_id: productId,
      item_name: validated.item_name,
      tag_no,
      gross_weight: validated.gross_weight,
      less_weight: validated.less_weight,
      net_weight: calc.net_weight,
      tunch_percent: validated.tunch_percent,
      fine_weight: calc.fine_weight,
      exchange_rate: validated.exchange_rate,
      metal_value: calc.metal_value,
      deduction_percent: calc.deduction_percent,
      deduction_amount: calc.deduction_amount,
      exchange_value: calc.exchange_value,
      notes: validated.notes,
    });

    this.recalculateTotals(exchangeId);
    return exchangeRepository.findById(exchangeId)!;
  }

  /**
   * Removes an item from a draft exchange transaction
   */
  removeItem(exchangeId: string, itemId: string, userId?: string): ExchangeTransactionDetailsRecord {
    const existing = exchangeRepository.findById(exchangeId);
    if (!existing) throw new NotFoundError('Exchange transaction not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('Cannot remove items from a finalized or cancelled exchange transaction');
    }

    const item = exchangeRepository.getItemById(itemId);
    if (!item || item.exchange_transaction_id !== exchangeId) {
      throw new NotFoundError('Exchange item not found in this transaction');
    }

    exchangeRepository.deleteItem(itemId);
    this.recalculateTotals(exchangeId);

    return exchangeRepository.findById(exchangeId)!;
  }

  /**
   * FINALIZES a standalone exchange transaction in an atomic transaction:
   * 1. Validates status is DRAFT and has items
   * 2. Pre-flight checks unique tags against stock_items
   * 3. Creates stock_items with status = IN_STOCK and acquisition_type = EXCHANGE
   * 4. Creates stock_movements with movement_type = EXCHANGE_IN
   * 5. Marks transaction FINALIZED
   * 6. Completely rolls back if any step fails
   */
  finalizeExchange(id: string, userId?: string): ExchangeTransactionDetailsRecord {
    const exchange = exchangeRepository.findById(id);
    if (!exchange) throw new NotFoundError('Exchange transaction not found');

    if (exchange.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot finalize exchange with status '${exchange.status}'. Only DRAFT can be finalized.`);
    }

    if (exchange.items.length === 0) {
      throw new BadRequestError('Exchange transaction contains no items. Add at least one item before finalizing.');
    }

    // Atomic Transaction
    const finalized = withTransaction(() => {
      // 1. Tag duplication pre-flight check
      for (const item of exchange.items) {
        const existingStock = stockRepository.findByTag(item.tag_no);
        if (existingStock) {
          throw new ConflictError(
            `Tag '${item.tag_no}' already exists in inventory. Duplicate tags are prohibited.`
          );
        }
      }

      // 2. Create Stock Items & EXCHANGE_IN Movements
      for (const item of exchange.items) {
        const metal = metalRepository.getMetalById(item.metal_id);
        const metalCode = metal ? metal.code : 'GOLD';
        const productId = this.resolveScrapProductId(metalCode, item.product_id);

        const stockItem = stockRepository.create({
          tag_no: item.tag_no,
          product_id: productId,
          metal_id: item.metal_id,
          purity_id: item.purity_id,
          gross_weight: item.gross_weight,
          less_weight: item.less_weight,
          net_weight: item.net_weight,
          tunch_percent: item.tunch_percent,
          fine_weight: item.fine_weight,
          wastage_percent: 0,
          making_charge: 0,
          rate_per_gram: item.exchange_rate, // Snapshot historical exchange rate
          metal_value: item.exchange_value,
          current_value: item.exchange_value,
          acquisition_type: 'EXCHANGE',
          acquisition_reference: exchange.exchange_number,
          status: StockStatus.IN_STOCK,
          notes: item.notes || `Old metal exchange ${exchange.exchange_number} from ${exchange.customer_name || 'customer'}`,
        });

        // Link stock item back to exchange item
        exchangeRepository.updateItemStockId(item.id, stockItem.id);

        // Record immutable EXCHANGE_IN movement
        stockMovementRepository.create({
          stock_item_id: stockItem.id,
          movement_type: MovementType.EXCHANGE_IN,
          reference_type: 'EXCHANGE',
          reference_id: exchange.id,
          from_status: null,
          to_status: StockStatus.IN_STOCK,
          quantity: 1,
          gross_weight: item.gross_weight,
          net_weight: item.net_weight,
          fine_weight: item.fine_weight,
          notes: `Old metal inward from customer exchange ${exchange.exchange_number}`,
          created_by: userId || null,
        });
      }

      // 3. Mark finalized
      this.recalculateTotals(exchange.id);
      exchangeRepository.updateStatus(exchange.id, 'FINALIZED');

      return exchangeRepository.findById(exchange.id)!;
    });

    auditRepository.log({
      user_id: userId,
      action: 'EXCHANGE_FINALIZED',
      entity_type: 'EXCHANGE_TRANSACTION',
      entity_id: exchange.id,
      metadata: {
        exchange_number: exchange.exchange_number,
        customer: exchange.customer_name,
        item_count: exchange.items.length,
        total_exchange_value: finalized.total_exchange_value,
      },
    });

    auditRepository.log({
      user_id: userId,
      action: 'EXCHANGE_STOCK_CREATED',
      entity_type: 'EXCHANGE_TRANSACTION',
      entity_id: exchange.id,
      metadata: {
        exchange_number: exchange.exchange_number,
        tags: exchange.items.map((i) => i.tag_no),
      },
    });

    return finalized;
  }

  /**
   * Cancels a draft exchange transaction
   */
  cancelDraft(id: string, userId?: string): ExchangeTransactionDetailsRecord {
    const exchange = exchangeRepository.findById(id);
    if (!exchange) throw new NotFoundError('Exchange transaction not found');

    if (exchange.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot cancel exchange with status '${exchange.status}'. Only DRAFT can be cancelled.`);
    }

    exchangeRepository.updateStatus(id, 'CANCELLED');

    auditRepository.log({
      user_id: userId,
      action: 'EXCHANGE_CANCELLED',
      entity_type: 'EXCHANGE_TRANSACTION',
      entity_id: id,
      metadata: { exchange_number: exchange.exchange_number },
    });

    return exchangeRepository.findById(id)!;
  }

  getExchangeDetails(id: string): ExchangeTransactionDetailsRecord {
    const exchange = exchangeRepository.findById(id);
    if (!exchange) throw new NotFoundError(`Exchange transaction with ID '${id}' not found`);
    return exchange;
  }

  listExchanges(params: ExchangeQueryParams): PaginatedResult<ExchangeTransactionRecord> {
    return exchangeRepository.find(params);
  }

  getCustomerExchanges(customerId: string): ExchangeTransactionRecord[] {
    const customer = customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    return exchangeRepository.findByCustomer(customerId);
  }

  /**
   * Recalculates authoritative aggregate totals from line items
   */
  private recalculateTotals(exchangeId: string): void {
    const exchange = exchangeRepository.findSummaryById(exchangeId);
    if (!exchange) return;

    const items = exchangeRepository.getItemsByExchangeId(exchangeId);
    const totals = calculateExchangeTotals({
      items,
      payout_amount: exchange.payout_amount,
    });

    exchangeRepository.updateTotals(exchangeId, totals);
  }
}

export const exchangeService = new ExchangeService();
