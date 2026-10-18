// frontend/src/pages/saving-schemes/SavingSchemeDetailPage.tsx
// Jewel Suite: Saving Scheme Detail, Installment Ledger & Maturity Settlement Page

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { savingSchemeApi } from '../../services/savingScheme';
import { SavingScheme, SavingSchemeInstallment } from '../../types';
import { ArrowLeft, PiggyBank, DollarSign, Award, X, AlertCircle } from 'lucide-react';
import './SavingSchemes.css';

export const SavingSchemeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [scheme, setScheme] = useState<SavingScheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Payment Modal State
  const [selectedInst, setSelectedInst] = useState<SavingSchemeInstallment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [payError, setPayError] = useState('');

  const loadScheme = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await savingSchemeApi.getScheme(id);
      setScheme(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load scheme details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheme();
  }, [id]);

  const openPayModal = (inst: SavingSchemeInstallment) => {
    const remaining = Number((inst.amount_due - inst.amount_paid).toFixed(2));
    setSelectedInst(inst);
    setPayAmount(String(remaining));
    setPayRef('');
    setPayNotes('');
    setPayError('');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheme || !selectedInst) return;

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setPayError('Please enter a valid payment amount');
      return;
    }

    try {
      setSubmittingPayment(true);
      setPayError('');

      await savingSchemeApi.payInstallment(scheme.id, selectedInst.id, {
        amount: amt,
        payment_mode: payMode,
        reference_number: payRef || undefined,
        notes: payNotes || undefined,
      });

      setSelectedInst(null);
      loadScheme();
    } catch (err: any) {
      setPayError(err.response?.data?.message || err.message || 'Failed to record installment payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleMatureScheme = async () => {
    if (!scheme) return;
    if (!window.confirm(`Mature scheme ${scheme.scheme_number} and compute customer bonus redemption benefit?`)) {
      return;
    }

    try {
      await savingSchemeApi.matureScheme(scheme.id, 'Matured by customer request');
      loadScheme();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (loading) {
    return <div className="schemes-page" style={{ padding: '2rem', textAlign: 'center' }}>Loading scheme details...</div>;
  }

  if (!scheme) {
    return (
      <div className="schemes-page" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#e74c3c', marginBottom: '1rem' }}>{errorMsg || 'Saving scheme not found'}</div>
        <button onClick={() => navigate('/finance/saving-schemes')} style={{ padding: '0.5rem 1rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-default)', borderRadius: '4px' }}>
          Back to Saving Schemes
        </button>
      </div>
    );
  }

  const percent = Math.min(100, Math.round((scheme.paid_installments / scheme.total_installments) * 100));

  return (
    <div className="schemes-page">
      {/* Header */}
      <div className="schemes-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/finance/saving-schemes')}
            style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="schemes-title">
              <PiggyBank size={24} color="#d4af37" />
              Scheme {scheme.scheme_number}
            </h1>
            <div className="schemes-subtitle">
              Customer: <strong>{scheme.customer_name}</strong> ({scheme.customer_phone || 'No phone'}) | Plan: <strong>{scheme.scheme_type_name}</strong>
            </div>
          </div>
        </div>

        {/* Maturity Button */}
        {scheme.status === 'ACTIVE' && scheme.paid_installments >= scheme.total_installments && (
          <button
            onClick={handleMatureScheme}
            style={{
              padding: '0.65rem 1.25rem',
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
            <Award size={18} /> Process Scheme Maturity
          </button>
        )}
      </div>

      {/* Financial Overview Cards */}
      <div className="schemes-summary-cards">
        <div className="schemes-card">
          <div className="schemes-card-title">Monthly Installment</div>
          <div className="schemes-card-value">₹{scheme.installment_amount.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
            Duration: {scheme.total_installments} Months
          </div>
        </div>

        <div className="schemes-card">
          <div className="schemes-card-title">Total Customer Deposits</div>
          <div className="schemes-card-value green">₹{scheme.paid_amount.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
            {scheme.paid_installments} of {scheme.total_installments} installments paid
          </div>
        </div>

        <div className="schemes-card">
          <div className="schemes-card-title">Maturity Redemption Value</div>
          <div className="schemes-card-value gold">
            ₹{scheme.maturity_amount > 0 ? scheme.maturity_amount.toLocaleString('en-IN') : (scheme.paid_amount + scheme.installment_amount).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
            Status:{' '}
            <span className={`scheme-status-badge scheme-status-${scheme.status.toLowerCase()}`}>
              {scheme.status}
            </span>
          </div>
        </div>

        <div className="schemes-card">
          <div className="schemes-card-title">Completion Progress</div>
          <div className="schemes-card-value blue">{percent}%</div>
          <div className="scheme-progress-bar-container">
            <div className="scheme-progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* Installment Schedule Table */}
      <div className="girvi-table-container">
        <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#d4af37' }}>
            Monthly Installment Schedule & Ledger
          </h2>
        </div>
        <table className="girvi-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Due Date</th>
              <th>Amount Due</th>
              <th>Amount Paid</th>
              <th>Status</th>
              <th>Payment Date</th>
              <th>Payment Mode</th>
              <th>Reference #</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scheme.installments && scheme.installments.map((inst) => (
              <tr key={inst.id}>
                <td><strong>Month {inst.installment_number}</strong></td>
                <td>{inst.due_date}</td>
                <td>₹{inst.amount_due.toLocaleString('en-IN')}</td>
                <td style={{ color: inst.amount_paid > 0 ? '#2ecc71' : '#8e95a5', fontWeight: 600 }}>
                  ₹{inst.amount_paid.toLocaleString('en-IN')}
                </td>
                <td>
                  <span className={`scheme-status-badge inst-status-${inst.status.toLowerCase()}`}>
                    {inst.status}
                  </span>
                </td>
                <td>{inst.payment_date || '-'}</td>
                <td>{inst.payment_mode || '-'}</td>
                <td style={{ fontSize: '0.8rem', color: '#8e95a5' }}>{inst.reference_number || '-'}</td>
                <td style={{ textAlign: 'right' }}>
                  {inst.status !== 'PAID' && scheme.status === 'ACTIVE' && (
                    <button
                      onClick={() => openPayModal(inst)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--gold-primary)',
                        color: 'var(--gold-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <DollarSign size={13} /> Pay Installment
                    </button>
                  )}
                  {inst.status === 'PAID' && (
                    <span style={{ fontSize: '0.8rem', color: '#2ecc71', fontWeight: 600 }}>Settled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pay Installment Modal */}
      {selectedInst && (
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
              maxWidth: '480px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} /> Pay Installment #{selectedInst.installment_number}
              </h2>
              <button
                onClick={() => setSelectedInst(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {payError && (
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
                <AlertCircle size={16} /> {payError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Due: ₹{(selectedInst.amount_due - selectedInst.amount_paid).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Payment Mode
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">CASH (Physical Drawer)</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CARD">Card</option>
                </select>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Transaction / UTR Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref # or UTR"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional installment payment notes"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedInst(null)}
                  style={{ padding: '0.6rem 1.25rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
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
                  {submittingPayment ? 'Recording...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
