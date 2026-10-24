import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { calculateSalesItem, calculateSalesTotals } from '../src/utils/salesMath.js';

export interface LessBreakdownEntryTest {
  id: string;
  item_name: string;
  purity_id?: string;
  quantity: number;
  weight_per_piece: number;
}

/**
 * Computes entry less weight and grand total less weight
 * using the exact decimal-safe arithmetic as LessWeightCalculatorModal.
 */
export function calculateLessBreakdown(entries: LessBreakdownEntryTest[]) {
  let grandTotalWeight = new Decimal(0);
  let totalPieces = 0;
  let hasNegative = false;

  const calculatedRows = entries.map((entry) => {
    if (entry.quantity < 0 || entry.weight_per_piece < 0) {
      hasNegative = true;
    }

    const qtyDec = new Decimal(entry.quantity || 0);
    const wtDec = new Decimal(entry.weight_per_piece || 0);
    const rowTotal = qtyDec.times(wtDec).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    if (!rowTotal.isNegative()) {
      grandTotalWeight = grandTotalWeight.plus(rowTotal);
      totalPieces += Math.max(0, entry.quantity || 0);
    }

    return {
      ...entry,
      calculatedTotal: rowTotal.toNumber(),
    };
  });

  return {
    rows: calculatedRows,
    totalPieces,
    totalWeight: grandTotalWeight.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
    hasNegative,
  };
}

describe('Less Weight Calculator Logic & Downstream Accounting', () => {
  it('1. Computes single entry correctly', () => {
    const entries: LessBreakdownEntryTest[] = [
      { id: '1', item_name: 'Solitaire CZ Stone', quantity: 1, weight_per_piece: 0.5 },
    ];
    const res = calculateLessBreakdown(entries);
    expect(res.totalPieces).toBe(1);
    expect(res.totalWeight).toBe(0.5);
    expect(res.rows[0].calculatedTotal).toBe(0.5);
    expect(res.hasNegative).toBe(false);
  });

  it('2. Computes the user prompt benchmark: 3 entries summing to exactly 16.000 g', () => {
    // Prompt Example:
    // - 10 jhumkas × 0.500 g = 5.000 g
    // - 20 jhumkas × 0.300 g = 6.000 g
    // - 50 pieces × 0.100 g = 5.000 g
    // - Total Less Weight = 16.000 g
    const entries: LessBreakdownEntryTest[] = [
      { id: '1', item_name: 'Jhumka Hanging A', quantity: 10, weight_per_piece: 0.500 },
      { id: '2', item_name: 'Jhumka Hanging B', quantity: 20, weight_per_piece: 0.300 },
      { id: '3', item_name: 'Small CZ Beads', quantity: 50, weight_per_piece: 0.100 },
    ];

    const res = calculateLessBreakdown(entries);
    expect(res.rows[0].calculatedTotal).toBe(5.0);
    expect(res.rows[1].calculatedTotal).toBe(6.0);
    expect(res.rows[2].calculatedTotal).toBe(5.0);
    expect(res.totalPieces).toBe(80);
    expect(res.totalWeight).toBe(16.0);
    expect(res.hasNegative).toBe(false);
  });

  it('3. Computes 10+ entries without restriction (unlimited entries)', () => {
    const entries: LessBreakdownEntryTest[] = Array.from({ length: 15 }, (_, i) => ({
      id: `entry-${i}`,
      item_name: `Stone Type ${i + 1}`,
      quantity: (i + 1) * 2,
      weight_per_piece: 0.05,
    }));

    const res = calculateLessBreakdown(entries);
    expect(res.rows.length).toBe(15);
    // sum of (1..15)*2 = 2 * (15*16/2) = 240 pcs
    expect(res.totalPieces).toBe(240);
    // 240 * 0.05 = 12.000 g
    expect(res.totalWeight).toBe(12.0);
  });

  it('4. Handles dynamic row removal safely', () => {
    const entries: LessBreakdownEntryTest[] = [
      { id: '1', item_name: 'Stone 1', quantity: 5, weight_per_piece: 0.2 }, // 1.0g
      { id: '2', item_name: 'Stone 2', quantity: 4, weight_per_piece: 0.5 }, // 2.0g
      { id: '3', item_name: 'Stone 3', quantity: 2, weight_per_piece: 0.5 }, // 1.0g
    ];

    let res = calculateLessBreakdown(entries);
    expect(res.totalWeight).toBe(4.0);

    // Remove row 2
    const filtered = entries.filter((e) => e.id !== '2');
    res = calculateLessBreakdown(filtered);
    expect(res.rows.length).toBe(2);
    expect(res.totalWeight).toBe(2.0);
    expect(res.totalPieces).toBe(7);
  });

  it('5. Handles empty breakdown safely (0.000 g total)', () => {
    const res = calculateLessBreakdown([]);
    expect(res.rows.length).toBe(0);
    expect(res.totalPieces).toBe(0);
    expect(res.totalWeight).toBe(0);
    expect(res.hasNegative).toBe(false);
  });

  it('6. Supports fractional weights with 4 decimal places (e.g. 0.025 g, 0.005 g)', () => {
    const entries: LessBreakdownEntryTest[] = [
      { id: '1', item_name: 'Micro Pavé Diamond CZ', quantity: 40, weight_per_piece: 0.025 }, // 1.0000g
      { id: '2', item_name: 'Mini Enamel Drop', quantity: 10, weight_per_piece: 0.0075 },      // 0.0750g
    ];

    const res = calculateLessBreakdown(entries);
    expect(res.rows[0].calculatedTotal).toBe(1.0);
    expect(res.rows[1].calculatedTotal).toBe(0.075);
    expect(res.totalWeight).toBe(1.075);
  });

  it('7. Flags invalid negative quantities or weights', () => {
    const entriesWithNegQty: LessBreakdownEntryTest[] = [
      { id: '1', item_name: 'Bad Entry', quantity: -5, weight_per_piece: 0.2 },
    ];
    expect(calculateLessBreakdown(entriesWithNegQty).hasNegative).toBe(true);

    const entriesWithNegWt: LessBreakdownEntryTest[] = [
      { id: '2', item_name: 'Bad Wt', quantity: 5, weight_per_piece: -0.2 },
    ];
    expect(calculateLessBreakdown(entriesWithNegWt).hasNegative).toBe(true);
  });

  it('8. Downstream integration: Applied 16.000 g less weight triggers correct net, fine, badla and totals', () => {
    // Gross: 500.000g, Applied Less: 16.000g
    // Net: 500 - 16 = 484.000g
    // Tunch: 75%
    // Pure fine: 484 * 75% = 363.0000g
    // Badla: -0.5% => Badla weight: 363 * -0.5% = -1.8150g
    // Wastage: 0%
    // Billable fine: 363 - 1.815 = 361.1850g
    // Rate: ₹7,190/g => Metal Value: 361.1850 * 7190 = ₹25,96,920.15
    // Making: 484 * ₹450 = ₹2,17,800.00
    // Total Amount: ₹25,96,920.15 + ₹2,17,800.00 = ₹28,14,720.15
    const saleResult = calculateSalesItem({
      gross_weight: 500.0,
      less_weight: 16.0,
      tunch_percent: 75.0,
      rate_per_gram: 7190,
      badla_percent: -0.5,
      wastage_percent: 0,
      making_charge: 484 * 450,
    });

    expect(saleResult.net_weight).toBe(484.0);
    expect(saleResult.fine_weight).toBe(363.0);
    expect(saleResult.badla_weight).toBe(-1.815);
    expect(saleResult.billable_weight).toBe(361.185);
    expect(saleResult.metal_value).toBe(2596920.15);
    expect(saleResult.making_charge).toBe(217800.0);
    expect(saleResult.item_amount).toBe(2814720.15);

    const totalsResult = calculateSalesTotals({
      items: [{ item_amount: saleResult.item_amount }],
      gst_rate: 3.0,
    });

    expect(totalsResult.subtotal).toBe(2814720.15);
    expect(totalsResult.taxable_amount).toBe(2814720.15);
    // GST 3% on 2814720.15 = 84441.6045 -> 84441.60
    expect(totalsResult.gst_amount).toBe(84441.6);
    // Grand Total = round(2814720.15 + 84441.60) = round(2899161.75) = 2899162
    expect(totalsResult.grand_total).toBe(2899162);
    expect(totalsResult.net_payable).toBe(2899162);
  });
});
