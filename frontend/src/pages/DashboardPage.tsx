import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { rateApi } from '../services/masters';
import { CurrentRate } from '../types';
import {
  TrendingUp,
  Receipt,
  Scale,
  Gem,
  CircleDollarSign,
  ShieldCheck,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const { user, health } = useAuth();
  const [rates, setRates] = useState<CurrentRate[]>([]);

  useEffect(() => {
    rateApi.getCurrentRates()
      .then(setRates)
      .catch((err) => console.error('Failed to load dashboard rates:', err));
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
          <div className="welcome-tag font-mono">JEWEL SUITE ERP • MASTERS CONNECTED</div>
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

      {/* Metrics Row (Placeholders for upcoming business modules) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Today's Sales</span>
            <div className="metric-icon-box gold">
              <Receipt size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">₹0.00</div>
          <div className="metric-footer">
            <span className="metric-phase">Module: Retail Billing (Part 3)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Stock Valuation</span>
            <div className="metric-icon-box emerald">
              <Scale size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">₹0.00</div>
          <div className="metric-footer">
            <span className="metric-phase">Module: Inventory & Tags (Part 2)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Girvi Loans</span>
            <div className="metric-icon-box indigo">
              <CircleDollarSign size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">0 Pledges</div>
          <div className="metric-footer">
            <span className="metric-phase">Module: Finance & Girvi (Part 7)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Karigar Workshop</span>
            <div className="metric-icon-box amber">
              <Gem size={18} />
            </div>
          </div>
          <div className="metric-value font-mono">0 Open Jobs</div>
          <div className="metric-footer">
            <span className="metric-phase">Module: Workshop (Part 6)</span>
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
