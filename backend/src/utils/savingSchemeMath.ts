// backend/src/utils/savingSchemeMath.ts
// Jewel Suite: Isolated Precision Calculation Engine for Jewellery Saving Schemes

import { Decimal } from 'decimal.js';
import { MaturityBenefitType } from '../domain/savingScheme.js';
import { toDecimal } from './precision.js';

export interface ScheduledInstallment {
  installment_number: number;
  due_date: string;
  amount_due: number;
}

/**
 * Generates an array of scheduled monthly installment dates and amounts.
 * Installment 1 is due on the scheme start date.
 * Subsequent installments are spaced out exactly one calendar month apart.
 */
export function generateInstallmentSchedule(
  startDateStr: string,
  durationMonths: number,
  installmentAmount: number
): ScheduledInstallment[] {
  const schedule: ScheduledInstallment[] = [];
  const start = new Date(startDateStr);

  for (let i = 1; i <= durationMonths; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(start.getMonth() + (i - 1));
    const formattedDate = dueDate.toISOString().substring(0, 10);

    schedule.push({
      installment_number: i,
      due_date: formattedDate,
      amount_due: toDecimal(installmentAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    });
  }

  return schedule;
}

/**
 * Calculates maturity redemption benefit and total payout based on scheme benefit rules.
 *
 * Types:
 * - BONUS: Customer receives N additional installments paid by shop (e.g. 1 bonus installment)
 * - PERCENTAGE: Customer receives X% additional bonus on total accumulated savings
 * - FIXED: Customer receives a fixed rupee bonus amount
 * - NONE: Exact accumulated savings returned/redeemed
 */
export function calculateMaturityBenefit(
  paidAmount: number,
  installmentAmount: number,
  benefitType: MaturityBenefitType | string,
  benefitValue: number
): { bonusAmount: number; totalMaturityAmount: number } {
  if (paidAmount <= 0) {
    return { bonusAmount: 0, totalMaturityAmount: 0 };
  }

  let bonusDec = new Decimal(0);

  if (benefitType === MaturityBenefitType.BONUS) {
    bonusDec = toDecimal(benefitValue).times(toDecimal(installmentAmount));
  } else if (benefitType === MaturityBenefitType.PERCENTAGE) {
    bonusDec = toDecimal(paidAmount).times(toDecimal(benefitValue)).dividedBy(100);
  } else if (benefitType === MaturityBenefitType.FIXED) {
    bonusDec = toDecimal(benefitValue);
  }

  const bonusAmount = bonusDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const totalMaturityAmount = toDecimal(paidAmount)
    .plus(toDecimal(bonusAmount))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

  return {
    bonusAmount,
    totalMaturityAmount,
  };
}
