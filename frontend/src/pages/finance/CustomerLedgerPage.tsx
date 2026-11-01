import React, { useState, useEffect } from 'react';
import { financeApi, CreatePaymentInput, CreateAdjustmentInput } from '../../services/finance';
import { customerApi } from '../../services/masters';
import { Customer, LedgerEntry, PartyStatementSummary, PartyMetalLedgerRecord, PartyMetalBalanceSummary } from '../../types';
import { CustomerSearchSelect } from '../../components/CustomerSearchSelect';
import {
  Users,
  SlidersHorizontal,
  ArrowDownLeft,
  Receipt,
  Scale,
  Coins,
} from 'lucide-react';
import './Finance.css';
import '../workshop/Workshop.css';

export const CustomerLedgerPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [statement, setStatement] = useState<PartyStatementSummary | null>(null);
  const [metalBalances, setMetalBalances] = useState<PartyMetalBalanceSummary[]>([]);
  const [metalEntries, setMetalEntries] = useState<PartyMetalLedgerRecord[]>([]);
  const [activeLedgerTab, setActiveLedgerTab] = useState<'CURRENCY' | 'METAL'>('CURRENCY');
  const [selectedMetalFilter, setSelectedMetalFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Receipt Form
  const [receiptMode, setReceiptMode] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK'>('CASH');
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');

  // Adjustment Form
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjDirection, setAdjDirection] = useState<'DEBIT' | 'CREDIT'>('CREDIT');
  const [adjReason, setAdjReason] = useState('');
  const [adjNotes, setAdjNotes] = useState('');

  useEffect(() => {
    customerApi.list({ pageSize: 500 })
      .then((res) => {
        setCustomers(res.items);
        if (res.items.length > 0) {
          setSelectedCustomerId(res.items[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const loadLedger = async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    try {
      const [currencyRes, metalBalRes, metalLedgerRes] = await Promise.all([
        financeApi.getCustomerLedger(selectedCustomerId, {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          pageSize: 100,
        }),
        financeApi.getCustomerMetalBalances(selectedCustomerId).catch(() => []),
        financeApi.getCustomerMetalLedger(selectedCustomerId, {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          pageSize: 100,
        }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 })),
      ]);

      setEntries(currencyRes.items);
      setStatement(currencyRes.statement);
      setMetalBalances(metalBalRes || []);
      setMetalEntries(metalLedgerRes.items || []);
    } catch (err) {
      console.error('Failed to load customer ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [selectedCustomerId, fromDate, toDate]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || receiptAmount <= 0) return;

    try {
      const payload: CreatePaymentInput = {
        party_type: 'CUSTOMER',
        party_id: selectedCustomerId,
        payment_type: 'RECEIPT',
        payment_mode: receiptMode,
        amount: Number(receiptAmount),
        reference_number: receiptRef || undefined,
        notes: receiptNotes || undefined,
      };

      await financeApi.createPayment(payload);
      setShowReceiptModal(false);
      setReceiptAmount(0);
      setReceiptRef('');
      setReceiptNotes('');
      loadLedger();
    } catch (err: any) {
      alert(err.message || 'Failed to record receipt');
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || adjAmount <= 0 || !adjReason.trim()) return;

    try {
      const payload: CreateAdjustmentInput = {
        party_type: 'CUSTOMER',
        party_id: selectedCustomerId,
        amount: Number(adjAmount),
        direction: adjDirection,
        reason: adjReason,
        notes: adjNotes || undefined,
      };

      await financeApi.createAdjustment(payload);
      setShowAdjustmentModal(false);
      setAdjAmount(0);
      setAdjReason('');
      setAdjNotes('');
      loadLedger();
    } catch (err: any) {
      alert(err.message || 'Failed to record adjustment');
    }
  };

  return (
    <div className="finance-page">
      <div className="finance-header">
        <div>
          <h1 className="finance-title">
            <Users size={26} className="text-gold" />
            Customer Receivables Ledger
          </h1>
          <div className="finance-subtitle">
            Party-wise Baaki / Jama statement (खाता बही), invoice payments, and outstanding balances
          </div>
        </div>
        <div className="workshop-actions">
          <button
            className="btn-primary"
            onClick={() => {
              setReceiptAmount(statement?.current_balance && statement.current_balance > 0 ? statement.current_balance : 0);
              setShowReceiptModal(true);
            }}
            disabled={!selectedCustomerId}
          >
            <ArrowDownLeft size={16} /> Record Payment (Receipt)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowAdjustmentModal(true)}
            disabled={!selectedCustomerId}
          >
            <SlidersHorizontal size={16} /> Adjust Balance
          </button>
        </div>
      </div>

      {/* Party Selector & Filters */}
      <div className="party-selector-bar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '320px', position: 'relative', zIndex: 10 }}>
          <label style={{ fontSize: '0.75rem', color: '#9da4b3' }}>Select Customer Party</label>
          <CustomerSearchSelect
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={(c) => setSelectedCustomerId(c.id)}
            onCustomerDiscovered={(newCust) => {
              setCustomers((prev) => {
                if (prev.some((c) => c.id === newCust.id)) return prev;
                return [...prev, newCust];
              });
            }}
            placeholder="Search party by name or phone..."
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#9da4b3' }}>From Date</label>
            <input
              type="date"
              className="filter-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#9da4b3' }}>To Date</label>
            <input
              type="date"
              className="filter-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {selectedCustomer && statement && (
        <div className="finance-summary-cards">
          <div className="finance-card">
            <div className="finance-card-title">
              <span>Customer Details</span>
              <Users size={16} className="text-gold" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedCustomer.name}</div>
            <div className="finance-card-sub">
              Code: {selectedCustomer.customer_code} • Phone: {selectedCustomer.phone || 'N/A'}
            </div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Baaki / Debited (Sales)</span>
              <Receipt size={16} className="text-rose" />
            </div>
            <div className="finance-card-value text-rose">
              ₹{statement.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Total purchases / Baaki by customer</div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Jama / Credited (Paid)</span>
              <ArrowDownLeft size={16} className="text-emerald" />
            </div>
            <div className="finance-card-value text-emerald">
              ₹{statement.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Total payments / Jama received</div>
          </div>

          <div className="finance-card" style={{ borderLeft: '3px solid #d4af37' }}>
            <div className="finance-card-title">
              <span>Current Outstanding</span>
              <Scale size={16} className="text-gold" />
            </div>
            <div className="finance-card-value text-gold">
              ₹{statement.current_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">
              {statement.current_balance > 0
                ? 'Receivable / Baaki (Customer owes shop - बाकी)'
                : statement.current_balance < 0
                ? 'Advance Jama / Credit Balance (जमा)'
                : 'Account fully settled'}
            </div>
          </div>

          {/* Gold Metal Balance Card */}
          <div className="finance-card" style={{ borderLeft: '3px solid #dfb742' }}>
            <div className="finance-card-title">
              <span>Gold Metal Due</span>
              <Coins size={16} className="text-gold" />
            </div>
            <div className="finance-card-value text-gold">
              {(metalBalances.find((m) => m.metal_code === 'GOLD')?.balance_grams ?? 0).toFixed(4)} g
            </div>
            <div className="finance-card-sub">
              {(metalBalances.find((m) => m.metal_code === 'GOLD')?.balance_grams ?? 0) > 0
                ? 'Customer owes gold'
                : (metalBalances.find((m) => m.metal_code === 'GOLD')?.balance_grams ?? 0) < 0
                ? 'Shop owes gold'
                : 'Zero gold dues'}
            </div>
          </div>

          {/* Silver Metal Balance Card */}
          <div className="finance-card" style={{ borderLeft: '3px solid #94a3b8' }}>
            <div className="finance-card-title">
              <span>Silver Metal Due</span>
              <Scale size={16} style={{ color: '#cbd5e1' }} />
            </div>
            <div className="finance-card-value" style={{ color: '#cbd5e1' }}>
              {(metalBalances.find((m) => m.metal_code === 'SILVER')?.balance_grams ?? 0).toFixed(3)} g
            </div>
            <div className="finance-card-sub">
              {(metalBalances.find((m) => m.metal_code === 'SILVER')?.balance_grams ?? 0) > 0
                ? 'Customer owes silver'
                : (metalBalances.find((m) => m.metal_code === 'SILVER')?.balance_grams ?? 0) < 0
                ? 'Shop owes silver'
                : 'Zero silver dues'}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Mode Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{
              background: activeLedgerTab === 'CURRENCY' ? 'linear-gradient(135deg, #dfb742 0%, #b8860b 100%)' : undefined,
              color: activeLedgerTab === 'CURRENCY' ? '#1a160f' : undefined,
              fontWeight: 700,
            }}
            onClick={() => setActiveLedgerTab('CURRENCY')}
          >
            <Receipt size={15} /> Currency Ledger (₹)
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{
              background: activeLedgerTab === 'METAL' ? 'linear-gradient(135deg, #dfb742 0%, #b8860b 100%)' : undefined,
              color: activeLedgerTab === 'METAL' ? '#1a160f' : undefined,
              fontWeight: 700,
            }}
            onClick={() => setActiveLedgerTab('METAL')}
          >
            <Coins size={15} /> Metal Ledger (Gold & Silver)
          </button>
        </div>

        {activeLedgerTab === 'METAL' && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#9da4b3' }}>Filter Metal:</span>
            <button
              type="button"
              className={`btn-secondary ${selectedMetalFilter === 'ALL' ? 'active-tab' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => setSelectedMetalFilter('ALL')}
            >
              All Metals
            </button>
            <button
              type="button"
              className={`btn-secondary ${selectedMetalFilter === 'GOLD' ? 'active-tab' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#dfb742' }}
              onClick={() => setSelectedMetalFilter('GOLD')}
            >
              Gold Only
            </button>
            <button
              type="button"
              className={`btn-secondary ${selectedMetalFilter === 'SILVER' ? 'active-tab' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#cbd5e1' }}
              onClick={() => setSelectedMetalFilter('SILVER')}
            >
              Silver Only
            </button>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      {activeLedgerTab === 'CURRENCY' ? (
        <div className="workshop-table-container">
          <table className="workshop-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Payment Mode</th>
                <th>Debit / Baaki (Dr - बाकी)</th>
                <th>Credit / Jama (Cr - जमा)</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading customer ledger entries...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                    No currency transactions recorded for this customer yet.
                  </td>
                </tr>
              ) : (
                entries.map((row) => (
                  <tr key={row.id}>
                    <td>{row.created_at}</td>
                    <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.reference_number || '-'}</td>
                    <td>
                      <div>{row.description}</div>
                      <span style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
                        Type: {row.entry_type}
                      </span>
                    </td>
                    <td>
                      {row.payment_method ? (
                        <span className={`badge-mode badge-mode-${row.payment_method.toLowerCase()}`}>
                          {row.payment_method}
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>-</span>
                      )}
                    </td>
                    <td className="debit-text">
                      {row.debit_credit === 'DEBIT' ? `₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="credit-text">
                      {row.debit_credit === 'CREDIT' ? `₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="balance-text">
                      ₹{row.balance_after.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Metal Ledger Table */
        <div className="workshop-table-container">
          <table className="workshop-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Reference</th>
                <th>Metal & Purity</th>
                <th>Description</th>
                <th>Debit / Baaki Given (Dr g - बाकी)</th>
                <th>Credit / Jama Received (Cr g - जमा)</th>
                <th>Balance (g)</th>
                <th>Valuation Rate & Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading customer metal ledger entries...
                  </td>
                </tr>
              ) : metalEntries.filter((e) => selectedMetalFilter === 'ALL' || e.metal_code === selectedMetalFilter).length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                    No metal ledger entries found for this customer.
                  </td>
                </tr>
              ) : (
                metalEntries
                  .filter((e) => selectedMetalFilter === 'ALL' || e.metal_code === selectedMetalFilter)
                  .map((row) => (
                    <tr key={row.id}>
                      <td>{row.created_at}</td>
                      <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.reference_number || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className={`metal-badge ${row.metal_code === 'GOLD' ? 'metal-badge-gold' : 'metal-badge-silver'}`}>
                            {row.metal_name || row.metal_code}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                            {row.purity_name || 'Standard'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div>{row.description}</div>
                        <span style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
                          Type: {row.entry_type} • Fine Wt: {row.fine_weight.toFixed(4)}g
                        </span>
                      </td>
                      <td className="debit-text" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.debit_credit === 'DEBIT' ? `${row.weight.toFixed(4)} g` : '-'}
                      </td>
                      <td className="credit-text" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.debit_credit === 'CREDIT' ? `${row.weight.toFixed(4)} g` : '-'}
                      </td>
                      <td className="balance-text" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {row.balance_after > 0 ? `+${row.balance_after.toFixed(4)} g (Dr)` : row.balance_after < 0 ? `${row.balance_after.toFixed(4)} g (Cr)` : '0.0000 g'}
                      </td>
                      <td>
                        {row.valuation_rate > 0 ? (
                          <div style={{ fontSize: '0.8rem' }}>
                            <div>₹{row.valuation_rate}/g</div>
                            <small className="text-gold">₹{row.valuation_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</small>
                          </div>
                        ) : (
                          <span style={{ color: '#6b7280' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* RECORD PAYMENT (RECEIPT) MODAL */}
      {showReceiptModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Record Customer Payment (Receipt)</h3>
              <button className="modal-close" onClick={() => setShowReceiptModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleReceiptSubmit}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#9da4b3' }}>
                  Customer: <strong>{selectedCustomer?.name}</strong> | Current Outstanding:{' '}
                  <strong style={{ color: '#d4af37' }}>
                    ₹{statement?.current_balance.toLocaleString('en-IN')}
                  </strong>
                </p>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select
                      className="form-select"
                      value={receiptMode}
                      onChange={(e) => setReceiptMode(e.target.value as any)}
                    >
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">CARD</option>
                      <option value="BANK">BANK / NEFT</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                {receiptMode !== 'CASH' && (
                  <div className="form-group">
                    <label>Reference Number / Transaction UTR *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. UPI-99887766, Bank Ref..."
                      value={receiptRef}
                      onChange={(e) => setReceiptRef(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Notes / Voucher Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Balance settlement towards Diwali purchase"
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowReceiptModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Generate Receipt Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create Ledger Adjustment</h3>
              <button className="modal-close" onClick={() => setShowAdjustmentModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAdjustmentSubmit}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#9da4b3' }}>
                  Audited adjustment for <strong>{selectedCustomer?.name}</strong>
                </p>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Adjustment Direction *</label>
                    <select
                      className="form-select"
                      value={adjDirection}
                      onChange={(e) => setAdjDirection(e.target.value as any)}
                    >
                      <option value="CREDIT">Jama / Credit (Reduces Customer Debt - जमा)</option>
                      <option value="DEBIT">Baaki / Debit (Increases Customer Debt - बाकी)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rounding waiver, dispute resolution, goodwill jama / credit"
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Additional context"
                    value={adjNotes}
                    onChange={(e) => setAdjNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAdjustmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
