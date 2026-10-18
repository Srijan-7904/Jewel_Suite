// backend/tests/girvi_math.test.ts
// Unit Tests for Girvi Loan Calculation Logic

import { describe, it, expect } from 'vitest';
import {
  calculateFineWeight,
  calculateItemValuation,
  calculateMaxLoan,
  calculateInterest,
  calculateOutstanding,
  checkIsOverdue,
} from '../src/utils/girviMath.js';
import { GirviInterestType } from '../src/domain/girvi.js';

describe('Jewel Suite Part 9: Girvi Math Precision Tests', () => {
  it('should calculate fine weight accurately: Net * (Tunch / 100)', () => {
    // 10g net weight at 91.6% tunch (22K) -> 9.160g fine weight
    const fine1 = calculateFineWeight(10.0, 91.6);
    expect(fine1).toBe(9.16);

    // 15.450g net weight at 75.0% tunch (18K) -> 11.588g fine weight
    const fine2 = calculateFineWeight(15.45, 75.0);
    expect(fine2).toBe(11.588);

    // Zero or negative handling
    expect(calculateFineWeight(0, 91.6)).toBe(0);
    expect(calculateFineWeight(10, 0)).toBe(0);
  });

  it('should calculate item valuation: Fine Weight * Valuation Rate', () => {
    // Spec Example: Fine Weight = 10g, Rate = ₹7,000 -> Valuation = ₹70,000
    const valuation = calculateItemValuation(10.0, 7000.0);
    expect(valuation).toBe(70000.0);

    const val2 = calculateItemValuation(9.16, 7200.0);
    expect(val2).toBe(65952.0);
  });

  it('should calculate maximum permissible loan based on LTV %', () => {
    // Spec Example: Jewellery Value = ₹70,000, LTV = 70% -> Max Loan = ₹49,000
    const maxLoan70 = calculateMaxLoan(70000.0, 70.0);
    expect(maxLoan70).toBe(49000.0);

    // Valuation = ₹100,000, LTV = 75% -> ₹75,000
    const maxLoan75 = calculateMaxLoan(100000.0, 75.0);
    expect(maxLoan75).toBe(75000.0);
  });

  it('should calculate interest under MONTHLY_PERCENT model', () => {
    // Principal ₹50,000, 2% per month, 30 days -> ₹1,000
    const interest30 = calculateInterest(
      50000.0,
      2.0,
      GirviInterestType.MONTHLY_PERCENT,
      '2026-01-01',
      '2026-01-31'
    );
    // 30 days difference
    expect(interest30).toBe(1000.0);

    // Principal ₹50,000, 2% per month, 60 days -> ₹2,000
    const interest60 = calculateInterest(
      50000.0,
      2.0,
      GirviInterestType.MONTHLY_PERCENT,
      '2026-01-01',
      '2026-03-02'
    );
    expect(interest60).toBe(2000.0);
  });

  it('should calculate interest under ANNUAL_PERCENT model', () => {
    // Principal ₹100,000, 12% per annum, 365 days -> ₹12,000
    const interestAnnual = calculateInterest(
      100000.0,
      12.0,
      GirviInterestType.ANNUAL_PERCENT,
      '2026-01-01',
      '2027-01-01'
    );
    expect(interestAnnual).toBe(12000.0);
  });

  it('should calculate interest under FLAT_AMOUNT model', () => {
    const flat = calculateInterest(
      50000.0,
      2500.0,
      GirviInterestType.FLAT_AMOUNT,
      '2026-01-01',
      '2026-06-01'
    );
    expect(flat).toBe(2500.0);
  });

  it('should calculate net outstanding correctly: Principal + Interest + Charges - Repayments', () => {
    // Spec Example: Principal ₹50,000, Interest ₹5,000, Repaid ₹20,000 -> Outstanding ₹35,000
    const outstanding = calculateOutstanding(50000.0, 5000.0, 0, 20000.0);
    expect(outstanding).toBe(35000.0);

    // With processing fee ₹500
    const outWithCharges = calculateOutstanding(50000.0, 5000.0, 500.0, 20000.0);
    expect(outWithCharges).toBe(35500.0);

    // Full repayment -> Outstanding = 0
    const zeroOut = calculateOutstanding(50000.0, 5000.0, 500.0, 55500.0);
    expect(zeroOut).toBe(0);
  });

  it('should evaluate overdue status correctly', () => {
    expect(checkIsOverdue('2026-06-01', '2026-06-15', 10000)).toBe(true);
    expect(checkIsOverdue('2026-06-15', '2026-06-01', 10000)).toBe(false);
    expect(checkIsOverdue('2026-06-01', '2026-06-15', 0)).toBe(false); // Paid in full
  });
});
