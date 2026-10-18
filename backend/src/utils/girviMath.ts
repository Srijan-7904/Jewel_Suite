// backend/src/utils/girviMath.ts
// Jewel Suite: Isolated Precision Calculation Engine for Girvi / Pledged Jewellery Loans

import Decimal from 'decimal.js';
import { GirviInterestType } from '../domain/girvi.js';
import { toDecimal } from './precision.js';

/**
 * Calculates fine gold/silver weight from net weight and purity touch (tunch %).
 * Fine Weight = Net Weight * (Tunch % / 100), rounded to 3 decimal places.
 */
export function calculateFineWeight(netWeight: number, tunchPercent: number): number {
  if (netWeight <= 0 || tunchPercent <= 0) return 0;
  return toDecimal(netWeight)
    .times(toDecimal(tunchPercent))
    .dividedBy(100)
    .toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Calculates financial market valuation for a pledged jewellery item.
 * Valuation = Fine Weight * Valuation Rate per gram, rounded to 2 decimal places.
 */
export function calculateItemValuation(fineWeight: number, valuationRate: number): number {
  if (fineWeight <= 0 || valuationRate <= 0) return 0;
  return toDecimal(fineWeight)
    .times(toDecimal(valuationRate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Calculates the maximum permissible loan disbursement based on total collateral valuation and LTV %.
 * Max Loan = Total Valuation * (LTV % / 100), rounded to 2 decimal places.
 */
export function calculateMaxLoan(totalValuation: number, ltvPercent: number): number {
  if (totalValuation <= 0 || ltvPercent <= 0) return 0;
  return toDecimal(totalValuation)
    .times(toDecimal(ltvPercent))
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Calculates loan interest based on the chosen interest model and duration.
 *
 * Formulas:
 * 1. MONTHLY_PERCENT: (Principal * (Rate / 100)) * (Days / 30)
 * 2. ANNUAL_PERCENT:  (Principal * (Rate / 100)) * (Days / 365)
 * 3. FLAT_AMOUNT:     Rate
 */
export function calculateInterest(
  principal: number,
  rate: number,
  interestType: GirviInterestType | string,
  startDateStr: string,
  endDateStr: string
): number {
  if (principal <= 0 || rate <= 0) return 0;

  if (interestType === GirviInterestType.FLAT_AMOUNT) {
    return toDecimal(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  if (interestType === GirviInterestType.MONTHLY_PERCENT) {
    // 30 days per standard financial month
    const interest = toDecimal(principal)
      .times(toDecimal(rate).dividedBy(100))
      .times(diffDays)
      .dividedBy(30);
    return interest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } else if (interestType === GirviInterestType.ANNUAL_PERCENT) {
    // 365 days per annual basis
    const interest = toDecimal(principal)
      .times(toDecimal(rate).dividedBy(100))
      .times(diffDays)
      .dividedBy(365);
    return interest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  return 0;
}

/**
 * Calculates net remaining outstanding loan balance.
 * Total Payable = Principal + Total Interest + Total Charges
 * Outstanding = Math.max(0, Total Payable - Total Repaid)
 */
export function calculateOutstanding(
  principal: number,
  totalInterest: number,
  totalCharges: number,
  totalRepaid: number
): number {
  const totalPayable = toDecimal(principal)
    .plus(toDecimal(totalInterest))
    .plus(toDecimal(totalCharges));
  const net = totalPayable.minus(toDecimal(totalRepaid));
  return Math.max(0, net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber());
}

/**
 * Evaluates whether a loan is overdue based on due date, as-of date, and outstanding balance.
 */
export function checkIsOverdue(dueDateStr: string, asOfDateStr: string, outstandingAmount: number): boolean {
  if (outstandingAmount <= 0) return false;
  return asOfDateStr > dueDateStr;
}
