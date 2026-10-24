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

export interface SalesItemCalculationInput {
  gross_weight: number;
  less_weight?: number;
  tunch_percent: number;
  rate_per_gram: number;
  wastage_percent?: number;
  badla_percent?: number;
  making_charge?: number;
}

export interface SalesItemCalculationResult {
  net_weight: number;
  fine_weight: number;
  billable_weight: number;
  effective_fine_weight?: number;
  adjusted_fine_weight?: number;
  wastage_percent: number;
  badla_percent?: number;
  badla_weight?: number;
  badla_amount?: number;
  wastage_weight: number;
  wastage_amount: number;
  metal_value: number;
  making_charge?: number;
  item_amount: number;
}

/**
 * Calculates item-level weights, fine weight, wastage, metal value, making charges, and total amount for a sale line item.
 * Established jewellery wastage-addition formula:
 * - net_weight = gross_weight - less_weight
 * - fine_weight = net_weight * (tunch_percent / 100) (physical pure gold weight after purity)
 * - badla_weight = fine_weight * (badla_percent / 100) (calculated from gold after purity)
 * - wastage_weight = fine_weight * (wastage_percent / 100) (calculated from gold after purity)
 * - total_addition_weight = badla_weight + wastage_weight
 * - billable_weight = fine_weight + total_addition_weight (clamped >= 0)
 * - metal_value = billable_weight * rate_per_gram
 * - wastage_amount = total_addition_weight * rate_per_gram
 * - item_amount = metal_value + making_charge
 * 
 * Behavior:
 * - Increasing Waste% or Badla% increases the billable metal value and therefore strictly increases the item amount.
 * - Decreasing Waste% or Badla% decreases the billable metal value and therefore strictly decreases the item amount.
 */
export function calculateSalesItem(
  input: SalesItemCalculationInput
): SalesItemCalculationResult {
  const net_weight = calculateNetWeight(input.gross_weight, input.less_weight ?? 0);
  const fine_weight = calculateFineWeight(net_weight, input.tunch_percent);

  const making_charge = input.making_charge ? roundCurrency(input.making_charge) : 0;
  if (making_charge < 0) {
    throw new BadRequestError('Making charge cannot be negative');
  }

  const wastage_percent = input.wastage_percent !== undefined ? Number(input.wastage_percent) : 0;
  const badla_percent = input.badla_percent !== undefined ? Number(input.badla_percent) : 0;

  if (wastage_percent < 0) {
    throw new BadRequestError('Wastage percentage cannot be negative');
  }
  if (badla_percent < -100) {
    throw new BadRequestError('Badla percentage cannot be less than -100%');
  }
  if (toDecimal(input.tunch_percent).plus(toDecimal(badla_percent)).plus(toDecimal(wastage_percent)).lt(0)) {
    throw new BadRequestError('Combined effective purity (tunch + badla + wastage) cannot be negative');
  }

  const total_addition_percent = toDecimal(wastage_percent).plus(toDecimal(badla_percent)).toNumber();

  // Badla and Wastage calculation based on fine weight (gold after purity)
  const badla_weight = roundFineWeight(
    toDecimal(fine_weight).times(toDecimal(badla_percent)).dividedBy(100)
  );
  const badla_amount = roundCurrency(
    toDecimal(badla_weight).times(toDecimal(input.rate_per_gram))
  );

  const pure_wastage_weight = roundFineWeight(
    toDecimal(fine_weight).times(toDecimal(wastage_percent)).dividedBy(100)
  );
  const pure_wastage_amount = roundCurrency(
    toDecimal(pure_wastage_weight).times(toDecimal(input.rate_per_gram))
  );

  // Total addition weight and combined wastage amount
  const total_addition_weight = toDecimal(badla_weight).plus(toDecimal(pure_wastage_weight)).toNumber();
  const wastage_weight = total_addition_weight;
  const wastage_amount = roundCurrency(
    toDecimal(total_addition_weight).times(toDecimal(input.rate_per_gram))
  );

  // Billable weight = fine weight + addition weight (positive adds, negative subtracts, clamped >= 0)
  const billable_weight = total_addition_weight !== 0
    ? roundFineWeight(Decimal.max(0, toDecimal(fine_weight).plus(toDecimal(total_addition_weight))))
    : fine_weight;

  // Effective fine weight and adjusted fine weight aliases
  const effective_fine_weight = billable_weight;
  const adjusted_fine_weight = billable_weight;

  // Billable metal value based on billable fine weight:
  // metal_value = billable_weight * rate_per_gram
  const metal_value = roundCurrency(
    toDecimal(billable_weight).times(toDecimal(input.rate_per_gram))
  );

  // Line item amount = metal_value + making_charge
  // Under the wastage addition rule, increasing Waste% increases the item amount,
  // and decreasing Waste% decreases the item amount.
  const item_amount = roundCurrency(
    toDecimal(metal_value).plus(toDecimal(making_charge))
  );

  return {
    net_weight,
    fine_weight,
    billable_weight,
    effective_fine_weight,
    adjusted_fine_weight,
    wastage_percent,
    badla_percent,
    badla_weight,
    badla_amount,
    wastage_weight,
    wastage_amount,
    metal_value,
    making_charge,
    item_amount,
  };
}

export interface SalesTotalsInput {
  items: Array<{ item_amount: number }>;
  discount_amount?: number;
  gst_rate?: number;
  exchange_amount?: number;
  payments?: Array<{ amount: number }>;
}

export interface SalesTotalsResult {
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount: number;
  round_off: number;
  grand_total: number;
  exchange_amount: number;
  net_payable: number;
  amount_paid: number;
  balance_amount: number;
  change_due: number;
  is_settled: boolean;
}

/**
 * Calculates authoritative financial totals for a retail sales invoice:
 * Subtotal -> Discount -> Taxable -> GST (3%) -> Round Off -> Grand Total -> Exchange Deduction -> Net Payable -> Payments -> Balance
 */
export function calculateSalesTotals(
  input: SalesTotalsInput
): SalesTotalsResult {
  const subtotalDec = (input.items || []).reduce(
    (sum, item) => sum.plus(toDecimal(item.item_amount || 0)),
    new Decimal(0)
  );
  const subtotal = roundCurrency(subtotalDec);

  let discountDec = toDecimal(input.discount_amount || 0);
  if (discountDec.isNegative()) discountDec = new Decimal(0);
  let discount_amount = roundCurrency(discountDec);

  if (subtotal > 0 && discount_amount > subtotal) {
    throw new BadRequestError(
      `Discount amount (₹${discount_amount}) cannot exceed subtotal (₹${subtotal})`
    );
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

  const exchange_amount = roundCurrency(Decimal.max(0, toDecimal(input.exchange_amount || 0)));
  const net_payable = roundCurrency(Decimal.max(0, toDecimal(grand_total).minus(toDecimal(exchange_amount))));

  const amount_paid = roundCurrency(
    (input.payments || []).reduce((sum, p) => sum.plus(toDecimal(p.amount || 0)), new Decimal(0))
  );

  const rawBalance = toDecimal(net_payable).minus(toDecimal(amount_paid));
  const balance_amount = roundCurrency(Decimal.max(0, rawBalance));
  const change_due = roundCurrency(Decimal.max(0, toDecimal(amount_paid).minus(toDecimal(net_payable))));
  const is_settled = net_payable > 0 ? toDecimal(amount_paid).gte(toDecimal(net_payable)) : false;

  return {
    subtotal,
    discount_amount,
    taxable_amount,
    gst_rate,
    gst_amount,
    round_off,
    grand_total,
    exchange_amount,
    net_payable,
    amount_paid,
    balance_amount,
    change_due,
    is_settled,
  };
}
