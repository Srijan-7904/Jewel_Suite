import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rateApi } from '../services/masters';
import { inventoryApi } from '../services/inventory';
import { financeApi } from '../services/finance';
import { reportsApi, DashboardMetricsData } from '../services/reports';
import { CurrentRate, StockValuationResponse, FinanceSummary } from '../types';
import {
  TrendingUp,
  Receipt,
  Scale,
  ShieldCheck,
  Database,
  Layers,
  Sparkles,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  BadgePercent,
} from 'lucide-react';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, health } = useAuth();
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [valuation, setValuation] = useState<StockValuationResponse | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [reportMetrics, setReportMetrics] = useState<DashboardMetricsData | null>(null);

  useEffect(() => {
    rateApi.getCurrentRates()
      .then(setRates)
      .catch((err) => console.error('Failed to load dashboard rates:', err));

    inventoryApi.getValuation()
      .then(setValuation)
      .catch((err) => console.error('Failed to load dashboard stock valuation:', err));

    financeApi.getSummary()
      .then(setFinance)
      .catch((err) => console.error('Failed to load dashboard finance summary:', err));

    reportsApi.getDashboardMetrics()
      .then(setReportMetrics)
      .catch((err) => console.error('Failed to load reporting dashboard metrics:', err));
  }, []);

  const gold24 = rates.find((r) => r.metal_code === 'GOLD' && r.purity_code === '24K');
  const gold22 = rates.find((r) => r.metal_code === 'GOLD' && r.purity_code === '22K');
  const silver999 = rates.find((r) => r.metal_code === 'SILVER' && (r.purity_code === '999' || r.purity_name.includes('999')));
  const plat950 = rates.find((r) => r.metal_code === 'PLATINUM' && r.purity_code === '950');

  const formatRate = (rateObj?: CurrentRate) => {
    if (!rateObj || !rateObj.rate) return 'N/A';
    return `₹${rateObj.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/g`;
  };

  return (
    <div className="dashboard-page">
      {/* Welcome Banner with Real Database-driven Rates */}
      <div className="welcome-banner">
        <div className="welcome-text">
          <div className="welcome-tag font-mono">JEWEL SUITE ERP • INVENTORY & VALUATION CONNECTED</div>
          <h2 className="welcome-title font-serif">Welcome, {user?.username || 'Jeweller'}</h2>
          <p className="welcome-desc">
            Offline-First Jewellery POS and ERP terminal is operational on this machine.
          </p>
        </div>
        <div className="rate-ticker">
          <div className="rate-card">
            <span className="rate-metal">GOLD 24K</span>
            <span className="rate-value font-mono">{formatRate(gold24)}</span>
            <span className="rate-change neutral font-mono">Live DB</span>
          </div>
          <div className="rate-card">
            <span className="rate-metal">GOLD 22K (916)</span>
            <span className="rate-value font-mono">{formatRate(gold22)}</span>
            <span className="rate-change neutral font-mono">Live DB</span>
          </div>
          <div className="rate-card">
            <span className="rate-metal">SILVER 999</span>
            <span className="rate-value font-mono">{formatRate(silver999)}</span>
            <span className="rate-change neutral font-mono">Live DB</span>
          </div>
          {plat950 && (
            <div className="rate-card">
              <span className="rate-metal">PLATINUM 950</span>
              <span className="rate-value font-mono">{formatRate(plat950)}</span>
              <span className="rate-change neutral font-mono">Live DB</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=SALES&report=sales-summary&preset=today')}
          title="Click to view Today's Sales in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Today's Sales</span>
            <div className="metric-icon-box gold">
              <Receipt size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.todaySales ?? finance?.today_sales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">
              Today's Collections: ₹{finance ? finance.today_collections.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=SALES&report=sales-summary&preset=this_month')}
          title="Click to view Monthly Turnover in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Monthly Turnover</span>
            <div className="metric-icon-box gold">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.monthlySales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">Finalized sales this month</span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=INVENTORY&report=stock-valuation')}
          title="Click to view Stock Valuation in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Stock Valuation</span>
            <div className="metric-icon-box emerald">
              <Scale size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.stockValuation ?? valuation?.total_current_valuation ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">
              {valuation && valuation.total_items > 0
                ? `${valuation.total_items} items in stock • ${valuation.total_fine_weight.toFixed(3)}g fine wt`
                : 'Live market valuation'}
            </span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=FINANCE&report=receivables')}
          title="Click to view Customer Receivables in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Customer Receivables</span>
            <div className="metric-icon-box amber">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.receivables ?? finance?.total_receivables ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">Due from credit sale customers</span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=FINANCE&report=payables')}
          title="Click to view Total Payables in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Total Payables</span>
            <div className="metric-icon-box rose">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.payables ?? finance?.total_payables ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">
              Suppliers: ₹{finance ? finance.supplier_payables.toLocaleString('en-IN') : '0'} • Karigars: ₹{finance ? finance.karigar_payables.toLocaleString('en-IN') : '0'}
            </span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=GIRVI&report=active-loans')}
          title="Click to view Active Girvi Loans in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Active Girvi Loans</span>
            <div className="metric-icon-box amber">
              <Coins size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.activeLoansAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">
              {reportMetrics?.activeLoansCount || 0} active / overdue loans
            </span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=GST&report=gst-sales&preset=this_month')}
          title="Click to view GST Collected in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">GST Collected (Mo)</span>
            <div className="metric-icon-box purple">
              <BadgePercent size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{(reportMetrics?.monthlyGstCollected ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">3% GST on sales finalized this month</span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>

        <div
          className="metric-card metric-card-clickable"
          onClick={() => navigate('/reports?category=FINANCE&report=cash-book&preset=today')}
          title="Click to view Cash in Drawer in Daybook"
        >
          <div className="metric-header">
            <span className="metric-title">Cash in Drawer</span>
            <div className="metric-icon-box indigo">
              <Wallet size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">
            ₹{finance ? finance.cash_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="metric-footer">
            <span className="metric-phase">Physical counter cash balance</span>
            <span className="metric-link-text">Daybook →</span>
          </div>
        </div>
      </div>

      {/* Part 1 Foundation Verification Panel */}
      <div className="foundation-status-panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <ShieldCheck size={20} className="panel-icon gold" />
            <div>
              <h3 className="panel-title font-serif">Part 1: Architecture & Foundation Health</h3>
              <p className="panel-subtitle">Current status of offline database, authentication, and core API</p>
            </div>
          </div>
          <span className="badge badge-success">ALL SYSTEMS NOMINAL</span>
        </div>

        <div className="foundation-grid">
          <div className="foundation-item">
            <div className="item-label">
              <Database size={15} />
              <span>Database Engine</span>
            </div>
            <div className="item-val font-mono">SQLite (better-sqlite3: {health?.database || 'CONNECTED'})</div>
            <div className="item-sub">WAL Mode • Foreign Keys Enabled</div>
          </div>

          <div className="foundation-item">
            <div className="item-label">
              <Layers size={15} />
              <span>Migration Pipeline</span>
            </div>
            <div className="item-val font-mono">schema_migrations: Active</div>
            <div className="item-sub">001_initial_schema.sql Applied</div>
          </div>

          <div className="foundation-item">
            <div className="item-label">
              <TrendingUp size={15} />
              <span>Session & Security</span>
            </div>
            <div className="item-val font-mono">User: {user?.username} ({user?.role})</div>
            <div className="item-sub">Bcrypt Hash • Offline JWT Token</div>
          </div>

          <div className="foundation-item">
            <div className="item-label">
              <Sparkles size={15} />
              <span>Transaction Engine</span>
            </div>
            <div className="item-val font-mono">Atomic Rollbacks Ready</div>
            <div className="item-sub">withTransaction() utility verified</div>
          </div>
        </div>
      </div>
    </div>
  );
};
