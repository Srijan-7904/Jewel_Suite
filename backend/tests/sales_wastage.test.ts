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

      // 4. Wastage Weight (basis: Net Weight) = 10.000g * 5% = 0.5000g
      const wastageWeight = calculateWastageWeight(netWeight, wastage_percent);
      expect(wastageWeight).toBe(0.5);

      // 5. Wastage Monetary Amount = 0.5000g * ₹7,250 = ₹3,625.00
      const wastageAmount = calculateWastageAmount(wastageWeight, rate_per_gram);
      expect(wastageAmount).toBe(3625.0);

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
      expect(res.wastage_weight).toBe(0.5);
      expect(res.wastage_amount).toBe(3625.0);
      expect(res.metal_value).toBe(66460.75);
      // Item Amount = Metal Value (66,460.75) + Wastage Amount (3,625.00) + Making (0) = ₹70,085.75
      expect(res.item_amount).toBe(70085.75);

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
      expect(purchaseRes.wastage_weight).toBe(0.5);
      expect(purchaseRes.wastage_amount).toBe(3625.0);
      expect(purchaseRes.metal_value).toBe(66460.75);
      expect(purchaseRes.item_amount).toBe(70085.75);
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

      // Wastage Weight = 10.0 * 2.5% = 0.2500g
      expect(res.wastage_weight).toBe(0.25);
      // Wastage Amount = 0.25 * 7250 = ₹1,812.50
      expect(res.wastage_amount).toBe(1812.5);
      // Item Amount = 66,460.75 + 1,812.50 = ₹68,273.25
      expect(res.item_amount).toBe(68273.25);
    });

    // 3. Wastage such as 5% and 10%
    it('3. Wastage such as 5% and 10%: scales linearly on net weight', () => {
      const res5 = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 5.0,
      });
      expect(res5.wastage_weight).toBe(0.5);
      expect(res5.wastage_amount).toBe(3625.0);
      expect(res5.item_amount).toBe(70085.75);

      const res10 = calculateSalesItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 10.0,
      });
      expect(res10.wastage_weight).toBe(1.0);
      expect(res10.wastage_amount).toBe(7250.0);
      expect(res10.item_amount).toBe(73710.75);
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
      // Metal Value = roundCurrency(0.0229 * 7250) = 166.03
      expect(res.metal_value).toBe(166.03);
      // Wastage Weight = roundFineWeight(0.025 * 0.05) = 0.0013g
      expect(res.wastage_weight).toBe(0.0013);
      // Wastage Amount = roundCurrency(0.0013 * 7250) = 9.43
      expect(res.wastage_amount).toBe(9.43);
      // Item Amount = 166.03 + 9.43 + 50.00 = 225.46
      expect(res.item_amount).toBe(225.46);
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
      // Metal value = roundCurrency(11.3167 * 7250.50) = 82,051.73
      expect(res.metal_value).toBe(82051.73);
      // Wastage weight = roundFineWeight(12.345 * 0.0325) = roundFineWeight(0.4012125) = 0.4012g
      expect(res.wastage_weight).toBe(0.4012);
      // Wastage amount = roundCurrency(0.4012 * 7250.50) = 2,908.90
      expect(res.wastage_amount).toBe(2908.9);
      // Item amount = 82,051.73 + 2,908.90 = 84,960.63
      expect(res.item_amount).toBe(84960.63);
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
      expect(resPerGram.metal_value).toBe(66460.75);
      expect(resPerGram.wastage_amount).toBe(3625.0);
      expect(resPerGram.item_amount).toBe(74585.75); // 66460.75 + 3625 + 4500

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
        wastage_percent: 5.0, // item_amount = 70,085.75
      });

      const item2 = calculateSalesItem({
        gross_weight: 5.0,
        tunch_percent: 91.67,
        rate_per_gram: 7250.0,
        wastage_percent: 2.5, // 5 * 0.9167 * 7250 = 33,230.38 metal, wastage = 5 * 0.025 * 7250 = 906.25 -> 34,136.63
      });

      const totals = calculateSalesTotals({
        items: [{ item_amount: item1.item_amount }, { item_amount: item2.item_amount }],
        discount_amount: 4222.38,
        gst_rate: 3.0,
      });

      // Subtotal = 70,085.75 + 34,136.63 = 104,222.38
      expect(totals.subtotal).toBe(104222.38);
      // Taxable = 104,222.38 - 4,222.38 = 100,000.00
      expect(totals.taxable_amount).toBe(100000.0);
      // GST 3% = ₹3,000.00
      expect(totals.gst_amount).toBe(3000.0);
      // Grand total = ₹103,000.00
      expect(totals.grand_total).toBe(103000.0);
    });

    // 8. Exchange value interactions
    it('8. Exchange value interactions: deducts scrap exchange from grand total accurately', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 70085.75 }],
        discount_amount: 85.75,
        gst_rate: 3.0,
        exchange_amount: 22100.0,
      });

      // Subtotal: 70,085.75 - 85.75 discount = 70,000.00
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
      expect(invoice.items[1].wastage_weight).toBe(0.5);
      expect(invoice.items[1].wastage_amount).toBe(3625);
      expect(invoice.items[1].item_amount).toBe(70585.75); // 66460.75 + 3625 + 500

      // Subtotal = 66,960.75 + 70,585.75 = 137,546.50
      expect(invoice.subtotal).toBe(137546.5);
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
      // Metal value = 13.2922 * 7250 = ₹96,368.45
      // Wastage weight = 14.5 * 0.045 = 0.6525g
      // Wastage amount = 0.6525 * 7250 = ₹4,730.63
      // Item amount = 96368.45 + 4730.63 + 1200 = ₹102,299.08
      expect(draft.items[0].net_weight).toBe(14.5);
      expect(draft.items[0].fine_weight).toBe(13.2922);
      expect(draft.items[0].wastage_percent).toBe(4.5);
      expect(draft.items[0].wastage_weight).toBe(0.6525);
      expect(draft.items[0].wastage_amount).toBe(4730.63);
      expect(draft.items[0].item_amount).toBe(102299.08);

      // Reopen draft from database
      const reopened = salesService.getInvoiceDetails(draft.id);
      expect(reopened.items[0].wastage_percent).toBe(4.5);
      expect(reopened.items[0].wastage_weight).toBe(0.6525);
      expect(reopened.items[0].wastage_amount).toBe(4730.63);
      expect(reopened.items[0].item_amount).toBe(102299.08);
      expect(reopened.subtotal).toBe(102299.08);
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
      expect(finalized.items[0].wastage_weight).toBe(0.5);
      expect(finalized.items[0].wastage_amount).toBe(3625.0);
      expect(finalized.items[0].item_amount).toBe(70085.75);

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
      expect(formatFineWeight(item.wastage_weight, 4)).toBe('0.4750'); // 9.5 * 5% = 0.4750g
      expect(formatCurrency(item.metal_value)).toBe('₹63,138.08'); // 8.7087 * 7250 = 63,138.075 -> 63,138.08
      expect(formatCurrency(item.wastage_amount)).toBe('₹3,443.75'); // 0.4750 * 7250 = 3443.75
      expect(formatCurrency(item.making_charge)).toBe('₹800.00');
      expect(formatCurrency(item.item_amount)).toBe('₹67,381.83'); // 63138.08 + 3443.75 + 800 = 67381.83
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
      expect(salesCsv.content).toContain('70585.75'); // taxable amount including metal + wastage + making
      expect(salesCsv.content).toContain('72703'); // grand total after GST
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
  });
});
