// backend/tests/saving_scheme_math.test.ts
// Unit Tests for Saving Scheme Schedule Generation and Maturity Calculations

import { describe, it, expect } from 'vitest';
import {
  generateInstallmentSchedule,
  calculateMaturityBenefit,
} from '../src/utils/savingSchemeMath.js';
import { MaturityBenefitType } from '../src/domain/savingScheme.js';

describe('Jewel Suite Part 9: Saving Scheme Math Precision Tests', () => {
  it('should generate 11 scheduled monthly installments starting from specified date', () => {
    const schedule = generateInstallmentSchedule('2026-01-10', 11, 5000.0);

    expect(schedule.length).toBe(11);
    expect(schedule[0].installment_number).toBe(1);
    expect(schedule[0].due_date).toBe('2026-01-10');
    expect(schedule[0].amount_due).toBe(5000.0);

    expect(schedule[1].installment_number).toBe(2);
    expect(schedule[1].due_date).toBe('2026-02-10');

    expect(schedule[10].installment_number).toBe(11);
    expect(schedule[10].due_date).toBe('2026-11-10');
    expect(schedule[10].amount_due).toBe(5000.0);
  });

  it('should calculate BONUS maturity benefit (1 free shop installment)', () => {
    // 11 installments of ₹5,000 paid = ₹55,000. Shop contributes 1 bonus installment (1.0 * ₹5,000 = ₹5,000)
    // Total maturity value = ₹60,000
    const result = calculateMaturityBenefit(
      55000.0,
      5000.0,
      MaturityBenefitType.BONUS,
      1.0
    );

    expect(result.bonusAmount).toBe(5000.0);
    expect(result.totalMaturityAmount).toBe(60000.0);
  });

  it('should calculate PERCENTAGE maturity benefit', () => {
    // ₹120,000 accumulated with 8.5% bonus
    const result = calculateMaturityBenefit(
      120000.0,
      10000.0,
      MaturityBenefitType.PERCENTAGE,
      8.5
    );

    // 8.5% of 120,000 = 10,200
    expect(result.bonusAmount).toBe(10200.0);
    expect(result.totalMaturityAmount).toBe(130200.0);
  });

  it('should calculate FIXED maturity benefit', () => {
    const result = calculateMaturityBenefit(
      50000.0,
      5000.0,
      MaturityBenefitType.FIXED,
      3500.0
    );

    expect(result.bonusAmount).toBe(3500.0);
    expect(result.totalMaturityAmount).toBe(53500.0);
  });

  it('should calculate NONE maturity benefit', () => {
    const result = calculateMaturityBenefit(
      50000.0,
      5000.0,
      MaturityBenefitType.NONE,
      0
    );

    expect(result.bonusAmount).toBe(0);
    expect(result.totalMaturityAmount).toBe(50000.0);
  });
});
