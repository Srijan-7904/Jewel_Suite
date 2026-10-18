// frontend/src/pages/finance/SupplierLedgerPage.tsx
import React, { useState, useEffect } from 'react';
import { financeApi, CreatePaymentInput, CreateAdjustmentInput } from '../../services/finance';
import { supplierApi } from '../../services/masters';
import { Supplier, LedgerEntry, PartyStatementSummary } from '../../types';
import {
  Truck,
  ArrowUpRight,
  SlidersHorizontal,
  Scale,
  ShoppingBag,
} from 'lucide-react';
import './Finance.css';
import '../workshop/Workshop.css';

export const SupplierLedgerPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [statement, setStatement] = useState<PartyStatementSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Payment Form
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK'>('BANK');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Adjustment Form
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjDirection, setAdjDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [adjReason, setAdjReason] = useState('');
  const [adjNotes, setAdjNotes] = useState('');

  useEffect(() => {
    supplierApi.list({ pageSize: 100 })
      .then((res) => {
        setSuppliers(res.items);
        if (res.items.length > 0) {
          setSelectedSupplierId(res.items[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const loadLedger = async () => {
    if (!selectedSupplierId) return;
    setLoading(true);
    try {
      const res = await financeApi.getSupplierLedger(selectedSupplierId, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        pageSize: 100,
      });
      setEntries(res.items);
      setStatement(res.statement);
    } catch (err) {
      console.error('Failed to load supplier ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [selectedSupplierId, fromDate, toDate]);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || paymentAmount <= 0) return;

    try {
      const payload: CreatePaymentInput = {
        party_type: 'SUPPLIER',
        party_id: selectedSupplierId,
        payment_type: 'PAYMENT',
        payment_mode: paymentMode,
        amount: Number(paymentAmount),
        reference_number: paymentRef || undefined,
        notes: paymentNotes || undefined,
      };

      await financeApi.createPayment(payload);
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentRef('');
      setPaymentNotes('');
      loadLedger();
    } catch (err: any) {
      alert(err.message || 'Failed to record supplier payment');
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || adjAmount <= 0 || !adjReason.trim()) return;

    try {
      const payload: CreateAdjustmentInput = {
        party_type: 'SUPPLIER',
        party_id: selectedSupplierId,
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
            <Truck size={26} className="text-gold" />
            Supplier Payables Ledger
          </h1>
          <div className="finance-subtitle">
            Vendor bullion and stock purchase bills, bank transfers, and outstanding payables
          </div>
        </div>
        <div className="workshop-actions">
          <button
            className="btn-primary"
            onClick={() => {
              setPaymentAmount(statement?.current_balance && statement.current_balance > 0 ? statement.current_balance : 0);
              setShowPaymentModal(true);
            }}
            disabled={!selectedSupplierId}
          >
            <ArrowUpRight size={16} /> Pay Supplier
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowAdjustmentModal(true)}
            disabled={!selectedSupplierId}
          >
            <SlidersHorizontal size={16} /> Adjust Balance
          </button>
        </div>
      </div>

      {/* Party Selector & Filters */}
      <div className="party-selector-bar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '280px' }}>
          <label style={{ fontSize: '0.75rem', color: '#9da4b3' }}>Select Supplier / Bullion Dealer</label>
          <select
            className="filter-input"
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.supplier_code})
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
      {selectedSupplier && statement && (
        <div className="finance-summary-cards">
          <div className="finance-card">
            <div className="finance-card-title">
              <span>Supplier Master</span>
              <Truck size={16} className="text-gold" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedSupplier.name}</div>
            <div className="finance-card-sub">
              Code: {selectedSupplier.supplier_code} • Phone: {selectedSupplier.phone || 'N/A'}
            </div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Credited (Purchases)</span>
              <ShoppingBag size={16} className="text-rose" />
            </div>
            <div className="finance-card-value text-rose">
              ₹{statement.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Shop purchases / liability</div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Debited (Paid)</span>
              <ArrowUpRight size={16} className="text-emerald" />
            </div>
            <div className="finance-card-value text-emerald">
              ₹{statement.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Payments made to supplier</div>
          </div>

          <div className="finance-card" style={{ borderLeft: '3px solid #d4af37' }}>
            <div className="finance-card-title">
              <span>Current Payable</span>
              <Scale size={16} className="text-gold" />
            </div>
            <div className="finance-card-value text-gold">
              ₹{statement.current_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">
              {statement.current_balance > 0
                ? 'Payable (Shop owes supplier)'
                : statement.current_balance < 0
                ? 'Advance Paid'
                : 'Account settled'}
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
              <th>Debit (Payment)</th>
              <th>Credit (Purchase)</th>
              <th>Payable Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading supplier ledger entries...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                  No transactions recorded for this supplier yet.
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
                  <td className="credit-text">
                    {row.debit_credit === 'DEBIT' ? `₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="debit-text">
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

      {/* PAY SUPPLIER MODAL */}
      {showPaymentModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Record Payment to Supplier</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#9da4b3' }}>
                  Supplier: <strong>{selectedSupplier?.name}</strong> | Current Payable:{' '}
                  <strong style={{ color: '#d4af37' }}>
                    ₹{statement?.current_balance.toLocaleString('en-IN')}
                  </strong>
                </p>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select
                      className="form-select"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                    >
                      <option value="BANK">BANK / RTGS / NEFT</option>
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">CARD</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                {paymentMode !== 'CASH' && (
                  <div className="form-group">
                    <label>Bank Reference / UTR Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. UTR-HDFC-998877, Cheque No..."
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Notes / Voucher Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bullion delivery settlement payment"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Generate Payment Voucher
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
              <h3>Create Supplier Ledger Adjustment</h3>
              <button className="modal-close" onClick={() => setShowAdjustmentModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAdjustmentSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Adjustment Direction *</label>
                    <select
                      className="form-select"
                      value={adjDirection}
                      onChange={(e) => setAdjDirection(e.target.value as any)}
                    >
                      <option value="DEBIT">DEBIT (Reduces Shop Payable)</option>
                      <option value="CREDIT">CREDIT (Increases Shop Payable)</option>
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
                    placeholder="e.g. Vendor discount, bullion purity rate adjustment"
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
