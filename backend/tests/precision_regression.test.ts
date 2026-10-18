import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatPercentage,
  formatCurrency,
  parseDecimalInput,
  toDecimal,
} from '../src/utils/precision.js';
import {
  calculateNetWeight,
  calculateRawFineWeight,
  calculateFineWeight,
  calculateRawMetalValue,
  calculateMetalValue,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from '../src/utils/jewelleryMath.js';
import { calculateSalesItem, calculateSalesTotals } from '../src/utils/salesMath.js';
import { calculateExchangeItem, calculateExchangeTotals } from '../src/utils/exchangeMath.js';
import { calculatePurchaseItem, calculatePurchaseTotals } from '../src/utils/purchaseMath.js';
import { salesService } from '../src/services/sales.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { purchaseService } from '../src/services/purchase.service.js';
import { exchangeService } from '../src/services/exchange.service.js';
import { reportsService } from '../src/services/reports.service.js';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { getDb } from '../src/database/connection/db.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { supplierRepository } from '../src/repositories/supplier.repository.js';
import { purchaseRepository } from '../src/repositories/purchase.repository.js';

describe('Jewellery Billing Precision & Financial Correctness Regression Suite', () => {
  let testDb: DatabaseType;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    customerRepository.create({
      customer_code: 'CUST-REG-01',
      name: 'Ramesh Patel',
      phone: '9876543210',
    });

    supplierRepository.create({
      supplier_code: 'SUP-REG-01',
      name: 'Zaveri Bullion',
      phone: '9820011223',
    });
  });

  // =========================================================================
  // 1. Mandatory Benchmark Test Cases from Section 10
  // =========================================================================
  describe('Section 10 Benchmark Specifications', () => {
    it('Input weight: 0.025 -> Expected display: 0.025', () => {
      const input = 0.025;
      expect(formatWeight(input)).toBe('0.025');
      expect(formatWeight('0.025')).toBe('0.025');
    });

    it('Input weight: 0.125 -> Expected display: 0.125', () => {
      const input = 0.125;
      expect(formatWeight(input)).toBe('0.125');
      expect(formatWeight('0.125')).toBe('0.125');
    });

    it('Gross weight: 1.250, Less weight: 0.025 -> Expected net weight: 1.225', () => {
      const gross = 1.25;
      const less = 0.025;
      const net = calculateNetWeight(gross, less);
      expect(net).toBe(1.225);
      expect(formatWeight(net)).toBe('1.225');
    });

    it('Net weight: 0.025, Tunch: 91.67 -> Expected fine weight before business rounding: 0.0229175', () => {
      const net = 0.025;
      const tunch = 91.67;
      const rawFine = calculateRawFineWeight(net, tunch);
      expect(rawFine).toBe(0.0229175);

      // Business rounding to 4 decimal places for bullion accounting
      const fineRounded = calculateFineWeight(net, tunch);
      expect(fineRounded).toBe(0.0229);
      expect(formatFineWeight(fineRounded)).toBe('0.0229');
    });

    it('Fine weight: 0.025, Rate per gram: 7250 -> Expected metal value before currency rounding: 181.25', () => {
      const fine = 0.025;
      const rate = 7250;
      const rawMetalValue = calculateRawMetalValue(fine, rate);
      expect(rawMetalValue).toBe(181.25);

      const metalValue = calculateMetalValue(fine, rate);
      expect(metalValue).toBe(181.25);
      expect(formatCurrency(metalValue)).toBe('₹181.25');
    });
  });

  // =========================================================================
  // 2. Weight Precision & Trailing Zeros
  // =========================================================================
  describe('Weight Precision & Trailing Zeros', () => {
    it('preserves exact fractional milligrams without truncation or drift', () => {
      const testCases = [
        { val: 0.025, expected: '0.025' },
        { val: 0.125, expected: '0.125' },
        { val: 1.235, expected: '1.235' },
        { val: 10.005, expected: '10.005' },
        { val: 100.75, expected: '100.750' },
        { val: 10.5, expected: '10.500' },
      ];

      for (const tc of testCases) {
        expect(formatWeight(tc.val)).toBe(tc.expected);
      }
    });

    it('supports typing partial decimal strings without clearing input state', () => {
      expect(parseDecimalInput('', 3)).toBe('');
      expect(parseDecimalInput('0', 3)).toBe('0');
      expect(parseDecimalInput('0.', 3)).toBe('0.');
      expect(parseDecimalInput('0.0', 3)).toBe('0.0');
      expect(parseDecimalInput('0.02', 3)).toBe('0.02');
      expect(parseDecimalInput('0.025', 3)).toBe('0.025');
      // Truncates past maxDecimals without rounding
      expect(parseDecimalInput('0.0256', 3)).toBe('0.025');
    });

    it('prevents negative weights and invalid input values', () => {
      expect(() => calculateNetWeight(-1, 0)).toThrow('Gross weight cannot be negative');
      expect(() => calculateNetWeight(1, -0.1)).toThrow('Less weight cannot be negative');
      expect(() => calculateNetWeight(1.2, 1.25)).toThrow('Less weight (1.25g) cannot exceed gross weight');
    });
  });

  // =========================================================================
  // 3. Separation of Weight, Rate, Percentage and Currency Formatters
  // =========================================================================
  describe('Separation of Domain Formatters', () => {
    it('formats metal rate with paise precision only when present', () => {
      expect(formatMetalRate(7250)).toBe('7,250');
      expect(formatMetalRate(7250.5)).toBe('7,250.50');
      expect(formatMetalRate(7250.75, true)).toBe('₹7,250.75');
    });

    it('formats percentages accurately', () => {
      expect(formatPercentage(91.67)).toBe('91.67%');
      expect(formatPercentage(3)).toBe('3%');
      expect(formatPercentage(100)).toBe('100%');
    });

    it('formats currency strictly to 2 decimal places with Indian numbering', () => {
      expect(formatCurrency(181.25)).toBe('₹181.25');
      expect(formatCurrency(181.25, false)).toBe('181.25');
      expect(formatCurrency(125000.5)).toBe('₹1,25,000.50');
      expect(formatCurrency(0)).toBe('₹0.00');
    });
  });

  // =========================================================================
  // 4. Sales Item & Totals Precision Math
  // =========================================================================
  describe('Sales Calculation Engine with Decimal Arithmetic', () => {
    it('calculates line item with fractional weight 0.025g accurately', () => {
      const res = calculateSalesItem({
        gross_weight: 0.035,
        less_weight: 0.01,
        tunch_percent: 91.67,
        rate_per_gram: 7250,
        making_charge: 50,
      });

      expect(res.net_weight).toBe(0.025);
      expect(res.fine_weight).toBe(0.0229);
      // Metal Value = roundCurrency(0.0229 * 7250) = roundCurrency(166.025) = 166.03
      expect(res.metal_value).toBe(166.03);
      // Item Amount = 166.03 + 50 = 216.03
      expect(res.item_amount).toBe(216.03);
    });

    it('calculates sales invoice totals with GST and rounding', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 181.25 }, { item_amount: 218.75 }],
        discount_amount: 0,
        gst_rate: 3,
      });

      // Total taxable: 400.00
      expect(totals.taxable_amount).toBe(400);
      // GST: 400 * 3% = 12.00
      expect(totals.gst_amount).toBe(12);
      // Grand total = 412
      expect(totals.grand_total).toBe(412);
    });
  });

  // =========================================================================
  // 5. Invoice Persistence Lifecycle (Draft -> Reopen -> Edit -> Finalize)
  // =========================================================================
  describe('Invoice Persistence Lifecycle with 0.025g', () => {
    it('creates draft, reopens, edits, and finalizes invoice preserving 0.025g', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      // 1. Create Draft with 0.025g weight
      const draft = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        gst_rate: 3,
        items: [
          {
            item_name: 'Micro Nose Pin',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 0.035,
            less_weight: 0.01,
            rate_per_gram: 7250,
            making_charge: 50,
          },
        ],
      });

      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('DRAFT');
      expect(draft.items[0].net_weight).toBe(0.025);
      expect(draft.items[0].gross_weight).toBe(0.035);
      expect(draft.items[0].less_weight).toBe(0.01);

      // 2. Reopen saved draft from database
      const reopened = salesService.getInvoiceDetails(draft.id);
      expect(reopened.items[0].net_weight).toBe(0.025);
      expect(formatWeight(reopened.items[0].net_weight)).toBe('0.025');

      // 3. Edit Draft Invoice metadata (discount, notes)
      const updated = salesService.updateDraft(draft.id, {
        notes: 'Updated invoice with 0.025g precision items',
        discount_amount: 10,
      });

      expect(updated.items[0].net_weight).toBe(0.025);
      expect(formatWeight(updated.items[0].net_weight)).toBe('0.025');
      expect(updated.discount_amount).toBe(10);

      // 4. Create another draft with 1.225g (gross 1.250, less 0.025)
      const draft2 = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        gst_rate: 3,
        items: [
          {
            item_name: 'Updated Nose Pin',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 1.25,
            less_weight: 0.025,
            rate_per_gram: 7250,
            making_charge: 100,
          },
        ],
      });

      expect(draft2.items[0].net_weight).toBe(1.225);
      expect(formatWeight(draft2.items[0].net_weight)).toBe('1.225');

      // 5. Finalize Sale
      const finalized = salesService.finalizeSale(draft.id);
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.items[0].net_weight).toBe(0.025);
    });
  });

  // =========================================================================
  // 6. Old Gold Exchange Precision
  // =========================================================================
  describe('Old Gold Exchange Precision with 0.025g', () => {
    it('calculates exchange with fractional weight 0.025g without drift', () => {
      const itemCalc = calculateExchangeItem({
        gross_weight: 1.25,
        less_weight: 0.025,
        tunch_percent: 91.67,
        exchange_rate: 7250,
      });

      expect(itemCalc.net_weight).toBe(1.225);
      expect(itemCalc.fine_weight).toBe(1.123);
      expect(itemCalc.exchange_value).toBe(8141.75);
    });

    it('creates and saves exchange voucher with 0.025g net weight item', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const voucher = exchangeService.createDraft({
        customer_id: customer.id,
        items: [
          {
            item_name: 'Scrap 22K Flakes',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 0.035,
            less_weight: 0.01,
            tunch_percent: 91.67,
            exchange_rate: 7250,
          },
        ],
      });

      expect(voucher.items[0].net_weight).toBe(0.025);
      expect(formatWeight(voucher.items[0].net_weight)).toBe('0.025');

      const retrieved = exchangeService.getExchangeDetails(voucher.id);
      expect(retrieved.items[0].net_weight).toBe(0.025);
    });
  });

  // =========================================================================
  // 7. Purchase Inward & Stock Creation
  // =========================================================================
  describe('Purchase Inward & Inventory Precision', () => {
    it('records purchase inward with 0.025g weight accurately', () => {
      const db = getDb();
      const supplier = db.prepare('SELECT id FROM suppliers LIMIT 1').get() as { id: string };
      const product = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const bill = purchaseService.createDraft({
        supplier_id: supplier.id,
        purchase_date: '2026-10-17',
        items: [
          {
            product_id: product.id,
            metal_id: gold.id,
            purity_id: purity.id,
            tag_no: 'TAG-PUR-0025',
            gross_weight: 0.035,
            less_weight: 0.01,
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            making_charge: 10,
          },
        ],
      });

      expect(bill.items[0].net_weight).toBe(0.025);
      expect(formatWeight(bill.items[0].net_weight)).toBe('0.025');

      const fetched = purchaseRepository.findById(bill.id);
      expect(fetched?.items[0].net_weight).toBe(0.025);
    });

    it('creates stock item and immutable movement with 0.025g', () => {
      const db = getDb();
      const product = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const stockItem = inventoryService.createStockItem({
        tag_no: 'TAG-PREC-025',
        product_id: product.id,
        metal_id: gold.id,
        purity_id: purity.id,
        gross_weight: 0.035,
        less_weight: 0.01,
        tunch_percent: 91.67,
        rate_per_gram: 7250,
      });

      expect(stockItem.net_weight).toBe(0.025);
      expect(stockItem.fine_weight).toBe(0.0229);
      expect(formatWeight(stockItem.net_weight)).toBe('0.025');
      expect(formatFineWeight(stockItem.fine_weight)).toBe('0.0229');

      // Verify movement record
      const movements = inventoryService.getMovements(stockItem.id);
      expect(movements.length).toBe(1);
      expect(movements[0].net_weight).toBe(0.025);
      expect(formatWeight(movements[0].net_weight)).toBe('0.025');
    });
  });

  // =========================================================================
  // 8. Reports & CSV Export Formatting
  // =========================================================================
  describe('Reports & CSV Exports Precision', () => {
    it('preserves 3-decimal weight precision in CSV export', () => {
      const db = getDb();
      const product = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      inventoryService.createStockItem({
        tag_no: 'TAG-CSV-025',
        product_id: product.id,
        metal_id: gold.id,
        purity_id: purity.id,
        gross_weight: 0.035,
        less_weight: 0.01,
        tunch_percent: 91.67,
        rate_per_gram: 7250,
      });

      const csvData = reportsService.exportReportCsv('current-stock', {});
      expect(csvData.content).toBeDefined();
      // Tag exists in CSV
      expect(csvData.content).toContain('TAG-CSV-025');
      // Net weight 0.025 is preserved without truncation
      expect(csvData.content).toContain('0.025');
      // Fine weight 0.0229 is preserved
      expect(csvData.content).toContain('0.0229');
    });

    it('aggregates stock valuation totals with Decimal to prevent IEEE-754 drift', () => {
      const val = inventoryService.getStockValuation();
      expect(val.total_items).toBeGreaterThan(0);
      expect(val.total_gross_weight).toBe(roundWeight(val.total_gross_weight));
      expect(val.total_net_weight).toBe(roundWeight(val.total_net_weight));
      expect(val.total_fine_weight).toBe(roundFineWeight(val.total_fine_weight));
      expect(val.total_current_valuation).toBe(roundCurrency(val.total_current_valuation));
    });
  });
});
