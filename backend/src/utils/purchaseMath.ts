import { Decimal } from 'decimal.js';
import {
  calculateNetWeight,
  calculateFineWeight,
  calculateMetalValue,
  roundWeight,
  roundFineWeight,
  roundCurrency,
} from './jewelleryMath.js';
import { BadRequestError } from './errors.js';
import { toDecimal } from './precision.js';

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
  wastage_percent: number;
  wastage_weight: number;
  wastage_amount: number;
  metal_value: number;
  item_amount: number;
}

/**
 * Calculates item-level weights and commercial amount for a purchase item.
 * Formula:
 * - net_weight = gross_weight - less_weight
 * - fine_weight = net_weight * (tunch_percent / 100)
 * - metal_value = fine_weight * rate_per_gram
 * - wastage_weight = net_weight * (wastage_percent / 100)
 * - wastage_amount = wastage_weight * rate_per_gram
 * - item_amount = metal_value + wastage_amount + making_charge
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

  const wastage_percent = input.wastage_percent !== undefined ? Number(input.wastage_percent) : 0;
  if (wastage_percent < 0) {
    throw new BadRequestError('Wastage percent cannot be negative');
  }

  // Wastage calculation based on net weight
  const wastage_weight = roundFineWeight(
    toDecimal(net_weight).times(toDecimal(wastage_percent)).dividedBy(100)
  );
  const wastage_amount = roundCurrency(
    toDecimal(wastage_weight).times(toDecimal(input.rate_per_gram))
  );

  const item_amount = roundCurrency(
    toDecimal(metal_value).plus(toDecimal(wastage_amount)).plus(toDecimal(making_charge))
  );

  return {
    net_weight,
    fine_weight,
    wastage_percent,
    wastage_weight,
    wastage_amount,
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
  const subtotalDec = (input.items || []).reduce(
    (sum, item) => sum.plus(toDecimal(item.item_amount || 0)),
    new Decimal(0)
  );
  const subtotal = roundCurrency(subtotalDec);

  let discountDec = toDecimal(input.discount_amount || 0);
  if (discountDec.isNegative()) discountDec = new Decimal(0);
  let discount_amount = roundCurrency(discountDec);

  if (subtotal > 0 && discount_amount > subtotal) {
    throw new BadRequestError(`Discount amount (₹${discount_amount}) cannot exceed subtotal (₹${subtotal})`);
  }
  if (subtotal === 0) {
    discount_amount = 0;
  }

  const taxable_amount = roundCurrency(Decimal.max(0, toDecimal(subtotal).minus(toDecimal(discount_amount))));

  const gst_rate = input.gst_rate !== undefined ? Number(input.gst_rate) : 3.0;
  if (gst_rate < 0) {
    throw new BadRequestError('GST rate cannot be negative');
  }

  const gst_amount = roundCurrency(
    toDecimal(taxable_amount).times(toDecimal(gst_rate)).dividedBy(100)
  );

  const rawTotal = toDecimal(taxable_amount).plus(toDecimal(gst_amount));
  const grand_total = rawTotal.round().toNumber();
  const round_off = roundCurrency(toDecimal(grand_total).minus(rawTotal));

  const amount_paid = roundCurrency(
    (input.payments || []).reduce((sum, p) => sum.plus(toDecimal(p.amount || 0)), new Decimal(0))
  );

  const balance_amount = roundCurrency(
    Decimal.max(0, toDecimal(grand_total).minus(toDecimal(amount_paid)))
  );

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
