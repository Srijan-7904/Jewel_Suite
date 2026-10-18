// frontend/src/pages/saving-schemes/SavingSchemesPage.tsx
// Jewel Suite: Jewellery Saving Schemes (Gold Chits) Management Page

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { savingSchemeApi } from '../../services/savingScheme';
import { customerApi } from '../../services/masters';
import { SavingScheme, SavingSchemeType, Customer } from '../../types';
import { PiggyBank, Plus, Search, Eye, X, AlertCircle } from 'lucide-react';
import './SavingSchemes.css';

export const SavingSchemesPage: React.FC = () => {
  const navigate = useNavigate();

  const [schemes, setSchemes] = useState<SavingScheme[]>([]);
  const [types, setTypes] = useState<SavingSchemeType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Enroll Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [schemeTypeId, setSchemeTypeId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [enrollNotes, setEnrollNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [schemesData, typesData, custData] = await Promise.all([
        savingSchemeApi.listSchemes({ search: search || undefined, status: statusFilter || undefined }),
        savingSchemeApi.listTypes(),
        customerApi.list({ pageSize: 100 }),
      ]);
      setSchemes(schemesData.items);
      setTypes(typesData);
      setCustomers(custData.items);
      if (typesData.length > 0 && !schemeTypeId) {
        setSchemeTypeId(typesData[0].id);
      }
    } catch (err: any) {
      console.error('Error loading saving schemes data:', err);
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

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !schemeTypeId) {
      setErrorMsg('Please select both customer and scheme plan');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      await savingSchemeApi.enrollCustomer({
        customer_id: customerId,
        scheme_type_id: schemeTypeId,
        start_date: startDate,
        notes: enrollNotes || null,
      });

      setIsModalOpen(false);
      setCustomerId('');
      setEnrollNotes('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to enroll customer');
    } finally {
      setSubmitting(false);
    }
  };

  // Metric aggregates
  const activeCount = schemes.filter((s) => s.status === 'ACTIVE').length;
  const totalAccumulated = schemes.reduce((sum, s) => sum + s.paid_amount, 0);
  const maturedCount = schemes.filter((s) => s.status === 'MATURED').length;

  return (
    <div className="schemes-page">
      {/* Header */}
      <div className="schemes-header">
        <div>
          <h1 className="schemes-title">
            <PiggyBank size={24} color="#d4af37" />
            Jewellery Saving Schemes (Gold Chits)
          </h1>
          <div className="schemes-subtitle">
            Customer recurring monthly gold savings plans (11+1 bonus scheme) with automatic installment schedules
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
          Enroll Customer
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="schemes-summary-cards">
        <div className="schemes-card">
          <div className="schemes-card-title">Active Saving Schemes</div>
          <div className="schemes-card-value green">{activeCount}</div>
        </div>
        <div className="schemes-card">
          <div className="schemes-card-title">Accumulated Customer Savings</div>
          <div className="schemes-card-value gold">₹{totalAccumulated.toLocaleString('en-IN')}</div>
        </div>
        <div className="schemes-card">
          <div className="schemes-card-title">Matured Plans</div>
          <div className="schemes-card-value blue">{maturedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="girvi-filter-bar">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search by Scheme No, Customer Name, or Phone..."
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
          <option value="">All Scheme Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="MATURED">Matured</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Schemes Table */}
      <div className="girvi-table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8e95a5' }}>Loading saving schemes...</div>
        ) : schemes.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#8e95a5' }}>
            No saving schemes enrolled. Click "Enroll Customer" to start a recurring gold saving plan.
          </div>
        ) : (
          <table className="girvi-table">
            <thead>
              <tr>
                <th>Scheme No</th>
                <th>Customer</th>
                <th>Plan Name</th>
                <th>Monthly Installment</th>
                <th>Duration</th>
                <th>Paid Amount</th>
                <th>Installment Progress</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((row) => {
                const percent = Math.min(100, Math.round((row.paid_installments / row.total_installments) * 100));
                return (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.scheme_number}</td>
                    <td>
                      <strong>{row.customer_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{row.customer_phone || 'No phone'}</div>
                    </td>
                    <td>{row.scheme_type_name}</td>
                    <td>₹{row.installment_amount.toLocaleString('en-IN')} / mo</td>
                    <td>{row.total_installments} mos</td>
                    <td style={{ color: '#2ecc71', fontWeight: 600 }}>
                      ₹{row.paid_amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8e95a5' }}>
                        <span>{row.paid_installments} of {row.total_installments} paid</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="scheme-progress-bar-container">
                        <div className="scheme-progress-bar-fill" style={{ width: `${percent}%` }} />
                      </div>
                    </td>
                    <td>
                      <span className={`scheme-status-badge scheme-status-${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/finance/saving-schemes/${row.id}`)}
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
                        <Eye size={14} /> View Plan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Enrollment Modal */}
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
              maxWidth: '550px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PiggyBank size={20} /> Enroll Customer in Saving Scheme
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleEnrollSubmit}>
              {/* Customer Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Select Customer *
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

              {/* Scheme Type Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Select Saving Scheme Plan *
                </label>
                <select
                  value={schemeTypeId}
                  onChange={(e) => setSchemeTypeId(e.target.value)}
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
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (₹{t.installment_amount.toLocaleString('en-IN')}/mo x {t.duration_months} mos)
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Scheme Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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

              {/* Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional enrollment notes..."
                  value={enrollNotes}
                  onChange={(e) => setEnrollNotes(e.target.value)}
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

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  {submitting ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
