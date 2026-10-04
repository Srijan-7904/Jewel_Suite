import { BadRequestError } from './errors.js';

/**
 * Rounds a floating point number to a given number of decimal places accurately,
 * avoiding standard IEEE 754 precision drift.
 */
export function roundToPrecision(value: number, decimals: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Standard jewellery weight precision: 3 decimal places (milligrams).
 * Example: 12.500 g
 */
export function roundWeight(weight: number): number {
  return roundToPrecision(weight, 3);
}

/**
 * Fine weight precision: 4 decimal places for exact bullion purity accounting.
 * Example: 12g * 91.67% = 11.0004 g
 */
export function roundFineWeight(fineWeight: number): number {
  return roundToPrecision(fineWeight, 4);
}

/**
 * Currency rounding: 2 decimal places (paise).
 * Example: ₹7250.50
 */
export function roundCurrency(amount: number): number {
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
  if (lessWeight > grossWeight) {
    throw new BadRequestError(
      `Less weight (${lessWeight}g) cannot exceed gross weight (${grossWeight}g)`
    );
  }

  return roundWeight(grossWeight - lessWeight);
}

/**
 * Computes Fine Weight based on Net Weight and Tunch %:
 * Fine Weight = Net Weight * (Tunch% / 100)
 */
export function calculateFineWeight(netWeight: number, tunchPercent: number): number {
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

  return roundFineWeight((netWeight * tunchPercent) / 100);
}

/**
 * Computes Acquisition Metal Value:
 * Metal Value = Fine Weight * Rate Per Gram
 */
export function calculateMetalValue(fineWeight: number, ratePerGram: number): number {
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

  return roundCurrency(fineWeight * ratePerGram);
}

/**
 * Computes Total Stock Acquisition Cost:
 * Total Cost = Metal Value + Making Charge
 */
export function calculateTotalCost(metalValue: number, makingCharge: number = 0): number {
  if (makingCharge < 0) {
    throw new BadRequestError('Making charge cannot be negative');
  }
  return roundCurrency(metalValue + makingCharge);
}
