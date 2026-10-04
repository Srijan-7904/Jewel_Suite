import {
  calculateNetWeight,
  calculateFineWeight,
  calculateMetalValue,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from './jewelleryMath.js';
import { BadRequestError } from './errors.js';

export interface PurchaseItemCalculationInput {
  gross_weight: number;
  less_weight?: number;
  tunch_percent: number;
  rate_per_gram: number;
  wastage_percent?: number;
  making_charge?: number;
}

export interface PurchaseItemCalculationResult {
  net_weight: number;
  fine_weight: number;
  metal_value: number;
  item_amount: number;
}

/**
 * Calculates item-level weights and commercial amount for a purchase item.
 */
export function calculatePurchaseItem(
  input: PurchaseItemCalculationInput
): PurchaseItemCalculationResult {
  const net_weight = calculateNetWeight(input.gross_weight, input.less_weight ?? 0);
  const fine_weight = calculateFineWeight(net_weight, input.tunch_percent);
  const metal_value = calculateMetalValue(fine_weight, input.rate_per_gram);

  const making_charge = input.making_charge ? roundCurrency(input.making_charge) : 0;
  if (making_charge < 0) {
    throw new BadRequestError('Making charge cannot be negative');
  }

  const wastage_percent = input.wastage_percent ? Number(input.wastage_percent) : 0;
  if (wastage_percent < 0) {
    throw new BadRequestError('Wastage percent cannot be negative');
  }

  // Wastage value if applicable
  const wastage_fine = roundFineWeight((net_weight * wastage_percent) / 100);
  const wastage_val = roundCurrency(wastage_fine * input.rate_per_gram);

  const item_amount = roundCurrency(metal_value + wastage_val + making_charge);

  return {
    net_weight,
    fine_weight,
    metal_value,
    item_amount,
  };
}

export interface PurchaseTotalsInput {
  items: Array<{ item_amount: number }>;
  discount_amount?: number;
  gst_rate?: number;
  payments?: Array<{ amount: number }>;
}

export interface PurchaseTotalsResult {
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  balance_amount: number;
}

/**
 * Calculates authoritative financial totals for a purchase bill:
 * Subtotal -> Discount -> Taxable -> GST -> Round Off -> Grand Total -> Payments -> Balance
 */
export function calculatePurchaseTotals(
  input: PurchaseTotalsInput
): PurchaseTotalsResult {
  const subtotal = roundCurrency(
    input.items.reduce((sum, item) => sum + (item.item_amount || 0), 0)
  );

  let discount_amount = roundCurrency(Math.max(0, input.discount_amount || 0));
  if (subtotal > 0 && discount_amount > subtotal) {
    throw new BadRequestError(`Discount amount (₹${discount_amount}) cannot exceed subtotal (₹${subtotal})`);
  }
  if (subtotal === 0) {
    discount_amount = 0;
  }

  const taxable_amount = roundCurrency(Math.max(0, subtotal - discount_amount));

  const gst_rate = input.gst_rate !== undefined ? Number(input.gst_rate) : 3.0;
  if (gst_rate < 0) {
    throw new BadRequestError('GST rate cannot be negative');
  }

  const gst_amount = roundCurrency((taxable_amount * gst_rate) / 100);

  const rawTotal = taxable_amount + gst_amount;
  const grand_total = Math.round(rawTotal);
  const round_off = roundCurrency(grand_total - rawTotal);

  const amount_paid = roundCurrency(
    (input.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
  );

  const balance_amount = roundCurrency(Math.max(0, grand_total - amount_paid));

  return {
    subtotal,
    discount_amount,
    taxable_amount,
    gst_rate,
    gst_amount,
    round_off,
    grand_total,
    amount_paid,
    balance_amount,
  };
}
