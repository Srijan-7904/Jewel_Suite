import { describe, it, expect } from 'vitest';
import {
  calculateExchangeItem,
  calculateExchangeTotals,
} from '../src/utils/exchangeMath.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite Part 6: Exchange Math Calculations', () => {
  describe('Single Item Calculation (Section 1, 8, 41)', () => {
    it('calculates correct fine weight and metal value for standard gold exchange', () => {
      // Example from Section 1: Net = 10g, Tunch = 75%, Fine = 7.5g, Rate = ₹7000/g => ₹52500
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 75.0,
        exchange_rate: 7000.0,
      });

      expect(result.net_weight).toBe(10.0);
      expect(result.fine_weight).toBe(7.5);
      expect(result.metal_value).toBe(52500.0);
      expect(result.deduction_amount).toBe(0.0);
      expect(result.exchange_value).toBe(52500.0);
    });

    it('calculates deduction percent correctly (Section 8, 9)', () => {
      // Fine Weight = 10g, Rate = ₹7000 => Metal Value = ₹70000
      // Deduction = 5% => Deduction Amount = ₹3500 => Exchange Value = ₹66500
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 100.0,
        exchange_rate: 7000.0,
        deduction_percent: 5.0,
      });

      expect(result.net_weight).toBe(10.0);
      expect(result.fine_weight).toBe(10.0);
      expect(result.metal_value).toBe(70000.0);
      expect(result.deduction_percent).toBe(5.0);
      expect(result.deduction_amount).toBe(3500.0);
      expect(result.exchange_value).toBe(66500.0);
    });

    it('handles deduction amount and calculates implied percentage', () => {
      const result = calculateExchangeItem({
        gross_weight: 12.5,
        less_weight: 0.5,
        tunch_percent: 91.67,
        exchange_rate: 7190.0,
        deduction_amount: 1500.0,
      });

      expect(result.net_weight).toBe(12.0);
      expect(result.fine_weight).toBe(11.0004);
      expect(result.metal_value).toBe(79092.88);
      expect(result.deduction_amount).toBe(1500.0);
      expect(result.deduction_percent).toBe(1.9); // ~1.90%
      expect(result.exchange_value).toBe(77592.88);
    });

    it('rejects invalid inputs such as negative weights or deductions exceeding metal value', () => {
      expect(() =>
        calculateExchangeItem({
          gross_weight: -5,
          tunch_percent: 90,
          exchange_rate: 7000,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        calculateExchangeItem({
          gross_weight: 10,
          less_weight: 12,
          tunch_percent: 90,
          exchange_rate: 7000,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        calculateExchangeItem({
          gross_weight: 10,
          tunch_percent: 105,
          exchange_rate: 7000,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        calculateExchangeItem({
          gross_weight: 10,
          tunch_percent: 90,
          exchange_rate: 7000,
          deduction_amount: 100000, // exceeds metal value
        })
      ).toThrow(BadRequestError);
    });
  });

  describe('Multiple Exchange Items & Aggregation (Section 10, 42)', () => {
    it('aggregates multiple old metal items accurately (Section 42: ₹30000 + ₹20000 + ₹10000 = ₹60000)', () => {
      const items = [
        {
          gross_weight: 5.0,
          net_weight: 5.0,
          fine_weight: 4.5,
          metal_value: 30000.0,
          deduction_amount: 0.0,
          exchange_value: 30000.0,
        },
        {
          gross_weight: 3.5,
          net_weight: 3.5,
          fine_weight: 3.0,
          metal_value: 20000.0,
          deduction_amount: 0.0,
          exchange_value: 20000.0,
        },
        {
          gross_weight: 2.0,
          net_weight: 2.0,
          fine_weight: 1.5,
          metal_value: 10000.0,
          deduction_amount: 0.0,
          exchange_value: 10000.0,
        },
      ];

      const totals = calculateExchangeTotals({ items, payout_amount: 0 });

      expect(totals.total_gross_weight).toBe(10.5);
      expect(totals.total_net_weight).toBe(10.5);
      expect(totals.total_fine_weight).toBe(9.0);
      expect(totals.total_metal_value).toBe(60000.0);
      expect(totals.total_deduction_amount).toBe(0.0);
      expect(totals.total_exchange_value).toBe(60000.0);
    });
  });

  describe('Exchange Sales Parity: Badla%, Waste%, and Making Charge Modes', () => {
    it('calculates Badla% and Waste% based on pure fine weight', () => {
      // Net = 10g, Tunch = 91.67% => pure fine = 9.1670g
      // Badla = -2% (on fine) => badla weight = 9.167 * -2% = -0.1833g
      // Waste = +1% (on net) => waste weight = 10.0 * 1% = +0.1000g
      // Net addition = -0.0833g => billable fine = 9.0837g
      // Rate = ₹7,000/g => metal value = 9.0837 * 7000 = ₹63,585.90
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        less_weight: 0.0,
        tunch_percent: 91.67,
        badla_percent: -2.0,
        wastage_percent: 1.0,
        exchange_rate: 7000.0,
      });

      expect(result.net_weight).toBe(10.0);
      expect(result.fine_weight).toBe(9.167);
      expect(result.badla_weight).toBe(-0.1833);
      expect(result.wastage_weight).toBe(0.1);
      expect(result.billable_weight).toBe(9.0837);
      expect(result.metal_value).toBe(63585.9);
      expect(result.exchange_value).toBe(63585.9);
    });

    it('calculates PERCENTAGE making charge deduction', () => {
      // Net = 10g, 100% fine, rate = 7000 => metal value = ₹70,000
      // Mode: PERCENTAGE, rate: 2% => deduction = ₹1,400 => exchange value = ₹68,600
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        tunch_percent: 100.0,
        exchange_rate: 7000.0,
        making_charge_type: 'PERCENTAGE',
        making_rate: 2.0,
      });

      expect(result.metal_value).toBe(70000.0);
      expect(result.deduction_percent).toBe(2.0);
      expect(result.deduction_amount).toBe(1400.0);
      expect(result.exchange_value).toBe(68600.0);
    });

    it('calculates PER_GRAM making charge deduction', () => {
      // Net = 10g, 100% fine, rate = 7000 => metal value = ₹70,000
      // Mode: PER_GRAM, rate: ₹50/g => deduction = 10 * 50 = ₹500 => exchange value = ₹69,500
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        tunch_percent: 100.0,
        exchange_rate: 7000.0,
        making_charge_type: 'PER_GRAM',
        making_rate: 50.0,
      });

      expect(result.deduction_amount).toBe(500.0);
      expect(result.exchange_value).toBe(69500.0);
    });

    it('calculates FIXED making charge deduction', () => {
      // Net = 10g, 100% fine, rate = 7000 => metal value = ₹70,000
      // Mode: FIXED, rate: ₹300 => deduction = ₹300 => exchange value = ₹69,700
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        tunch_percent: 100.0,
        exchange_rate: 7000.0,
        making_charge_type: 'FIXED',
        making_rate: 300.0,
      });

      expect(result.deduction_amount).toBe(300.0);
      expect(result.exchange_value).toBe(69700.0);
    });

    it('calculates PER_PIECE making charge deduction', () => {
      // Net = 10g, 100% fine, rate = 7000 => metal value = ₹70,000
      // Mode: PER_PIECE, pieces = 3, rate = ₹100 => deduction = 3 * 100 = ₹300 => exchange value = ₹69,700
      const result = calculateExchangeItem({
        gross_weight: 10.0,
        tunch_percent: 100.0,
        exchange_rate: 7000.0,
        making_charge_type: 'PER_PIECE',
        pieces: 3,
        making_rate: 100.0,
      });

      expect(result.deduction_amount).toBe(300.0);
      expect(result.exchange_value).toBe(69700.0);
    });
  });
});
