// frontend/src/pages/billing/ExchangePage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { exchangeApi, ExchangeRecord } from '../../services/exchange';
import { customerApi, rateApi } from '../../services/masters';
import { settingsApi, ShopProfile } from '../../services/settings';
import { Customer, CurrentRate } from '../../types';
import {
  toDecimal,
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatPercentage,
  formatCurrency,
  parseDecimalInput,
} from '../../utils/precision';
import {
  RotateCcw,
  Search,
  Filter,
  Eye,
  Printer,
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  Save,
} from 'lucide-react';
import './ExchangePage.css';

export const ExchangePage: React.FC = () => {
  // Data States
  const [exchanges, setExchanges] = useState<ExchangeRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState<{
    customer_id: string;
    exchange_date: string;
    item_name: string;
    metal_id: string;
    purity_id: string;
    gross_weight: number | string;
    less_weight: number | string;
    tunch_percent: number | string;
    exchange_rate: number | string;
    deduction_percent: number | string;
    notes: string;
  }>({
    customer_id: '',
    exchange_date: new Date().toISOString().split('T')[0],
    item_name: 'Old Gold Ornaments (Scrap)',
    metal_id: '',
    purity_id: '',
    gross_weight: '10.000',
    less_weight: '0.500',
    tunch_percent: '84.00',
    exchange_rate: '6800',
    deduction_percent: '2.0',
    notes: 'Old metal exchange at counter',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Reference Masters
  useEffect(() => {
    customerApi.list({ pageSize: 100 })
      .then((res) => setCustomers(res.items || []))
      .catch(() => {});

    rateApi.getCurrentRates()
      .then((res) => {
        setRates(res || []);
        if (res && res.length > 0) {
          setCreateForm((prev) => ({
            ...prev,
            metal_id: res[0].metal_id,
            purity_id: res[0].purity_id,
            exchange_rate: Math.round(res[0].rate * 0.96), // standard scrap rate deduction
          }));
        }
      })
      .catch(() => {});

    settingsApi.getShopProfile()
      .then(setShopProfile)
      .catch(() => {});
  }, []);

  // Fetch Exchange Records from SQLite
  const loadExchanges = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await exchangeApi.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      setExchanges(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load exchange records from SQLite');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, fromDate, toDate]);

  useEffect(() => {
    loadExchanges();
  }, [loadExchanges]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalExchangeVal = 0;
    let totalGrossWeight = 0;
    let totalFineWeight = 0;
    let finalizedCount = 0;

    for (const ex of exchanges) {
      totalExchangeVal += ex.final_exchange_value;
      totalGrossWeight += ex.total_gross_weight;
      totalFineWeight += ex.total_fine_weight;
      if (ex.status === 'FINALIZED') {
        finalizedCount++;
      }
    }

    return {
      totalExchangeVal,
      totalGrossWeight,
      totalFineWeight,
      finalizedCount,
    };
  }, [exchanges]);

  // View Details
  const handleViewDetails = async (id: string) => {
    try {
      const details = await exchangeApi.getDetails(id);
      setSelectedExchange(details);
      setShowDetailModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch exchange details');
    }
  };

  // Finalize Exchange
  const handleFinalize = async (id: string) => {
    if (!window.confirm('Finalize this old metal exchange? Metal inventory will be credited to scrap bin.')) {
      return;
    }

    try {
      await exchangeApi.finalize(id);
      showToast('success', 'Exchange finalized and stock credited to scrap bin');
      loadExchanges();
      if (selectedExchange && selectedExchange.id === id) {
        handleViewDetails(id);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to finalize exchange');
    }
  };

  // Create Draft
  const handleCreateExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.customer_id) {
      showToast('error', 'Please select a customer');
      return;
    }

    const gross = toDecimal(createForm.gross_weight);
    const less = toDecimal(createForm.less_weight);
    if (gross.lte(0)) {
      showToast('error', 'Gross weight must be greater than zero');
      return;
    }
    if (less.gt(gross)) {
      showToast('error', 'Less weight cannot exceed gross weight');
      return;
    }

    setIsSubmitting(true);
    try {
      const netWeight = gross.minus(less);
      const tunch = toDecimal(createForm.tunch_percent);
      const fineWeight = netWeight.times(tunch).dividedBy(100);
      const rate = toDecimal(createForm.exchange_rate);
      const rawValue = fineWeight.times(rate);
      const dedPercent = toDecimal(createForm.deduction_percent);
      const deductionAmount = rawValue.times(dedPercent).dividedBy(100);

      const draft = await exchangeApi.createDraft({
        customer_id: createForm.customer_id,
        exchange_date: createForm.exchange_date,
        notes: createForm.notes,
        items: [
          {
            metal_id: createForm.metal_id,
            purity_id: createForm.purity_id,
            item_name: createForm.item_name,
            gross_weight: gross.toNumber(),
            less_weight: less.toNumber(),
            tunch_percent: tunch.toNumber(),
            exchange_rate: rate.toNumber(),
            deduction_percent: dedPercent.toNumber(),
            deduction_amount: deductionAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
          },
        ],
      });

      showToast('success', `Exchange voucher ${draft.exchange_number} created in DRAFT status`);
      setShowCreateModal(false);
      loadExchanges();
      handleViewDetails(draft.id);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create exchange voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="exchange-page-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`exchange-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="exchange-header">
        <div className="exchange-header-left">
          <div className="exchange-icon-box">
            <RotateCcw size={24} className="gold" />
          </div>
          <div>
            <h1 className="exchange-title font-serif">Old Metal Exchange Register</h1>
            <p className="exchange-subtitle">
              Customer scrap jewellery touch testing, melting reconciliation, valuation slips, and sales exchange adjustments.
            </p>
          </div>
        </div>

        <div className="exchange-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadExchanges}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>New Exchange Slip</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="exchange-metrics-grid">
        <div className="exchange-metric-card">
          <div className="exchange-metric-label">Total Exchange Value</div>
          <div className="exchange-metric-val emerald font-mono">
            {formatCurrency(metrics.totalExchangeVal)}
          </div>
          <div className="exchange-metric-sub">{metrics.finalizedCount} Finalized Exchange Slips</div>
        </div>

        <div className="exchange-metric-card">
          <div className="exchange-metric-label">Total Scrap Gross Weight</div>
          <div className="exchange-metric-val font-mono">
            {formatWeight(metrics.totalGrossWeight, 3)} g
          </div>
          <div className="exchange-metric-sub">Received from Customers</div>
        </div>

        <div className="exchange-metric-card">
          <div className="exchange-metric-label">Total Fine Bullion Weight</div>
          <div className="exchange-metric-val amber font-mono">
            {formatFineWeight(metrics.totalFineWeight, 4)} g
          </div>
          <div className="exchange-metric-sub">Pure 24K Equivalent Melted</div>
        </div>

        <div className="exchange-metric-card">
          <div className="exchange-metric-label">Registered Vouchers</div>
          <div className="exchange-metric-val font-mono">{total}</div>
          <div className="exchange-metric-sub">Draft & Finalized Exchanges</div>
        </div>
      </div>

      {/* Filter and Action Toolbar */}
      <div className="exchange-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="font-mono text-xs"
            placeholder="Search by Voucher No, Customer Name, Phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button type="button" className="clear-search-btn" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <Filter size={15} className="text-muted" />

          {/* Status Filter */}
          <select
            className="filter-select font-mono"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="FINALIZED">FINALIZED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div className="filter-group date-group">
          <Calendar size={15} className="text-muted" />
          <input
            type="date"
            className="date-input font-mono"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            title="From Date"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            className="date-input font-mono"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            title="To Date"
          />
        </div>

        {(search || statusFilter !== 'ALL' || fromDate || toDate) && (
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setFromDate('');
              setToDate('');
              setPage(1);
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Exchange Table Card */}
      <div className="exchange-table-card">
        <div className="table-responsive">
          <table className="exchange-table">
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Phone</th>
                <th className="text-right">Gross Wt (g)</th>
                <th className="text-right">Net Wt (g)</th>
                <th className="text-right">Fine Wt (g)</th>
                <th className="text-right">Deductions (₹)</th>
                <th className="text-right">Final Exchange Value (₹)</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted">
                    <RefreshCw size={24} className="spin gold mx-auto mb-2" />
                    <span>Loading exchange vouchers from SQLite...</span>
                  </td>
                </tr>
              ) : exchanges.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <div className="empty-registry-state">
                      <RotateCcw size={44} className="text-muted mb-3 opacity-40 mx-auto" />
                      <h4 className="text-base font-serif text-gold font-semibold">No Old Metal Exchange Vouchers Found</h4>
                      <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                        There are currently no old gold or scrap metal exchange vouchers in SQLite.
                        When customers return scrap jewellery against retail billing or cash, they will appear here.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowCreateModal(true)}
                      >
                        <Plus size={14} />
                        <span>Create First Exchange Slip</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                exchanges.map((ex) => (
                  <tr key={ex.id} className="exchange-row">
                    <td className="font-mono font-bold text-gold">
                      <span className="tag-pill">{ex.exchange_number}</span>
                    </td>
                    <td className="font-mono text-xs">{ex.exchange_date}</td>
                    <td>
                      <div className="font-semibold text-main">{ex.customer_name || 'Walk-in Customer'}</div>
                    </td>
                    <td className="font-mono text-xs text-muted">{ex.customer_phone || '-'}</td>
                    <td className="font-mono text-right font-medium">
                      {formatWeight(ex.total_gross_weight, 3)}g
                    </td>
                    <td className="font-mono text-right font-medium text-emerald-400">
                      {formatWeight(ex.total_net_weight, 3)}g
                    </td>
                    <td className="font-mono text-right font-bold text-gold">
                      {formatFineWeight(ex.total_fine_weight, 4)}g
                    </td>
                    <td className="font-mono text-right text-muted">
                      {ex.total_deductions > 0 ? formatCurrency(ex.total_deductions) : '-'}
                    </td>
                    <td className="font-mono text-right font-bold text-emerald">
                      {formatCurrency(ex.final_exchange_value)}
                    </td>
                    <td className="text-center">
                      <span className={`status-pill ${ex.status.toLowerCase()}`}>
                        {ex.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          title="View & Print Valuation Voucher"
                          onClick={() => handleViewDetails(ex.id)}
                        >
                          <Eye size={15} />
                        </button>
                        {ex.status === 'DRAFT' && (
                          <button
                            type="button"
                            className="btn-icon text-emerald"
                            title="Finalize Exchange"
                            onClick={() => handleFinalize(ex.id)}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="exchange-pagination">
            <span className="text-xs text-muted font-mono">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} voucher(s)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="font-mono text-xs text-gold px-2">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: VIEW & PRINT VALUATION VOUCHER */}
      {showDetailModal && selectedExchange && (
        <div className="modal-backdrop print-modal-backdrop">
          <div className="modal-dialog print-modal-dialog">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <FileText size={18} className="gold" />
                <h3 className="modal-title font-serif">Old Metal Exchange Valuation: {selectedExchange.exchange_number}</h3>
                <span className={`status-pill ${selectedExchange.status.toLowerCase()}`}>
                  {selectedExchange.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer size={15} />
                  <span>Print Slip</span>
                </button>
                <button type="button" className="close-btn" onClick={() => setShowDetailModal(false)}>
                  &times;
                </button>
              </div>
            </div>

            <div className="printable-exchange-voucher">
              {/* Shop Header */}
              <div className="voucher-shop-header text-center pb-4 border-b">
                <h2 className="text-xl font-bold font-serif text-gold tracking-wide">
                  {shopProfile?.name || 'JEWEL SUITE STORE'}
                </h2>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Official Old Metal Exchange & Melting Valuation Slip</p>
                <p className="text-xs text-muted">
                  {shopProfile?.address ? `${shopProfile.address}, ` : ''}
                  {shopProfile?.city ? `${shopProfile.city}, ` : ''}
                  {shopProfile?.state || 'Maharashtra'} - {shopProfile?.pincode || '400001'}
                </p>
                <div className="flex justify-center gap-4 text-xs font-mono mt-1">
                  <span>Phone: {shopProfile?.phone || '+91 9876543210'}</span>
                  <span>GSTIN: <strong>{shopProfile?.gstin || '27AAAAA0000A1Z5'}</strong></span>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="voucher-meta-grid py-3 border-b text-xs">
                <div>
                  <span className="text-muted block">Customer (Seller):</span>
                  <strong className="text-sm font-semibold">{selectedExchange.customer_name || 'Walk-in Customer'}</strong>
                  {selectedExchange.customer_phone && (
                    <span className="block font-mono text-muted">Tel: {selectedExchange.customer_phone}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-muted block">Voucher Number:</span>
                  <strong className="text-sm font-mono text-gold">{selectedExchange.exchange_number}</strong>
                  <span className="block font-mono text-muted">Date: {selectedExchange.exchange_date}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="voucher-items-table py-3">
                <table className="print-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Metal & Purity</th>
                      <th className="text-right">Gross (g)</th>
                      <th className="text-right">Less (g)</th>
                      <th className="text-right">Net (g)</th>
                      <th className="text-right">Tunch %</th>
                      <th className="text-right">Fine (g)</th>
                      <th className="text-right">Rate (₹/g)</th>
                      <th className="text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedExchange.items && selectedExchange.items.length > 0 ? (
                      selectedExchange.items.map((it, idx) => (
                        <tr key={it.id}>
                          <td>{idx + 1}</td>
                          <td className="font-semibold">{it.item_name}</td>
                          <td>{it.metal_code || 'GOLD'} ({it.purity_name || 'Standard Purity'})</td>
                          <td className="text-right font-mono">{formatWeight(it.gross_weight, 3)}</td>
                          <td className="text-right font-mono">{formatWeight(it.less_weight, 3)}</td>
                          <td className="text-right font-mono font-medium">{formatWeight(it.net_weight, 3)}</td>
                          <td className="text-right font-mono">{formatPercentage(it.tunch_percent)}</td>
                          <td className="text-right font-mono font-bold text-gold">{formatFineWeight(it.fine_weight, 4)}</td>
                          <td className="text-right font-mono">{formatMetalRate(it.exchange_rate, true)}</td>
                          <td className="text-right font-mono font-bold">{formatCurrency(it.final_value)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>1</td>
                        <td>Old Jewellery Scrap</td>
                        <td>GOLD (Standard)</td>
                        <td className="text-right font-mono">{formatWeight(selectedExchange.total_gross_weight, 3)}</td>
                        <td className="text-right font-mono">0.000</td>
                        <td className="text-right font-mono">{formatWeight(selectedExchange.total_net_weight, 3)}</td>
                        <td className="text-right font-mono">84.00%</td>
                        <td className="text-right font-mono font-bold text-gold">{formatFineWeight(selectedExchange.total_fine_weight, 4)}</td>
                        <td className="text-right font-mono">-</td>
                        <td className="text-right font-mono font-bold">{formatCurrency(selectedExchange.final_exchange_value)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="voucher-totals-grid py-3 border-t">
                <div className="text-xs text-muted">
                  <span className="font-bold text-gold uppercase block mb-1">Exchange Conditions</span>
                  <p>1. Scrap gold valuation derived after stone/lac removal and touch purity test.</p>
                  <p>2. Melted fine metal credited to showroom scrap inventory under offline compliance.</p>
                  {selectedExchange.notes && <p className="mt-1 italic">Notes: {selectedExchange.notes}</p>}
                </div>

                <div className="totals-column text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Total Gross Weight:</span>
                    <strong className="font-mono">{formatWeight(selectedExchange.total_gross_weight, 3)} g</strong>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Total Net Weight:</span>
                    <strong className="font-mono">{formatWeight(selectedExchange.total_net_weight, 3)} g</strong>
                  </div>
                  <div className="flex justify-between py-0.5 text-gold font-bold">
                    <span>Equivalent Fine Metal (24K):</span>
                    <span className="font-mono">{formatFineWeight(selectedExchange.total_fine_weight, 4)} g</span>
                  </div>
                  {selectedExchange.total_deductions > 0 && (
                    <div className="flex justify-between py-0.5 text-rose-400">
                      <span>Deductions / Refining Cost:</span>
                      <span className="font-mono">−{formatCurrency(selectedExchange.total_deductions)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-t text-sm font-bold text-emerald">
                    <span>Final Exchange Credit:</span>
                    <span className="font-mono">{formatCurrency(selectedExchange.final_exchange_value)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="voucher-signatures grid grid-cols-2 gap-8 pt-8 mt-4 border-t text-xs">
                <div className="text-center">
                  <div className="sig-line mb-1" />
                  <span className="font-semibold text-muted uppercase">Customer (Seller) Signature</span>
                </div>
                <div className="text-center">
                  <div className="sig-line mb-1" />
                  <span className="font-semibold text-muted uppercase">Authorized Valuer Signature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE EXCHANGE SLIP */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog create-exchange-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="gold" />
                <h3 className="modal-title font-serif">Record Old Metal Exchange</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateExchange} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Select Customer *</label>
                  <select
                    className="form-control"
                    value={createForm.customer_id}
                    onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Exchange Date *</label>
                  <input
                    type="date"
                    className="form-control font-mono"
                    value={createForm.exchange_date}
                    onChange={(e) => setCreateForm({ ...createForm, exchange_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="section-divider-sm" />
              <h4 className="font-semibold text-xs text-gold uppercase tracking-wider mb-2">Scrap Metal Touch & Weight</h4>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Description *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={createForm.item_name}
                    onChange={(e) => setCreateForm({ ...createForm, item_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Purity / Board Rate</label>
                  <select
                    className="form-control"
                    value={createForm.purity_id}
                    onChange={(e) => {
                      const sel = rates.find((r) => r.purity_id === e.target.value);
                      if (sel) {
                        setCreateForm({
                          ...createForm,
                          purity_id: sel.purity_id,
                          metal_id: sel.metal_id,
                          exchange_rate: Math.round(sel.rate * 0.96),
                          tunch_percent: sel.tunch_percent || 84.0,
                        });
                      }
                    }}
                  >
                    {rates.map((r) => (
                      <option key={r.purity_id} value={r.purity_id}>
                        {r.metal_name} {r.purity_name} (₹{r.rate}/g)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Exchange Rate (₹/g) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control font-mono font-bold"
                    value={createForm.exchange_rate}
                    onChange={(e) => setCreateForm({ ...createForm, exchange_rate: parseDecimalInput(e.target.value, 2) })}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Gross Weight (g) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control font-mono"
                    value={createForm.gross_weight}
                    onChange={(e) => setCreateForm({ ...createForm, gross_weight: parseDecimalInput(e.target.value, 4) })}
                    placeholder="0.000"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Less / Stones (g)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control font-mono"
                    value={createForm.less_weight}
                    onChange={(e) => setCreateForm({ ...createForm, less_weight: parseDecimalInput(e.target.value, 4) })}
                    placeholder="0.000"
                  />
                </div>

                <div className="form-group">
                  <label>Tunch % *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control font-mono"
                    value={createForm.tunch_percent}
                    onChange={(e) => setCreateForm({ ...createForm, tunch_percent: parseDecimalInput(e.target.value, 4) })}
                    placeholder="84.00"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={16} />
                  <span>{isSubmitting ? 'Recording...' : 'Generate Exchange Slip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
