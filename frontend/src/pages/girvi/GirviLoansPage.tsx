// frontend/src/pages/girvi/GirviLoansPage.tsx
// Jewel Suite: Girvi / Pledged Jewellery Loans Management Page

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { girviApi } from '../../services/girvi';
import { customerApi } from '../../services/masters';
import { GirviLoan, GirviMetrics, Customer } from '../../types';
import { Landmark, Plus, Search, ShieldCheck, AlertCircle, Eye, X } from 'lucide-react';
import {
  formatWeight,
  formatFineWeight,
  formatCurrency,
  toDecimal,
  parseDecimalInput,
} from '../../utils/precision';
import Decimal from 'decimal.js';
import './Girvi.css';

export const GirviLoansPage: React.FC = () => {
  const navigate = useNavigate();

  const [loans, setLoans] = useState<GirviLoan[]>([]);
  const [metrics, setMetrics] = useState<GirviMetrics | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('2.0');
  const [interestType, setInterestType] = useState('MONTHLY_PERCENT');
  const [dueDate, setDueDate] = useState('');
  const [ltvPercent, setLtvPercent] = useState('75.0');
  const [disburseImmediately, setDisburseImmediately] = useState(true);
  const [disbursementMode, setDisbursementMode] = useState('CASH');

  // Pledged Item State
  const [itemDescription, setItemDescription] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [lessWeight, setLessWeight] = useState('0');
  const [tunchPercent, setTunchPercent] = useState('91.6');
  const [valuationRate, setValuationRate] = useState('7000');
  const [items, setItems] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, loansData, custData] = await Promise.all([
        girviApi.getMetrics(),
        girviApi.listLoans({ search: search || undefined, status: statusFilter || undefined }),
        customerApi.list({ pageSize: 100 }),
      ]);
      setMetrics(metricsData);
      setLoans(loansData.items);
      setCustomers(custData.items);
    } catch (err: any) {
      console.error('Error loading Girvi data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Live item weight math
  const grossD = toDecimal(grossWeight);
  const lessD = toDecimal(lessWeight);
  const netD = grossD.gt(lessD) ? grossD.minus(lessD) : new Decimal(0);
  const tunchD = toDecimal(tunchPercent);
  const fineD = netD.mul(tunchD).div(100);
  const rateD = toDecimal(valuationRate);
  const valuationD = fineD.mul(rateD);

  const gross = grossD.toNumber();
  const less = lessD.toNumber();
  const net = netD.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const tunch = tunchD.toNumber();
  const fine = fineD.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  const rate = rateD.toNumber();
  const valuation = valuationD.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  const addItemToLoan = () => {
    if (!itemDescription.trim() || gross <= 0 || rate <= 0) {
      setErrorMsg('Please enter item description, valid gross weight, and valuation rate');
      return;
    }
    setErrorMsg('');
    setItems([
      ...items,
      {
        description: itemDescription.trim(),
        gross_weight: gross,
        less_weight: less,
        net_weight: net,
        tunch_percent: tunch,
        fine_weight: fine,
        valuation_rate: rate,
        valuation_amount: valuation,
        pledged_value: valuation,
      },
    ]);
    setItemDescription('');
    setGrossWeight('');
    setLessWeight('0');
  };

  const removeItemFromLoan = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalCollateralValue = items.reduce((sum, it) => sum.plus(toDecimal(it.valuation_amount)), new Decimal(0)).toNumber();
  const ltvRatio = toDecimal(ltvPercent || 75);
  const maxEligibleLoan = toDecimal(totalCollateralValue).mul(ltvRatio).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg('Please select a customer');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one pledged jewellery item');
      return;
    }
    const principal = parseFloat(principalAmount);
    if (!principal || principal <= 0) {
      setErrorMsg('Please enter a valid principal loan amount');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        customer_id: customerId,
        due_date: dueDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        principal_amount: principal,
        interest_rate: parseFloat(interestRate) || 2.0,
        interest_type: interestType,
        ltv_percent: ltvRatio,
        items,
        disburse_immediately: disburseImmediately,
        disbursement_payment_mode: disbursementMode,
      };

      await girviApi.createLoan(payload);
      setIsModalOpen(false);
      resetModal();
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to create Girvi loan');
    } finally {
      setSubmitting(false);
    }
  };

  const resetModal = () => {
    setCustomerId('');
    setPrincipalAmount('');
    setDueDate('');
    setItems([]);
    setErrorMsg('');
  };

  return (
    <div className="girvi-page">
      {/* Header */}
      <div className="girvi-header">
        <div>
          <h1 className="girvi-title">
            <Landmark size={24} color="#d4af37" />
            Girvi Loans & Jewellery Pledges
          </h1>
          <div className="girvi-subtitle">
            Pawn loans against customer gold/silver ornaments with LTV valuation & physical custody vault tracking
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            background: 'linear-gradient(135deg, #d4af37, #aa820a)',
            color: '#000',
            fontWeight: 700,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          <Plus size={18} />
          New Girvi Loan
        </button>
      </div>

      {/* Metrics Banner */}
      {metrics && (
        <div className="girvi-summary-cards">
          <div className="girvi-card">
            <div className="girvi-card-title">Active Girvi Loans</div>
            <div className="girvi-card-value">{metrics.active_loans_count}</div>
          </div>
          <div className="girvi-card">
            <div className="girvi-card-title">Principal Outstanding</div>
            <div className="girvi-card-value highlight-gold">
              ₹{metrics.total_principal_outstanding.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="girvi-card">
            <div className="girvi-card-title">Total Pledged Value</div>
            <div className="girvi-card-value highlight-green">
              ₹{metrics.total_pledged_value.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="girvi-card">
            <div className="girvi-card-title">Overdue Loans</div>
            <div className="girvi-card-value highlight-red">
              {metrics.overdue_loans_count}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="girvi-filter-bar">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search by Loan No, Customer Name, Phone, or Ornament description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-main)',
              }}
            />
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '0.6rem 1rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.6rem 1rem',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            color: 'var(--text-main)',
          }}
        >
          <option value="">All Loan Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Loans Table */}
      <div className="girvi-table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8e95a5' }}>Loading Girvi loans...</div>
        ) : loans.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#8e95a5' }}>
            No Girvi loans found. Click "New Girvi Loan" to record collateral and disburse funds.
          </div>
        ) : (
          <table className="girvi-table">
            <thead>
              <tr>
                <th>Loan No</th>
                <th>Customer</th>
                <th>Loan Date</th>
                <th>Due Date</th>
                <th>Principal</th>
                <th>Total Interest</th>
                <th>Repaid</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.loan_number}</td>
                  <td>
                    <strong>{row.customer_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{row.customer_phone || 'No phone'}</div>
                  </td>
                  <td>{row.loan_date}</td>
                  <td>{row.due_date}</td>
                  <td>₹{row.principal_amount.toLocaleString('en-IN')}</td>
                  <td>₹{row.total_interest.toLocaleString('en-IN')}</td>
                  <td style={{ color: '#2ecc71' }}>₹{row.total_repaid.toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: row.outstanding_amount > 0 ? '#e74c3c' : '#2ecc71' }}>
                    ₹{row.outstanding_amount.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`girvi-status-badge girvi-status-${row.status.toLowerCase().replace('_', '-')}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/finance/girvi/${row.id}`)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '4px',
                        color: 'var(--gold-primary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Eye size={14} /> View Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Girvi Loan Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(33, 29, 23, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-gold)',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} /> New Girvi Jewellery Loan
              </h2>
              <button
                onClick={() => { setIsModalOpen(false); resetModal(); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(231, 76, 60, 0.15)',
                  border: '1px solid #e74c3c',
                  color: '#e74c3c',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                }}
              >
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateLoan}>
              {/* Customer Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Select Customer (Girvi Client) *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                  }}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'No phone'}) - {c.customer_code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Pledged Item Card */}
              <div
                style={{
                  background: 'var(--gold-bg-subtle)',
                  border: '1px dashed var(--border-gold)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--gold-primary)' }}>
                  Add Pledged Collateral Item (Customer-Owned)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Description</label>
                    <input
                      type="text"
                      placeholder="e.g. 22K Gold Mangalsutra (1 pc)"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gross Wt (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.000"
                      value={grossWeight}
                      onChange={(e) => setGrossWeight(parseDecimalInput(e.target.value, 3))}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Less Wt (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.000"
                      value={lessWeight}
                      onChange={(e) => setLessWeight(parseDecimalInput(e.target.value, 3))}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tunch %</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tunchPercent}
                      onChange={(e) => setTunchPercent(parseDecimalInput(e.target.value, 2))}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate (₹/g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valuationRate}
                      onChange={(e) => setValuationRate(parseDecimalInput(e.target.value, 2))}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Net Wt: <strong style={{ color: 'var(--text-main)' }}>{formatWeight(net)}g</strong> | Fine Wt:{' '}
                    <strong style={{ color: 'var(--gold-primary)' }}>{formatFineWeight(fine)}g</strong> | Val:{' '}
                    <strong style={{ color: '#059669' }}>{formatCurrency(valuation)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={addItemToLoan}
                    style={{
                      padding: '0.45rem 1rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--gold-primary)',
                      color: 'var(--gold-primary)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    + Add Item
                  </button>
                </div>

                {/* Items List */}
                {items.length > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#8e95a5', marginBottom: '0.35rem' }}>
                      Pledged Collateral Items ({items.length}):
                    </div>
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.4rem 0.5rem',
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: '4px',
                          marginBottom: '0.3rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>
                          <strong>{it.description}</strong> - Net: {formatWeight(it.net_weight)}g, Fine: {formatFineWeight(it.fine_weight)}g, Val:{' '}
                          <span style={{ color: '#2ecc71' }}>{formatCurrency(it.valuation_amount)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItemFromLoan(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', marginTop: '0.5rem', fontSize: '0.9rem', color: '#d4af37' }}>
                      Total Collateral Valuation: <strong>₹{totalCollateralValue.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Loan Terms */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#8e95a5', marginBottom: '0.25rem' }}>
                    LTV Ratio (%)
                  </label>
                  <input
                    type="number"
                    value={ltvPercent}
                    onChange={(e) => setLtvPercent(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Max Loan: ₹{maxEligibleLoan.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Principal Loan Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Interest Type
                  </label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  >
                    <option value="MONTHLY_PERCENT">Monthly %</option>
                    <option value="ANNUAL_PERCENT">Annual %</option>
                    <option value="FLAT_AMOUNT">Flat Amount</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Interest Rate (% or ₹)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              {/* Disbursement Option */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={disburseImmediately}
                    onChange={(e) => setDisburseImmediately(e.target.checked)}
                  />
                  <span>Disburse Principal Immediately (Generate Finance Payment & Ledger Debit)</span>
                </label>
                {disburseImmediately && (
                  <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Disbursement Mode:</span>
                    <select
                      value={disbursementMode}
                      onChange={(e) => setDisbursementMode(e.target.value)}
                      style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    >
                      <option value="CASH">CASH (Physical Drawer)</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetModal(); }}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    background: 'var(--gold-gradient)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#1A160F',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Girvi Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
