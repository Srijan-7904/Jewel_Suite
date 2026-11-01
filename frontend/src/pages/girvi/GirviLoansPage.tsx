// frontend/src/pages/girvi/GirviLoansPage.tsx
// Jewel Suite: Girvi / Pledged Jewellery Loans Management Page

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { girviApi } from '../../services/girvi';
import { customerApi } from '../../services/masters';
import { GirviLoan, GirviMetrics, Customer, GirviInterestType } from '../../types';
import { CustomerSearchSelect } from '../../components/CustomerSearchSelect';
import { CreateCustomerModal } from '../../components/CreateCustomerModal';
import {
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  AlertCircle,
  Eye,
  X,
  Zap,
  Clock,
  Calculator,
  UserPlus,
  Banknote,
} from 'lucide-react';
import {
  formatWeight,
  formatFineWeight,
  formatCurrency,
  toDecimal,
  parseDecimalInput,
} from '../../utils/precision';
import Decimal from 'decimal.js';
import './Girvi.css';

const TENURE_PRESETS = [
  { label: '3D', days: 3, name: '3 Days' },
  { label: '7D', days: 7, name: '7 Days' },
  { label: '15D', days: 15, name: '15 Days' },
  { label: '30D', days: 30, name: '30 Days (1 Mo)' },
  { label: '180D', days: 180, name: '180 Days (6 Mo)' },
  { label: '365D', days: 365, name: '365 Days (1 Yr)' },
];

const addDaysToDate = (baseDateStr: string, days: number): string => {
  const d = baseDateStr ? new Date(baseDateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
};

const getDaysDifference = (fromStr: string, toStr: string): number => {
  if (!fromStr || !toStr) return 0;
  const f = new Date(fromStr).getTime();
  const t = new Date(toStr).getTime();
  const diff = Math.ceil((t - f) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

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
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [principalAmount, setPrincipalAmount] = useState('');
  const [disbursedAmount, setDisbursedAmount] = useState('');
  const [interestRate, setInterestRate] = useState('2.0');
  const [interestType, setInterestType] = useState<GirviInterestType>('DAILY_PERCENT');
  const [tenurePeriod, setTenurePeriod] = useState('7D');
  const [tenureDays, setTenureDays] = useState(7);
  const [dueDate, setDueDate] = useState(() => addDaysToDate(new Date().toISOString().substring(0, 10), 7));
  const [ltvPercent, setLtvPercent] = useState('80.0');
  const [disburseImmediately, setDisburseImmediately] = useState(true);
  const [disbursementMode, setDisbursementMode] = useState('CASH');

  // Quick Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Pledged Item State
  const [itemDescription, setItemDescription] = useState('Chain');
  const [grossWeight, setGrossWeight] = useState('');
  const [lessWeight, setLessWeight] = useState('0');
  const [tunchPercent, setTunchPercent] = useState('75');
  const [valuationRate, setValuationRate] = useState('15000');
  const [manualValuation, setManualValuation] = useState('');
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

  // Currently selected customer object
  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Quick Counter / Cash Customer Selector (Like in sales)
  const handleQuickWalkin = async () => {
    try {
      // 1. Look for existing Cash or Walk-in customer to avoid duplicates
      const existingWalkin = customers.find((c) => {
        const n = (c.name || '').toUpperCase();
        const code = (c.customer_code || '').toUpperCase();
        const phone = c.phone || '';
        return (
          n.includes('COUNTER') ||
          n.includes('CASH') ||
          n.includes('WALK-IN') ||
          n.includes('WALKIN') ||
          code === 'COUNTER' ||
          code === 'CASH' ||
          phone === '9999999999' ||
          phone === 'COUNTER'
        );
      });

      if (existingWalkin) {
        setCustomerId(existingWalkin.id);
        return;
      }

      // 2. Create single standard Cash/Counter Customer master
      const walkin = await customerApi.create({
        name: 'COUNTER CASH CUSTOMER',
        customer_code: 'COUNTER',
        phone: '9999999999',
        customer_type: 'RETAIL',
        address: 'COUNTER CASH / GIRVI WALK-IN',
        city: 'LOCAL',
      });
      setCustomers((prev) => [walkin, ...prev]);
      setCustomerId(walkin.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to select counter customer');
    }
  };



  // Live item weight math
  const grossD = toDecimal(grossWeight);
  const lessD = toDecimal(lessWeight);
  const netD = grossD.gt(lessD) ? grossD.minus(lessD) : new Decimal(0);
  const tunchD = toDecimal(tunchPercent);
  const fineD = netD.mul(tunchD).div(100);
  const rateD = toDecimal(valuationRate);
  const formulaValuationD = fineD.mul(rateD);

  const gross = grossD.toNumber();
  const less = lessD.toNumber();
  const net = netD.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const tunch = tunchD.toNumber();
  const fine = fineD.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  const rate = rateD.toNumber();
  const formulaValuation = formulaValuationD.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  // If user entered a manual valuation, use it; otherwise fallback to formula valuation
  const effectiveItemValuation = manualValuation.trim() !== ''
    ? parseFloat(manualValuation) || 0
    : formulaValuation;

  const addItemToLoan = () => {
    if (!itemDescription.trim() || gross <= 0) {
      setErrorMsg('Please enter item description and valid gross weight');
      return;
    }
    if (effectiveItemValuation <= 0) {
      setErrorMsg('Please specify a valid valuation rate or assessed item value');
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
        valuation_amount: effectiveItemValuation,
        pledged_value: effectiveItemValuation,
      },
    ]);
    setItemDescription('');
    setGrossWeight('');
    setLessWeight('0');
    setManualValuation('');
  };

  const removeItemFromLoan = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalCollateralValue = items.reduce((sum, it) => sum.plus(toDecimal(it.valuation_amount)), new Decimal(0)).toNumber();
  const ltvRatio = toDecimal(ltvPercent || 80);
  const maxEligibleLoan = toDecimal(totalCollateralValue).mul(ltvRatio).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  // Financial preview math
  const principal = parseFloat(principalAmount) || 0;
  const disbursed = disbursedAmount.trim() !== '' ? parseFloat(disbursedAmount) || 0 : principal;
  const upfrontDeduction = Math.max(0, principal - disbursed);
  const rateNum = parseFloat(interestRate) || 0;

  // Calculate estimated interest for tenure
  let estimatedInterest = 0;
  let dailyInterestAmount = 0;
  if (interestType === 'DAILY_PERCENT') {
    dailyInterestAmount = (principal * rateNum) / 100;
    estimatedInterest = dailyInterestAmount * (tenureDays || 1);
  } else if (interestType === 'MONTHLY_PERCENT') {
    const monthlyInt = (principal * rateNum) / 100;
    estimatedInterest = (monthlyInt / 30) * (tenureDays || 30);
  } else if (interestType === 'ANNUAL_PERCENT') {
    const annualInt = (principal * rateNum) / 100;
    estimatedInterest = (annualInt / 365) * (tenureDays || 365);
  } else {
    estimatedInterest = rateNum;
  }
  const estimatedMaturityRepayment = principal + estimatedInterest;

  // Handle Tenure selection
  const handleSelectTenure = (preset: typeof TENURE_PRESETS[0]) => {
    setTenurePeriod(preset.label);
    setTenureDays(preset.days);
    const calculatedDue = addDaysToDate(loanDate, preset.days);
    setDueDate(calculatedDue);
  };

  // Handle manual Due Date change
  const handleDueDateChange = (newDueDate: string) => {
    setDueDate(newDueDate);
    const diff = getDaysDifference(loanDate, newDueDate);
    setTenureDays(diff);
    const matched = TENURE_PRESETS.find((p) => p.days === diff);
    setTenurePeriod(matched ? matched.label : `${diff}D`);
  };

  // Handle 1-click Reference Preset filling (User's exact example)
  const handleLoadReferenceExample = async () => {
    setItemDescription('Chain');
    setGrossWeight('10');
    setLessWeight('0');
    setTunchPercent('75');
    setValuationRate('15000');
    setManualValuation('70000');
    setItems([
      {
        description: 'Chain (Gold 18K / 75 Tunch)',
        gross_weight: 10,
        less_weight: 0,
        net_weight: 10,
        tunch_percent: 75,
        fine_weight: 7.5,
        valuation_rate: 15000,
        valuation_amount: 70000,
        pledged_value: 70000,
      },
    ]);
    setLtvPercent('80');
    setPrincipalAmount('55000');
    setDisbursedAmount('50000');
    setInterestType('DAILY_PERCENT');
    setInterestRate('2.0');
    setTenurePeriod('7D');
    setTenureDays(7);
    const calculatedDue = addDaysToDate(loanDate, 7);
    setDueDate(calculatedDue);

    if (!customerId) {
      if (customers.length > 0) {
        setCustomerId(customers[0].id);
      } else {
        await handleQuickWalkin();
      }
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg('Please select a customer or click + COUNTER CUSTOMER');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one pledged jewellery item');
      return;
    }
    if (principal <= 0) {
      setErrorMsg('Please enter a valid principal loan amount');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        customer_id: customerId,
        loan_date: loanDate,
        due_date: dueDate || addDaysToDate(loanDate, 7),
        principal_amount: principal,
        disbursed_amount: disbursed,
        upfront_deduction: upfrontDeduction,
        tenure_days: tenureDays,
        tenure_period: tenurePeriod,
        interest_rate: rateNum,
        interest_type: interestType,
        ltv_percent: ltvRatio.toNumber(),
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
    setDisbursedAmount('');
    setDueDate(addDaysToDate(new Date().toISOString().substring(0, 10), 7));
    setTenurePeriod('7D');
    setTenureDays(7);
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
            Pawn loans against customer gold/silver ornaments with LTV valuation, flexible tenure (7D/3D/15D/30D/180D/365D) & daily interest
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
                <th>Tenure / Due</th>
                <th>Principal / Paid</th>
                <th>Interest Rate</th>
                <th>Total Interest</th>
                <th>Repaid</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((row) => {
                const diffDays = getDaysDifference(row.loan_date, row.due_date);
                const tenureDisplay = row.tenure_period || `${diffDays}D`;
                const isDaily = row.interest_type === 'DAILY_PERCENT';
                const rateLabel = isDaily ? `${row.interest_rate}%/Day` : row.interest_type === 'MONTHLY_PERCENT' ? `${row.interest_rate}%/Mo` : row.interest_type === 'ANNUAL_PERCENT' ? `${row.interest_rate}%/Yr` : `₹${row.interest_rate} Flat`;

                return (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.loan_number}</td>
                    <td>
                      <strong>{row.customer_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{row.customer_phone || 'No phone'}</div>
                    </td>
                    <td>{row.loan_date}</td>
                    <td>
                      <span className="girvi-tenure-btn active" style={{ padding: '2px 6px', fontSize: '0.75rem', marginRight: '6px' }}>
                        {tenureDisplay}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#8e95a5' }}>{row.due_date}</span>
                    </td>
                    <td>
                      <strong>₹{row.principal_amount.toLocaleString('en-IN')}</strong>
                      {row.disbursed_amount && row.disbursed_amount !== row.principal_amount && (
                        <div style={{ fontSize: '0.75rem', color: '#2ecc71' }}>
                          Paid: ₹{row.disbursed_amount.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ color: '#d4af37', fontWeight: 600 }}>{rateLabel}</span>
                    </td>
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
                );
              })}
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
            backgroundColor: 'rgba(33, 29, 23, 0.65)',
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
              maxWidth: '880px',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Modal Title & 1-Click Reference Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} /> New Girvi Jewellery Loan
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleLoadReferenceExample}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.85rem',
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '6px',
                    color: 'var(--gold-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Load reference example: Chain 10g 75T ₹55k/₹50k 2%/Day 7D"
                >
                  <Zap size={14} /> Fill Example Reference (Chain 10g 75T)
                </button>
                <button
                  onClick={() => { setIsModalOpen(false); resetModal(); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
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
              {/* Customer Selector & Loan Date */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ gridColumn: 'span 2', position: 'relative', zIndex: 60 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Select Customer (Girvi Borrower) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={handleQuickWalkin}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.65rem',
                          background: 'rgba(46, 204, 113, 0.12)',
                          border: '1px solid rgba(46, 204, 113, 0.35)',
                          borderRadius: '4px',
                          color: '#2ecc71',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Select Cash / Counter Walk-in customer (Spot Girvi)"
                      >
                        <Banknote size={12} />
                        <span>+ COUNTER CUSTOMER</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustomerName('');
                          setNewCustomerPhone('');
                          setShowAddCustomerModal(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.65rem',
                          background: 'rgba(212, 175, 55, 0.12)',
                          border: '1px solid var(--border-gold)',
                          borderRadius: '4px',
                          color: 'var(--gold-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Create new customer in Master directory"
                      >
                        <UserPlus size={12} />
                        <span>+ Add Customer</span>
                      </button>
                    </div>
                  </div>

                  <CustomerSearchSelect
                    customers={customers}
                    selectedCustomerId={customerId}
                    onSelectCustomer={(c) => setCustomerId(c.id)}
                    onClearCustomer={() => setCustomerId('')}
                    onAddNewCustomer={(query) => {
                      if (query && /^\d+$/.test(query)) {
                        setNewCustomerPhone(query);
                        setNewCustomerName('');
                      } else if (query) {
                        setNewCustomerName(query);
                        setNewCustomerPhone('');
                      }
                      setShowAddCustomerModal(true);
                    }}
                    onQuickWalkin={handleQuickWalkin}
                    onCustomerDiscovered={(newCust) => {
                      setCustomers((prev) => {
                        if (prev.some((c) => c.id === newCust.id)) return prev;
                        return [...prev, newCust];
                      });
                    }}
                    placeholder="Search borrower by name or phone (e.g. 9628... / Ramesh)..."
                  />

                  {selectedCustomer && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedCustomer.name}</span>
                      {selectedCustomer.phone && <span>• 📞 {selectedCustomer.phone}</span>}
                      {selectedCustomer.customer_code && <span style={{ color: 'var(--gold-primary)' }}>({selectedCustomer.customer_code})</span>}
                      {selectedCustomer.city && <span>• 📍 {selectedCustomer.city}</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Loan Date
                  </label>
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(e) => {
                      setLoanDate(e.target.value);
                      setDueDate(addDaysToDate(e.target.value, tenureDays));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>

              {/* Add Pledged Item Card */}
              <div
                style={{
                  background: 'var(--gold-bg-subtle)',
                  border: '1px dashed var(--border-gold)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} /> Collateral Item Pledged (Customer-Owned Jewellery)
                  </h3>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick Touch:</span>
                    <button
                      type="button"
                      onClick={() => setTunchPercent('75')}
                      style={{ padding: '1px 6px', fontSize: '0.7rem', borderRadius: '4px', background: tunchPercent === '75' ? 'var(--gold-primary)' : 'var(--bg-surface-elevated)', color: tunchPercent === '75' ? '#000' : 'var(--text-main)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                    >
                      75 T (18K)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTunchPercent('91.6')}
                      style={{ padding: '1px 6px', fontSize: '0.7rem', borderRadius: '4px', background: tunchPercent === '91.6' ? 'var(--gold-primary)' : 'var(--bg-surface-elevated)', color: tunchPercent === '91.6' ? '#000' : 'var(--text-main)', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                    >
                      91.6 T (22K)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Item Name / Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Chain (Gold)"
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
                      placeholder="10.000"
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
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Purity Tunch %</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="75"
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
                      placeholder="15000"
                      value={valuationRate}
                      onChange={(e) => setValuationRate(parseDecimalInput(e.target.value, 2))}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: 600 }}>
                      Item Value (₹ Assessed)
                    </label>
                    <input
                      type="number"
                      placeholder={formulaValuation > 0 ? String(formulaValuation) : '70000'}
                      value={manualValuation}
                      onChange={(e) => setManualValuation(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-gold)', borderRadius: '4px', color: 'var(--gold-primary)', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Net Wt: <strong style={{ color: 'var(--text-main)' }}>{formatWeight(net)}g</strong> | Fine Wt:{' '}
                    <strong style={{ color: 'var(--gold-primary)' }}>{formatFineWeight(fine)}g</strong> | Assessed Value:{' '}
                    <strong style={{ color: '#059669', fontSize: '0.9rem' }}>{formatCurrency(effectiveItemValuation)}</strong>
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
                    + Add Collateral Item
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
                          <strong>{it.description}</strong> - Net: {formatWeight(it.net_weight)}g ({it.tunch_percent}T), Fine: {formatFineWeight(it.fine_weight)}g, Assessed Val:{' '}
                          <span style={{ color: '#2ecc71', fontWeight: 700 }}>{formatCurrency(it.valuation_amount)}</span>
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
                    <div style={{ textAlign: 'right', marginTop: '0.5rem', fontSize: '0.95rem', color: '#d4af37' }}>
                      Total Collateral Valuation: <strong>₹{totalCollateralValue.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Loan Terms: LTV%, Principal, Disbursed, Interest Type, Rate & Tenures */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem', position: 'relative', zIndex: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#8e95a5', marginBottom: '0.25rem' }}>
                    Value% (LTV %)
                  </label>
                  <input
                    type="number"
                    value={ltvPercent}
                    onChange={(e) => setLtvPercent(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Max Loan Limit: <strong>₹{maxEligibleLoan.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Loan Amt (Principal ₹) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 55000"
                    value={principalAmount}
                    onChange={(e) => {
                      setPrincipalAmount(e.target.value);
                      if (!disbursedAmount) setDisbursedAmount(e.target.value);
                    }}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Loan Paid Amt (Disbursed ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={disbursedAmount}
                    onChange={(e) => setDisbursedAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: '#2ecc71', fontWeight: 700 }}
                  />
                  {upfrontDeduction > 0 && (
                    <div style={{ fontSize: '0.725rem', color: '#e74c3c', marginTop: '2px' }}>
                      Upfront Advance Deduction: -₹{upfrontDeduction.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Rate of Interest
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      style={{ width: '70px', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)', fontWeight: 600 }}
                    />
                    <select
                      value={interestType}
                      onChange={(e) => setInterestType(e.target.value as GirviInterestType)}
                      style={{ flex: 1, padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)', fontSize: '0.8rem' }}
                    >
                      <option value="DAILY_PERCENT">% / Day (Daily)</option>
                      <option value="MONTHLY_PERCENT">% / Month (Monthly)</option>
                      <option value="ANNUAL_PERCENT">% / Year (Annual)</option>
                      <option value="FLAT_AMOUNT">Flat Amount (₹)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tenure Selection Presets & Due Date */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '6px', marginBottom: '1.25rem', border: '1px solid var(--border-default)', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={16} color="var(--gold-primary)" /> Select Loan Tenure Period (Quick Presets):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due Date:</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div className="girvi-tenure-group">
                  {TENURE_PRESETS.map((p) => {
                    const isSelected = tenurePeriod === p.label;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        className={`girvi-tenure-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => handleSelectTenure(p)}
                      >
                        {p.label} ({p.name})
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`girvi-tenure-btn ${!TENURE_PRESETS.some((p) => p.label === tenurePeriod) ? 'active' : ''}`}
                    onClick={() => {
                      const days = prompt('Enter custom tenure days:', String(tenureDays || 7));
                      if (days) {
                        const d = parseInt(days, 10);
                        if (d > 0) {
                          setTenureDays(d);
                          setTenurePeriod(`${d}D`);
                          setDueDate(addDaysToDate(loanDate, d));
                        }
                      }
                    }}
                  >
                    Custom Days
                  </button>
                </div>
              </div>

              {/* Live Maturity & Financial Breakdown Card */}
              {principal > 0 && (
                <div className="girvi-math-card">
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '0.4rem' }}>
                    <Calculator size={15} /> Live Loan Breakdown & Maturity Estimate:
                  </div>
                  <div className="girvi-math-grid">
                    <div className="girvi-math-item">
                      <span className="girvi-math-label">Collateral Value</span>
                      <span className="girvi-math-val">₹{totalCollateralValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="girvi-math-item">
                      <span className="girvi-math-label">Max Limit ({ltvPercent}%)</span>
                      <span className="girvi-math-val">₹{maxEligibleLoan.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="girvi-math-item">
                      <span className="girvi-math-label">Loan Principal</span>
                      <span className="girvi-math-val gold">₹{principal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="girvi-math-item">
                      <span className="girvi-math-label">Cash Disbursed</span>
                      <span className="girvi-math-val green">₹{disbursed.toLocaleString('en-IN')}</span>
                    </div>
                    {upfrontDeduction > 0 && (
                      <div className="girvi-math-item">
                        <span className="girvi-math-label">Upfront Deduction</span>
                        <span className="girvi-math-val red">-₹{upfrontDeduction.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="girvi-math-item">
                      <span className="girvi-math-label">
                        {interestType === 'DAILY_PERCENT' ? `Est. Interest (${tenureDays}D)` : 'Est. Interest'}
                      </span>
                      <span className="girvi-math-val blue">₹{Math.round(estimatedInterest).toLocaleString('en-IN')}</span>
                      {interestType === 'DAILY_PERCENT' && (
                        <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                          ₹{dailyInterestAmount.toFixed(0)}/Day
                        </span>
                      )}
                    </div>
                    <div className="girvi-math-item">
                      <span className="girvi-math-label">Maturity Repayment</span>
                      <span className="girvi-math-val gold">₹{Math.round(estimatedMaturityRepayment).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Disbursement Option */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={disburseImmediately}
                    onChange={(e) => setDisburseImmediately(e.target.checked)}
                  />
                  <span>Disburse Principal Immediately (Generate Finance Payment & Ledger Debit / Baaki - बाकी)</span>
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

      {/* Universal Luxury Customer Registration Modal with Full Options & Opening Khata */}
      <CreateCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSuccess={(created) => {
          setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
          setCustomerId(created.id);
          setShowAddCustomerModal(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
        }}
        initialName={newCustomerName}
        initialPhone={newCustomerPhone}
        defaultCustomerType="GIRVI_CLIENT"
        knownCustomers={customers}
      />
    </div>
  );
};
