import { Decimal } from 'decimal.js';
import {
  calculateNetWeight,
  calculateFineWeight,
  calculateMetalValue,
  roundWeight,
  roundFineWeight,
  roundCurrency,
  roundToPrecision,
} from './jewelleryMath.js';
import { BadRequestError } from './errors.js';
import { toDecimal } from './precision.js';

export interface ExchangeItemCalculationInput {
  gross_weight: number;
  less_weight?: number;
  tunch_percent: number;
  exchange_rate: number;
  deduction_percent?: number;
  deduction_amount?: number;
}

export interface ExchangeItemCalculationResult {
  net_weight: number;
  fine_weight: number;
  metal_value: number;
  deduction_percent: number;
  deduction_amount: number;
  exchange_value: number;
}

/**
 * Calculates line-item weights, metal value, deduction, and final exchange value
 * for an old metal / jewellery item received from a customer.
 */
export function calculateExchangeItem(
  input: ExchangeItemCalculationInput
): ExchangeItemCalculationResult {
  const net_weight = calculateNetWeight(input.gross_weight, input.less_weight ?? 0);
  const fine_weight = calculateFineWeight(net_weight, input.tunch_percent);

  if (typeof input.exchange_rate !== 'number' || isNaN(input.exchange_rate)) {
    throw new BadRequestError('Exchange rate must be a valid numeric value');
  }
  if (input.exchange_rate < 0) {
    throw new BadRequestError('Exchange rate cannot be negative');
  }

  const metal_value = calculateMetalValue(fine_weight, input.exchange_rate);

  let deduction_percent = 0;
  let deduction_amount = 0;

  if (input.deduction_percent !== undefined && input.deduction_percent !== null) {
    deduction_percent = Number(input.deduction_percent);
    if (deduction_percent < 0 || deduction_percent > 100) {
      throw new BadRequestError(`Deduction percent must be between 0 and 100, received: ${deduction_percent}`);
    }
    deduction_amount = roundCurrency(
      toDecimal(metal_value).times(toDecimal(deduction_percent)).dividedBy(100)
    );
  } else if (input.deduction_amount !== undefined && input.deduction_amount !== null) {
    deduction_amount = roundCurrency(Number(input.deduction_amount));
    if (deduction_amount < 0) {
      throw new BadRequestError('Deduction amount cannot be negative');
    }
    if (deduction_amount > metal_value) {
      throw new BadRequestError(
        `Deduction amount (₹${deduction_amount}) cannot exceed metal value (₹${metal_value})`
      );
    }
    deduction_percent = metal_value > 0
      ? roundToPrecision(toDecimal(deduction_amount).dividedBy(toDecimal(metal_value)).times(100), 2)
      : 0;
  }

  if (deduction_amount > metal_value) {
    throw new BadRequestError(
      `Deduction amount (₹${deduction_amount}) cannot exceed metal value (₹${metal_value})`
    );
  }

  const exchange_value = roundCurrency(
    Decimal.max(0, toDecimal(metal_value).minus(toDecimal(deduction_amount)))
  );

  return {
    net_weight,
    fine_weight,
    metal_value,
    deduction_percent,
    deduction_amount,
    exchange_value,
  };
}

export interface ExchangeTotalsInput {
  items: Array<{
    gross_weight: number;
    net_weight: number;
    fine_weight: number;
    metal_value: number;
    deduction_amount: number;
    exchange_value: number;
  }>;
  payout_amount?: number;
}

export interface ExchangeTotalsResult {
  total_gross_weight: number;
  total_net_weight: number;
  total_fine_weight: number;
  total_metal_value: number;
  total_deduction_amount: number;
  total_exchange_value: number;
  payout_amount: number;
}

/**
 * Computes authoritative aggregate totals for an exchange transaction.
 */
export function calculateExchangeTotals(
  input: ExchangeTotalsInput
): ExchangeTotalsResult {
  let grossDec = new Decimal(0);
  let netDec = new Decimal(0);
  let fineDec = new Decimal(0);
  let metalValDec = new Decimal(0);
  let deductDec = new Decimal(0);
  let exValDec = new Decimal(0);

  for (const item of input.items || []) {
    grossDec = grossDec.plus(toDecimal(item.gross_weight || 0));
    netDec = netDec.plus(toDecimal(item.net_weight || 0));
    fineDec = fineDec.plus(toDecimal(item.fine_weight || 0));
    metalValDec = metalValDec.plus(toDecimal(item.metal_value || 0));
    deductDec = deductDec.plus(toDecimal(item.deduction_amount || 0));
    exValDec = exValDec.plus(toDecimal(item.exchange_value || 0));
  }

  const payout_amount = roundCurrency(Decimal.max(0, toDecimal(input.payout_amount || 0)));

  return {
    total_gross_weight: roundWeight(grossDec),
    total_net_weight: roundWeight(netDec),
    total_fine_weight: roundFineWeight(fineDec),
    total_metal_value: roundCurrency(metalValDec),
    total_deduction_amount: roundCurrency(deductDec),
    total_exchange_value: roundCurrency(exValDec),
    payout_amount,
  };
}
