import { describe, it, expect } from 'vitest';
import {
  calculateNetWeight,
  calculateFineWeight,
  calculateMetalValue,
  calculateTotalCost,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from '../src/utils/jewelleryMath.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite Part 3: Jewellery Math & Calculation Engine Tests', () => {
  describe('Weight Calculations (Section 6 & 37)', () => {
    it('should accurately calculate Net Weight = Gross - Less', () => {
      // Prompt requirement: gross = 12, less = 0.5, net = 11.5
      const net = calculateNetWeight(12.0, 0.5);
      expect(net).toBe(11.5);
    });

    it('should maintain 3 decimal precision for jewellery milligrams', () => {
      const net = calculateNetWeight(8.525, 0.123);
      expect(net).toBe(8.402);
    });

    it('should reject less_weight > gross_weight with BadRequestError', () => {
      expect(() => calculateNetWeight(10.0, 10.001)).toThrow(BadRequestError);
    });

    it('should reject negative gross or less weight', () => {
      expect(() => calculateNetWeight(-5.0, 0)).toThrow(BadRequestError);
      expect(() => calculateNetWeight(10.0, -1.0)).toThrow(BadRequestError);
    });
  });

  describe('Tunch & Fine Weight Calculations (Section 7 & 37)', () => {
    it('should accurately calculate Fine Weight = Net * (Tunch% / 100)', () => {
      // Prompt requirement: net = 12, tunch = 91.67, fine = 11.0004
      const fine = calculateFineWeight(12.0, 91.67);
      expect(fine).toBe(11.0004);
    });

    it('should accurately calculate 24K pure bullion fine weight (99.9%)', () => {
      const fine = calculateFineWeight(100.0, 99.9);
      expect(fine).toBe(99.9);
    });

    it('should accurately calculate 18K fine weight (75%)', () => {
      const fine = calculateFineWeight(20.0, 75.0);
      expect(fine).toBe(15.0);
    });

    it('should reject tunch > 100 or negative tunch', () => {
      expect(() => calculateFineWeight(10.0, 100.01)).toThrow(BadRequestError);
      expect(() => calculateFineWeight(10.0, -0.5)).toThrow(BadRequestError);
    });
  });

  describe('Metal Value & Commercial Calculations (Section 9 & 37)', () => {
    it('should calculate Metal Value = Fine Weight * Rate per gram', () => {
      // 11.0004g * ₹7,250 = ₹79,752.90
      const metalVal = calculateMetalValue(11.0004, 7250.0);
      expect(metalVal).toBe(79752.9);
    });

    it('should reject negative rate per gram or fine weight', () => {
      expect(() => calculateMetalValue(10.0, -500.0)).toThrow(BadRequestError);
      expect(() => calculateMetalValue(-1.0, 7250.0)).toThrow(BadRequestError);
    });

    it('should calculate total acquisition cost including making charge', () => {
      const total = calculateTotalCost(79752.9, 1500.0);
      expect(total).toBe(81252.9);
    });

    it('should reject negative making charge', () => {
      expect(() => calculateTotalCost(50000, -100)).toThrow(BadRequestError);
    });
  });

  describe('Precision Rounding Helpers', () => {
    it('should avoid floating-point epsilon precision drift', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
      expect(roundWeight(0.1 + 0.2)).toBe(0.3);
      expect(roundFineWeight(0.123456)).toBe(0.1235);
      expect(roundCurrency(10.555)).toBe(10.56);
    });
  });
});
