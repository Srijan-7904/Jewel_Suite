// frontend/src/pages/finance/CashBookPage.tsx
import React, { useState, useEffect } from 'react';
import { financeApi } from '../../services/finance';
import { CashBookResponse } from '../../types';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Calendar,
} from 'lucide-react';
import './Finance.css';
import '../workshop/Workshop.css';

export const CashBookPage: React.FC = () => {
  const [data, setData] = useState<CashBookResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const loadCashBook = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getCashBook({
        page,
        pageSize: 25,
        search: search || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load cash book:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashBook();
  }, [page, search, fromDate, toDate]);

  return (
    <div className="finance-page">
      <div className="finance-header">
        <div>
          <h1 className="finance-title">
            <Wallet size={26} className="text-gold" />
            Physical Cash Book
          </h1>
          <div className="finance-subtitle">
            Strict audit of physical counter currency receipts, cash disbursements, and running drawer balance
          </div>
        </div>
      </div>

      {/* Summary Row */}
      {data && (
        <div className="finance-summary-cards">
          <div className="finance-card">
            <div className="finance-card-title">
              <span>Opening Cash</span>
              <Calendar size={16} className="text-gold" />
            </div>
            <div className="finance-card-value text-gold">
              ₹{data.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Balance at start of period</div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Cash In (Receipts)</span>
              <ArrowDownLeft size={16} className="text-emerald" />
            </div>
            <div className="finance-card-value text-emerald">
              ₹{data.total_cash_in.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Customer cash collections</div>
          </div>

          <div className="finance-card">
            <div className="finance-card-title">
              <span>Total Cash Out (Paid)</span>
              <ArrowUpRight size={16} className="text-rose" />
            </div>
            <div className="finance-card-value text-rose">
              ₹{data.total_cash_out.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Cash paid to karigars & vendors</div>
          </div>

          <div className="finance-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div className="finance-card-title">
              <span>Closing Cash Balance</span>
              <Scale size={16} className="text-emerald" />
            </div>
            <div className="finance-card-value text-emerald">
              ₹{data.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="finance-card-sub">Physical drawer cash verified</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search Reference, Description, Party..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
          style={{ width: '260px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9da4b3' }}>From:</span>
          <input
            type="date"
            className="filter-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9da4b3' }}>To:</span>
          <input
            type="date"
            className="filter-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Cash Book Table */}
      <div className="workshop-table-container">
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Voucher / Ref No</th>
              <th>Description</th>
              <th>Counter Party</th>
              <th>Cash In (+)</th>
              <th>Cash Out (-)</th>
              <th>Running Drawer Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading cash book transactions...
                </td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                  No cash transactions recorded for this period.
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.reference_number}</td>
                  <td>{row.description}</td>
                  <td>
                    <strong>{row.party_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{row.party_type}</div>
                  </td>
                  <td className="credit-text">
                    {row.cash_in > 0 ? `+₹${row.cash_in.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="debit-text">
                    {row.cash_out > 0 ? `-₹${row.cash_out.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="balance-text">
                    ₹{row.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#9da4b3' }}>
            Page {page} of {data.totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
