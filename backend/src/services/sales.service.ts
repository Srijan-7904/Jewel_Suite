import { z } from 'zod';
import {
  salesRepository,
  SalesInvoiceRecord,
  SalesInvoiceDetailsRecord,
  SalesQueryParams,
} from '../repositories/sales.repository.js';
import {
  exchangeRepository,
  ExchangeTransactionDetailsRecord,
} from '../repositories/exchange.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { stockRepository } from '../repositories/stock.repository.js';
import { stockMovementRepository } from '../repositories/stock_movement.repository.js';
import { metalRepository } from '../repositories/metal.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction, getDb } from '../database/connection/db.js';
import { calculateSalesItem, calculateSalesTotals } from '../utils/salesMath.js';
import { calculateExchangeItem } from '../utils/exchangeMath.js';
import { calculateNetWeight, calculateFineWeight, calculateMetalValue, calculateMakingCharge, roundCurrency } from '../utils/jewelleryMath.js';
import { toDecimal } from '../utils/precision.js';
import { MovementType, StockStatus, assertValidStatusTransition } from '../domain/stockStatus.js';
import { financeRepository } from '../repositories/finance.repository.js';
import { PartyType, EntryType, DebitCredit, PaymentType } from '../domain/finance.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const salesItemSchema = z.object({
  stock_item_id: z.string().optional(),
  tag_no: z.string().trim().toUpperCase().optional(),
  item_name: z.string().min(1, 'Item name is required').trim(),
  metal_id: z.string().min(1, 'Metal is required'),
  purity_id: z.string().min(1, 'Purity is required'),
  gross_weight: z.number().positive('Gross weight must be greater than zero'),
  less_weight: z.number().nonnegative('Less weight cannot be negative').default(0),
  tunch_percent: z.number().min(0).max(100).default(91.6),
  wastage_percent: z.number().min(0, 'Wastage percent cannot be negative').default(0),
  rate_per_gram: z.number().positive('Rate per gram must be greater than zero').optional(),
  metal_rate: z.number().positive().optional(),
  pieces: z.number().int().positive().default(1).optional(),
  making_charge: z.number().min(0).optional(),
  making_rate: z.number().min(0).optional(),
  making_charge_type: z.enum(['PER_GRAM', 'FIXED', 'PER_PIECE', 'PERCENTAGE']).optional(),
  huid: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
}).refine((val) => (val.less_weight ?? 0) <= val.gross_weight, {
  message: 'Less weight cannot exceed gross weight',
  path: ['less_weight'],
}).transform((val) => {
  const rate_per_gram = val.rate_per_gram || val.metal_rate || 0;
  const net_weight = calculateNetWeight(val.gross_weight, val.less_weight || 0);
  let making_charge = val.making_charge !== undefined ? val.making_charge : 0;
  if (val.making_rate !== undefined) {
    const fine_weight = calculateFineWeight(net_weight, val.tunch_percent);
    const metal_val = calculateMetalValue(fine_weight, rate_per_gram);
    making_charge = calculateMakingCharge(
      val.making_charge_type as any,
      val.making_rate,
      net_weight,
      metal_val,
      val.pieces || 1
    );
  }
  const tag_no = val.tag_no && val.tag_no.trim()
    ? val.tag_no.trim().toUpperCase()
    : `TAG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

  return {
    ...val,
    tag_no,
    rate_per_gram,
    making_charge,
  };
});

export const salesPaymentSchema = z.object({
  payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'BANK', 'CREDIT', 'GOLD', 'SILVER', 'OTHER']),
  amount: z.number().nonnegative('Payment amount cannot be negative').default(0),
  metal_weight: z.number().nonnegative('Metal weight cannot be negative').optional(),
  metal_rate: z.number().positive('Metal rate must be positive if provided').optional(),
  metal_id: z.string().trim().nullable().optional(),
  purity_id: z.string().trim().nullable().optional(),
  reference_number: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const salesExchangeItemSchema = z.object({
  source_type: z.enum(['LOOSE_METAL', 'CUSTOMER_JEWELLERY']).default('CUSTOMER_JEWELLERY'),
  metal_id: z.string().min(1, 'Metal is required'),
  purity_id: z.string().min(1, 'Purity is required'),
  product_id: z.string().nullable().optional(),
  item_name: z.string().min(1, 'Description is required').trim(),
  tag_no: z.string().trim().toUpperCase().optional(),
  gross_weight: z.number().positive('Gross weight must be positive'),
  less_weight: z.number().nonnegative('Less weight cannot be negative').default(0),
  tunch_percent: z.number().min(0).max(100),
  exchange_rate: z.number().positive('Exchange rate per gram must be positive'),
  deduction_percent: z.number().min(0).max(100).optional(),
  deduction_amount: z.number().min(0).optional(),
  notes: z.string().trim().nullable().optional(),
});

export const baseCreateSalesInvoiceSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  discount_amount: z.number().min(0).default(0),
  gst_rate: z.number().min(0).default(3.0),
  notes: z.string().trim().nullable().optional(),
  items: z.array(salesItemSchema).optional(),
  exchange_items: z.array(salesExchangeItemSchema).optional(),
  payments: z.array(salesPaymentSchema).optional(),
});

export const createSalesInvoiceSchema = baseCreateSalesInvoiceSchema.transform((data) => {
  return {
    ...data,
    payments: data.payments ? data.payments.filter((p) => p.amount > 0) : undefined,
  };
});

export const updateSalesInvoiceSchema = baseCreateSalesInvoiceSchema.partial();

export interface CombinedSalesInvoiceDetails extends SalesInvoiceDetailsRecord {
  exchange?: ExchangeTransactionDetailsRecord | null;
}

export class SalesService {
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
    const anyProd = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: string } | undefined;
    if (anyProd) return anyProd.id;
    throw new BadRequestError('No valid product found for scrap mapping');
  }

  /**
   * Creates a draft sales invoice (optionally with new items, exchange items, and payments)
   */
  createDraft(data: unknown, userId?: string): CombinedSalesInvoiceDetails {
    const validated = createSalesInvoiceSchema.parse(data);

    // 1. Verify customer
    const customer = customerRepository.findById(validated.customer_id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${validated.customer_id}' does not exist`);
    }

    // 2. Generate unique invoice number
    const invoice_number = salesRepository.getNextInvoiceNumber();

    const created = withTransaction(() => {
      // Create invoice record
      const invoice = salesRepository.create({
        invoice_number,
        customer_id: validated.customer_id,
        invoice_date: validated.invoice_date,
        discount_amount: validated.discount_amount,
        gst_rate: validated.gst_rate,
        notes: validated.notes,
        status: 'DRAFT',
        created_by: userId || null,
      });

      // Insert sales items if provided
      if (validated.items && validated.items.length > 0) {
        for (const itemInput of validated.items) {
          let stockItemId = itemInput.stock_item_id || null;

          // If stock item id not provided, lookup by tag
          if (!stockItemId) {
            const stock = stockRepository.findByTag(itemInput.tag_no);
            if (stock) {
              stockItemId = stock.id;
              if (stock.status !== StockStatus.IN_STOCK) {
                throw new BadRequestError(`Stock item '${itemInput.tag_no}' is not IN_STOCK (Current status: ${stock.status})`);
              }
            }
          }

          const calc = calculateSalesItem({
            gross_weight: itemInput.gross_weight,
            less_weight: itemInput.less_weight,
            tunch_percent: itemInput.tunch_percent,
            rate_per_gram: itemInput.rate_per_gram,
            wastage_percent: itemInput.wastage_percent,
            making_charge: itemInput.making_charge,
          });

          salesRepository.createItem({
            sales_invoice_id: invoice.id,
            stock_item_id: stockItemId,
            tag_no: itemInput.tag_no,
            item_name: itemInput.item_name,
            metal_id: itemInput.metal_id,
            purity_id: itemInput.purity_id,
            gross_weight: itemInput.gross_weight,
            less_weight: itemInput.less_weight,
            net_weight: calc.net_weight,
            tunch_percent: itemInput.tunch_percent,
            fine_weight: calc.fine_weight,
            wastage_percent: calc.wastage_percent,
            wastage_weight: calc.wastage_weight,
            wastage_amount: calc.wastage_amount,
            rate_per_gram: itemInput.rate_per_gram,
            metal_value: calc.metal_value,
            making_charge: itemInput.making_charge,
            item_amount: calc.item_amount,
            huid: itemInput.huid,
            notes: itemInput.notes,
          });
        }
      }

      // Handle old metal exchange items if provided
      if (validated.exchange_items && validated.exchange_items.length > 0) {
        const exchange_number = exchangeRepository.getNextExchangeNumber();
        const exchange = exchangeRepository.create({
          exchange_number,
          customer_id: validated.customer_id,
          sales_invoice_id: invoice.id,
          exchange_date: validated.invoice_date,
          status: 'DRAFT',
          notes: `Linked to Invoice ${invoice.invoice_number}`,
          created_by: userId || null,
        });

        for (const exInput of validated.exchange_items) {
          const metal = metalRepository.getMetalById(exInput.metal_id);
          const metalCode = metal ? metal.code : 'G';
          const tag_no = exInput.tag_no && exInput.tag_no.trim()
            ? exInput.tag_no.trim().toUpperCase()
            : exchangeRepository.getNextExchangeTag(metalCode);

          const productId = this.resolveScrapProductId(metalCode, exInput.product_id);

          const calc = calculateExchangeItem({
            gross_weight: exInput.gross_weight,
            less_weight: exInput.less_weight,
            tunch_percent: exInput.tunch_percent,
            exchange_rate: exInput.exchange_rate,
            deduction_percent: exInput.deduction_percent,
            deduction_amount: exInput.deduction_amount,
          });

          exchangeRepository.createItem({
            exchange_transaction_id: exchange.id,
            source_type: exInput.source_type,
            metal_id: exInput.metal_id,
            purity_id: exInput.purity_id,
            product_id: productId,
            item_name: exInput.item_name,
            tag_no,
            gross_weight: exInput.gross_weight,
            less_weight: exInput.less_weight,
            net_weight: calc.net_weight,
            tunch_percent: exInput.tunch_percent,
            fine_weight: calc.fine_weight,
            exchange_rate: exInput.exchange_rate,
            metal_value: calc.metal_value,
            deduction_percent: calc.deduction_percent,
            deduction_amount: calc.deduction_amount,
            exchange_value: calc.exchange_value,
            notes: exInput.notes,
          });
        }

        // Update exchange totals
        const exDetails = exchangeRepository.findById(exchange.id)!;
        const totalExVal = exDetails.items.reduce((sum, it) => sum + it.exchange_value, 0);
        exchangeRepository.updateTotals(exchange.id, {
          total_gross_weight: exDetails.items.reduce((sum, it) => sum + it.gross_weight, 0),
          total_net_weight: exDetails.items.reduce((sum, it) => sum + it.net_weight, 0),
          total_fine_weight: exDetails.items.reduce((sum, it) => sum + it.fine_weight, 0),
          total_metal_value: exDetails.items.reduce((sum, it) => sum + it.metal_value, 0),
          total_deduction_amount: exDetails.items.reduce((sum, it) => sum + it.deduction_amount, 0),
          total_exchange_value: totalExVal,
        });

        // Set exchange_amount on sales invoice
        salesRepository.update(invoice.id, { exchange_amount: totalExVal });
      }

      // Insert payments if provided
      if (validated.payments && validated.payments.length > 0) {
        for (const paymentInput of validated.payments) {
          let paymentNotes = paymentInput.notes ? paymentInput.notes.trim() : null;
          if (['GOLD', 'SILVER'].includes(paymentInput.payment_mode) && paymentInput.metal_weight && paymentInput.metal_rate) {
            const metalDesc = `${paymentInput.payment_mode === 'GOLD' ? 'Gold' : 'Silver'} Payment: ${paymentInput.metal_weight}g @ ₹${paymentInput.metal_rate}/g`;
            paymentNotes = paymentNotes ? `${paymentNotes} (${metalDesc})` : metalDesc;
          }

          salesRepository.createPayment({
            sales_invoice_id: invoice.id,
            payment_mode: paymentInput.payment_mode,
            amount: paymentInput.amount,
            metal_weight: paymentInput.metal_weight || null,
            metal_rate: paymentInput.metal_rate || null,
            reference_number: paymentInput.reference_number,
            notes: paymentNotes,
          });
        }
      }

      this.recalculateInvoiceTotals(invoice.id);
      return this.getInvoiceDetails(invoice.id);
    });

    auditRepository.log({
      user_id: userId,
      action: 'SALE_CREATED',
      entity_type: 'SALES_INVOICE',
      entity_id: created.id,
      metadata: {
        invoice_number: created.invoice_number,
        customer: customer.name,
        grand_total: created.grand_total,
        exchange_amount: created.exchange_amount,
        net_payable: created.net_payable,
      },
    });

    return created;
  }

  /**
   * Updates draft sales invoice metadata or totals
   */
  updateDraft(id: string, data: unknown, userId?: string): CombinedSalesInvoiceDetails {
    const validated = updateSalesInvoiceSchema.parse(data);
    const existing = salesRepository.findById(id);
    if (!existing) throw new NotFoundError('Sales invoice not found');

    if (existing.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot modify sales invoice with status '${existing.status}'. Only DRAFT invoices can be edited.`);
    }

    if (validated.customer_id) {
      const customer = customerRepository.findById(validated.customer_id);
      if (!customer) throw new NotFoundError(`Customer with ID '${validated.customer_id}' not found`);
    }

    salesRepository.update(id, {
      customer_id: validated.customer_id,
      invoice_date: validated.invoice_date,
      discount_amount: validated.discount_amount,
      gst_rate: validated.gst_rate,
      notes: validated.notes,
    });

    if (validated.items && validated.items.length > 0) {
      const existingItems = salesRepository.getItemsByInvoiceId(id);
      for (const it of existingItems) {
        salesRepository.deleteItem(it.id);
      }
      for (const itemInput of validated.items) {
        let stockItemId = itemInput.stock_item_id || null;
        if (!stockItemId) {
          const stock = stockRepository.findByTag(itemInput.tag_no);
          if (stock) {
            stockItemId = stock.id;
            if (stock.status !== StockStatus.IN_STOCK) {
              throw new BadRequestError(`Stock item '${itemInput.tag_no}' is not IN_STOCK (Current status: ${stock.status})`);
            }
          }
        }

        const calc = calculateSalesItem({
          gross_weight: itemInput.gross_weight,
          less_weight: itemInput.less_weight,
          tunch_percent: itemInput.tunch_percent,
          rate_per_gram: itemInput.rate_per_gram,
          wastage_percent: itemInput.wastage_percent,
          making_charge: itemInput.making_charge,
        });

        salesRepository.createItem({
          sales_invoice_id: id,
          stock_item_id: stockItemId,
          tag_no: itemInput.tag_no,
          item_name: itemInput.item_name,
          metal_id: itemInput.metal_id,
          purity_id: itemInput.purity_id,
          gross_weight: itemInput.gross_weight,
          less_weight: itemInput.less_weight,
          net_weight: calc.net_weight,
          tunch_percent: itemInput.tunch_percent,
          fine_weight: calc.fine_weight,
          wastage_percent: calc.wastage_percent,
          wastage_weight: calc.wastage_weight,
          wastage_amount: calc.wastage_amount,
          rate_per_gram: itemInput.rate_per_gram,
          metal_value: calc.metal_value,
          making_charge: itemInput.making_charge,
          item_amount: calc.item_amount,
          huid: itemInput.huid,
          notes: itemInput.notes,
        });
      }
    }

    if (validated.payments !== undefined) {
      const existingPayments = salesRepository.getPaymentsByInvoiceId(id);
      for (const it of existingPayments) {
        salesRepository.deletePayment(it.id);
      }
      for (const paymentInput of validated.payments) {
        if (paymentInput.amount > 0) {
          let paymentNotes = paymentInput.notes ? paymentInput.notes.trim() : null;
          if (['GOLD', 'SILVER'].includes(paymentInput.payment_mode) && paymentInput.metal_weight && paymentInput.metal_rate) {
            const metalDesc = `${paymentInput.payment_mode === 'GOLD' ? 'Gold' : 'Silver'} Payment: ${paymentInput.metal_weight}g @ ₹${paymentInput.metal_rate}/g`;
            paymentNotes = paymentNotes ? `${paymentNotes} (${metalDesc})` : metalDesc;
          }

          salesRepository.createPayment({
            sales_invoice_id: id,
            payment_mode: paymentInput.payment_mode,
            amount: paymentInput.amount,
            metal_weight: paymentInput.metal_weight || null,
            metal_rate: paymentInput.metal_rate || null,
            reference_number: paymentInput.reference_number,
            notes: paymentNotes,
          });
        }
      }
    }

    this.recalculateInvoiceTotals(id);

    auditRepository.log({
      user_id: userId,
      action: 'SALE_UPDATED',
      entity_type: 'SALES_INVOICE',
      entity_id: id,
      metadata: { invoice_number: existing.invoice_number },
    });

    return this.getInvoiceDetails(id);
  }

  /**
   * FINALIZES a retail sale with exchange in ONE ATOMIC TRANSACTION:
   * (Satisfies Section 19, 20, 26, 29, 40)
   * 1. Validates invoice is DRAFT and has items or exchange items
   * 2. Verifies stock availability for all sold items
   * 3. Inwards all exchange items as stock_items (status = IN_STOCK, acquisition_type = EXCHANGE)
   * 4. Logs EXCHANGE_IN movements
   * 5. Outwards all sold items: marks stock_items status = SOLD
   * 6. Logs SALE_OUT movements
   * 7. Finalizes linked exchange transaction
   * 8. Finalizes sales invoice
   * 9. Completely rolls back if any step fails
   */
  finalizeSale(id: string, userId?: string): CombinedSalesInvoiceDetails {
    const invoice = salesRepository.findById(id);
    if (!invoice) throw new NotFoundError('Sales invoice not found');

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot finalize sales invoice with status '${invoice.status}'. Only DRAFT invoices can be finalized.`);
    }

    const linkedExchange = exchangeRepository.findByInvoiceId(id);

    if (invoice.items.length === 0 && (!linkedExchange || linkedExchange.items.length === 0)) {
      throw new BadRequestError('Invoice contains neither sale items nor exchange items to finalize.');
    }

    // ONE ATOMIC TRANSACTION OWNER
    const finalized = withTransaction(() => {
      // 1. Check stock availability for sale items
      for (const item of invoice.items) {
        if (item.stock_item_id) {
          const stock = stockRepository.findById(item.stock_item_id);
          if (!stock) {
            throw new NotFoundError(`Stock item for tag '${item.tag_no}' not found in inventory`);
          }
          if (stock.status !== StockStatus.IN_STOCK) {
            throw new BadRequestError(
              `Stock item '${item.tag_no}' is not available for sale (Current status: ${stock.status})`
            );
          }
        }
      }

      // 2. If exchange items exist, inward them as stock and log EXCHANGE_IN
      if (linkedExchange && linkedExchange.status === 'DRAFT') {
        // Pre-flight check tag uniqueness
        for (const exItem of linkedExchange.items) {
          const existing = stockRepository.findByTag(exItem.tag_no);
          if (existing) {
            throw new ConflictError(`Exchange tag '${exItem.tag_no}' already exists in inventory`);
          }
        }

        // Create inward stock items
        for (const exItem of linkedExchange.items) {
          const metal = metalRepository.getMetalById(exItem.metal_id);
          const metalCode = metal ? metal.code : 'G';
          const productId = this.resolveScrapProductId(metalCode, exItem.product_id);

          const stock = stockRepository.create({
            tag_no: exItem.tag_no,
            product_id: productId,
            metal_id: exItem.metal_id,
            purity_id: exItem.purity_id,
            gross_weight: exItem.gross_weight,
            less_weight: exItem.less_weight,
            net_weight: exItem.net_weight,
            tunch_percent: exItem.tunch_percent,
            fine_weight: exItem.fine_weight,
            rate_per_gram: exItem.exchange_rate,
            metal_value: exItem.exchange_value,
            current_value: exItem.exchange_value,
            acquisition_type: 'EXCHANGE',
            acquisition_reference: invoice.invoice_number,
            status: StockStatus.IN_STOCK,
            notes: `Old metal exchange linked to invoice ${invoice.invoice_number}`,
          });

          exchangeRepository.updateItemStockId(exItem.id, stock.id);

          stockMovementRepository.create({
            stock_item_id: stock.id,
            movement_type: MovementType.EXCHANGE_IN,
            reference_type: 'SALES_INVOICE',
            reference_id: invoice.id,
            from_status: null,
            to_status: StockStatus.IN_STOCK,
            quantity: 1,
            gross_weight: exItem.gross_weight,
            net_weight: exItem.net_weight,
            fine_weight: exItem.fine_weight,
            notes: `Inward old metal exchange on sale invoice ${invoice.invoice_number}`,
            created_by: userId || null,
          });
        }

        // Finalize exchange transaction
        exchangeRepository.updateStatus(linkedExchange.id, 'FINALIZED');
      }

      // 3. Outward sale items: mark status = SOLD and log SALE_OUT
      for (const item of invoice.items) {
        if (item.stock_item_id) {
          assertValidStatusTransition(StockStatus.IN_STOCK, StockStatus.SOLD);
          stockRepository.updateStatus(item.stock_item_id, StockStatus.SOLD);

          stockMovementRepository.create({
            stock_item_id: item.stock_item_id,
            movement_type: MovementType.SALE_OUT,
            reference_type: 'SALES_INVOICE',
            reference_id: invoice.id,
            from_status: StockStatus.IN_STOCK,
            to_status: StockStatus.SOLD,
            quantity: 1,
            gross_weight: item.gross_weight,
            net_weight: item.net_weight,
            fine_weight: item.fine_weight,
            notes: `Sold on invoice ${invoice.invoice_number} to ${invoice.customer_name || 'customer'}`,
            created_by: userId || null,
          });
        }
      }

      // 4. Recalculate totals and mark invoice FINALIZED
      this.recalculateInvoiceTotals(invoice.id);
      salesRepository.updateStatus(invoice.id, 'FINALIZED');

      const updated = this.getInvoiceDetails(invoice.id);

      // 5. Part 8 Finance Integration: Post to Central Ledger & Payments
      if (updated.grand_total > 0) {
        // Customer is debited for invoice total (increases customer receivable)
        financeRepository.createLedgerEntry({
          party_type: PartyType.CUSTOMER,
          party_id: updated.customer_id,
          entry_type: EntryType.SALE,
          debit_credit: DebitCredit.DEBIT,
          amount: updated.grand_total,
          reference_type: 'SALES_INVOICE',
          reference_id: updated.id,
          reference_number: updated.invoice_number,
          description: `Sale Invoice ${updated.invoice_number}`,
          payment_method: null,
          created_by: userId || null,
        });

        // Credit customer for any upfront payments recorded on the invoice
        if (updated.payments && updated.payments.length > 0) {
          for (const pay of updated.payments) {
            const pmtRecord = financeRepository.createPayment({
              party_type: PartyType.CUSTOMER,
              party_id: updated.customer_id,
              payment_type: PaymentType.RECEIPT,
              payment_mode: pay.payment_mode as any,
              amount: pay.amount,
              reference_number: pay.reference_number || null,
              payment_date: updated.invoice_date,
              reference_type: 'SALES_INVOICE',
              reference_id: updated.id,
              notes: pay.notes || `Upfront tender on invoice ${updated.invoice_number}`,
              created_by: userId || null,
            });

            financeRepository.createLedgerEntry({
              party_type: PartyType.CUSTOMER,
              party_id: updated.customer_id,
              entry_type: EntryType.SALE_PAYMENT,
              debit_credit: DebitCredit.CREDIT,
              amount: pay.amount,
              reference_type: 'SALES_INVOICE',
              reference_id: updated.id,
              reference_number: pmtRecord.payment_number,
              description: `Payment received (${pay.payment_mode}) - ${pmtRecord.payment_number}`,
              payment_method: pay.payment_mode as any,
              created_by: userId || null,
            });
          }
        }
      }

      return updated;
    });

    auditRepository.log({
      user_id: userId,
      action: 'SALE_FINALIZED',
      entity_type: 'SALES_INVOICE',
      entity_id: invoice.id,
      metadata: {
        invoice_number: invoice.invoice_number,
        customer: invoice.customer_name,
        grand_total: finalized.grand_total,
        exchange_amount: finalized.exchange_amount,
        net_payable: finalized.net_payable,
        item_count: invoice.items.length,
      },
    });

    if (linkedExchange) {
      auditRepository.log({
        user_id: userId,
        action: 'EXCHANGE_FINALIZED',
        entity_type: 'EXCHANGE_TRANSACTION',
        entity_id: linkedExchange.id,
        metadata: {
          exchange_number: linkedExchange.exchange_number,
          invoice_number: invoice.invoice_number,
          exchange_value: linkedExchange.total_exchange_value,
        },
      });
    }

    return finalized;
  }

  cancelDraft(id: string, userId?: string): CombinedSalesInvoiceDetails {
    const invoice = salesRepository.findById(id);
    if (!invoice) throw new NotFoundError('Sales invoice not found');

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot cancel sales invoice with status '${invoice.status}'. Only DRAFT can be cancelled.`);
    }

    salesRepository.updateStatus(id, 'CANCELLED');

    const linkedExchange = exchangeRepository.findByInvoiceId(id);
    if (linkedExchange && linkedExchange.status === 'DRAFT') {
      exchangeRepository.updateStatus(linkedExchange.id, 'CANCELLED');
    }

    auditRepository.log({
      user_id: userId,
      action: 'SALE_CANCELLED',
      entity_type: 'SALES_INVOICE',
      entity_id: id,
      metadata: { invoice_number: invoice.invoice_number },
    });

    return this.getInvoiceDetails(id);
  }

  getInvoiceDetails(id: string): CombinedSalesInvoiceDetails {
    const invoice = salesRepository.findById(id);
    if (!invoice) throw new NotFoundError(`Sales invoice with ID '${id}' not found`);

    const exchange = exchangeRepository.findByInvoiceId(id);
    return {
      ...invoice,
      exchange,
    };
  }

  listInvoices(params: SalesQueryParams): PaginatedResult<SalesInvoiceRecord> {
    return salesRepository.find(params);
  }

  getCustomerInvoices(customerId: string): SalesInvoiceRecord[] {
    const customer = customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    return salesRepository.find({ customer_id: customerId, pageSize: 100 }).items;
  }

  /**
   * Recalculates authoritative aggregate totals from items, exchange deduction, and payments
   */
  private recalculateInvoiceTotals(invoiceId: string): void {
    const invoice = salesRepository.findSummaryById(invoiceId);
    if (!invoice) return;

    const items = salesRepository.getItemsByInvoiceId(invoiceId);
    const payments = salesRepository.getPaymentsByInvoiceId(invoiceId);

    // Get linked exchange total if any
    const linkedExchange = exchangeRepository.findByInvoiceId(invoiceId);
    const exchangeAmount = linkedExchange ? linkedExchange.total_exchange_value : invoice.exchange_amount || 0;

    const totals = calculateSalesTotals({
      items,
      discount_amount: invoice.discount_amount,
      gst_rate: invoice.gst_rate,
      exchange_amount: exchangeAmount,
      payments,
    });

    salesRepository.updateTotals(invoiceId, totals);
  }
}

export const salesService = new SalesService();
