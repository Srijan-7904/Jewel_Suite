import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { getDb } from '../src/database/connection/db.js';
import { salesService } from '../src/services/sales.service.js';
import { salesRepository } from '../src/repositories/sales.repository.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { calculateSalesTotals } from '../src/utils/salesMath.js';
import {
  calculateMetalPaymentValue,
  calculateMetalPaymentWeight,
  calculateMakingCharge,
  roundWeight,
  roundCurrency,
} from '../src/utils/jewelleryMath.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite: Retail Invoice Payment Received, Metal Payment & Balance Calculation', () => {
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
  // Benchmark Cases A to F (Calculation & Conversion Rules)
  // =========================================================================

  describe('Benchmark Test Cases A to F', () => {
    it('Case A — Cash payment: Net ₹12,000, Cash ₹10,000 -> Balance ₹2,000', () => {
      const netPayable = 12000;
      const cashReceived = 10000;
      const totals = calculateSalesTotals({
        items: [{ item_amount: 11650.49 }], // Subtotal that with 3% GST rounds to 12,000
        discount_amount: 0,
        gst_rate: 3,
        payments: [{ amount: cashReceived }],
      });

      expect(totals.grand_total).toBe(netPayable);
      expect(totals.net_payable).toBe(netPayable);
      expect(totals.amount_paid).toBe(cashReceived);
      expect(totals.balance_amount).toBe(2000);
      expect(totals.change_due).toBe(0);
      expect(totals.is_settled).toBe(false);
    });

    it('Case B — Cash plus gold: Net ₹12,000, Cash ₹5,000, Gold ₹4,000 -> Received ₹9,000, Balance ₹3,000', () => {
      const netPayable = 12000;
      const cashReceived = 5000;
      const goldPaymentValue = 4000;
      const totalReceived = cashReceived + goldPaymentValue;

      const totals = calculateSalesTotals({
        items: [{ item_amount: 11650.49 }],
        discount_amount: 0,
        gst_rate: 3,
        payments: [
          { amount: cashReceived },
          { amount: goldPaymentValue },
        ],
      });

      expect(totals.net_payable).toBe(netPayable);
      expect(totals.amount_paid).toBe(totalReceived);
      expect(totals.amount_paid).toBe(9000);
      expect(totals.balance_amount).toBe(3000);
      expect(totals.change_due).toBe(0);
      expect(totals.is_settled).toBe(false);
    });

    it('Case C — Fully settled: Net ₹12,000, Cash ₹7,000, Gold ₹5,000 -> Balance ₹0, Settled', () => {
      const netPayable = 12000;
      const cashReceived = 7000;
      const goldPaymentValue = 5000;
      const totalReceived = cashReceived + goldPaymentValue;

      const totals = calculateSalesTotals({
        items: [{ item_amount: 11650.49 }],
        discount_amount: 0,
        gst_rate: 3,
        payments: [
          { amount: cashReceived },
          { amount: goldPaymentValue },
        ],
      });

      expect(totals.net_payable).toBe(netPayable);
      expect(totals.amount_paid).toBe(totalReceived);
      expect(totals.amount_paid).toBe(12000);
      expect(totals.balance_amount).toBe(0);
      expect(totals.change_due).toBe(0);
      expect(totals.is_settled).toBe(true);
    });

    it('Case D — Gold amount converted to grams: ₹10,000 @ ₹5,000/g -> 2.000 g', () => {
      const goldAmount = 10000;
      const applicableRate = 5000;
      const grams = calculateMetalPaymentWeight(goldAmount, applicableRate);

      expect(grams).toBe(2.0);
      expect(roundWeight(grams)).toBe(2.0);
    });

    it('Case E — Gold grams converted to amount: 1.250 g @ ₹5,000/g -> ₹6,250', () => {
      const goldWeight = 1.25;
      const applicableRate = 5000;
      const amount = calculateMetalPaymentValue(goldWeight, applicableRate);

      expect(amount).toBe(6250);
      expect(roundCurrency(amount)).toBe(6250);
    });

    it('Case F — Invalid rate: Throws or rejects rate <= 0 instead of using zero or hardcoded rate', () => {
      expect(() => calculateMetalPaymentWeight(10000, 0)).toThrow(BadRequestError);
      expect(() => calculateMetalPaymentWeight(10000, -100)).toThrow(BadRequestError);
      expect(() => calculateMetalPaymentValue(1.25, 0)).toThrow(BadRequestError);
      expect(() => calculateMetalPaymentValue(1.25, -5000)).toThrow(BadRequestError);
    });
  });

  // =========================================================================
  // Additional Edge Cases & Complex Scenarios
  // =========================================================================

  describe('Multiple Modes, Precision, Overpayments & Exchange', () => {
    it('handles multiple payments (Cash + UPI + Bank + Gold + Silver)', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 25000 }],
        discount_amount: 500,
        gst_rate: 3,
        exchange_amount: 5000,
        payments: [
          { amount: 5000 }, // Cash
          { amount: 3000 }, // UPI
          { amount: 2000 }, // Bank
          { amount: 6250 }, // Gold (1.25g @ 5000)
          { amount: 1500 }, // Silver (20g @ 75)
        ],
      });

      // Subtotal: 25000
      // Discount: 500 -> Taxable: 24500
      // GST (3%): 735 -> Grand Total: 25235
      // Net Payable: 25235 - 5000 (Exchange) = 20235
      // Total Paid: 5000 + 3000 + 2000 + 6250 + 1500 = 17750
      // Balance: 20235 - 17750 = 2485
      expect(totals.subtotal).toBe(25000);
      expect(totals.discount_amount).toBe(500);
      expect(totals.taxable_amount).toBe(24500);
      expect(totals.gst_amount).toBe(735);
      expect(totals.grand_total).toBe(25235);
      expect(totals.exchange_amount).toBe(5000);
      expect(totals.net_payable).toBe(20235);
      expect(totals.amount_paid).toBe(17750);
      expect(totals.balance_amount).toBe(2485);
      expect(totals.change_due).toBe(0);
      expect(totals.is_settled).toBe(false);
    });

    it('calculates change due on customer overpayment and flags settled', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 10000 }],
        discount_amount: 0,
        gst_rate: 3,
        payments: [{ amount: 11000 }], // Customer tendered ₹11,000 for ₹10,300 bill
      });

      // Taxable: 10000, GST: 300, Grand Total: 10300
      // Net Payable: 10300, Paid: 11000
      // Remaining Balance: 0, Change Due: 700
      expect(totals.grand_total).toBe(10300);
      expect(totals.net_payable).toBe(10300);
      expect(totals.amount_paid).toBe(11000);
      expect(totals.balance_amount).toBe(0);
      expect(totals.change_due).toBe(700);
      expect(totals.is_settled).toBe(true);
    });

    it('preserves small weights like 0.025g during metal payment calculation', () => {
      const rate = 7200;
      const weight = 0.025; // 25 mg nose pin scrap
      const value = calculateMetalPaymentValue(weight, rate);
      // 0.025 * 7200 = 180.00
      expect(value).toBe(180);

      const convertedWeight = calculateMetalPaymentWeight(180, rate);
      expect(convertedWeight).toBe(0.025);
    });

    it('never marks invoice settled when net payable is pending or payments are empty', () => {
      const totals = calculateSalesTotals({
        items: [{ item_amount: 5000 }],
        discount_amount: 0,
        gst_rate: 3,
        payments: [{ amount: 0 }],
      });

      expect(totals.net_payable).toBe(5150);
      expect(totals.amount_paid).toBe(0);
      expect(totals.balance_amount).toBe(5150);
      expect(totals.is_settled).toBe(false);
    });
  });

  // =========================================================================
  // Persistence & Lifecycle (Create Draft -> Edit Payments -> Reopen -> Finalize)
  // =========================================================================

  describe('Invoice Persistence Lifecycle with Payments', () => {
    it('persists cash, gold and silver payments and recalculates balance upon reopening and updating', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      // 1. Create Draft with Cash + Gold payment
      const draft = salesService.createDraft({
        customer_id: customer.id,
        invoice_date: '2026-10-17',
        gst_rate: 3,
        items: [
          {
            item_name: 'Gold Necklace',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 10.0,
            less_weight: 0.0,
            rate_per_gram: 7000,
            making_charge: 1000,
          },
        ],
        payments: [
          { payment_mode: 'CASH', amount: 30000, reference_number: 'CASH-01' },
          {
            payment_mode: 'GOLD',
            amount: 25000,
            metal_weight: 5.0,
            metal_rate: 5000,
            notes: 'Gold tender 22K',
          },
        ],
      });

      expect(draft.id).toBeDefined();
      expect(draft.payments).toHaveLength(2);
      expect(draft.amount_paid).toBe(55000);

      // Verify metal details stored
      const goldPayment = draft.payments.find((p) => p.payment_mode === 'GOLD');
      expect(goldPayment).toBeDefined();
      expect(goldPayment?.amount).toBe(25000);
      expect(goldPayment?.metal_weight).toBe(5.0);
      expect(goldPayment?.metal_rate).toBe(5000);

      // 2. Reopen saved invoice from database
      const reopened = salesService.getInvoiceDetails(draft.id);
      expect(reopened.amount_paid).toBe(55000);
      expect(reopened.payments).toHaveLength(2);
      expect(reopened.balance_amount).toBe(draft.balance_amount);

      // 3. Update Draft with additional payment row (UPI)
      const updated = salesService.updateDraft(draft.id, {
        payments: [
          { payment_mode: 'CASH', amount: 30000, reference_number: 'CASH-01' },
          {
            payment_mode: 'GOLD',
            amount: 25000,
            metal_weight: 5.0,
            metal_rate: 5000,
            notes: 'Gold tender 22K',
          },
          { payment_mode: 'UPI', amount: draft.balance_amount, reference_number: 'UPI-FINAL-01' },
        ],
      });

      // Now invoice should be fully paid
      expect(updated.payments).toHaveLength(3);
      expect(updated.amount_paid).toBe(updated.net_payable);
      expect(updated.balance_amount).toBe(0);

      // 4. Finalize sale
      const finalized = salesService.finalizeSale(draft.id);
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.balance_amount).toBe(0);
      expect(finalized.amount_paid).toBe(finalized.net_payable);
    });
  });

  // =========================================================================
  // Making Charge Modes: Per Piece / Fixed, Per Gram & Percentage
  // =========================================================================

  describe('Making Charge Modes: Per Piece / Fixed, Per Gram & Percentage', () => {
    it('distinguishes between FIXED (flat lump sum) and PER_PIECE (pieces * rate)', () => {
      // 3 pieces, rate 750:
      // FIXED is flat lump sum: 750 regardless of pieces
      const fixedCharge = calculateMakingCharge('FIXED', 750, 10.0, 50000, 3);
      expect(fixedCharge).toBe(750);

      // PER_PIECE multiplies by pieces: 3 * 750 = 2250
      const perPieceCharge = calculateMakingCharge('PER_PIECE', 750, 10.0, 50000, 3);
      expect(perPieceCharge).toBe(2250);
    });

    it('calculates per gram and percentage making charge correctly', () => {
      // 10g @ 450/g = 4500
      const perGramCharge = calculateMakingCharge('PER_GRAM', 450, 10.0, 50000);
      expect(perGramCharge).toBe(4500);

      // 10% on 50,000 metal value = 5000
      const percentCharge = calculateMakingCharge('PERCENTAGE', 10, 10.0, 50000);
      expect(percentCharge).toBe(5000);
    });

    it('creates draft invoice with PER_PIECE making charge (multiplying pieces)', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const draft = salesService.createDraft({
        customer_id: customer.id,
        items: [
          {
            item_name: 'Gold Tops (Pair)',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 5.0,
            less_weight: 0.0,
            rate_per_gram: 7000,
            pieces: 2,
            making_rate: 800,
            making_charge_type: 'PER_PIECE',
          },
        ],
      });

      // Fine weight = 5.0g * 91.6% = 4.58g. Metal value = 4.58 * 7000 = 32060.
      // 2 pieces * 800/pc = 1600 making charge.
      // Item amount = 32060 + 1600 = 33660
      expect(draft.items[0].making_charge).toBe(1600);
      expect(draft.items[0].item_amount).toBe(33660);
    });

    it('creates draft invoice with FIXED making charge (flat amount independent of pieces)', () => {
      const db = getDb();
      const customer = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string };
      const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string };
      const purity = db.prepare("SELECT id FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string };

      const draft = salesService.createDraft({
        customer_id: customer.id,
        items: [
          {
            item_name: 'Gold Tops (Pair)',
            metal_id: gold.id,
            purity_id: purity.id,
            gross_weight: 5.0,
            less_weight: 0.0,
            rate_per_gram: 7000,
            pieces: 2,
            making_rate: 800,
            making_charge_type: 'FIXED',
          },
        ],
      });

      // Flat fixed making charge = 800 (not multiplied by pieces)
      // Item amount = 32060 + 800 = 32860
      expect(draft.items[0].making_charge).toBe(800);
      expect(draft.items[0].item_amount).toBe(32860);
    });
  });
});
