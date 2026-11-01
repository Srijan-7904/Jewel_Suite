// frontend/src/pages/inventory/MetalStockInwardPage.tsx
// Jewel Suite: Dedicated Metal Stock Inward (Gold / Silver Bullion Inward)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { rateApi } from '../../services/masters';
import { inventoryApi } from '../../services/inventory';
import { CurrentRate, Metal, MetalPurity, StockItem, StockValuationResponse } from '../../types';
import { toDecimal, formatWeight, formatFineWeight, formatCurrency } from '../../utils/precision';
import Decimal from 'decimal.js';
import {
  Coins,
  Scale,
  Boxes,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowDownLeft,
} from 'lucide-react';
import './MetalStockInwardPage.css';

export const MetalStockInwardPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reference Masters & Data
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [currentRates, setCurrentRates] = useState<CurrentRate[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationResponse | null>(null);
  const [recentMetalStock, setRecentMetalStock] = useState<StockItem[]>([]);

  // Inward Form State
  const [form, setForm] = useState({
    metal_id: '',
    purity_id: '',
    gross_weight: '',
    less_weight: '0',
    tunch_percent: '',
    rate_per_gram: '',
    tag_no: '',
    huid: '',
    notes: '',
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Fetch all necessary data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mList, pList, ratesList, valRes, stockList] = await Promise.all([
        rateApi.getMetals().catch(() => []),
        rateApi.getAllPurities().catch(() => []),
        rateApi.getCurrentRates().catch(() => []),
        inventoryApi.getValuation().catch(() => null),
        inventoryApi.list({ pageSize: 15 }).catch(() => ({ items: [], total: 0 })),
      ]);

      const validMetals = Array.isArray(mList) ? mList : [];
      const validPurities = Array.isArray(pList) ? pList : [];
      const validRates = Array.isArray(ratesList) ? ratesList : [];

      // Filter specifically for Bullion Metals: Gold and Silver ONLY
      const bullionMetals = validMetals.filter((m) => {
        const c = (m.code || '').toUpperCase();
        const n = (m.name || '').toUpperCase();
        return c === 'GOLD' || n.includes('GOLD') || c === 'SILVER' || n.includes('SILVER');
      });

      const effectiveMetals = bullionMetals.length > 0 ? bullionMetals : validMetals;
      setMetals(effectiveMetals);
      setPurities(validPurities);
      setCurrentRates(validRates);
      if (valRes) setStockValuation(valRes);
      if (stockList && stockList.items) setRecentMetalStock(stockList.items);

      // Default selection: Gold 22K 916
      const goldMetal = effectiveMetals.find(
        (m) => (m.code || '').toUpperCase() === 'GOLD' || (m.name || '').toUpperCase().includes('GOLD')
      ) || effectiveMetals[0];

      const goldPurity = goldMetal
        ? validPurities.find(
            (p) =>
              p.metal_id === goldMetal.id &&
              (p.code === '22K' ||
                (p.name || '').includes('916') ||
                ((p as any).purity_name || '').includes('916'))
          ) || validPurities.find((p) => p.metal_id === goldMetal.id)
        : null;

      let initialRate = '';
      if (goldMetal && goldPurity && validRates.length > 0) {
        const matched = validRates.find((r) => r.metal_id === goldMetal.id && r.purity_id === goldPurity.id);
        if (matched) initialRate = matched.rate.toString();
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);

      setForm((prev) => ({
        ...prev,
        metal_id: prev.metal_id || (goldMetal ? goldMetal.id : ''),
        purity_id: prev.purity_id || (goldPurity ? goldPurity.id : ''),
        tunch_percent: prev.tunch_percent || (goldPurity?.tunch_percent ? goldPurity.tunch_percent.toString() : '91.67'),
        rate_per_gram: prev.rate_per_gram || initialRate,
        tag_no: prev.tag_no || `TAG-G${randomSuffix}`,
      }));
    } catch (err: any) {
      console.error('Failed to load metal stock inward data:', err);
      showNotification('error', err.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bullion Holding Aggregates
  const goldStats = useMemo(() => {
    const groups =
      stockValuation?.groups.filter(
        (g) =>
          (g.metal_code || '').toUpperCase() === 'GOLD' ||
          (g.metal_name || '').toUpperCase().includes('GOLD')
      ) || [];
    return {
      fine: groups.reduce((acc, g) => acc + (g.fine_weight || 0), 0),
      gross: groups.reduce((acc, g) => acc + (g.gross_weight || 0), 0),
      net: groups.reduce((acc, g) => acc + (g.net_weight || 0), 0),
      items: groups.reduce((acc, g) => acc + (g.item_count || 0), 0),
      valuation: groups.reduce((acc, g) => acc + (g.current_valuation || 0), 0),
    };
  }, [stockValuation]);

  const silverStats = useMemo(() => {
    const groups =
      stockValuation?.groups.filter(
        (g) =>
          (g.metal_code || '').toUpperCase() === 'SILVER' ||
          (g.metal_name || '').toUpperCase().includes('SILVER')
      ) || [];
    return {
      fine: groups.reduce((acc, g) => acc + (g.fine_weight || 0), 0),
      gross: groups.reduce((acc, g) => acc + (g.gross_weight || 0), 0),
      net: groups.reduce((acc, g) => acc + (g.net_weight || 0), 0),
      items: groups.reduce((acc, g) => acc + (g.item_count || 0), 0),
      valuation: groups.reduce((acc, g) => acc + (g.current_valuation || 0), 0),
    };
  }, [stockValuation]);

  const totalBullionValuation = useMemo(() => {
    return toDecimal(goldStats.valuation).plus(silverStats.valuation).toNumber();
  }, [goldStats.valuation, silverStats.valuation]);

  // Real-time Calculations for Inward Form
  const liveCalculations = useMemo(() => {
    try {
      const grossD = toDecimal(form.gross_weight);
      const lessD = toDecimal(form.less_weight);
      const tunchD = toDecimal(form.tunch_percent);
      const rateD = toDecimal(form.rate_per_gram);

      const netD = grossD.gt(lessD) ? grossD.minus(lessD) : new Decimal(0);
      const fineD = netD.mul(tunchD).div(100);
      const metalValD = fineD.mul(rateD);

      return {
        net: netD.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
        fine: fineD.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
        metalVal: metalValD.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      };
    } catch {
      return { net: 0, fine: 0, metalVal: 0 };
    }
  }, [form.gross_weight, form.less_weight, form.tunch_percent, form.rate_per_gram]);

  // Handle Metal Change
  const handleMetalSelect = (metalId: string) => {
    const metalObj = metals.find((m) => m.id === metalId);
    const isGold = (metalObj?.code || '').toUpperCase() === 'GOLD' || (metalObj?.name || '').toUpperCase().includes('GOLD');
    const pList = purities.filter((p) => p.metal_id === metalId);
    const defaultP = isGold
      ? pList.find(
          (p) =>
            p.code === '22K' ||
            (p.name || '').includes('916') ||
            ((p as any).purity_name || '').includes('916')
        ) || pList[0]
      : pList.find(
          (p) =>
            p.code === '925' ||
            (p.name || '').includes('925') ||
            ((p as any).purity_name || '').includes('925')
        ) || pList[0];

    let tunch = '';
    let rate = '';
    if (defaultP) {
      if (defaultP.tunch_percent !== null && defaultP.tunch_percent !== undefined) {
        tunch = defaultP.tunch_percent.toString();
      }
      const cr = currentRates.find((r) => r.metal_id === metalId && r.purity_id === defaultP.id);
      if (cr) rate = cr.rate.toString();
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const tagPrefix = isGold ? 'TAG-G' : 'TAG-S';

    setForm((prev) => ({
      ...prev,
      metal_id: metalId,
      purity_id: defaultP ? defaultP.id : '',
      tunch_percent: tunch,
      rate_per_gram: rate,
      tag_no: `${tagPrefix}${randomSuffix}`,
    }));
  };

  // Handle Purity Change
  const handlePuritySelect = (purityId: string) => {
    const p = purities.find((pur) => pur.id === purityId);
    let tunch = form.tunch_percent;
    let rate = form.rate_per_gram;

    if (p) {
      if (p.tunch_percent !== null && p.tunch_percent !== undefined) {
        tunch = p.tunch_percent.toString();
      }
      const cr = currentRates.find((r) => r.metal_id === p.metal_id && r.purity_id === p.id);
      if (cr) rate = cr.rate.toString();
    }

    setForm((prev) => ({
      ...prev,
      purity_id: purityId,
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Submit Inward
  const handleSaveMetalStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const grossD = toDecimal(form.gross_weight);
      const lessD = toDecimal(form.less_weight);
      const tunchD = toDecimal(form.tunch_percent);
      const rateD = toDecimal(form.rate_per_gram);

      if (!form.tag_no.trim()) {
        throw new Error('Stock Tag Number is required');
      }
      if (grossD.lte(0)) {
        throw new Error('Gross weight must be greater than zero');
      }
      if (lessD.lt(0) || lessD.gt(grossD)) {
        throw new Error('Less weight cannot exceed gross weight');
      }
      if (tunchD.lt(0) || tunchD.gt(100)) {
        throw new Error('Purity Tunch % must be between 0 and 100');
      }

      const metalObj = metals.find((m) => m.id === form.metal_id);
      const isGold = metalObj?.code === 'GOLD' || metalObj?.name?.toLowerCase().includes('gold');
      const defaultStockName = isGold ? 'Gold Stock' : 'Silver Stock';

      await inventoryApi.create({
        tag_no: form.tag_no.trim().toUpperCase(),
        product_id: undefined,
        item_name: defaultStockName,
        metal_id: form.metal_id,
        purity_id: form.purity_id,
        gross_weight: grossD.toNumber(),
        less_weight: lessD.toNumber(),
        tunch_percent: tunchD.toNumber(),
        wastage_percent: 0,
        making_charge: 0,
        rate_per_gram: rateD.toNumber(),
        huid: form.huid.trim() || undefined,
        notes: form.notes.trim() || undefined,
        acquisition_type: 'OPENING_STOCK',
      });

      showNotification('success', `✓ Stock Item ${form.tag_no.toUpperCase()} successfully inwarded to store inventory!`);

      // Reset for next entry
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const tagPrefix = isGold ? 'TAG-G' : 'TAG-S';
      setForm((prev) => ({
        ...prev,
        tag_no: `${tagPrefix}${randomSuffix}`,
        gross_weight: '',
        less_weight: '0',
        huid: '',
        notes: '',
      }));

      // Refresh stock valuation & recent list
      const [valRes, stockList] = await Promise.all([
        inventoryApi.getValuation().catch(() => null),
        inventoryApi.list({ pageSize: 15 }).catch(() => ({ items: [], total: 0 })),
      ]);
      if (valRes) setStockValuation(valRes);
      if (stockList && stockList.items) setRecentMetalStock(stockList.items);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to inward metal stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="metal-inward-page-wrapper">
      {/* Toast Notification */}
      {feedback && (
        <div className={`metal-inward-toast ${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="metal-inward-header">
        <div className="flex items-center gap-3">
          <div className="metal-inward-header-icon">
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="metal-inward-title font-serif">Metal Stock Inward (Gold / Silver)</h1>
              <span className="badge-inward-bullion">OPENING BULLION STOCK</span>
            </div>
            <p className="metal-inward-subtitle">
              Pure Gold & Silver Physical Metal Inward, Fine Weight Tracker & Live Market Valuation
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline metal-inward-refresh-btn"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Live Rates</span>
        </button>
      </div>

      {/* KPI Bullion Holdings & Live Valuation Grid */}
      <div className="bullion-kpi-grid">
        {/* Pure Gold Card */}
        <div className="bullion-kpi-card gold-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-box gold">
              <Coins size={22} />
            </div>
            <span className="kpi-tag gold">GOLD BULLION</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Store Pure Gold (शुद्ध सोना)</span>
            <div className="kpi-main-val font-mono text-gold">
              {formatFineWeight(goldStats.fine)} <span className="kpi-unit">g</span>
            </div>
            <div className="kpi-sub-row">
              <span>Gross: <strong>{formatWeight(goldStats.gross)}g</strong></span>
              <span>•</span>
              <span>Net: <strong>{formatWeight(goldStats.net)}g</strong></span>
              <span>•</span>
              <span>{goldStats.items} entries</span>
            </div>
            <div className="kpi-valuation-pill">
              <span className="val-lbl">Live Valuation:</span>
              <span className="val-amt font-mono">{formatCurrency(goldStats.valuation)}</span>
            </div>
          </div>
        </div>

        {/* Pure Silver Card */}
        <div className="bullion-kpi-card silver-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-box silver">
              <Scale size={22} />
            </div>
            <span className="kpi-tag silver">SILVER BULLION</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Store Pure Silver (शुद्ध चांदी)</span>
            <div className="kpi-main-val font-mono text-silver">
              {formatFineWeight(silverStats.fine)} <span className="kpi-unit">g</span>
            </div>
            <div className="kpi-sub-row">
              <span>Gross: <strong>{formatWeight(silverStats.gross)}g</strong></span>
              <span>•</span>
              <span>Net: <strong>{formatWeight(silverStats.net)}g</strong></span>
              <span>•</span>
              <span>{silverStats.items} entries</span>
            </div>
            <div className="kpi-valuation-pill">
              <span className="val-lbl">Live Valuation:</span>
              <span className="val-amt font-mono">{formatCurrency(silverStats.valuation)}</span>
            </div>
          </div>
        </div>

        {/* Total Valuation Card */}
        <div className="bullion-kpi-card emerald-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-box emerald">
              <Boxes size={22} />
            </div>
            <span className="kpi-tag emerald">TOTAL HOLDING</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Total Bullion Market Valuation</span>
            <div className="kpi-main-val font-mono text-emerald">
              {formatCurrency(totalBullionValuation)}
            </div>
            <div className="kpi-sub-row">
              <span>Live Benchmark Bullion Holding</span>
            </div>
            <div className="kpi-valuation-pill emerald-bg">
              <span className="val-lbl">Au: {formatCurrency(goldStats.valuation)}</span>
              <span>|</span>
              <span className="val-lbl">Ag: {formatCurrency(silverStats.valuation)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card: Inward Form + Recent Table */}
      <div className="metal-inward-content-card">
        <div className="card-header flex-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="card-title font-serif">Add Metal Stock (Gold / Silver Inward)</h2>
              <span className="badge-inward-bullion">OPENING BULLION STOCK</span>
            </div>
            <p className="card-desc">
              Direct physical bullion inward for raw gold, silver, bars, coins, or vault balance. Tracks fine weight and live benchmark valuation without product SKU catalog restrictions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveMetalStock} className="metal-inward-form">
          <div className="form-grid-3">
            <div className="form-group">
              <label>Metal *</label>
              <select
                className="form-control"
                value={form.metal_id}
                onChange={(e) => handleMetalSelect(e.target.value)}
                required
              >
                {metals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Purity / Grade *</label>
              <select
                className="form-control"
                value={form.purity_id}
                onChange={(e) => handlePuritySelect(e.target.value)}
                required
              >
                {purities
                  .filter((p) => p.metal_id === form.metal_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p as any).purity_name || p.name || p.code} {p.tunch_percent ? `(${p.tunch_percent}% Tunch)` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label>Stock Tag No *</label>
              <input
                type="text"
                className="form-control font-mono font-bold uppercase"
                value={form.tag_no}
                onChange={(e) => setForm({ ...form, tag_no: e.target.value.toUpperCase() })}
                placeholder="TAG-G1938"
                required
              />
            </div>
          </div>

          <div className="form-grid-4">
            <div className="form-group">
              <label>Gross Weight (g) *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="form-control font-mono text-bold"
                value={form.gross_weight}
                onChange={(e) => setForm({ ...form, gross_weight: e.target.value })}
                placeholder="0.000"
                required
              />
            </div>

            <div className="form-group">
              <label>Less Weight / Stones (g)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                className="form-control font-mono"
                value={form.less_weight}
                onChange={(e) => setForm({ ...form, less_weight: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label>Purity Tunch % *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                max="100"
                className="form-control font-mono"
                value={form.tunch_percent}
                onChange={(e) => setForm({ ...form, tunch_percent: e.target.value })}
                placeholder="e.g. 91.67"
                required
              />
            </div>

            <div className="form-group">
              <label>Valuation Rate ₹/g</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control font-mono"
                value={form.rate_per_gram}
                onChange={(e) => setForm({ ...form, rate_per_gram: e.target.value })}
                placeholder="9167"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>HUID (Hallmark ID - Optional)</label>
              <input
                type="text"
                className="form-control font-mono uppercase"
                value={form.huid}
                onChange={(e) => setForm({ ...form, huid: e.target.value.toUpperCase() })}
                placeholder="e.g. HD9281 (Optional)"
              />
            </div>

            <div className="form-group">
              <label>Remarks / Description (Optional)</label>
              <input
                type="text"
                className="form-control"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Opening Balance Bullion / Safe Vault (Optional)"
              />
            </div>
          </div>

          {/* REAL-TIME CALCULATED BANNER */}
          <div className="metal-inward-calc-bar">
            <div className="metal-inward-calc-box">
              <span className="calc-label">Calculated Net Weight</span>
              <span className="calc-value font-mono">
                {formatWeight(liveCalculations.net)} g
              </span>
            </div>
            <div className="metal-inward-calc-divider" />
            <div className="metal-inward-calc-box">
              <span className="calc-label">Calculated Fine Weight</span>
              <span className="calc-value font-mono text-gold">
                {formatFineWeight(liveCalculations.fine)} g
              </span>
            </div>
            <div className="metal-inward-calc-divider" />
            <div className="metal-inward-calc-box">
              <span className="calc-label">Calculated Metal Value</span>
              <span className="calc-value font-mono text-emerald">
                {formatCurrency(liveCalculations.metalVal)}
              </span>
            </div>
          </div>

          <div className="metal-inward-form-actions">
            <button type="submit" className="btn btn-primary metal-inward-submit-btn" disabled={saving}>
              <Plus size={16} />
              <span>{saving ? 'Inwarding Metal...' : 'Add Metal Stock (Gold / Silver Inward)'}</span>
            </button>
          </div>
        </form>

        {/* RECENT INWARDED ITEMS TABLE */}
        <div className="metal-inward-recent-section">
          <div className="flex-between mb-3">
            <div>
              <h3 className="subheading font-serif" style={{ margin: 0 }}>Recent Metal Stock Inwards</h3>
              <p className="text-xs text-muted" style={{ margin: '0.2rem 0 0' }}>
                Latest inward entries tracked by fine weight and live benchmark valuation
              </p>
            </div>
            <span className="text-xs text-muted font-mono">{recentMetalStock.length} items</span>
          </div>

          <div className="table-responsive">
            <table className="metal-inward-table">
              <thead>
                <tr>
                  <th>Tag No</th>
                  <th>Metal & Purity</th>
                  <th className="text-right">Gross Wt</th>
                  <th className="text-right">Net Wt</th>
                  <th className="text-right">Tunch %</th>
                  <th className="text-right">Fine Wt</th>
                  <th className="text-right">Valuation Rate</th>
                  <th className="text-right">Live Valuation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentMetalStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-muted">
                      No stock items inwarded yet. Use the form above to inward pure metal stock.
                    </td>
                  </tr>
                ) : (
                  recentMetalStock.map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono font-bold text-gold">{item.tag_no}</td>
                      <td>
                        <span className="font-medium">{item.metal_name || item.metal_code}</span>
                        <span className="text-muted text-xs ml-1">({item.purity_code || item.purity_name})</span>
                      </td>
                      <td className="text-right font-mono">{formatWeight(item.gross_weight)}g</td>
                      <td className="text-right font-mono">{formatWeight(item.net_weight)}g</td>
                      <td className="text-right font-mono">{item.tunch_percent ? `${item.tunch_percent}%` : '-'}</td>
                      <td className="text-right font-mono text-gold font-bold">{formatFineWeight(item.fine_weight)}g</td>
                      <td className="text-right font-mono">
                        ₹{item.live_benchmark_rate ? Number(item.live_benchmark_rate).toLocaleString('en-IN') : Number(item.rate_per_gram || 0).toLocaleString('en-IN')}/g
                      </td>
                      <td className="text-right font-mono text-emerald font-bold">
                        {formatCurrency(item.current_valuation || 0)}
                      </td>
                      <td>
                        <span className="metal-inward-status-badge in-stock">{item.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
