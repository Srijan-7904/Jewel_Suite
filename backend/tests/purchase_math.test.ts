import { describe, it, expect } from 'vitest';
import {
  calculatePurchaseItem,
  calculatePurchaseTotals,
} from '../src/utils/purchaseMath.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite Part 5: Purchase Calculations & Financial Engine Tests', () => {
  describe('Purchase Item Calculation (Section 10, 11, 12, 47)', () => {
    it('should accurately calculate purchase item net weight, fine weight, and metal value', () => {
      // Example: Gross = 10.000g, Less = 0.500g -> Net = 9.500g
      // Tunch = 91.67% -> Fine = 9.5 * 0.9167 = 8.70865 -> 8.7087g
      // Rate = ₹7,000/g -> Metal Value = 8.7087 * 7000 = ₹60,960.90
      // Making = ₹1,200 -> Item Amount = ₹62,160.90
      const res = calculatePurchaseItem({
        gross_weight: 10.0,
        less_weight: 0.5,
        tunch_percent: 91.67,
        rate_per_gram: 7000.0,
        making_charge: 1200.0,
      });

      expect(res.net_weight).toBe(9.5);
      expect(res.fine_weight).toBe(8.7087);
      expect(res.metal_value).toBe(60960.9);
      expect(res.item_amount).toBe(62160.9);
    });

    it('should reject invalid weights (less > gross or negative weights)', () => {
      expect(() =>
        calculatePurchaseItem({
          gross_weight: 5.0,
          less_weight: 6.0,
          tunch_percent: 91.67,
          rate_per_gram: 7000.0,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        calculatePurchaseItem({
          gross_weight: -2.0,
          less_weight: 0,
          tunch_percent: 91.67,
          rate_per_gram: 7000.0,
        })
      ).toThrow(BadRequestError);
    });

    it('should reject invalid tunch % (> 100 or negative)', () => {
      expect(() =>
        calculatePurchaseItem({
          gross_weight: 10.0,
          less_weight: 0,
          tunch_percent: 105.0,
          rate_per_gram: 7000.0,
        })
      ).toThrow(BadRequestError);
    });
  });

  describe('Purchase Bill Totals, GST, Round Off & Balance (Section 19, 20, 21, 54)', () => {
    it('should calculate subtotal, discount, taxable amount, GST (3%), and grand total correctly', () => {
      const items = [
        { item_amount: 60000.0 },
        { item_amount: 40000.0 },
      ];

      // Subtotal = 100,000
      // Discount = 5,000 -> Taxable = 95,000
      // GST 3% = 95,000 * 3% = 2,850
      // Raw Total = 97,850 -> Grand Total = 97,850, Round Off = 0
      const totals = calculatePurchaseTotals({
        items,
        discount_amount: 5000.0,
        gst_rate: 3.0,
      });

      expect(totals.subtotal).toBe(100000.0);
      expect(totals.discount_amount).toBe(5000.0);
      expect(totals.taxable_amount).toBe(95000.0);
      expect(totals.gst_rate).toBe(3.0);
      expect(totals.gst_amount).toBe(2850.0);
      expect(totals.grand_total).toBe(97850.0);
      expect(totals.balance_amount).toBe(97850.0);
    });

    it('should calculate payments and balance payable accurately (Section 54)', () => {
      // Test 54: Purchase = ₹100,000, Cash = ₹40,000, UPI = ₹20,000 -> Paid = ₹60,000, Balance = ₹40,000
      const items = [{ item_amount: 100000.0 }];
      const payments = [
        { amount: 40000.0 },
        { amount: 20000.0 },
      ];

      const totals = calculatePurchaseTotals({
        items,
        discount_amount: 0,
        gst_rate: 0, // Zero GST for test 54 exact number matching
        payments,
      });

      expect(totals.grand_total).toBe(100000.0);
      expect(totals.amount_paid).toBe(60000.0);
      expect(totals.balance_amount).toBe(40000.0);
    });

    it('should reject discount greater than subtotal', () => {
      expect(() =>
        calculatePurchaseTotals({
          items: [{ item_amount: 10000.0 }],
          discount_amount: 15000.0,
        })
      ).toThrow(BadRequestError);
    });

    it('should reject negative GST rate', () => {
      expect(() =>
        calculatePurchaseTotals({
          items: [{ item_amount: 10000.0 }],
          gst_rate: -1.0,
        })
      ).toThrow(BadRequestError);
    });
  });
});
