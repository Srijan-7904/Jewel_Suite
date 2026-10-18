import Decimal from 'decimal.js';
import { BadRequestError } from './errors.js';
import { toDecimal } from './precision.js';

// Configure Decimal defaults for precision financial and weight calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Rounds a floating point or decimal number to a given number of decimal places accurately
 * using decimal arithmetic (HALF_UP rounding mode).
 */
export function roundToPrecision(value: number | string | Decimal, decimals: number): number {
  if (value === null || value === undefined || value === '') return 0;
  try {
    const d = toDecimal(value);
    if (d.isNaN()) return 0;
    return d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Standard jewellery weight precision: 3 decimal places (milligrams).
 * Example: 12.500 g, 0.025 g
 */
export function roundWeight(weight: number | string | Decimal): number {
  return roundToPrecision(weight, 3);
}

/**
 * Fine weight precision: 4 decimal places for bullion purity accounting.
 * Example: 12g * 91.67% = 11.0004 g
 */
export function roundFineWeight(fineWeight: number | string | Decimal): number {
  return roundToPrecision(fineWeight, 4);
}

/**
 * Currency rounding: 2 decimal places (paise).
 * Example: ₹7250.50
 */
export function roundCurrency(amount: number | string | Decimal): number {
  return roundToPrecision(amount, 2);
}

/**
 * Validates weights and computes Net Weight:
 * Net Weight = Gross Weight - Less Weight
 */
export function calculateNetWeight(grossWeight: number, lessWeight: number = 0): number {
  if (typeof grossWeight !== 'number' || isNaN(grossWeight)) {
    throw new BadRequestError('Gross weight must be a valid numeric value');
  }
  if (typeof lessWeight !== 'number' || isNaN(lessWeight)) {
    throw new BadRequestError('Less weight must be a valid numeric value');
  }
  if (grossWeight < 0) {
    throw new BadRequestError('Gross weight cannot be negative');
  }
  if (lessWeight < 0) {
    throw new BadRequestError('Less weight cannot be negative');
  }

  const g = toDecimal(grossWeight);
  const l = toDecimal(lessWeight);

  if (l.greaterThan(g)) {
    throw new BadRequestError(
      `Less weight (${lessWeight}g) cannot exceed gross weight (${grossWeight}g)`
    );
  }

  return roundWeight(g.minus(l));
}

/**
 * Computes raw Fine Weight without business rounding:
 * Fine Weight = Net Weight * (Tunch% / 100)
 * Example: 0.025g * 91.67% = 0.0229175g
 */
export function calculateRawFineWeight(netWeight: number, tunchPercent: number): number {
  if (typeof netWeight !== 'number' || isNaN(netWeight)) {
    throw new BadRequestError('Net weight must be a valid numeric value');
  }
  if (typeof tunchPercent !== 'number' || isNaN(tunchPercent)) {
    throw new BadRequestError('Tunch percent must be a valid numeric value');
  }
  if (netWeight < 0) {
    throw new BadRequestError('Net weight cannot be negative');
  }
  if (tunchPercent < 0 || tunchPercent > 100) {
    throw new BadRequestError(
      `Tunch percent must be between 0 and 100, received: ${tunchPercent}`
    );
  }

  return toDecimal(netWeight).times(toDecimal(tunchPercent)).dividedBy(100).toNumber();
}

/**
 * Computes Fine Weight based on Net Weight and Tunch % with business rounding (4 decimal places):
 * Fine Weight = Net Weight * (Tunch% / 100)
 */
export function calculateFineWeight(netWeight: number, tunchPercent: number): number {
  const raw = calculateRawFineWeight(netWeight, tunchPercent);
  return roundFineWeight(raw);
}

/**
 * Computes raw Acquisition Metal Value before currency rounding:
 * Metal Value = Fine Weight * Rate Per Gram
 * Example: 0.025g * 7250 = 181.25
 */
export function calculateRawMetalValue(fineWeight: number, ratePerGram: number): number {
  if (typeof fineWeight !== 'number' || isNaN(fineWeight)) {
    throw new BadRequestError('Fine weight must be a valid numeric value');
  }
  if (typeof ratePerGram !== 'number' || isNaN(ratePerGram)) {
    throw new BadRequestError('Rate per gram must be a valid numeric value');
  }
  if (fineWeight < 0) {
    throw new BadRequestError('Fine weight cannot be negative');
  }
  if (ratePerGram < 0) {
    throw new BadRequestError('Rate per gram cannot be negative');
  }

  return toDecimal(fineWeight).times(toDecimal(ratePerGram)).toNumber();
}

/**
 * Computes Acquisition Metal Value rounded to currency precision (paise / 2 decimals):
 * Metal Value = Fine Weight * Rate Per Gram
 */
export function calculateMetalValue(fineWeight: number, ratePerGram: number): number {
  const raw = calculateRawMetalValue(fineWeight, ratePerGram);
  return roundCurrency(raw);
}

/**
 * Computes Total Stock Acquisition Cost:
 * Total Cost = Metal Value + Making Charge
 */
export function calculateTotalCost(metalValue: number, makingCharge: number = 0): number {
  if (typeof makingCharge !== 'number' || isNaN(makingCharge)) {
    throw new BadRequestError('Making charge must be a valid numeric value');
  }
  if (makingCharge < 0) {
    throw new BadRequestError('Making charge cannot be negative');
  }
  return roundCurrency(toDecimal(metalValue).plus(toDecimal(makingCharge)));
}

/**
 * Computes raw Wastage Weight from Net Weight and Wastage Percentage:
 * Wastage Weight = Net Weight * (Wastage% / 100)
 * Example: 10.000g * 5% = 0.500g, 0.025g * 5% = 0.00125g
 */
export function calculateRawWastageWeight(netWeight: number, wastagePercent: number): number {
  if (typeof netWeight !== 'number' || isNaN(netWeight)) {
    throw new BadRequestError('Net weight must be a valid numeric value');
  }
  if (typeof wastagePercent !== 'number' || isNaN(wastagePercent)) {
    throw new BadRequestError('Wastage percent must be a valid numeric value');
  }
  if (netWeight < 0) {
    throw new BadRequestError('Net weight cannot be negative');
  }
  if (wastagePercent < 0) {
    throw new BadRequestError('Wastage percent cannot be negative');
  }

  return toDecimal(netWeight).times(toDecimal(wastagePercent)).dividedBy(100).toNumber();
}

/**
 * Computes Wastage Weight rounded to fine weight precision (4 decimal places):
 * Wastage Weight = Net Weight * (Wastage% / 100)
 */
export function calculateWastageWeight(netWeight: number, wastagePercent: number): number {
  const raw = calculateRawWastageWeight(netWeight, wastagePercent);
  return roundFineWeight(raw);
}

/**
 * Computes Wastage Monetary Amount:
 * Wastage Amount = Wastage Weight * Rate Per Gram
 * Example: 0.500g * ₹7,250 = ₹3,625.00
 */
export function calculateWastageAmount(wastageWeight: number, ratePerGram: number): number {
  if (typeof wastageWeight !== 'number' || isNaN(wastageWeight)) {
    throw new BadRequestError('Wastage weight must be a valid numeric value');
  }
  if (typeof ratePerGram !== 'number' || isNaN(ratePerGram)) {
    throw new BadRequestError('Rate per gram must be a valid numeric value');
  }
  if (wastageWeight < 0) {
    throw new BadRequestError('Wastage weight cannot be negative');
  }
  if (ratePerGram < 0) {
    throw new BadRequestError('Rate per gram cannot be negative');
  }

  return roundCurrency(toDecimal(wastageWeight).times(toDecimal(ratePerGram)));
}

/**
 * Computes metal payment value in rupees from weight and applicable rate:
 * metalPaymentValue = paymentWeightInGrams * applicableRatePerGram
 */
export function calculateMetalPaymentValue(weightGrams: number, ratePerGram: number): number {
  if (typeof weightGrams !== 'number' || isNaN(weightGrams)) {
    throw new BadRequestError('Payment weight must be a valid numeric value');
  }
  if (typeof ratePerGram !== 'number' || isNaN(ratePerGram)) {
    throw new BadRequestError('Applicable rate per gram must be a valid numeric value');
  }
  if (ratePerGram <= 0) {
    throw new BadRequestError('Applicable rate per gram must be greater than zero for metal payment');
  }
  if (weightGrams < 0) {
    throw new BadRequestError('Metal payment weight cannot be negative');
  }
  return roundCurrency(toDecimal(weightGrams).times(toDecimal(ratePerGram)));
}

/**
 * Computes metal payment weight in grams from rupee amount and applicable rate:
 * paymentWeightInGrams = paymentAmount / applicableRatePerGram
 */
export function calculateMetalPaymentWeight(amountRupees: number, ratePerGram: number): number {
  if (typeof amountRupees !== 'number' || isNaN(amountRupees)) {
    throw new BadRequestError('Payment amount must be a valid numeric value');
  }
  if (typeof ratePerGram !== 'number' || isNaN(ratePerGram)) {
    throw new BadRequestError('Applicable rate per gram must be a valid numeric value');
  }
  if (ratePerGram <= 0) {
    throw new BadRequestError('Applicable rate per gram must be greater than zero for metal payment');
  }
  if (amountRupees < 0) {
    throw new BadRequestError('Metal payment amount cannot be negative');
  }
  return roundWeight(toDecimal(amountRupees).dividedBy(toDecimal(ratePerGram)));
}

/**
 * Computes making charge based on mode:
 * - PER_GRAM: Net Weight * Rate per gram
 * - PER_PIECE: Pieces (Qty) * Rate per piece
 * - FIXED: Flat fixed charge (lump sum for item)
 * - PERCENTAGE: Metal Value * (Percentage / 100)
 */
export type MakingChargeType = 'PER_GRAM' | 'PER_PIECE' | 'FIXED' | 'PERCENTAGE';

export function calculateMakingCharge(
  type: MakingChargeType = 'PER_GRAM',
  makingRate: number = 0,
  netWeight: number = 0,
  metalValue: number = 0,
  pieces: number = 1
): number {
  if (typeof makingRate !== 'number' || isNaN(makingRate)) {
    throw new BadRequestError('Making rate must be a valid numeric value');
  }
  if (makingRate < 0) {
    throw new BadRequestError('Making rate cannot be negative');
  }
  const pcs = typeof pieces === 'number' && !isNaN(pieces) && pieces > 0 ? pieces : 1;

  if (type === 'PERCENTAGE') {
    return roundCurrency(toDecimal(metalValue).times(toDecimal(makingRate)).dividedBy(100));
  }
  if (type === 'PER_PIECE') {
    return roundCurrency(toDecimal(pcs).times(toDecimal(makingRate)));
  }
  if (type === 'FIXED') {
    return roundCurrency(toDecimal(makingRate));
  }
  // Default: PER_GRAM
  return roundCurrency(toDecimal(netWeight).times(toDecimal(makingRate)));
}
