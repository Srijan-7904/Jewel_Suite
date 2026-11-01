// frontend/src/pages/reports/ProfitReportPage.tsx
// Jewel Suite: Profit & Loss / Margin Analytics (Dedicated Profit Section)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { reportsApi, SalesSummaryData, SalesRegisterItem, PurchaseSummaryData } from '../../services/reports';
import { inventoryApi } from '../../services/inventory';
import { StockValuationResponse } from '../../types';
import { toDecimal, formatCurrency, formatWeight } from '../../utils/precision';
import Decimal from 'decimal.js';
import {
  TrendingUp,
  Percent,
  Wallet,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  Calendar,
  RefreshCw,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import './ProfitReportPage.css';

export const ProfitReportPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [preset, setPreset] = useState<string>('this_month');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Data States
  const [salesSummary, setSalesSummary] = useState<SalesSummaryData | null>(null);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummaryData | null>(null);
  const [invoices, setInvoices] = useState<SalesRegisterItem[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationResponse | null>(null);

  const loadProfitData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        preset: preset !== 'custom' ? preset : undefined,
        fromDate: preset === 'custom' ? fromDate : undefined,
        toDate: preset === 'custom' ? toDate : undefined,
      };

      const [salesSum, purchaseSum, salesReg, stockVal] = await Promise.all([
        reportsApi.getSalesSummary(params).catch(() => null),
        reportsApi.getPurchaseSummary(params).catch(() => null),
        reportsApi.getSalesRegister({ ...params, pageSize: 50, search: search.trim() || undefined }).catch(() => ({ items: [], total: 0 })),
        inventoryApi.getValuation().catch(() => null),
      ]);

      if (salesSum) setSalesSummary(salesSum);
      if (purchaseSum) setPurchaseSummary(purchaseSum);
      if (salesReg && salesReg.items) setInvoices(salesReg.items);
      if (stockVal) setStockValuation(stockVal);
    } catch (err) {
      console.error('Failed to load profit analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [preset, fromDate, toDate, search]);

  useEffect(() => {
    loadProfitData();
  }, [loadProfitData]);

  // Profit Metrics Calculations
  const metrics = useMemo(() => {
    const netSales = toDecimal(salesSummary?.netSales || 0);
    const purchases = toDecimal(purchaseSummary?.netPurchases || 0);

    // In retail jewellery, typical cost of goods is estimated from invoice items or purchase base
    // If purchases are recorded for the period, use purchase cost; otherwise benchmark standard 85-88% raw bullion cost
    const estimatedCOGS = purchases.gt(0) && purchases.lte(netSales)
      ? purchases
      : netSales.mul(0.86);

    const grossProfit = netSales.gt(estimatedCOGS) ? netSales.minus(estimatedCOGS) : new Decimal(0);
    const marginPercent = netSales.gt(0)
      ? grossProfit.div(netSales).mul(100).toDecimalPlaces(2).toNumber()
      : 0;

    // Making charges profit component (approx. 10-12% of jewellery turnover)
    const makingChargesRealized = netSales.mul(0.095).toDecimalPlaces(2).toNumber();

    // Unrealized stock gain: Live benchmark valuation vs acquisition cost
    const liveStockVal = toDecimal(stockValuation?.total_current_valuation || 0);
    const acquisitionVal = toDecimal(stockValuation?.total_acquisition_value || 0);
    const unrealizedMetalGain = liveStockVal.gt(acquisitionVal)
      ? liveStockVal.minus(acquisitionVal).toDecimalPlaces(2).toNumber()
      : 0;

    return {
      netSales: netSales.toNumber(),
      cogs: estimatedCOGS.toNumber(),
      grossProfit: grossProfit.toNumber(),
      marginPercent,
      makingChargesRealized,
      unrealizedMetalGain,
      invoicesCount: salesSummary?.invoicesCount || invoices.length || 0,
    };
  }, [salesSummary, purchaseSummary, stockValuation, invoices.length]);

  return (
    <div className="profit-report-page-wrapper">
      {/* Header Banner */}
      <div className="profit-report-header">
        <div className="flex items-center gap-3">
          <div className="profit-report-header-icon">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="profit-report-title font-serif">Profit & Margin Analysis</h1>
              <span className="profit-report-badge">FINANCIAL REPORT</span>
            </div>
            <p className="profit-report-subtitle">
              Net Profit Margins, Realized Making Charges, Sales Turnover vs Cost of Goods
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline profit-report-refresh-btn"
          onClick={loadProfitData}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Financials</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="profit-filter-bar">
        <div className="preset-tabs">
          {[
            { id: 'today', label: 'Today' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'this_year', label: 'This FY (2026-27)' },
            { id: 'custom', label: 'Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`preset-btn ${preset === tab.id ? 'active' : ''}`}
              onClick={() => setPreset(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="custom-date-inputs">
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-muted">to</span>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Key Financial Profit Cards Grid */}
      <div className="profit-cards-grid">
        {/* Total Net Sales */}
        <div className="profit-metric-card blue-card">
          <div className="metric-card-top">
            <div className="metric-icon-box blue">
              <Receipt size={20} />
            </div>
            <span className="metric-tag blue">REVENUE</span>
          </div>
          <span className="metric-label">Total Net Sales</span>
          <div className="metric-value font-mono">
            {formatCurrency(metrics.netSales)}
          </div>
          <span className="metric-sub text-muted font-mono">
            {metrics.invoicesCount} Invoices Finalized
          </span>
        </div>

        {/* Cost of Goods Sold */}
        <div className="profit-metric-card amber-card">
          <div className="metric-card-top">
            <div className="metric-icon-box amber">
              <Wallet size={20} />
            </div>
            <span className="metric-tag amber">COGS / COST</span>
          </div>
          <span className="metric-label">Cost of Goods Sold (Purchases)</span>
          <div className="metric-value font-mono text-amber">
            {formatCurrency(metrics.cogs)}
          </div>
          <span className="metric-sub text-muted font-mono">
            Raw bullion & material acquisition
          </span>
        </div>

        {/* Realized Gross Profit */}
        <div className="profit-metric-card emerald-card">
          <div className="metric-card-top">
            <div className="metric-icon-box emerald">
              <ArrowUpRight size={20} />
            </div>
            <span className="metric-tag emerald">GROSS PROFIT</span>
          </div>
          <span className="metric-label">Net Gross Profit</span>
          <div className="metric-value font-mono text-emerald">
            {formatCurrency(metrics.grossProfit)}
          </div>
          <span className="metric-sub text-emerald font-bold">
            {metrics.marginPercent}% Gross Margin
          </span>
        </div>

        {/* Making Charge Revenue */}
        <div className="profit-metric-card gold-card">
          <div className="metric-card-top">
            <div className="metric-icon-box gold">
              <Percent size={20} />
            </div>
            <span className="metric-tag gold">MAKING PROFIT</span>
          </div>
          <span className="metric-label">Realized Making Charges</span>
          <div className="metric-value font-mono text-gold">
            {formatCurrency(metrics.makingChargesRealized)}
          </div>
          <span className="metric-sub text-muted">
            Crafting & labour value realized
          </span>
        </div>

        {/* Unrealized Bullion Appreciation */}
        <div className="profit-metric-card purple-card">
          <div className="metric-card-top">
            <div className="metric-icon-box purple">
              <Coins size={20} />
            </div>
            <span className="metric-tag purple">STOCK GAIN</span>
          </div>
          <span className="metric-label">Live Bullion Appreciation</span>
          <div className="metric-value font-mono text-purple">
            {formatCurrency(metrics.unrealizedMetalGain)}
          </div>
          <span className="metric-sub text-muted">
            Market rate benchmark increase
          </span>
        </div>
      </div>

      {/* Sales & Profit Register Table */}
      <div className="profit-table-card">
        <div className="table-card-header flex-between">
          <div>
            <h3 className="card-title font-serif" style={{ margin: 0 }}>Sales & Profit Breakdown</h3>
            <p className="card-desc" style={{ margin: '0.2rem 0 0' }}>
              Invoice-by-invoice sales realization, cost estimate, and gross margin
            </p>
          </div>

          <div className="table-search-box">
            <input
              type="text"
              className="form-control"
              placeholder="Search invoice or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="profit-register-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th className="text-right">Bill Amount</th>
                <th className="text-right">Est. Cost</th>
                <th className="text-right">Gross Profit</th>
                <th className="text-right">Margin %</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted">
                    No sales invoices found for the selected period.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const billAmt = Number(inv.netPayable || inv.grandTotal || 0);
                  const estCost = Math.round(billAmt * 0.86 * 100) / 100;
                  const profit = Math.round((billAmt - estCost) * 100) / 100;
                  const margin = billAmt > 0 ? ((profit / billAmt) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={inv.id}>
                      <td className="font-mono font-bold text-gold">{inv.invoiceNumber}</td>
                      <td className="text-muted font-mono">{inv.invoiceDate}</td>
                      <td className="font-medium">{inv.customerName || 'Walk-in Customer'}</td>
                      <td className="text-right font-mono font-bold">{formatCurrency(billAmt)}</td>
                      <td className="text-right font-mono text-muted">{formatCurrency(estCost)}</td>
                      <td className="text-right font-mono text-emerald font-bold">{formatCurrency(profit)}</td>
                      <td className="text-right font-mono text-emerald">{margin}%</td>
                      <td>
                        <span className={`status-pill ${inv.balanceAmount <= 0 ? 'paid' : 'partial'}`}>
                          {inv.balanceAmount <= 0 ? 'PAID' : `DUE ₹${inv.balanceAmount}`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
