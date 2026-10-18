// frontend/src/pages/girvi/GirviDetailPage.tsx
// Jewel Suite: Girvi Loan Detail, Collateral Custody & Repayments Page

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { girviApi } from '../../services/girvi';
import { GirviLoan } from '../../types';
import { ArrowLeft, Landmark, DollarSign, ShieldCheck, CheckCircle2, X, ShieldAlert } from 'lucide-react';
import './Girvi.css';

export const GirviDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loan, setLoan] = useState<GirviLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Repayment Modal State
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [principalRepay, setPrincipalRepay] = useState('');
  const [interestRepay, setInterestRepay] = useState('');
  const [chargesRepay, setChargesRepay] = useState('0');
  const [repayMode, setRepayMode] = useState('CASH');
  const [repayRef, setRepayRef] = useState('');
  const [repayNotes, setRepayNotes] = useState('');
  const [submittingRepay, setSubmittingRepay] = useState(false);

  const loadLoan = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await girviApi.getLoan(id);
      setLoan(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load loan details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoan();
  }, [id]);

  const handleDisburse = async () => {
    if (!loan) return;
    if (!window.confirm(`Disburse principal of ₹${loan.principal_amount.toLocaleString('en-IN')} to ${loan.customer_name}? This will record a Finance Payment voucher and debit customer receivable.`)) {
      return;
    }
    try {
      await girviApi.disburseLoan(loan.id, { payment_mode: 'CASH' });
      loadLoan();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleReleasePledge = async () => {
    if (!loan) return;
    const notes = prompt('Enter pledge release notes / identity verification check:', 'Physical gold verified and returned to customer');
    if (notes === null) return;

    try {
      await girviApi.releasePledge(loan.id, notes);
      loadLoan();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;

    const p = parseFloat(principalRepay) || 0;
    const i = parseFloat(interestRepay) || 0;
    const c = parseFloat(chargesRepay) || 0;
    const total = p + i + c;

    if (total <= 0) {
      alert('Total repayment amount must be greater than zero');
      return;
    }

    try {
      setSubmittingRepay(true);
      await girviApi.recordRepayment(loan.id, {
        principal_amount: p,
        interest_amount: i,
        charges_amount: c,
        payment_mode: repayMode,
        reference_number: repayRef || null,
        notes: repayNotes || null,
      });

      setIsRepayModalOpen(false);
      setPrincipalRepay('');
      setInterestRepay('');
      setChargesRepay('0');
      setRepayRef('');
      setRepayNotes('');
      loadLoan();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSubmittingRepay(false);
    }
  };

  if (loading) {
    return <div className="girvi-page" style={{ padding: '2rem', textAlign: 'center' }}>Loading Girvi loan details...</div>;
  }

  if (!loan) {
    return (
      <div className="girvi-page" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#e74c3c', marginBottom: '1rem' }}>{errorMsg || 'Loan not found'}</div>
        <button onClick={() => navigate('/finance/girvi')} style={{ padding: '0.5rem 1rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-default)', borderRadius: '4px' }}>
          Back to Girvi List
        </button>
      </div>
    );
  }

  const hasPledgedItems = loan.items && loan.items.some((it) => it.status === 'PLEDGED');

  return (
    <div className="girvi-page">
      {/* Header */}
      <div className="girvi-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/finance/girvi')}
            style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="girvi-title">
              <Landmark size={24} color="#d4af37" />
              Girvi Loan {loan.loan_number}
            </h1>
            <div className="girvi-subtitle">
              Customer: <strong>{loan.customer_name}</strong> ({loan.customer_phone || 'No phone'}) | Loan Date: {loan.loan_date} | Due: {loan.due_date}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {loan.status === 'DRAFT' && (
            <button
              onClick={handleDisburse}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <DollarSign size={18} /> Disburse Loan
            </button>
          )}

          {(loan.status === 'ACTIVE' || loan.status === 'PARTIALLY_PAID' || loan.status === 'OVERDUE') && (
            <button
              onClick={() => {
                setPrincipalRepay(String(loan.outstanding_amount));
                setIsRepayModalOpen(true);
              }}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #d4af37, #aa820a)',
                color: '#000',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <DollarSign size={18} /> Record Repayment
            </button>
          )}

          {loan.status === 'CLOSED' && hasPledgedItems && (
            <button
              onClick={handleReleasePledge}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <ShieldCheck size={18} /> Release Collateral
            </button>
          )}
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="girvi-summary-cards">
        <div className="girvi-card">
          <div className="girvi-card-title">Principal Amount</div>
          <div className="girvi-card-value">₹{loan.principal_amount.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
            Interest: {loan.interest_rate}% ({loan.interest_type})
          </div>
        </div>

        <div className="girvi-card">
          <div className="girvi-card-title">Accrued Interest</div>
          <div className="girvi-card-value">₹{loan.total_interest.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>Charges: ₹{loan.total_charges}</div>
        </div>

        <div className="girvi-card">
          <div className="girvi-card-title">Total Repaid</div>
          <div className="girvi-card-value highlight-green">₹{loan.total_repaid.toLocaleString('en-IN')}</div>
        </div>

        <div className="girvi-card">
          <div className="girvi-card-title">Net Outstanding</div>
          <div className={`girvi-card-value ${loan.outstanding_amount > 0 ? 'highlight-red' : 'highlight-green'}`}>
            ₹{loan.outstanding_amount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
            Status:{' '}
            <span className={`girvi-status-badge girvi-status-${loan.status.toLowerCase().replace('_', '-')}`}>
              {loan.status}
            </span>
          </div>
        </div>
      </div>

      {/* Pledged Collateral Section */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '1.25rem', border: '1px solid var(--border-default)' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={18} /> Pledged Jewellery Collateral (Customer-Owned Ornaments)
        </h2>
        <table className="girvi-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Metal / Purity</th>
              <th>Gross Wt</th>
              <th>Less Wt</th>
              <th>Net Wt</th>
              <th>Tunch %</th>
              <th>Fine Wt</th>
              <th>Valuation Rate</th>
              <th>Total Valuation</th>
              <th>Custody Status</th>
            </tr>
          </thead>
          <tbody>
            {loan.items && loan.items.map((it) => (
              <tr key={it.id}>
                <td><strong>{it.description}</strong></td>
                <td>{it.metal_name || 'Gold'} / {it.purity_name || '22K'}</td>
                <td>{it.gross_weight}g</td>
                <td>{it.less_weight}g</td>
                <td><strong>{it.net_weight}g</strong></td>
                <td>{it.tunch_percent}%</td>
                <td style={{ color: '#d4af37' }}><strong>{it.fine_weight}g</strong></td>
                <td>₹{it.valuation_rate.toLocaleString('en-IN')}</td>
                <td style={{ color: '#2ecc71', fontWeight: 600 }}>₹{it.valuation_amount.toLocaleString('en-IN')}</td>
                <td>
                  <span className={`girvi-status-badge girvi-status-${it.status.toLowerCase()}`}>
                    {it.status}
                  </span>
                  {it.release_date && (
                    <div style={{ fontSize: '0.7rem', color: '#8e95a5', marginTop: '2px' }}>
                      Rel: {it.release_date}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments History & Pledge Events Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.25rem' }}>
        {/* Repayment History */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '1.25rem', border: '1px solid var(--border-default)' }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} color="#059669" /> Repayment History
          </h2>
          {(!loan.payments || loan.payments.length === 0) ? (
            <div style={{ color: '#8e95a5', fontSize: '0.85rem' }}>No repayments recorded yet.</div>
          ) : (
            <table className="girvi-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Total</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {loan.payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ color: '#d4af37', fontWeight: 600 }}>{p.payment_number}</td>
                    <td>{p.payment_date}</td>
                    <td>₹{p.principal_amount.toLocaleString('en-IN')}</td>
                    <td>₹{p.interest_amount.toLocaleString('en-IN')}</td>
                    <td style={{ color: '#2ecc71', fontWeight: 700 }}>₹{p.total_amount.toLocaleString('en-IN')}</td>
                    <td>{p.payment_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Custody Audit Trail */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '1.25rem', border: '1px solid var(--border-default)' }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} color="var(--gold-primary)" /> Collateral Vault & Custody Events
          </h2>
          {(!loan.pledge_events || loan.pledge_events.length === 0) ? (
            <div style={{ color: '#8e95a5', fontSize: '0.85rem' }}>No custody events logged.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {loan.pledge_events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '6px',
                    borderLeft: `3px solid ${ev.event_type === 'RELEASED' ? '#9b59b6' : '#d4af37'}`,
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong style={{ color: ev.event_type === 'RELEASED' ? '#9b59b6' : '#d4af37' }}>
                      {ev.event_type}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
                      {ev.event_date.substring(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                  <div style={{ color: '#c5cad3' }}>{ev.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Repayment Modal */}
      {isRepayModalOpen && (
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
              maxWidth: '500px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} /> Record Girvi Repayment
              </h2>
              <button
                onClick={() => setIsRepayModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#8e95a5', marginBottom: '1rem' }}>
              Current Outstanding Balance: <strong style={{ color: '#e74c3c' }}>₹{loan.outstanding_amount.toLocaleString('en-IN')}</strong>
            </div>

            <form onSubmit={handleRepaymentSubmit}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Principal Repayment (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={principalRepay}
                  onChange={(e) => setPrincipalRepay(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Interest Payment (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={interestRepay}
                  onChange={(e) => setInterestRepay(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Payment Mode
                </label>
                <select
                  value={repayMode}
                  onChange={(e) => setRepayMode(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                >
                  <option value="CASH">CASH (Physical Drawer)</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CARD">Card</option>
                </select>
              </div>

              {repayMode !== 'CASH' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / Cheque No"
                    value={repayRef}
                    onChange={(e) => setRepayRef(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional repayment notes"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  style={{ padding: '0.6rem 1.25rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRepay}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: 'var(--gold-gradient)',
                    color: '#1A160F',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {submittingRepay ? 'Saving...' : 'Confirm Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
