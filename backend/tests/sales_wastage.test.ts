import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { getDb } from '../src/database/connection/db.js';
import { calculateSalesItem, calculateSalesTotals } from '../src/utils/salesMath.js';
import { calculatePurchaseItem, calculatePurchaseTotals } from '../src/utils/purchaseMath.js';
import {
  calculateRawWastageWeight,
  calculateWastageWeight,
  calculateWastageAmount,
  calculateNetWeight,
  calculateFineWeight,
  calculateMetalValue,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from '../src/utils/jewelleryMath.js';
import { salesService } from '../src/services/sales.service.js';
import { salesRepository } from '../src/repositories/sales.repository.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { reportsService } from '../src/services/reports.service.js';
import { formatWeight, formatFineWeight, formatCurrency, formatPercentage } from '../src/utils/precision.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite: Wastage Calculation & Invoice Breakdown Suite', () => {
  let testDb: DatabaseType;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    customerRepository.create({
      name: 'Ramesh Patel',
      phone: '9820011223',
      customer_type: 'RETAIL',
      address: '22 Zaveri Bazaar, Mumbai',
    });
  });

  // =========================================================================
  // Section 10: Required Example Verification
  // =========================================================================
  describe('Section 10: Required Example Verification', () => {
    it('verifies exact intermediate values for: Gross=10.000g, Less=0.000g, Tunch=91.67%, Wastage=5%, Rate=₹7,250', () => {
      // Input parameters from Section 10
      const gross_weight = 10.0;
      const less_weight = 0.0;
      const tunch_percent = 91.67;
      const wastage_percent = 5.0;
      const rate_per_gram = 7250.0;

      // 1. Net Weight = Gross - Less = 10.000g - 0.000g = 10.000g
      const netWeight = calculateNetWeight(gross_weight, less_weight);
      expect(netWeight).toBe(10.0);

      // 2. Fine Weight = Net Weight * Tunch / 100 = 10.000 * 91.67% = 9.1670g
      const fineWeight = calculateFineWeight(netWeight, tunch_percent);
      expect(fineWeight).toBe(9.167);

      // 3. Metal Value = Fine Weight * Rate = 9.1670 * 7,250 = ₹66,460.75
      const metalValue = calculateMetalValue(fineWeight, rate_per_gram);
      expect(metalValue).toBe(66460.75);

      // 4. Wastage Weight (basis: Fine Weight after purity) = 9.1670g * 5% = 0.4584g
      const wastageWeight = calculateWastageWeight(fineWeight, wastage_percent);
      expect(wastageWeight).toBe(0.4584);

      // 5. Wastage Monetary Amount = 0.4584g * ₹7,250 = ₹3,323.40
      const wastageAmount = calculateWastageAmount(wastageWeight, rate_per_gram);
      expect(wastageAmount).toBe(3323.4);

      // 6. Complete line item calculation via calculateSalesItem
      const res = calculateSalesItem({
        gross_weight,
        less_weight,
        tunch_percent,
        rate_per_gram,
        wastage_percent,
        making_charge: 0,
      });

      expect(res.net_weight).toBe(10.0);
      expect(res.fine_weight).toBe(9.167);
      expect(res.wastage_percent).toBe(5.0);
      expect(res.wastage_weight).toBe(0.4584);
      expect(res.wastage_amount).toBe(3323.4);
      // Under addition rule: billable fine = 9.167 + 0.4584 = 9.6254g
      // Metal Value = 9.6254 * 7,250 = ₹69,784.15
      expect(res.metal_value).toBe(69784.15);
      // Item Amount = Metal Value (69,784.15) + Making (0) = ₹69,784.15
      expect(res.item_amount).toBe(69784.15);

      // 7. Verify calculatePurchaseItem produces the exact same authoritative result
      const purchaseRes = calculatePurchaseItem({
        gross_weight,
        less_weight,
        tunch_percent,
        rate_per_gram,
        wastage_percent,
        making_charge: 0,
      });
      expect(purchaseRes.net_weight).toBe(10.0);
      expect(purchaseRes.fine_weight).toBe(9.167);
      expect(purchaseRes.wastage_percent).toBe(5.0);
      expect(purchaseRes.wastage_weight).toBe(0.4584);
      expect(purchaseRes.wastage_amount).toBe(3323.4);
      expect(purchaseRes.metal_value).toBe(69784.15);
      expect(purchaseRes.item_amount).toBe(69784.15);
    });
  });

  // =========================================================================
  // Section 9: Comprehensive Test Cases (1 to 14)
  // =========================================================================
  describe('Section 9: Core Test Cases', () => {
    // 1. Zero wastage
    it('1. Zero wastage: calculates without wastage surcharge', () => {
      const res = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 0.0,
        making_charge: 500.0,
      });

      expect(res.net_weight).toBe(10.0);
      expect(res.fine_weight).toBe(9.167);
      expect(res.wastage_percent).toBe(0.0);
      expect(res.wastage_weight).toBe(0.0);
      expect(res.wastage_amount).toBe(0.0);
      expect(res.metal_value).toBe(66460.75);
      expect(res.item_amount).toBe(66960.75);
    });

    // 2. Fractional wastage such as 2.5%
    it('2. Fractional wastage 2.5%: calculates accurate fractional wastage weight and value', () => {
      const res = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 2.5,
      });

      // Wastage Weight = 9.1670 * 2.5% = 0.2292g
      expect(res.wastage_weight).toBe(0.2292);
      // Wastage Amount = 0.2292 * 7250 = ₹1,661.70
      expect(res.wastage_amount).toBe(1661.7);
      // Billable fine weight = 9.167 + 0.2292 = 9.3962g
      // Metal Value = 9.3962 * 7250 = ₹68,122.45
      expect(res.metal_value).toBe(68122.45);
      expect(res.item_amount).toBe(68122.45);
    });

    // 3. Wastage such as 5% and 10%
    it('3. Wastage such as 5% and 10%: scales linearly on net weight and strictly increases item amount', () => {
      const res5 = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 5.0,
      });
      expect(res5.wastage_weight).toBe(0.4584);
      expect(res5.wastage_amount).toBe(3323.4);
      expect(res5.metal_value).toBe(69784.15);
      expect(res5.item_amount).toBe(69784.15);

      const res10 = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 10.0,
      });
      expect(res10.wastage_weight).toBe(0.9167);
      expect(res10.wastage_amount).toBe(6646.08);
      expect(res10.metal_value).toBe(73106.83);
      expect(res10.item_amount).toBe(73106.83);

      // Increasing Waste% must strictly increase the item amount:
      expect(res10.item_amount).toBeGreaterThan(res5.item_amount);
    });

    // 4. Small jewellery weight such as 0.025 g
    it('4. Small jewellery weight 0.025g: preserves small fractional weights with wastage', () => {
      const res = calculateSalesItem({
        gross_weight: 0.035,
        less_weight: 0.01,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 5.0,
        making_charge: 50.0,
      });

      expect(res.net_weight).toBe(0.025);
      // Fine weight = 0.025 * 0.9167 = 0.0229175 -> 0.0229g
      expect(res.fine_weight).toBe(0.0229);
      // Wastage Weight = roundFineWeight(0.0229 * 0.05) = 0.0011g
      expect(res.wastage_weight).toBe(0.0011);
      // Wastage Amount = roundCurrency(0.0011 * 7250) = 7.98
      expect(res.wastage_amount).toBe(7.98);
      // Billable Fine = 0.0229 + 0.0011 = 0.0240g
      // Metal Value = roundCurrency(0.0240 * 7250) = 174.00
      expect(res.metal_value).toBe(174.0);
      // Item Amount = 174.00 + 50.00 = 224.00
      expect(res.item_amount).toBe(224.0);
    });

    // 5. High-precision net and fine weights
    it('5. High-precision net and fine weights: maintains 4-decimal bullion purity accounting', () => {
      const res = calculateSalesItem({
        gross_weight: 12.345,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.5,
        wastage_percent: 3.25,
      });

      expect(res.net_weight).toBe(12.345);
      // 12.345 * 0.9167 = 11.3166615 -> 11.3167g
      expect(res.fine_weight).toBe(11.3167);
      // Wastage weight = roundFineWeight(11.3167 * 0.0325) = 0.3678g
      expect(res.wastage_weight).toBe(0.3678);
      // Wastage amount = roundCurrency(0.3678 * 7250.50) = 2,666.73
      expect(res.wastage_amount).toBe(2666.73);
      // Billable weight = 11.3167 + 0.3678 = 11.6845g
      // Metal value = roundCurrency(11.6845 * 7250.50) = 84,718.47
      expect(res.metal_value).toBe(84718.47);
      expect(res.item_amount).toBe(84718.47);
    });

    // 6. Making charges combined with wastage
    it('6. Making charges combined with wastage: keeps wastage and making charges strictly separate', () => {
      // Test per-gram making charge
      const resPerGram = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 5.0,
        making_charge: 4500.0, // e.g. ₹450/g * 10g
      });
      // Billable weight = 9.167 + 0.4584 = 9.6254g => metal_value = 69,784.15
      expect(resPerGram.metal_value).toBe(69784.15);
      expect(resPerGram.wastage_amount).toBe(3323.4);
      expect(resPerGram.item_amount).toBe(74284.15); // 69784.15 + 4500

      // Rejects negative wastage or negative making charges
      expect(() =>
        calculateSalesItem({
          gross_weight: 10.0,
          tunch_percent: 91.67,
          rate_per_gram: 7250.0,
          wastage_percent: -2.0,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        calculateSalesItem({
          gross_weight: 10.0,
          tunch_percent: 91.67,
          rate_per_gram: 7250.0,
          making_charge: -100.0,
        })
      ).toThrow(BadRequestError);
    });

    // 7. Discount and GST interactions
    it('7. Discount and GST interactions: applies discount to taxable total, then GST (3%)', () => {
      const item1 = calculateSalesItem({
        gross_weight: 10.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 5.0, // under addition: metal_val = 69,784.15
      });

      const item2 = calculateSalesItem({
        gross_weight: 5.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 2.5, // under addition: billable = 4.6981 * 7250 = 34,061.23
      });

      const totals = calculateSalesTotals({
        items: [{ item_amount: item1.item_amount }, { item_amount: item2.item_amount }],
        discount_amount: 3845.38,
        gst_rate: 3.0,
      });

      // Subtotal = 69,784.15 + 34,061.23 = 103,845.38
      expect(totals.subtotal).toBe(103845.38);
      // Taxable = 103,845.38 - 3,845.38 = 100,000.00
      expect(totals.taxable_amount).toBe(100000.0);
      // GST 3% = ₹3,000.00
      expect(totals.gst_amount).toBe(3000.0);
      // Grand total = ₹103,000.00
      expect(totals.grand_total).toBe(103000.0);
    });

    // 8. Exchange value interactions
    it('8. Exchange value interactions: deducts scrap exchange from grand total accurately', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 70284.15 }],
        discount_amount: 284.15,
        gst_rate: 3.0,
        exchange_amount: 22100.0,
      });

      // Subtotal: 70,284.15 - 284.15 discount = 70,000.00
      // Taxable = 70,000.00
      // GST 3% = 2,100.00
      // Grand total = 72,100.00
      // Net payable = 72,100.00 - 22,100.00 = 50,000.00
      expect(totals.grand_total).toBe(72100.0);
      expect(totals.exchange_amount).toBe(22100.0);
      expect(totals.net_payable).toBe(50000.0);
    });

    // 9. Multiple invoice items
    it('9. Multiple invoice items: handles multi-line invoices with differing wastage percentages', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity22 = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const invoice = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        items: [
          {
            item_name: 'Item A (0% Wastage)',
            metal_id: gold.id,
            purity_id: purity22.id,
            gross_weight: 10.0,
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            wastage_percent: 0,
            making_charge: 500,
          },
          {
            item_name: 'Item B (5% Wastage)',
            metal_id: gold.id,
            purity_id: purity22.id,
            gross_weight: 10.0,
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            wastage_percent: 5,
            making_charge: 500,
          },
        ],
      });

      expect(invoice.items.length).toBe(2);
      expect(invoice.items[0].wastage_percent).toBe(0);
      expect(invoice.items[0].wastage_weight).toBe(0);
      expect(invoice.items[0].wastage_amount).toBe(0);
      expect(invoice.items[0].item_amount).toBe(66960.75);

      expect(invoice.items[1].wastage_percent).toBe(5);
      expect(invoice.items[1].wastage_weight).toBe(0.4584);
      expect(invoice.items[1].wastage_amount).toBe(3323.4);
      // Under addition: metal_val = 69,784.15 + 500 making = 70,284.15
      expect(invoice.items[1].item_amount).toBe(70284.15);

      // Subtotal = 66,960.75 + 70,284.15 = 137,244.90
      expect(invoice.subtotal).toBe(137244.9);
    });

    // 10. Save and reopen draft
    it('10. Save and reopen draft: preserves wastage weight and amounts in SQLite database', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const draft = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        items: [
          {
            item_name: 'Gold Bangle',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 15.0,
            less_weight: 0.5, // net = 14.500g
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            wastage_percent: 4.5,
            making_charge: 1200,
          },
        ],
      });

      // 14.5 * 0.9167 = 13.29215 -> 13.2922g fine weight
      // Wastage weight = 13.2922 * 0.045 = 0.5981g
      // Under addition: billable fine = 13.2922 + 0.5981 = 13.8903g
      // Metal value = 13.8903 * 7250 = ₹100,704.68
      // Item amount = 100704.68 + 1200 = ₹101,904.68
      expect(draft.items[0].net_weight).toBe(14.5);
      expect(draft.items[0].fine_weight).toBe(13.2922);
      expect(draft.items[0].wastage_percent).toBe(4.5);
      expect(draft.items[0].wastage_weight).toBe(0.5981);
      expect(draft.items[0].wastage_amount).toBe(4336.23);
      expect(draft.items[0].item_amount).toBe(101904.68);

      // Reopen draft from database
      const reopened = salesService.getInvoiceDetails(draft.id);
      expect(reopened.items[0].wastage_percent).toBe(4.5);
      expect(reopened.items[0].wastage_weight).toBe(0.5981);
      expect(reopened.items[0].wastage_amount).toBe(4336.23);
      expect(reopened.items[0].item_amount).toBe(101904.68);
      expect(reopened.subtotal).toBe(101904.68);
    });

    // 11. Finalize invoice
    it('11. Finalize invoice: persists finalized invoice with immutability', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const draft = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        items: [
          {
            item_name: 'Necklace 22K',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 10.0,
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            wastage_percent: 5.0,
          },
        ],
      });

      const finalized = salesService.finalizeSale(draft.id);
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.items[0].wastage_weight).toBe(0.4584);
      expect(finalized.items[0].wastage_amount).toBe(3323.4);
      // Under addition: billable fine = 9.6254 * 7250 = 69,784.15
      expect(finalized.items[0].item_amount).toBe(69784.15);

      // Cannot modify finalized invoice
      expect(() =>
        salesService.updateDraft(draft.id, { notes: 'Modifying finalized invoice' })
      ).toThrow(BadRequestError);
    });

    // 12. Printed invoice data breakdown
    it('12. Printed invoice: provides full transparent breakdown of physical vs wastage components', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const draft = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        items: [
          {
            item_name: 'Diamond Studded Ring',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 10.0,
            less_weight: 0.5,
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            wastage_percent: 5.0,
            making_charge: 800,
          },
        ],
      });

      const invoice = salesService.getInvoiceDetails(draft.id);
      const item = invoice.items[0];

      // Formatter tests ensuring weights and money use correct formatters
      expect(formatWeight(item.gross_weight, 3)).toBe('10.000');
      expect(formatWeight(item.less_weight, 3)).toBe('0.500');
      expect(formatWeight(item.net_weight, 3)).toBe('9.500');
      expect(formatPercentage(item.tunch_percent)).toBe('91.67%');
      expect(formatFineWeight(item.fine_weight, 4)).toBe('8.7087');
      expect(formatPercentage(item.wastage_percent)).toBe('5%');
      expect(formatFineWeight(item.wastage_weight, 4)).toBe('0.4354'); // 8.7087 * 5% = 0.4354g
      // Under addition rule: billable fine = 8.7087 + 0.4354 = 9.1441g => metal_value = 66,294.73
      expect(formatCurrency(item.metal_value)).toBe('₹66,294.73');
      expect(formatCurrency(item.wastage_amount)).toBe('₹3,156.65'); // 0.4354 * 7250 = 3156.65
      expect(formatCurrency(item.making_charge)).toBe('₹800.00');
      expect(formatCurrency(item.item_amount)).toBe('₹67,094.73'); // 66294.73 + 800 = 67094.73
    });

    // 13. CSV/report values
    it('13. CSV/report values: exports consistent product sales and sales register totals', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const draft = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        items: [
          {
            item_name: 'Solitaire Gold Ring',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 10.0,
            tunch_percent: 91.67,
            rate_per_gram: 7250,
            wastage_percent: 5.0,
            making_charge: 500,
          },
        ],
      });
      salesService.finalizeSale(draft.id);

      // Verify product sales CSV includes item details and total sales with wastage
      const productCsv = reportsService.exportReportCsv('product-sales', {});
      expect(productCsv.content).toContain('Solitaire Gold Ring');
      expect(productCsv.filename).toMatch(/product_sales_/);

      // Verify sales register CSV includes invoice total with wastage
      const salesCsv = reportsService.exportReportCsv('sales-register', {});
      expect(salesCsv.content).toContain('Ramesh Patel');
      expect(salesCsv.filename).toMatch(/sales_register_/);
      expect(salesCsv.content).toContain('70284.15'); // taxable amount under addition rule: 69784.15 + 500
      expect(salesCsv.content).toContain('72393'); // grand total after GST
    });

    // 14. Historical invoice preservation
    it('14. Historical invoice preservation: leaves historical finalized invoice values unmodified', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      // Simulate a historical invoice created before wastage columns existed (wastage = 0)
      const historicalId = 'hist-inv-2025-001';
      db.prepare(`
        INSERT INTO sales_invoices (
          id, invoice_number, customer_id, invoice_date, subtotal,
          discount_amount, taxable_amount, gst_rate, gst_amount,
          grand_total, net_payable, amount_paid, balance_amount, status
        ) VALUES (
          ?, 'INV-HIST-001', ?, '2025-05-15', 60000.0,
          0.0, 60000.0, 3.0, 1800.0,
          61800.0, 61800.0, 61800.0, 0.0, 'FINALIZED'
        )
      `).run(historicalId, customer.id);

      db.prepare(`
        INSERT INTO sales_invoice_items (
          id, sales_invoice_id, tag_no, item_name, metal_id, purity_id,
          gross_weight, less_weight, net_weight, tunch_percent, fine_weight,
          rate_per_gram, metal_value, making_charge, item_amount,
          wastage_percent, wastage_weight, wastage_amount
        ) VALUES (
          'hist-item-1', ?, 'TAG-HIST-1', 'Antique Gold Chain', ?, ?,
          10.0, 0.0, 10.0, 91.6, 9.16,
          6500.0, 59540.0, 460.0, 60000.0,
          0.0, 0.0, 0.0
        )
      `).run(historicalId, gold.id, purity.id);

      // Verify querying the historical invoice returns exact historical numbers untouched
      const histInvoice = salesService.getInvoiceDetails(historicalId);
      expect(histInvoice.subtotal).toBe(60000.0);
      expect(histInvoice.taxable_amount).toBe(60000.0);
      expect(histInvoice.gst_amount).toBe(1800.0);
      expect(histInvoice.grand_total).toBe(61800.0);
      expect(histInvoice.items[0].wastage_percent).toBe(0.0);
      expect(histInvoice.items[0].wastage_weight).toBe(0.0);
      expect(histInvoice.items[0].wastage_amount).toBe(0.0);
      expect(histInvoice.items[0].item_amount).toBe(60000.0);
    });

    // 15. Signed Badla and Wastage calculations (e.g. -23 or +2)
    it('15. Signed Badla calculation: correctly handles negative badla (e.g. -23) by deducting from billable fine weight', () => {
      // Gross 10g, Less 0g -> Net 10g, Tunch 91.6% -> Pure Fine 9.16g
      // Badla -23% on pure fine weight: 9.16 * (-23) / 100 = -2.1068g
      // Billable Fine = 9.1600 - 2.1068 = 7.0532g
      const res = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.6,
        rate_per_gram: 7000.0,
        badla_percent: -23.0,
        wastage_percent: 0.0,
        making_charge: 0,
      });

      expect(res.net_weight).toBe(10.0);
      expect(res.fine_weight).toBe(9.16);
      expect(res.billable_weight).toBe(7.0532);
      expect(res.wastage_weight).toBe(-2.1068);
      // Metal Value = 7.0532 * 7000 = 49372.4
      expect(res.metal_value).toBe(49372.4);
      expect(res.item_amount).toBe(49372.4);
    });

    it('16. Signed Badla + Waste combined: correctly combines negative badla with positive waste', () => {
      // Gross 10g, Less 0g -> Net 10g, Tunch 91.6% -> Pure Fine 9.16g
      // Badla -2% on fine: 9.16 * -2% = -0.1832g
      // Waste +5% on fine: 9.16 * +5% = +0.4580g
      // Total Addition Weight = -0.1832 + 0.4580 = +0.2748g
      // Billable Fine = 9.1600 + 0.2748 = 9.4348g
      const res = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.6,
        rate_per_gram: 7000.0,
        badla_percent: -2.0,
        wastage_percent: 5.0,
        making_charge: 0,
      });

      expect(res.net_weight).toBe(10.0);
      expect(res.fine_weight).toBe(9.16);
      expect(res.billable_weight).toBe(9.4348);
      expect(res.wastage_weight).toBe(0.2748);
      expect(res.metal_value).toBe(66043.6);
      expect(res.item_amount).toBe(66043.6);
    });
  });
});
