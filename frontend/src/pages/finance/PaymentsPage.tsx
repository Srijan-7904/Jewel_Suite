// frontend/src/pages/finance/PaymentsPage.tsx
import React, { useState, useEffect } from 'react';
import { financeApi, CreatePaymentInput } from '../../services/finance';
import { customerApi, supplierApi, karigarApi } from '../../services/masters';
import { Payment, Customer, Supplier, Karigar } from '../../types';
import {
  CreditCard,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import './Finance.css';
import '../workshop/Workshop.css';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState('ALL');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'SUPPLIER' | 'KARIGAR'>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [paymentType, setPaymentType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK'>('CASH');
  const [amount, setAmount] = useState<number>(0);
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Parties for dropdown
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getPayments({
        page,
        pageSize: 20,
        search: search || undefined,
        party_type: partyTypeFilter,
        payment_type: paymentTypeFilter,
        payment_mode: paymentModeFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setPayments(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadParties = async () => {
    try {
      const [c, s, k] = await Promise.all([
        customerApi.list({ pageSize: 100 }),
        supplierApi.list({ pageSize: 100 }),
        karigarApi.list({ pageSize: 100 }),
      ]);
      setCustomers(c.items);
      setSuppliers(s.items);
      setKarigars(k.items);
      if (c.items.length > 0 && !partyId) {
        setPartyId(c.items[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [page, search, partyTypeFilter, paymentTypeFilter, paymentModeFilter, fromDate, toDate]);

  useEffect(() => {
    loadParties();
  }, []);

  const handlePartyTypeChange = (newType: 'CUSTOMER' | 'SUPPLIER' | 'KARIGAR') => {
    setPartyType(newType);
    if (newType === 'CUSTOMER') {
      setPaymentType('RECEIPT');
      if (customers.length > 0) setPartyId(customers[0].id);
    } else if (newType === 'SUPPLIER') {
      setPaymentType('PAYMENT');
      if (suppliers.length > 0) setPartyId(suppliers[0].id);
    } else {
      setPaymentType('PAYMENT');
      if (karigars.length > 0) setPartyId(karigars[0].id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || amount <= 0) return;

    try {
      const payload: CreatePaymentInput = {
        party_type: partyType,
        party_id: partyId,
        payment_type: paymentType,
        payment_mode: paymentMode,
        amount: Number(amount),
        reference_number: refNumber || undefined,
        notes: notes || undefined,
      };

      await financeApi.createPayment(payload);
      setShowModal(false);
      setAmount(0);
      setRefNumber('');
      setNotes('');
      loadPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="finance-page">
      <div className="finance-header">
        <div>
          <h1 className="finance-title">
            <CreditCard size={26} className="text-gold" />
            Financial Payments & Receipts
          </h1>
          <div className="finance-subtitle">
            Central voucher registry for all cash, UPI, bank, and card receipts & disbursements
          </div>
        </div>
        <div className="workshop-actions">
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Payment Voucher
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search Voucher No, Reference, Party..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
          style={{ width: '240px' }}
        />

        <select
          value={partyTypeFilter}
          onChange={(e) => setPartyTypeFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Parties</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SUPPLIER">Suppliers</option>
          <option value="KARIGAR">Karigars</option>
        </select>

        <select
          value={paymentTypeFilter}
          onChange={(e) => setPaymentTypeFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Types</option>
          <option value="RECEIPT">RECEIPT (In)</option>
          <option value="PAYMENT">PAYMENT (Out)</option>
        </select>

        <select
          value={paymentModeFilter}
          onChange={(e) => setPaymentModeFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Modes</option>
          <option value="CASH">CASH</option>
          <option value="UPI">UPI</option>
          <option value="CARD">CARD</option>
          <option value="BANK">BANK</option>
        </select>

        <input
          type="date"
          className="filter-input"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <input
          type="date"
          className="filter-input"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      {/* Payments Table */}
      <div className="workshop-table-container">
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Voucher No</th>
              <th>Date</th>
              <th>Party Type</th>
              <th>Party Name</th>
              <th>Voucher Type</th>
              <th>Payment Mode</th>
              <th>Amount</th>
              <th>Reference / UTR</th>
              <th>Notes / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading payment vouchers...
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                  No payment vouchers found.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: '#d4af37' }}>{p.payment_number}</td>
                  <td>{p.payment_date}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: '#9da4b3' }}>{p.party_type}</span>
                  </td>
                  <td>
                    <strong>{p.party_name}</strong>
                    {p.party_code && (
                      <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{p.party_code}</div>
                    )}
                  </td>
                  <td>
                    {p.payment_type === 'RECEIPT' ? (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                        <ArrowDownLeft size={12} style={{ marginRight: '4px' }} /> RECEIPT
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                        <ArrowUpRight size={12} style={{ marginRight: '4px' }} /> PAYMENT
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge-mode badge-mode-${p.payment_mode.toLowerCase()}`}>
                      {p.payment_mode}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>{p.reference_number || '-'}</td>
                  <td>{p.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#9da4b3' }}>
            Page {page} ({total} vouchers)
          </span>
          <button
            className="btn-secondary"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* NEW VOUCHER MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create Financial Payment Voucher</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Party Classification *</label>
                    <select
                      className="form-select"
                      value={partyType}
                      onChange={(e) => handlePartyTypeChange(e.target.value as any)}
                    >
                      <option value="CUSTOMER">Customer (Receipt / Credit)</option>
                      <option value="SUPPLIER">Supplier (Payment / Debit)</option>
                      <option value="KARIGAR">Karigar Artisan (Wages / Debit)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Select Party *</label>
                    <select
                      className="form-select"
                      value={partyId}
                      onChange={(e) => setPartyId(e.target.value)}
                      required
                    >
                      {partyType === 'CUSTOMER' &&
                        customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone || c.customer_code})
                          </option>
                        ))}
                      {partyType === 'SUPPLIER' &&
                        suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.supplier_code})
                          </option>
                        ))}
                      {partyType === 'KARIGAR' &&
                        karigars.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.specialization})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Voucher Type *</label>
                    <select
                      className="form-select"
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as any)}
                    >
                      <option value="RECEIPT">RECEIPT (Money In)</option>
                      <option value="PAYMENT">PAYMENT (Money Out)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select
                      className="form-select"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                    >
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">CARD</option>
                      <option value="BANK">BANK / NEFT</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Transaction UTR / Reference</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. UTR-998811, Cheque No..."
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      required={paymentMode !== 'CASH'}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes / Voucher Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Balance settlement"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
