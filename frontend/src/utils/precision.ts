import Decimal from 'decimal.js';

// Configure Decimal defaults for precision financial and weight calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Safely converts an input value to a Decimal instance.
 */
export function toDecimal(val: number | string | Decimal | null | undefined): Decimal {
  if (val instanceof Decimal) return val;
  if (val === null || val === undefined || val === '') return new Decimal(0);
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return new Decimal(0);
    return new Decimal(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return new Decimal(0);
    try {
      return new Decimal(trimmed);
    } catch {
      return new Decimal(0);
    }
  }
  return new Decimal(0);
}

/**
 * Formats a weight value to at least the given decimal places (default 3),
 * preserving significant fractional milligrams and required trailing zeros.
 * E.g.
 * formatWeight(0.025) -> "0.025"
 * formatWeight(0.125) -> "0.125"
 * formatWeight(1.225) -> "1.225"
 * formatWeight(10.5) -> "10.500"
 * formatWeight(100.75) -> "100.750"
 */
export function formatWeight(
  weight: number | string | Decimal | null | undefined,
  decimals: number = 3
): string {
  if (weight === null || weight === undefined || weight === '') {
    return (0).toFixed(decimals);
  }
  try {
    const d = toDecimal(weight);
    if (d.isNaN()) return (0).toFixed(decimals);
    const dp = Math.max(decimals, Math.min(d.decimalPlaces(), 6));
    return d.toFixed(dp);
  } catch {
    return (0).toFixed(decimals);
  }
}

/**
 * Formats fine weight with bullion purity precision (at least 4 decimals).
 */
export function formatFineWeight(
  fineWeight: number | string | Decimal | null | undefined,
  decimals: number = 4
): string {
  return formatWeight(fineWeight, decimals);
}

/**
 * Formats metal rate per gram, preserving paise precision if present.
 * E.g.
 * formatMetalRate(7250) -> "7,250"
 * formatMetalRate(7250.50) -> "7,250.50"
 */
export function formatMetalRate(
  rate: number | string | Decimal | null | undefined,
  includeSymbol: boolean = false
): string {
  if (rate === null || rate === undefined || rate === '') {
    return includeSymbol ? '₹0' : '0';
  }
  try {
    const d = toDecimal(rate);
    if (d.isNaN()) return includeSymbol ? '₹0' : '0';
    const num = d.toNumber();
    const hasFractions = !d.modulo(1).isZero();
    const formatted = num.toLocaleString('en-IN', {
      minimumFractionDigits: hasFractions ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return includeSymbol ? `₹${formatted}` : formatted;
  } catch {
    return includeSymbol ? '₹0' : '0';
  }
}

/**
 * Formats percentage values like purity tunch, wastage, and GST.
 * E.g.
 * formatPercentage(91.67) -> "91.67%"
 * formatPercentage(3) -> "3%"
 */
export function formatPercentage(
  percent: number | string | Decimal | null | undefined,
  includeSymbol: boolean = true
): string {
  if (percent === null || percent === undefined || percent === '') {
    return includeSymbol ? '0%' : '0';
  }
  try {
    const d = toDecimal(percent);
    if (d.isNaN()) return includeSymbol ? '0%' : '0';
    const hasFractions = !d.modulo(1).isZero();
    const dp = hasFractions ? Math.min(d.decimalPlaces(), 2) : 0;
    const str = d.toFixed(dp);
    return includeSymbol ? `${str}%` : str;
  } catch {
    return includeSymbol ? '0%' : '0';
  }
}

/**
 * Formats currency values in INR with 2 decimal places and ₹ symbol option.
 * E.g.
 * formatCurrency(181.25) -> "₹181.25"
 * formatCurrency(79752.9) -> "₹79,752.90"
 */
export function formatCurrency(
  amount: number | string | Decimal | null | undefined,
  includeSymbol: boolean = true
): string {
  if (amount === null || amount === undefined || amount === '') {
    return includeSymbol ? '₹0.00' : '0.00';
  }
  try {
    const d = toDecimal(amount);
    if (d.isNaN()) return includeSymbol ? '₹0.00' : '0.00';
    const num = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const formatted = num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return includeSymbol ? `₹${formatted}` : formatted;
  } catch {
    return includeSymbol ? '₹0.00' : '0.00';
  }
}

/**
 * Cleanly sanitizes and validates string input as the user types numbers into
 * decimal form fields without dropping incomplete decimals like "0", "0.", "0.0", or "0.02".
 */
export function parseDecimalInput(
  input: string,
  maxDecimals?: number
): string {
  if (!input) return '';
  let cleaned = input.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  if (maxDecimals !== undefined && parts.length === 2 && parts[1].length > maxDecimals) {
    cleaned = parts[0] + '.' + parts[1].substring(0, maxDecimals);
  }
  return cleaned;
}

/**
 * Converts user input (number or string) to a safe JavaScript number.
 */
export function safeParseNumber(
  input: string | number | null | undefined,
  defaultValue: number = 0
): number {
  if (input === null || input === undefined || input === '') return defaultValue;
  if (typeof input === 'number') {
    return isNaN(input) || !isFinite(input) ? defaultValue : input;
  }
  const parsed = parseFloat(input);
  return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
}
