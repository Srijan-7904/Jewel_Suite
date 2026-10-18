// frontend/src/pages/finance/CustomerLedgerPage.tsx
import React, { useState, useEffect } from 'react';
import { financeApi, CreatePaymentInput, CreateAdjustmentInput } from '../../services/finance';
import { customerApi } from '../../services/masters';
import { Customer, LedgerEntry, PartyStatementSummary } from '../../types';
import {
  Users,
  SlidersHorizontal,
  ArrowDownLeft,
  Receipt,
  Scale,
} from 'lucide-react';
import './Finance.css';
import '../workshop/Workshop.css';

export const CustomerLedgerPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [statement, setStatement] = useState<PartyStatementSummary | null>(null);
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
    customerApi.list({ pageSize: 100 })
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
      const res = await financeApi.getCustomerLedger(selectedCustomerId, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        pageSize: 100,
      });
      setEntries(res.items);
      setStatement(res.statement);
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
            Party-wise debit/credit statement, invoice payments, and outstanding balances
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '280px' }}>
          <label style={{ fontSize: '0.75rem', color: '#9da4b3' }}>Select Customer Party</label>
          <select
            className="filter-input"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone || c.customer_code})
              </option>
            ))}
          </select>
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
              <span>Total Debited (Sales)</span>
              <Receipt size={16} className="text-rose" />
            </div>
            <div className="finance-card-value text-rose">
              ₹{statement.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Total purchases by customer</div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Credited (Paid)</span>
              <ArrowDownLeft size={16} className="text-emerald" />
            </div>
            <div className="finance-card-value text-emerald">
              ₹{statement.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Total payments received</div>
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
                ? 'Receivable (Customer owes shop)'
                : statement.current_balance < 0
                ? 'Advance Credit Balance'
                : 'Account fully settled'}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="workshop-table-container">
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Payment Mode</th>
              <th>Debit (Dr)</th>
              <th>Credit (Cr)</th>
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
                  No transactions recorded for this customer yet.
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
                      <option value="CREDIT">CREDIT (Reduces Customer Debt)</option>
                      <option value="DEBIT">DEBIT (Increases Customer Debt)</option>
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
                    placeholder="e.g. Rounding waiver, dispute resolution, goodwill credit"
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
