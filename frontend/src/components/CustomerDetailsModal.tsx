import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Receipt,
  ArrowDownLeft,
  Scale,
  Coins,
  FileText,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { Customer, LedgerEntry, PartyStatementSummary, PartyMetalBalanceSummary } from '../types';
import { financeApi } from '../services/finance';
import { useNavigate } from 'react-router-dom';
import './CustomerDetailsModal.css';

interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const navigate = useNavigate();
  const [statement, setStatement] = useState<PartyStatementSummary | null>(null);
  const [recentEntries, setRecentEntries] = useState<LedgerEntry[]>([]);
  const [metalBalances, setMetalBalances] = useState<PartyMetalBalanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PROFILE'>('LEDGER');

  useEffect(() => {
    if (!isOpen || !customer) {
      setStatement(null);
      setRecentEntries([]);
      setMetalBalances([]);
      return;
    }

    setLoading(true);
    Promise.all([
      financeApi.getCustomerLedger(customer.id, { pageSize: 20 }).catch(() => null),
      financeApi.getCustomerMetalBalances(customer.id).catch(() => []),
    ])
      .then(([ledgerRes, metalRes]) => {
        if (ledgerRes) {
          setStatement(ledgerRes.statement || null);
          setRecentEntries(ledgerRes.items || []);
        }
        if (metalRes && Array.isArray(metalRes)) {
          setMetalBalances(metalRes);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  // Determine current balance (prefer live statement balance, fallback to customer.current_balance)
  const netBalance =
    statement?.current_balance !== undefined
      ? statement.current_balance
      : customer.current_balance !== undefined
      ? Number(customer.current_balance)
      : customer.opening_balance_type === 'DEBIT'
      ? Number(customer.opening_balance || 0)
      : -Number(customer.opening_balance || 0);

  const isDebit = netBalance > 0;
  const isCredit = netBalance < 0;

  const totalDebit =
    statement?.total_debit !== undefined
      ? statement.total_debit
      : isDebit
      ? netBalance
      : 0;

  const totalCredit =
    statement?.total_credit !== undefined
      ? statement.total_credit
      : isCredit
      ? Math.abs(netBalance)
      : 0;

  const goldBalance =
    metalBalances.find((m) => m.metal_code?.toUpperCase() === 'GOLD')?.balance_grams ??
    customer.gold_balance_grams ??
    0;

  const silverBalance =
    metalBalances.find((m) => m.metal_code?.toUpperCase() === 'SILVER')?.balance_grams ??
    customer.silver_balance_grams ??
    0;

  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return 'C';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleOpenFullLedger = () => {
    onClose();
    navigate('/finance/ledger/customer');
  };

  return (
    <div className="customer-modal-backdrop" onClick={onClose}>
      <div className="customer-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="customer-modal-header">
          <div className="customer-modal-title-group">
            <div className="customer-header-avatar">{getInitials(customer.name)}</div>
            <div>
              <div className="customer-modal-name-row">
                <h3 className="customer-modal-name">{customer.name}</h3>
                {customer.customer_code && (
                  <span className="customer-modal-code font-mono">{customer.customer_code}</span>
                )}
                <span className={`customer-modal-type ${customer.customer_type?.toLowerCase() || 'retail'}`}>
                  {customer.customer_type || 'RETAIL'}
                </span>
              </div>
              <div className="customer-modal-sub-contact font-mono text-xs">
                {customer.phone && (
                  <span className="contact-item">
                    <Phone size={12} className="inline-icon" /> {customer.phone}
                  </span>
                )}
                {(customer.city || customer.address) && (
                  <span className="contact-item text-muted">
                    <MapPin size={12} className="inline-icon" /> {customer.city ? `${customer.city}, ` : ''}{customer.address || ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button type="button" className="customer-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* FINANCIAL KPI HIGHLIGHTS */}
        <div className="customer-modal-kpi-grid">
          {/* 1. Total Debited (All Purchases / Invoices) */}
          <div className="kpi-card debit-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Total Baaki / Debited (Purchases)</span>
              <Receipt size={16} className="text-rose" />
            </div>
            <div className="kpi-card-value text-rose font-mono">
              ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="kpi-card-caption text-muted">All invoices & Baaki (debit) charges</div>
          </div>

          {/* 2. Total Credited (Payments Received) */}
          <div className="kpi-card credit-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Total Jama / Credited (Paid)</span>
              <ArrowDownLeft size={16} className="text-emerald" />
            </div>
            <div className="kpi-card-value text-emerald font-mono">
              ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="kpi-card-caption text-muted">Total payments & Jama received</div>
          </div>

          {/* 3. Net Current Outstanding (Live Khata) */}
          <div className={`kpi-card balance-card ${isDebit ? 'is-due' : isCredit ? 'is-advance' : 'is-settled'}`}>
            <div className="kpi-card-header">
              <span className="kpi-title">Net Khata Balance</span>
              <Scale size={16} className={isDebit ? 'text-rose' : isCredit ? 'text-emerald' : 'text-gold'} />
            </div>
            <div className="kpi-card-value font-mono">
              ₹{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="kpi-balance-status">
              {isDebit ? (
                <span className="status-badge debit">
                  <AlertTriangle size={11} /> CUSTOMER OWES SHOP • BAAKI (बाकी / DR)
                </span>
              ) : isCredit ? (
                <span className="status-badge credit">
                  <CheckCircle size={11} /> ADVANCE IN SHOP • JAMA (जमा / CR)
                </span>
              ) : (
                <span className="status-badge settled">ACCOUNT FULLY SETTLED</span>
              )}
            </div>
          </div>

          {/* 4. Metal Position (Gold & Silver) */}
          <div className="kpi-card metal-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Metal Khata</span>
              <Coins size={16} className="text-gold" />
            </div>
            <div className="kpi-metal-values font-mono">
              <div className="metal-row">
                <span className="metal-name">Gold:</span>
                <span className={`metal-amt ${goldBalance > 0 ? 'text-rose' : goldBalance < 0 ? 'text-emerald' : ''}`}>
                  {goldBalance > 0 ? `+${goldBalance.toFixed(3)}g (Due)` : goldBalance < 0 ? `${goldBalance.toFixed(3)}g (Dep)` : '0.000g'}
                </span>
              </div>
              <div className="metal-row">
                <span className="metal-name">Silver:</span>
                <span className={`metal-amt ${silverBalance > 0 ? 'text-rose' : silverBalance < 0 ? 'text-emerald' : ''}`}>
                  {silverBalance > 0 ? `+${silverBalance.toFixed(2)}g (Due)` : silverBalance < 0 ? `${silverBalance.toFixed(2)}g (Dep)` : '0.00g'}
                </span>
              </div>
            </div>
            <div className="kpi-card-caption text-muted">Weight balances</div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="customer-modal-tabs">
          <button
            type="button"
            className={`customer-tab-btn ${activeTab === 'LEDGER' ? 'active' : ''}`}
            onClick={() => setActiveTab('LEDGER')}
          >
            <FileText size={14} />
            <span>Recent Ledger & Khata History</span>
          </button>
          <button
            type="button"
            className={`customer-tab-btn ${activeTab === 'PROFILE' ? 'active' : ''}`}
            onClick={() => setActiveTab('PROFILE')}
          >
            <User size={14} />
            <span>Opening Balances & Full Profile</span>
          </button>
        </div>

        {/* TAB BODY */}
        <div className="customer-modal-body">
          {loading ? (
            <div className="modal-loading-box">
              <Loader2 size={28} className="spin-icon text-gold" />
              <p>Fetching customer khata and transaction ledger...</p>
            </div>
          ) : activeTab === 'LEDGER' ? (
            <div className="ledger-tab-content">
              <div className="ledger-table-header-info">
                <span className="table-caption">
                  Showing recent entries for <strong>{customer.name}</strong>
                </span>
                <button
                  type="button"
                  className="open-full-ledger-link"
                  onClick={handleOpenFullLedger}
                >
                  <span>Open Full Ledger Page</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              <div className="ledger-table-wrapper">
                <table className="customer-mini-ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref / Voucher</th>
                      <th>Particulars / Description</th>
                      <th>Payment Mode</th>
                      <th className="text-right">Debit / Baaki (Billed ₹)</th>
                      <th className="text-right">Credit / Jama (Paid ₹)</th>
                      <th className="text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-muted font-sans">
                          No past ledger transactions recorded for this customer yet.
                          {customer.opening_balance > 0 && (
                            <span className="block mt-1 font-mono text-gold">
                              Initial Opening Balance: ₹{Number(customer.opening_balance).toLocaleString('en-IN')} ({customer.opening_balance_type === 'DEBIT' ? 'Baaki / Dr' : 'Jama / Cr'})
                            </span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      recentEntries.map((entry) => {
                        const isDebitEntry = entry.debit_credit === 'DEBIT';
                        return (
                          <tr key={entry.id}>
                            <td className="font-mono text-xs whitespace-nowrap">
                              {entry.created_at?.split('T')[0] || '—'}
                            </td>
                            <td className="font-mono text-xs">
                              <span className="voucher-pill">{entry.reference_number || '—'}</span>
                            </td>
                            <td className="particulars-cell">
                              <span className="entry-desc">{entry.description || entry.entry_type}</span>
                            </td>
                            <td className="font-mono text-xs">
                              {entry.payment_method || '—'}
                            </td>
                            <td className="text-right font-mono text-rose font-semibold">
                              {isDebitEntry ? `₹${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="text-right font-mono text-emerald font-semibold">
                              {!isDebitEntry ? `₹${Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="text-right font-mono text-xs">
                              {entry.balance_after !== undefined ? (
                                <span className={entry.balance_after > 0 ? 'text-rose' : entry.balance_after < 0 ? 'text-emerald' : 'text-muted'}>
                                  ₹{Math.abs(Number(entry.balance_after)).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {entry.balance_after > 0 ? 'Baaki (Dr)' : entry.balance_after < 0 ? 'Jama (Cr)' : ''}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* PROFILE & MULTI OPENING BALANCE BREAKDOWN */
            <div className="profile-tab-content">
              <div className="profile-grid">
                {/* Contact & Address */}
                <div className="profile-section-card">
                  <h4 className="section-card-title">
                    <User size={14} className="text-gold" />
                    <span>Contact & Location</span>
                  </h4>
                  <div className="profile-details-list font-mono text-xs">
                    <div className="detail-row">
                      <span className="detail-label">Full Name:</span>
                      <span className="detail-value font-sans font-semibold">{customer.name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Primary Phone:</span>
                      <span className="detail-value">{customer.phone || 'None provided'}</span>
                    </div>
                    {customer.alternate_phone && (
                      <div className="detail-row">
                        <span className="detail-label">Alternate Phone:</span>
                        <span className="detail-value">{customer.alternate_phone}</span>
                      </div>
                    )}
                    {customer.email && (
                      <div className="detail-row">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{customer.email}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">Address:</span>
                      <span className="detail-value font-sans">{customer.address || 'Counter Cash Sale'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">City, State, PIN:</span>
                      <span className="detail-value">
                        {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    {customer.gstin && (
                      <div className="detail-row">
                        <span className="detail-label">GSTIN:</span>
                        <span className="detail-value text-gold font-semibold">{customer.gstin}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Opening Balances Breakdown */}
                <div className="profile-section-card">
                  <h4 className="section-card-title">
                    <Scale size={14} className="text-gold" />
                    <span>Granular Opening Balance Records</span>
                  </h4>
                  <div className="profile-details-list font-mono text-xs">
                    <div className="detail-row">
                      <span className="detail-label">Net Opening Balance:</span>
                      <span className={`detail-value font-bold ${customer.opening_balance_type === 'DEBIT' ? 'text-rose' : 'text-emerald'}`}>
                        ₹{Number(customer.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({customer.opening_balance_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Cash Component:</span>
                      <span className="detail-value">
                        ₹{Number(customer.opening_cash_balance || 0).toLocaleString('en-IN')} ({customer.opening_cash_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Bank Component:</span>
                      <span className="detail-value">
                        ₹{Number(customer.opening_bank_balance || 0).toLocaleString('en-IN')} ({customer.opening_bank_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Gold Component:</span>
                      <span className="detail-value text-gold">
                        {Number(customer.opening_gold_weight || 0).toFixed(3)}g ({customer.opening_gold_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})
                        {customer.opening_gold_rate ? ` @ ₹${Number(customer.opening_gold_rate).toLocaleString('en-IN')}/g` : ''}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Silver Component:</span>
                      <span className="detail-value">
                        {Number(customer.opening_silver_weight || 0).toFixed(2)}g ({customer.opening_silver_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})
                        {customer.opening_silver_rate ? ` @ ₹${Number(customer.opening_silver_rate).toLocaleString('en-IN')}/g` : ''}
                      </span>
                    </div>
                    {customer.opening_balance_date && (
                      <div className="detail-row">
                        <span className="detail-label">Opening Date:</span>
                        <span className="detail-value">{customer.opening_balance_date}</span>
                      </div>
                    )}
                    {customer.opening_balance_ref && (
                      <div className="detail-row">
                        <span className="detail-label">Opening Ref / Folio:</span>
                        <span className="detail-value">{customer.opening_balance_ref}</span>
                      </div>
                    )}
                    {customer.opening_balance_notes && (
                      <div className="detail-row">
                        <span className="detail-label">Opening Notes:</span>
                        <span className="detail-value font-sans italic text-muted">{customer.opening_balance_notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="customer-modal-footer">
          <div className="footer-left-info font-mono text-xs">
            <span>Customer ID: {customer.id}</span>
          </div>
          <div className="footer-actions">
            <button
              type="button"
              className="btn-full-ledger"
              onClick={handleOpenFullLedger}
            >
              <ExternalLink size={14} />
              <span>Full Khata Ledger Screen</span>
            </button>
            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
