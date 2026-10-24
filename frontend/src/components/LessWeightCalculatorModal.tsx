import React, { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import {
  Calculator,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
  Check,
  RotateCcw,
} from 'lucide-react';
import { toDecimal, formatWeight, parseDecimalInput } from '../utils/precision';
import './LessWeightCalculatorModal.css';

export interface LessBreakdownEntry {
  id: string;
  item_name: string;
  purity_id?: string;
  quantity: number | string;
  weight_per_piece: number | string;
}

export interface LessWeightCalculatorModalProps {
  isOpen: boolean;
  initialBreakdown?: LessBreakdownEntry[];
  initialLessWeight?: number | string;
  itemName?: string;
  purities?: Array<{ id: string; name: string; tunch_percent?: number | null }>;
  onApply: (totalWeight: number, breakdown: LessBreakdownEntry[]) => void;
  onClose: () => void;
}

const PRESET_ITEMS = [
  'Stone / CZ',
  'Wax / Lac',
  'Enamel / Meena',
  'Pearl / Beads',
  'Jhumka Hanging',
  'Thread / Dori',
];

export const LessWeightCalculatorModal: React.FC<LessWeightCalculatorModalProps> = ({
  isOpen,
  initialBreakdown,
  initialLessWeight,
  itemName,
  purities = [],
  onApply,
  onClose,
}) => {
  const [entries, setEntries] = useState<LessBreakdownEntry[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or reset entries whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;

    setValidationError(null);

    if (initialBreakdown && initialBreakdown.length > 0) {
      // Clone existing breakdown
      setEntries(
        initialBreakdown.map((e) => ({
          ...e,
          id: e.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }))
      );
    } else if (initialLessWeight !== undefined && Number(initialLessWeight) > 0) {
      // Seed with 1 entry matching current less_weight
      setEntries([
        {
          id: `entry-${Date.now()}-1`,
          item_name: 'Stone / Deductions',
          purity_id: '',
          quantity: 1,
          weight_per_piece: initialLessWeight,
        },
      ]);
    } else {
      // Default clean entry
      setEntries([
        {
          id: `entry-${Date.now()}-1`,
          item_name: 'Stone',
          purity_id: '',
          quantity: 1,
          weight_per_piece: '',
        },
      ]);
    }
  }, [isOpen, initialBreakdown, initialLessWeight]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Add a new blank row
  const handleAddEntry = (presetName?: string) => {
    setValidationError(null);
    const newEntry: LessBreakdownEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item_name: presetName || '',
      purity_id: '',
      quantity: 1,
      weight_per_piece: '',
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  // Remove an entry
  const handleRemoveEntry = (id: string) => {
    setValidationError(null);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Update a single entry field
  const handleUpdateEntry = (id: string, updates: Partial<LessBreakdownEntry>) => {
    setValidationError(null);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  // Clear all entries
  const handleClearAll = () => {
    setValidationError(null);
    setEntries([]);
  };

  // Calculate row subtotal and grand total
  let grandTotalWeight = new Decimal(0);
  let totalPieces = 0;
  let hasNegative = false;

  const calculatedRows = entries.map((entry) => {
    const qtyNum = Number(entry.quantity || 0);
    const wtNum = Number(entry.weight_per_piece || 0);

    if (qtyNum < 0 || wtNum < 0) {
      hasNegative = true;
    }

    const qtyDec = toDecimal(entry.quantity || 0);
    const wtDec = toDecimal(entry.weight_per_piece || 0);
    const rowTotal = qtyDec.times(wtDec).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    if (!rowTotal.isNegative()) {
      grandTotalWeight = grandTotalWeight.plus(rowTotal);
      totalPieces += Math.max(0, qtyNum);
    }

    return {
      ...entry,
      calculatedTotal: rowTotal.toNumber(),
    };
  });

  const formattedGrandTotal = grandTotalWeight.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();

  // Validate and apply total
  const handleApply = () => {
    if (hasNegative) {
      setValidationError('Quantities and weights per piece cannot be negative numbers.');
      return;
    }

    // Filter out completely blank rows
    const cleanEntries = entries.filter((e) => {
      const q = Number(e.quantity || 0);
      const w = Number(e.weight_per_piece || 0);
      return q > 0 || w > 0 || e.item_name.trim().length > 0;
    });

    onApply(formattedGrandTotal, cleanEntries);
  };

  return (
    <div className="modal-backdrop less-calc-backdrop" onClick={onClose}>
      <div
        className="modal-dialog less-calc-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="less-calc-title"
      >
        {/* Header */}
        <div className="modal-header less-calc-header">
          <div className="flex items-center gap-3">
            <div className="less-calc-icon-box">
              <Calculator size={20} className="text-gold" />
            </div>
            <div>
              <h3 id="less-calc-title" className="modal-title font-serif">
                Less Weight Breakdown Calculator
              </h3>
              <p className="modal-subtitle">
                {itemName ? (
                  <>
                    Item: <span className="font-semibold text-main">{itemName}</span> &bull;{' '}
                  </>
                ) : null}
                Calculate total less weight from any number of product/stone entries
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Cancel & Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Metrics Header Card */}
        <div className="less-calc-summary-bar">
          <div className="summary-metric-card">
            <span className="summary-label">Total Entries</span>
            <span className="summary-val font-mono">{entries.length}</span>
          </div>
          <div className="summary-metric-card">
            <span className="summary-label">Total Pieces (Qty)</span>
            <span className="summary-val font-mono text-main">{totalPieces} pcs</span>
          </div>
          <div className="summary-metric-card highlight">
            <span className="summary-label">Grand Total Less Weight</span>
            <span className="summary-val font-mono font-bold text-gold text-lg">
              {formatWeight(formattedGrandTotal, 3)} g
            </span>
          </div>
        </div>

        {/* Quick Item Presets */}
        <div className="less-calc-presets">
          <span className="preset-label">
            <Sparkles size={12} className="text-gold" /> Quick Add:
          </span>
          {PRESET_ITEMS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="btn-preset-pill"
              onClick={() => handleAddEntry(preset)}
            >
              + {preset}
            </button>
          ))}
        </div>

        {/* Error notification if any */}
        {validationError && (
          <div className="less-calc-alert">
            <AlertCircle size={15} />
            <span>{validationError}</span>
          </div>
        )}

        {/* Table Body */}
        <div className="less-calc-body">
          {entries.length === 0 ? (
            <div className="less-calc-empty">
              <Calculator size={36} className="text-muted/40 mb-2" />
              <p className="font-semibold text-main">No Less Weight Entries</p>
              <p className="text-xs text-muted mb-3">
                Add entries to calculate stones, wax, beads or mixed attachments.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleAddEntry()}
              >
                <Plus size={14} />
                <span>+ Add First Entry</span>
              </button>
            </div>
          ) : (
            <div className="less-calc-table-wrap">
              <table className="less-calc-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px', textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: '160px' }}>Product / Item Name</th>
                    <th style={{ width: '135px' }}>Purity / Karat</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Qty (Pcs)</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Less Wt / Pc (g)</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Total Less (g)</th>
                    <th style={{ width: '36px', textAlign: 'center' }}>✕</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedRows.map((entry, idx) => {
                    const rowIsNegative =
                      Number(entry.quantity || 0) < 0 ||
                      Number(entry.weight_per_piece || 0) < 0;

                    return (
                      <tr
                        key={entry.id}
                        className={`less-calc-row ${rowIsNegative ? 'row-error' : ''}`}
                      >
                        <td className="text-center font-mono text-muted text-xs">
                          {idx + 1}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="less-calc-input text-main"
                            value={entry.item_name}
                            onChange={(e) =>
                              handleUpdateEntry(entry.id, { item_name: e.target.value })
                            }
                            placeholder="e.g. Jhumka, Stone, Wax"
                          />
                        </td>
                        <td>
                          <select
                            className="less-calc-select font-mono text-xs"
                            value={entry.purity_id || ''}
                            onChange={(e) =>
                              handleUpdateEntry(entry.id, { purity_id: e.target.value })
                            }
                            title="Product purity (recorded for tracking mixed items)"
                          >
                            <option value="">Non-Metal / Stone</option>
                            {purities.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="less-calc-input text-right font-mono"
                            value={entry.quantity ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateEntry(entry.id, {
                                quantity: val === '' ? '' : parseInt(val, 10) || 0,
                              });
                            }}
                            placeholder="1"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="less-calc-input text-right font-mono font-semibold"
                            value={entry.weight_per_piece ?? ''}
                            onChange={(e) =>
                              handleUpdateEntry(entry.id, {
                                weight_per_piece: parseDecimalInput(e.target.value, 4),
                              })
                            }
                            placeholder="0.000"
                          />
                        </td>
                        <td className="text-right font-mono font-bold text-amber-300">
                          {formatWeight(entry.calculatedTotal, 3)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn-trash-entry"
                            onClick={() => handleRemoveEntry(entry.id)}
                            title="Remove this entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Table Toolbar */}
          <div className="less-calc-table-toolbar">
            <button
              type="button"
              className="btn btn-outline btn-sm font-semibold"
              onClick={() => handleAddEntry()}
            >
              <Plus size={14} />
              <span>Add Another Entry</span>
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-muted hover:text-danger"
                onClick={handleClearAll}
              >
                <RotateCcw size={12} />
                <span>Reset / Clear Rows</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer less-calc-footer">
          <div className="less-calc-formula-hint">
            <span className="font-mono text-muted text-xs">
              Formula: Entry Total = Qty &times; Wt/Pc &bull; Grand Total = &Sigma; Entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary font-bold shadow-md"
              onClick={handleApply}
            >
              <Check size={16} />
              <span>Apply Total ({formatWeight(formattedGrandTotal, 3)} g)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LessWeightCalculatorModal;
