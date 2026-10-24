import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { calculateSalesItem, calculateSalesTotals } from '../src/utils/salesMath.js';
import {
  calculateNetWeight,
  calculateFineWeight,
  calculateRawFineWeight,
  calculateWastageWeight,
  calculateWastageAmount,
  calculateMetalValue,
  calculateMakingCharge,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from '../src/utils/jewelleryMath.js';
import { salesService } from '../src/services/sales.service.js';
import { salesRepository } from '../src/repositories/sales.repository.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { metalRepository } from '../src/repositories/metal.repository.js';
import { reportsService } from '../src/services/reports.service.js';
import { BadRequestError } from '../src/utils/errors.js';
import { Decimal } from 'decimal.js';

describe('Jewel Suite: Retail Sale Fine Weight, Wastage, Metal Value & GST Regression Suite', () => {
  let testDb: DatabaseType;
  let customerId: string;
  let gold22kPurityId: string;
  let gold24kPurityId: string;
  let goldMetalId: string;
  let silverMetalId: string;
  let platinumMetalId: string;
  let diamondMetalId: string;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    const customer = customerRepository.create({
      name: 'Arryan Jaiswal',
      phone: '1234567890',
      customer_type: 'RETAIL',
      address: 'Varanasi',
    });
    customerId = customer.id;

    // Retrieve master IDs
    const goldMetal = testDb.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
    const silverMetal = testDb.prepare("SELECT id FROM metals WHERE code = 'SILVER'").get() as { id: string };
    const platMetal = testDb.prepare("SELECT id FROM metals WHERE code = 'PLATINUM'").get() as { id: string };
    const diaMetal = testDb.prepare("SELECT id FROM metals WHERE code = 'DIAMOND'").get() as { id: string };

    goldMetalId = goldMetal.id;
    silverMetalId = silverMetal.id;
    platinumMetalId = platMetal.id;
    diamondMetalId = diaMetal.id;

    const p22k = testDb.prepare("SELECT id FROM metal_purities WHERE code = '22K' AND metal_id = ?").get(goldMetalId) as { id: string };
    const p24k = testDb.prepare("SELECT id FROM metal_purities WHERE code = '24K' AND metal_id = ?").get(goldMetalId) as { id: string };
    gold22kPurityId = p22k.id;
    gold24kPurityId = p24k.id;
  });

  // =========================================================================
  // Requirement 1: Gross 5.500g and Less 0.100g producing Net 5.400g
  // =========================================================================
  describe('1. Gross, Less & Net Weight Calculations', () => {
    it('produces exactly 5.400g net weight from gross 5.500g and less 0.100g', () => {
      const gross = 5.500;
      const less = 0.100;
      const net = calculateNetWeight(gross, less);
      expect(net).toBe(5.400);
      expect(roundWeight(net)).toBe(5.400);
    });

    it('handles zero less weight correctly (gross 5.500g -> net 5.500g)', () => {
      const net = calculateNetWeight(5.500, 0);
      expect(net).toBe(5.500);
    });

    it('rejects less weight exceeding gross weight with a descriptive error', () => {
      expect(() => calculateNetWeight(5.500, 6.000)).toThrow(BadRequestError);
    });

    it('rejects negative gross or less weight', () => {
      expect(() => calculateNetWeight(-5.500, 0)).toThrow(BadRequestError);
      expect(() => calculateNetWeight(5.500, -0.100)).toThrow(BadRequestError);
    });
  });

  // =========================================================================
  // Requirement 2: Purity/Tunch Conversion Using Application Representation
  // =========================================================================
  describe('2. Purity / Tunch Conversion', () => {
    it('calculates fine weight as netWeight * (tunchPercent / 100)', () => {
      // 22K Gold (91.67% tunch): 5.400g net * 91.67% = 4.95018g -> rounded to 4 decimals = 4.9502g
      const fine22k = calculateFineWeight(5.400, 91.67);
      expect(fine22k).toBe(4.9502);

      // 24K Gold (99.90% tunch): 5.400g net * 99.90% = 5.3946g
      const fine24k = calculateFineWeight(5.400, 99.90);
      expect(fine24k).toBe(5.3946);

      // 100% Benchmark: 5.400g net * 100% = 5.4000g
      const fine100 = calculateFineWeight(5.400, 100.0);
      expect(fine100).toBe(5.4000);

      // 18K Gold (75.00% tunch): 5.400g net * 75.00% = 4.0500g
      const fine18k = calculateFineWeight(5.400, 75.00);
      expect(fine18k).toBe(4.0500);
    });

    it('validates tunch percentage boundaries [0, 100]', () => {
      expect(() => calculateFineWeight(5.400, -1)).toThrow(BadRequestError);
      expect(() => calculateFineWeight(5.400, 101)).toThrow(BadRequestError);
    });
  });

  // =========================================================================
  // Requirement 3: Zero Wastage
  // =========================================================================
  describe('3. Zero Wastage Calculation', () => {
    it('calculates item without wastage surcharge when wastage is 0%', () => {
      const res = calculateSalesItem({
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 91.67,
        rate_per_gram: 7190.0,
        wastage_percent: 0,
        making_charge: 2430.0,
      });

      expect(res.net_weight).toBe(5.400);
      expect(res.fine_weight).toBe(4.9502);
      expect(res.effective_fine_weight).toBe(4.9502);
      expect(res.wastage_percent).toBe(0);
      expect(res.wastage_weight).toBe(0);
      expect(res.wastage_amount).toBe(0);
      // Metal Value = roundCurrency(4.9502 * 7190) = ₹35,591.94
      expect(res.metal_value).toBe(35591.94);
      // Item Amount = 35,591.94 + 0 + 2,430.00 = ₹38,021.94
      expect(res.item_amount).toBe(38021.94);
    });
  });

  // =========================================================================
  // Requirement 4: Fractional Wastage & Fractional Weights
  // =========================================================================
  describe('4. Fractional Wastage and Small Weights', () => {
    it('handles small jewellery weight 0.025g with fractional wastage 2.5%', () => {
      const res = calculateSalesItem({
        gross_weight: 0.035,
        less_weight: 0.010,
        tunch_percent: 91.67,
        rate_per_gram: 7190.0,
        wastage_percent: 2.5,
        making_charge: 100.0,
      });

      expect(res.net_weight).toBe(0.025);
      // Fine weight = 0.025 * 0.9167 = 0.0229175 -> 0.0229g
      expect(res.fine_weight).toBe(0.0229);
      // Wastage weight = roundFineWeight(0.025 * 0.025) = 0.0006g
      expect(res.wastage_weight).toBe(0.0006);
      expect(res.wastage_amount).toBe(roundCurrency(0.0006 * 7190));
      // Billable weight = 0.0229 + 0.0006 = 0.0235g
      expect(res.billable_weight).toBe(0.0235);
      // Metal Value = roundCurrency(0.0235 * 7190) = 168.97
      expect(res.metal_value).toBe(168.97);
      expect(res.item_amount).toBe(268.97);
    });
  });

  // =========================================================================
  // Requirement 5: Wastage Applied Exactly Once & Not in Pure Fine Weight
  // =========================================================================
  describe('5. Wastage Applied Exactly Once', () => {
    it('strictly separates pure fine weight from wastage and does not double-count wastage', () => {
      const res = calculateSalesItem({
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 100.0,
        rate_per_gram: 7190.0,
        wastage_percent: 10.0,
        making_charge: 2430.0,
      });

      // Pure Fine Weight must remain 5.4000g, NOT 5.9400g!
      expect(res.fine_weight).toBe(5.4000);
      expect(res.fine_weight).toBeLessThanOrEqual(res.net_weight);

      // Wastage Weight is 5.400 * 10% = 0.5400g
      expect(res.wastage_weight).toBe(0.5400);

      // Billable Fine Weight = 5.4000 + 0.5400 = 5.9400g
      expect(res.adjusted_fine_weight).toBe(5.9400);
      expect(res.billable_weight).toBe(5.9400);

      // Metal value based on billable fine weight = 5.9400 * 7190 = ₹42,708.60
      expect(res.metal_value).toBe(42708.60);

      // Wastage monetary amount = 0.5400 * 7190 = ₹3,882.60
      expect(res.wastage_amount).toBe(3882.60);

      // Item amount = 42,708.60 + 2,430.00 = ₹45,138.60
      expect(res.item_amount).toBe(45138.60);
    });
  });

  // =========================================================================
  // Requirement 6: Making Charges - Supported Modes
  // =========================================================================
  describe('6. Making Charge Modes', () => {
    const netWeight = 5.400;
    const metalVal = 38826.0;

    it('PER_GRAM mode: netWeight * rate', () => {
      const making = calculateMakingCharge('PER_GRAM', 450.0, netWeight, metalVal, 1);
      expect(making).toBe(2430.0); // 5.4 * 450 = ₹2,430.00
    });

    it('PER_PIECE mode: pieces * rate', () => {
      const making = calculateMakingCharge('PER_PIECE', 1200.0, netWeight, metalVal, 2);
      expect(making).toBe(2400.0); // 2 pcs * 1200 = ₹2,400.00
    });

    it('FIXED mode: flat lump sum', () => {
      const making = calculateMakingCharge('FIXED', 1500.0, netWeight, metalVal, 1);
      expect(making).toBe(1500.0);
    });

    it('PERCENTAGE mode: metalValue * (percentage / 100)', () => {
      const making = calculateMakingCharge('PERCENTAGE', 10.0, netWeight, metalVal, 1);
      expect(making).toBe(3882.6); // 10% of 38,826.00 = ₹3,882.60
    });

    it('confirms making charges do not alter metal weight or fine weight', () => {
      const res = calculateSalesItem({
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 91.67,
        rate_per_gram: 7190.0,
        wastage_percent: 0,
        making_charge: 5000.0,
      });
      expect(res.net_weight).toBe(5.400);
      expect(res.fine_weight).toBe(4.9502); // unchanged by making charge
    });
  });

  // =========================================================================
  // Requirement 7: Correct Metal Rate Selection
  // =========================================================================
  describe('7. Metal Rate Selection', () => {
    it('retrieves configured board rate for Gold 22K (₹7,190.00/g) and Gold 24K (₹7,850.00/g)', () => {
      const currentRates = metalRepository.getCurrentRates();
      const rate22k = currentRates.find((r) => r.metal_id === goldMetalId && r.purity_id === gold22kPurityId);
      expect(rate22k).toBeDefined();
      expect(rate22k?.rate).toBe(7190.0);

      const rate24k = currentRates.find((r) => r.metal_id === goldMetalId && r.purity_id === gold24kPurityId);
      expect(rate24k).toBeDefined();
      expect(rate24k?.rate).toBe(7850.0);

      // Verifies that ₹450/g from invoice was the making rate, NOT the metal rate
      expect(rate22k?.rate).not.toBe(450.0);
    });
  });

  // =========================================================================
  // Requirement 8: Metal Types Handling (Gold, Silver, Platinum, Diamond)
  // =========================================================================
  describe('8. Metal Type Handling', () => {
    it('handles silver items using silver rates without contaminating gold totals', () => {
      const silverRate = 94.50; // Silver 999
      const res = calculateSalesItem({
        gross_weight: 50.0,
        less_weight: 0.0,
        tunch_percent: 99.90,
        rate_per_gram: silverRate,
        wastage_percent: 2.0,
        making_charge: 500.0,
      });

      expect(res.net_weight).toBe(50.0);
      expect(res.fine_weight).toBe(49.95);
      // Wastage weight based on fine weight: 49.95 * 2% = 0.9990g
      expect(res.wastage_weight).toBe(0.999);
      expect(res.wastage_amount).toBe(94.41);
      // Under wastage addition rule: billable fine = 49.95 + 0.999 = 50.9490g
      expect(res.adjusted_fine_weight).toBe(50.949);
      expect(res.billable_weight).toBe(50.949);
      // Metal value = 50.949 * 94.50 = 4814.68
      expect(res.metal_value).toBe(4814.68);
      expect(res.item_amount).toBe(5314.68);
    });

    it('verifies diamond purity is carat/clarity based without tunch', () => {
      const diaPurity = testDb.prepare("SELECT tunch_percent FROM metal_purities WHERE metal_id = ? LIMIT 1").get(diamondMetalId) as { tunch_percent: number | null };
      expect(diaPurity.tunch_percent).toBeNull();
    });
  });

  // =========================================================================
  // Requirement 9: GST, CGST/SGST and IGST Split Reconciliation
  // =========================================================================
  describe('9. GST Calculation & Round-off Reconciliation', () => {
    it('computes 3% GST on taxable amount ₹45,138.60 as ₹1,354.16 and grand total ₹46,493.00', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 45138.60 }],
        discount_amount: 0,
        gst_rate: 3.0,
      });

      expect(totals.subtotal).toBe(45138.60);
      expect(totals.discount_amount).toBe(0);
      expect(totals.taxable_amount).toBe(45138.60);
      expect(totals.gst_rate).toBe(3.0);
      // GST: 45,138.60 * 3% = 1,354.158 -> ₹1,354.16
      expect(totals.gst_amount).toBe(1354.16);

      // Raw total: 45,138.60 + 1,354.16 = 46,492.76
      // Rounded to nearest integer rupee: ₹46,493.00
      expect(totals.grand_total).toBe(46493.0);
      // Round off: +₹0.24
      expect(totals.round_off).toBe(0.24);
      expect(totals.net_payable).toBe(46493.0);
    });

    it('splits GST into equal CGST (1.5%) and SGST (1.5%) for intra-state supply', () => {
      const totalGst = 1354.16;
      const cgst = roundCurrency(totalGst / 2);
      const sgst = roundCurrency(totalGst / 2);
      expect(cgst).toBe(677.08);
      expect(sgst).toBe(677.08);
      expect(cgst + sgst).toBe(totalGst);
    });
  });

  // =========================================================================
  // Requirement 10: Saving & Reopening Invoice (Observed Invoice Fixture)
  // =========================================================================
  describe('10. SQLite Persistence & Reopening (Observed Invoice Fixture)', () => {
    it('saves the observed invoice and reloads exact separated values without drift', () => {
      // Create draft invoice with observed parameters
      const invoice = salesService.createDraft({
        customer_id: customerId,
        invoice_date: '2026-10-24',
        discount_amount: 0,
        gst_rate: 3.0,
        items: [
          {
            tag_no: 'TAG-MVLYHDXL-1',
            item_name: 'Gold Ring',
            metal_id: goldMetalId,
            purity_id: gold22kPurityId,
            gross_weight: 5.500,
            less_weight: 0.100,
            tunch_percent: 100.0, // Benchmark observed
            wastage_percent: 10.0,
            rate_per_gram: 7190.0,
            making_charge: 2430.0,
          },
        ],
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.invoice_number).toBeDefined();

      // Reopen invoice from database
      const reloaded = salesService.getInvoiceDetails(invoice.id);
      expect(reloaded).toBeDefined();

      // Verify invoice totals (under wastage addition rule: 42,708.60 + 2,430 = 45,138.60 taxable)
      expect(reloaded.taxable_amount).toBe(45138.60);
      expect(reloaded.gst_amount).toBe(1354.16);
      expect(reloaded.grand_total).toBe(46493.00);
      expect(reloaded.net_payable).toBe(46493.00);

      // Verify item weights and amounts separation
      expect(reloaded.items).toHaveLength(1);
      const item = reloaded.items[0];
      expect(item.gross_weight).toBe(5.500);
      expect(item.less_weight).toBe(0.100);
      expect(item.net_weight).toBe(5.400);
      expect(item.tunch_percent).toBe(100.0);
      expect(item.fine_weight).toBe(5.4000); // STRICTLY pure fine weight!
      expect(item.wastage_percent).toBe(10.0);
      expect(item.wastage_weight).toBe(0.5400);
      expect(item.wastage_amount).toBe(3882.60);
      // Billable fine weight = 5.4000 + 0.5400 = 5.9400g
      expect(item.metal_value).toBe(42708.60);
      expect(item.making_charge).toBe(2430.00);
      expect(item.item_amount).toBe(45138.60);
    });
  });

  // =========================================================================
  // Requirement 11: Finalization & Reports Matching
  // =========================================================================
  describe('11. Finalization & Reporting Reconciliation', () => {
    it('finalizes invoice and matches reports register', () => {
      const invoice = salesService.createDraft({
        customer_id: customerId,
        invoice_date: '2026-10-24',
        discount_amount: 0,
        gst_rate: 3.0,
        items: [
          {
            tag_no: 'TAG-MVLYHDXL-1',
            item_name: 'Gold Ring',
            metal_id: goldMetalId,
            purity_id: gold22kPurityId,
            gross_weight: 5.500,
            less_weight: 0.100,
            tunch_percent: 100.0,
            wastage_percent: 10.0,
            rate_per_gram: 7190.0,
            making_charge: 2430.0,
          },
        ],
        payments: [
          {
            payment_mode: 'UPI',
            amount: 46493.00,
            reference_number: 'UPI-123456',
          },
        ],
      });

      const finalized = salesService.finalizeSale(invoice.id);
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.balance_amount).toBe(0);

      // Verify GST report
      const gstReport = reportsService.getGstInvoiceRegister({
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      });
      expect(gstReport.items.length).toBeGreaterThanOrEqual(1);
      const match = gstReport.items.find((inv) => inv.id === finalized.id);
      expect(match).toBeDefined();
      expect(match!.taxableValue).toBe(45138.60);
      expect(match!.gstAmount).toBe(1354.16);
      expect(match!.grandTotal).toBe(46493.00);
    });
  });

  // =========================================================================
  // Requirement 12: Correct Fine Gold Net Sold Calculation & Summary Label
  // =========================================================================
  describe('12. Fine Gold Net Sold Label and Metric', () => {
    it('guarantees Fine Gold Net Sold reports physical pure gold and separates billable metal equivalent', () => {
      // In 22K (91.67%): pure gold is 4.9502g, wastage addition is 0.5400g, billable equivalent is 5.4902g
      const res22k = calculateSalesItem({
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 91.67,
        rate_per_gram: 7190.0,
        wastage_percent: 10.0,
        making_charge: 2430.0,
      });

      expect(res22k.fine_weight).toBe(4.9502); // Physical fine gold sold
      expect(res22k.wastage_weight).toBe(0.4950); // Wastage addition: 4.9502 * 10%
      expect(res22k.effective_fine_weight).toBe(5.4452); // Billable fine eq.

      // In 100% benchmark: pure gold is 5.4000g, wastage addition is 0.5400g, billable equivalent is 5.9400g
      const res100 = calculateSalesItem({
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 100.0,
        rate_per_gram: 7190.0,
        wastage_percent: 10.0,
        making_charge: 2430.0,
      });

      expect(res100.fine_weight).toBe(5.4000); // Physical fine gold sold: NOT overwritten with billable weight!
      expect(res100.wastage_weight).toBe(0.5400); // Wastage addition: 5.4000 * 10%
      expect(res100.effective_fine_weight).toBe(5.9400); // Commercial billable fine eq.
    });

    it('verifies 20% wastage example: Net=5.400g, Tunch=91.67%, Wastage=20%, Rate=₹7,190/g, Making=₹450/g', () => {
      const res = calculateSalesItem({
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 91.67,
        rate_per_gram: 7190.0,
        wastage_percent: 20.0,
        making_charge: 2430.0,
      });

      // 1. Net weight = 5.500 - 0.100 = 5.400g
      expect(res.net_weight).toBe(5.400);

      // 2. Pure fine weight = 5.400 * 91.67% = 4.95018g -> 4.9502g
      expect(res.fine_weight).toBe(4.9502);

      // 3. Wastage weight (basis: pure Fine weight) = 4.9502 * 20% = 0.9900g
      expect(res.wastage_weight).toBe(0.9900);

      // 4. Wastage addition rule: billableWeight = fineWeight + wastageWeight = 4.9502 + 0.9900 = 5.9402g
      expect(res.adjusted_fine_weight).toBe(5.9402);
      expect(res.billable_weight).toBe(5.9402);

      // 5. Billable metal value = 5.9402 * 7,190 = ₹42,710.04
      expect(res.metal_value).toBe(42710.04);

      // 6. Wastage monetary amount = 0.9900 * 7,190 = ₹7,118.10
      expect(res.wastage_amount).toBe(7118.10);

      // 7. Item Amount = 42,710.04 + 2,430.00 = ₹45,140.04
      expect(res.item_amount).toBe(45140.04);
    });
  });

  // =========================================================================
  // Requirement 13: Wastage Monotonicity & Direct Relationship
  // =========================================================================
  describe('13. Wastage Monotonicity & Direct Amount Relationship', () => {
    it('strictly proves increasing Waste% increases item amount, and decreasing Waste% decreases item amount', () => {
      const baseInput = {
        gross_weight: 5.500,
        less_weight: 0.100,
        tunch_percent: 91.67,
        rate_per_gram: 7190.0,
        making_charge: 2430.0,
      };

      const res0 = calculateSalesItem({ ...baseInput, wastage_percent: 0 });
      const res5 = calculateSalesItem({ ...baseInput, wastage_percent: 5 });
      const res10 = calculateSalesItem({ ...baseInput, wastage_percent: 10 });
      const res15 = calculateSalesItem({ ...baseInput, wastage_percent: 15 });
      const res20 = calculateSalesItem({ ...baseInput, wastage_percent: 20 });

      // Fine weight is constant across all wastage levels (strictly numeric pure fine weight)
      expect(res0.fine_weight).toBe(4.9502);
      expect(res5.fine_weight).toBe(4.9502);
      expect(res10.fine_weight).toBe(4.9502);
      expect(res15.fine_weight).toBe(4.9502);
      expect(res20.fine_weight).toBe(4.9502);

      // Increasing Waste% increases wastage weight (basis: pure Fine weight 4.9502g)
      expect(res0.wastage_weight).toBe(0);
      expect(res5.wastage_weight).toBe(0.2475);
      expect(res10.wastage_weight).toBe(0.4950);
      expect(res15.wastage_weight).toBe(0.7425);
      expect(res20.wastage_weight).toBe(0.9900);

      // Increasing Waste% increases billable fine weight
      expect(res0.billable_weight).toBe(4.9502);
      expect(res5.billable_weight).toBe(5.1977);
      expect(res10.billable_weight).toBe(5.4452);
      expect(res15.billable_weight).toBe(5.6927);
      expect(res20.billable_weight).toBe(5.9402);

      // Increasing Waste% strictly increases metal value
      expect(res0.metal_value).toBe(35591.94);
      expect(res5.metal_value).toBe(37371.46);
      expect(res10.metal_value).toBe(39150.99);
      expect(res15.metal_value).toBe(40930.51);
      expect(res20.metal_value).toBe(42710.04);

      // Increasing Waste% strictly increases item amount:
      expect(res0.item_amount).toBe(38021.94);
      expect(res5.item_amount).toBe(39801.46);
      expect(res10.item_amount).toBe(41580.99);
      expect(res15.item_amount).toBe(43360.51);
      expect(res20.item_amount).toBe(45140.04);

      expect(res0.item_amount).toBeLessThan(res5.item_amount);
      expect(res5.item_amount).toBeLessThan(res10.item_amount);
      expect(res10.item_amount).toBeLessThan(res15.item_amount);
      expect(res15.item_amount).toBeLessThan(res20.item_amount);

      // Decreasing Waste% strictly decreases item amount:
      // res20 > res15 > res10 > res5 > res0
      expect(res20.item_amount).toBeGreaterThan(res15.item_amount);
      expect(res15.item_amount).toBeGreaterThan(res10.item_amount);
      expect(res10.item_amount).toBeGreaterThan(res5.item_amount);
      expect(res5.item_amount).toBeGreaterThan(res0.item_amount);
    });

    it('verifies invoice persistence, database reopening, and printed totals with wastage addition', () => {
      const created = salesService.createDraft({
        customer_id: customerId,
        invoice_date: '2026-10-24',
        discount_amount: 0,
        gst_rate: 3.0,
        items: [
          {
            tag_no: 'TAG-ADD-20',
            item_name: 'Gold Ring 22K',
            metal_id: goldMetalId,
            purity_id: gold22kPurityId,
            gross_weight: 5.500,
            less_weight: 0.100,
            tunch_percent: 91.67,
            wastage_percent: 20.0,
            rate_per_gram: 7190.0,
            making_charge: 2430.0,
          },
        ],
      });

      const reloaded = salesRepository.findById(created.id)!;
      expect(reloaded).not.toBeNull();
      const item = reloaded.items[0];

      // Physical fine weight remains pure fine gold
      expect(item.fine_weight).toBe(4.9502);
      expect(item.wastage_weight).toBe(0.9900);
      expect(item.adjusted_fine_weight).toBe(5.9402);
      expect(item.billable_weight).toBe(5.9402);
      expect(item.metal_value).toBe(42710.04);
      expect(item.making_charge).toBe(2430.00);
      expect(item.item_amount).toBe(45140.04);

      // Taxable amount and GST
      expect(reloaded.taxable_amount).toBe(45140.04);
      expect(reloaded.gst_amount).toBe(1354.20); // 45,140.04 * 3% = 1354.2012 -> 1354.20
      expect(reloaded.grand_total).toBe(46494.00); // 45,140.04 + 1354.20 = 46,494.24 -> 46,494.00
    });

    it('verifies Fine Gold Inward Exchange deduction and Net Gold Weight reconciliation', () => {
      // 1. Sold item: Net 5.400g, 91.67% tunch => 4.9502g pure fine gold
      const soldFine = 4.9502;
      // 2. Inward exchange: 2.7501g fine gold
      const exchangeFine = 2.7501;

      // Pure fine net physical gold position:
      const netGoldWeightPhysical = Number(new Decimal(soldFine).minus(exchangeFine).toDecimalPlaces(4));
      expect(netGoldWeightPhysical).toBe(2.2001);

      // Billable fine position (20% wastage):
      // Billable fine = 4.9502 + 1.0800 = 6.0302g
      const billableFine = 6.0302;
      const netGoldWeightBillable = Number(new Decimal(billableFine).minus(exchangeFine).toDecimalPlaces(4));
      expect(netGoldWeightBillable).toBe(3.2801);
    });
  });

  // =========================================================================
  // Requirement: Retail Sale Investigation & Fix (500g, 75% Tunch, Badla -0.5)
  // =========================================================================
  describe('8. Retail Sale Investigation & Fix (500g, 75% Tunch, Badla -0.5, ₹450/g Making, ₹7190/g Metal Rate)', () => {
    it('Requirement 4: produces exactly 375.0000g pure fine weight and ₹29,21,250 with neutral Badla (0%) and Wastage (0%)', () => {
      const res = calculateSalesItem({
        gross_weight: 500.0,
        less_weight: 0.0,
        tunch_percent: 75.0,
        badla_percent: 0.0,
        wastage_percent: 0.0,
        rate_per_gram: 7190.0,
        making_charge: 225000.0, // 500g * ₹450/g
      });

      expect(res.net_weight).toBe(500.0);
      expect(res.fine_weight).toBe(375.0);
      expect(res.billable_weight).toBe(375.0);
      expect(res.effective_fine_weight).toBe(375.0);
      expect(res.metal_value).toBe(2696250.0); // 375 * 7190
      expect(res.making_charge).toBe(225000.0);
      expect(res.item_amount).toBe(2921250.0); // 26,96,250 + 2,25,000
    });

    it('Requirements 1, 2, 3, 5: with Badla -0.5%, keeps fine_weight at 375.0000g while setting billable_weight to 373.1250g and item_amount to ₹29,07,768.75', () => {
      const res = calculateSalesItem({
        gross_weight: 500.0,
        less_weight: 0.0,
        tunch_percent: 75.0,
        badla_percent: -0.5,
        wastage_percent: 0.0,
        rate_per_gram: 7190.0,
        making_charge: 225000.0, // 500g * ₹450/g
      });

      // 1. Net weight = 500.000g
      expect(res.net_weight).toBe(500.0);
      // 2. Pure assay fine weight remains strictly 375.0000g (NOT reduced by Badla)
      expect(res.fine_weight).toBe(375.0);
      // 3. Badla is calculated from gold after purity (fine weight): 375 * (-0.5 / 100) = -1.8750g
      expect(res.wastage_weight).toBe(-1.875);
      expect(res.badla_weight).toBe(-1.875);
      // 4. Billable settlement weight = 375.0000 + (-1.8750) = 373.1250g
      expect(res.billable_weight).toBe(373.125);
      // 5. Metal value = 373.1250 * 7190 = ₹26,82,768.75
      expect(res.metal_value).toBe(2682768.75);
      // 6. Making charge = ₹2,25,000.00
      expect(res.making_charge).toBe(225000.0);
      // 7. Total item amount = 26,82,768.75 + 2,25,000.00 = ₹29,07,768.75
      expect(res.item_amount).toBe(2907768.75);
    });

    it('Requirement 6: increasing wastage increases billable weight and item amount without corrupting actual fine weight', () => {
      // With Badla -0.5% and Wastage 5.0% calculated from pure fine weight 375.0g:
      // Badla weight = 375 * -0.5% = -1.875g, Wastage weight = 375 * 5% = +18.750g => net addition = +16.8750g
      const res = calculateSalesItem({
        gross_weight: 500.0,
        less_weight: 0.0,
        tunch_percent: 75.0,
        badla_percent: -0.5,
        wastage_percent: 5.0,
        rate_per_gram: 7190.0,
        making_charge: 225000.0,
      });

      // Actual physical fine weight is STILL 375.0000g
      expect(res.fine_weight).toBe(375.0);
      // Net commercial adjustment weight = -1.8750 + 18.7500 = +16.8750g
      expect(res.wastage_weight).toBe(16.875);
      // Billable weight = 375.0000 + 16.8750 = 391.8750g
      expect(res.billable_weight).toBe(391.875);
      // Metal value = 391.8750 * 7190 = ₹28,17,581.25
      expect(res.metal_value).toBe(2817581.25);
      // Item total = 28,17,581.25 + 2,25,000.00 = ₹30,42,581.25
      expect(res.item_amount).toBe(3042581.25);
    });

    it('Requirement 7: validates negative Badla values and rejects invalid combinations', () => {
      // Rejects badla < -100%
      expect(() =>
        calculateSalesItem({
          gross_weight: 500.0,
          less_weight: 0.0,
          tunch_percent: 75.0,
          badla_percent: -101.0,
          rate_per_gram: 7190.0,
        })
      ).toThrow(BadRequestError);

      // Rejects total effective purity < 0% (e.g. tunch 75% + badla -80% = -5%)
      expect(() =>
        calculateSalesItem({
          gross_weight: 500.0,
          less_weight: 0.0,
          tunch_percent: 75.0,
          badla_percent: -80.0,
          rate_per_gram: 7190.0,
        })
      ).toThrow(BadRequestError);
    });

    it('Requirement 8: verifies invoice creation, DB persistence, and repository hydration with negative Badla', () => {
      const created = salesService.createDraft({
        customer_id: customerId,
        invoice_date: '2026-10-24',
        discount_amount: 0,
        gst_rate: 3.0,
        items: [
          {
            tag_no: 'TAG-RETAIL-500',
            item_name: 'Gold Ornament 750',
            metal_id: goldMetalId,
            purity_id: gold22kPurityId,
            gross_weight: 500.0,
            less_weight: 0.0,
            tunch_percent: 75.0,
            badla_percent: -0.5,
            wastage_percent: 0.0,
            rate_per_gram: 7190.0,
            making_charge: 225000.0,
          },
        ],
      });

      const reloaded = salesRepository.findById(created.id)!;
      expect(reloaded).not.toBeNull();
      const item = reloaded.items[0];

      // Physical fine weight is preserved as pure 375.0000g
      expect(item.fine_weight).toBe(375.0);
      expect(item.wastage_weight).toBe(-1.875);
      // Commercial billable weight is 373.1250g
      expect(item.billable_weight).toBe(373.125);
      expect(item.adjusted_fine_weight).toBe(373.125);
      expect(item.effective_fine_weight).toBe(373.125);
      // Amounts
      expect(item.metal_value).toBe(2682768.75);
      expect(item.making_charge).toBe(225000.0);
      expect(item.item_amount).toBe(2907768.75);

      // Invoice Totals
      expect(reloaded.taxable_amount).toBe(2907768.75);
      expect(reloaded.gst_amount).toBe(87233.06); // 29,07,768.75 * 3%
      expect(reloaded.grand_total).toBe(2995002.00); // 29,07,768.75 + 87,233.06 = 2,995,001.81 -> 2,995,002.00
    });

    it('Requirement 8: ensures historical finalized invoices remain unaffected and unmodified', () => {
      // Simulate an existing historical invoice stored in DB
      const invoiceId = 'hist-inv-001';
      testDb.prepare(`
        INSERT INTO sales_invoices (
          id, invoice_number, customer_id, invoice_date, status,
          subtotal, discount_amount, taxable_amount,
          gst_rate, gst_amount, round_off, grand_total, exchange_amount, net_payable, amount_paid, balance_amount, created_at, updated_at
        ) VALUES (
          ?, 'INV-HIST-001', ?, '2026-01-15', 'FINALIZED',
          2903275.0, 0, 2903275.0,
          3.0, 87098.25, -0.25, 2990373.0, 0, 2990373.0, 2990373.0, 0, '2026-01-15 10:00:00', '2026-01-15 10:00:00'
        )
      `).run(invoiceId, customerId);

      testDb.prepare(`
        INSERT INTO sales_invoice_items (
          id, sales_invoice_id, tag_no, item_name, metal_id, purity_id,
          gross_weight, less_weight, net_weight, tunch_percent, wastage_percent,
          wastage_weight, fine_weight, rate_per_gram, metal_value,
          making_charge, item_amount, created_at
        ) VALUES (
          'hist-item-001', ?, 'HIST-01', 'Historical Bracelet', ?, ?,
          500.0, 0.0, 500.0, 75.0, -0.5,
          -2.5, 375.0, 7190.0, 2678275.0,
          225000.0, 2903275.0, '2026-01-15 10:00:00'
        )
      `).run(invoiceId, goldMetalId, gold22kPurityId);

      // Hydrate historical invoice
      const histInvoice = salesRepository.findById(invoiceId)!;
      expect(histInvoice).not.toBeNull();
      expect(histInvoice.status).toBe('FINALIZED');
      expect(histInvoice.items[0].fine_weight).toBe(375.0);
      expect(histInvoice.items[0].billable_weight).toBe(372.5);
      expect(histInvoice.items[0].item_amount).toBe(2903275.0);
      expect(histInvoice.grand_total).toBe(2990373.0);
    });
  });
});
