import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesApi, SalesInvoice, SalesInvoiceDetails } from '../../services/sales';
import { settingsApi, ShopProfile } from '../../services/settings';
import {
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatCurrency,
} from '../../utils/precision';
import {
  Receipt,
  Search,
  Filter,
  Eye,
  Printer,
  Plus,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import './InvoicesPage.css';

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();

  // Data States
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
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

  // Modals & Details
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Invoices from SQLite
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await salesApi.list({
        page,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      setInvoices(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load invoices from database');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, fromDate, toDate]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    settingsApi.getShopProfile().then(setShopProfile).catch(() => {});
  }, []);

  // View Invoice Details
  const handleViewInvoice = async (id: string) => {
    try {
      const details = await salesApi.getDetails(id);
      setSelectedInvoice(details);
      setShowDetailModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load invoice details');
    }
  };

  // Finalize Draft Invoice
  const handleFinalize = async (id: string) => {
    if (!window.confirm('Are you sure you want to finalize this invoice? Once finalized, stock will be deducted and ledger will be updated.')) {
      return;
    }
    try {
      await salesApi.finalize(id);
      showToast('success', 'Invoice finalized successfully');
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === id) {
        handleViewInvoice(id);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to finalize invoice');
    }
  };

  // Cancel Invoice
  const handleCancelInvoice = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this invoice?')) {
      return;
    }
    try {
      await salesApi.cancel(id);
      showToast('success', 'Invoice cancelled');
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === id) {
        setShowDetailModal(false);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to cancel invoice');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="invoices-page-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`invoices-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="invoices-header">
        <div className="invoices-header-left">
          <div className="invoices-icon-box">
            <Receipt size={24} className="gold" />
          </div>
          <div>
            <h1 className="invoices-title font-serif">Retail & Wholesale Invoices</h1>
            <p className="invoices-subtitle">
              Official sales register tracking tax invoices, GST breakdowns, payments, and print history.
            </p>
          </div>
        </div>

        <div className="invoices-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadInvoices}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/billing/create')}
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="invoices-filter-panel">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input font-mono"
            placeholder="Search by Bill No, Customer, Phone..."
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
            Reset Filters
          </button>
        )}
      </div>

      {/* Invoices Table Card */}
      <div className="invoices-table-card">
        <div className="table-responsive">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Phone</th>
                <th className="text-right">Taxable (₹)</th>
                <th className="text-right">GST (₹)</th>
                <th className="text-right">Exchange (₹)</th>
                <th className="text-right">Grand Total (₹)</th>
                <th className="text-right">Paid (₹)</th>
                <th className="text-right">Balance (₹)</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-muted">
                    <RefreshCw size={24} className="spin gold mx-auto mb-2" />
                    <span>Loading sales invoices from SQLite...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12">
                    <div className="empty-registry-state">
                      <Receipt size={40} className="text-muted mb-3 mx-auto opacity-50" />
                      <h4 className="text-base font-serif text-gold font-semibold">No Invoices Found</h4>
                      <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                        There are currently no sales invoices matching your search or filters in the database.
                        Invoices generated via Retail Billing or Wholesale Counter will appear here.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/billing/create')}
                      >
                        <Plus size={14} />
                        <span>Create First Invoice</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="invoice-row">
                    <td className="font-mono font-bold text-gold">{inv.invoice_number}</td>
                    <td className="font-mono text-xs">{inv.invoice_date}</td>
                    <td className="font-semibold text-main">{inv.customer_name || 'Walk-in Customer'}</td>
                    <td className="font-mono text-xs text-muted">{inv.customer_phone || '-'}</td>
                    <td className="font-mono text-right">{formatCurrency(inv.taxable_amount)}</td>
                    <td className="font-mono text-right">{formatCurrency(inv.gst_amount)}</td>
                    <td className="font-mono text-right text-amber-300">
                      {Number(inv.exchange_amount || 0) > 0 ? `-${formatCurrency(inv.exchange_amount)}` : '-'}
                    </td>
                    <td className="font-mono text-right font-bold text-main">
                      {formatCurrency(inv.grand_total)}
                    </td>
                    <td className="font-mono text-right text-emerald-400">
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td className="font-mono text-right">
                      {Number(inv.balance_amount || 0) > 0 ? (
                        <span className="text-rose-400 font-bold">
                          {formatCurrency(inv.balance_amount)}
                        </span>
                      ) : (
                        <span className="text-muted font-bold">₹0.00</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className={`status-pill ${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-action-icon"
                          title="View & Print Invoice"
                          onClick={() => handleViewInvoice(inv.id)}
                        >
                          <Eye size={15} />
                        </button>
                        {inv.status === 'DRAFT' && (
                          <button
                            type="button"
                            className="btn-action-icon text-success"
                            title="Finalize Invoice"
                            onClick={() => handleFinalize(inv.id)}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {inv.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="btn-action-icon text-danger"
                            title="Cancel Invoice"
                            onClick={() => handleCancelInvoice(inv.id)}
                          >
                            <XCircle size={15} />
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

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="invoices-pagination">
            <span className="text-xs text-muted">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} invoice(s)
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

      {/* MODAL 1: VIEW & PRINT INVOICE */}
      {showDetailModal && selectedInvoice && (
        <div className="modal-backdrop print-modal-backdrop">
          <div className="modal-dialog print-modal-dialog">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="gold" />
                <h3 className="modal-title font-serif">Tax Invoice: {selectedInvoice.invoice_number}</h3>
                <span className={`status-pill ${selectedInvoice.status.toLowerCase()}`}>
                  {selectedInvoice.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer size={15} />
                  <span>Print Bill</span>
                </button>
                <button type="button" className="close-btn" onClick={() => setShowDetailModal(false)}>
                  &times;
                </button>
              </div>
            </div>

            <div className="printable-tax-invoice">
              {/* Shop Header Letterhead */}
              <div className="tax-invoice-shop-header">
                <h1 className="tax-invoice-shop-title">
                  {shopProfile?.name || 'JEWEL SUITE DEMO STORE'}
                </h1>
                {shopProfile?.legal_name && (
                  <p className="tax-invoice-shop-subtitle">{shopProfile.legal_name}</p>
                )}
                <p className="tax-invoice-shop-address">
                  {shopProfile?.address ? `${shopProfile.address}, ` : ''}
                  {shopProfile?.city ? `${shopProfile.city}, ` : ''}
                  {shopProfile?.state || 'Maharashtra'} - {shopProfile?.pincode || '400001'}
                </p>
                <div className="tax-invoice-shop-tax-bar">
                  <span>Phone: <strong>{shopProfile?.phone || '+91 98765 43210'}</strong></span>
                  <span>GSTIN: <strong>{shopProfile?.gstin || '27AAAAA0000A1Z5'}</strong></span>
                  {shopProfile?.pan && <span>PAN: <strong>{shopProfile.pan}</strong></span>}
                </div>
              </div>

              {/* Metadata Grid (Customer & Invoice Info) */}
              <div className="tax-invoice-meta-grid">
                {/* Left: Customer Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">BILLED TO (CUSTOMER DETAILS)</div>
                  <div className="meta-customer-name">
                    {selectedInvoice.customer_name || 'Walk-in Retail Customer'}
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Contact / Phone:</span>
                    <span className="meta-info-val font-mono">
                      {selectedInvoice.customer_phone || 'Counter Walk-in'}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Address:</span>
                    <span className="meta-info-val">
                      {selectedInvoice.customer_address || 'Counter Sale / In-Store'}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Place of Supply:</span>
                    <span className="meta-info-val">
                      {shopProfile?.state || 'Maharashtra'} (State Code: 27)
                    </span>
                  </div>
                </div>

                {/* Right: Invoice Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">TAX INVOICE DETAILS</div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Invoice Number:</span>
                    <span className="invoice-number-highlight">
                      {selectedInvoice.invoice_number}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Invoice Date:</span>
                    <span className="meta-info-val font-mono">
                      {selectedInvoice.invoice_date}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Invoice Status:</span>
                    <span className={`invoice-status-tag ${selectedInvoice.status.toLowerCase()}`}>
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Payment Status:</span>
                    <span className="meta-info-val font-semibold">
                      {Number(selectedInvoice.balance_amount || 0) <= 0 ? (
                        <span className="text-emerald-700">● PAID IN FULL</span>
                      ) : Number(selectedInvoice.amount_paid || 0) > 0 ? (
                        <span className="text-amber-700">● PARTIALLY PAID</span>
                      ) : (
                        <span className="text-rose-700">● UNPAID / BALANCE DUE</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table with ALL Input Fields */}
              <div className="print-table-wrapper">
                <table className="print-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28px', textAlign: 'center' }}>#</th>
                      <th>Tag #</th>
                      <th>Item Description</th>
                      <th>Purity</th>
                      <th className="text-right">Gross (g)</th>
                      <th className="text-right">Less (g)</th>
                      <th className="text-right">Net (g)</th>
                      <th className="text-right">Tunch %</th>
                      <th className="text-right">Fine Wt</th>
                      <th className="text-right">Wastage</th>
                      <th className="text-right">Rate (₹/g)</th>
                      <th className="text-right">Making (₹)</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items || []).map((it, idx) => {
                      const gross = Number(it.gross_weight || 0);
                      const less = Number(it.less_weight || 0);
                      const net = Number(it.net_weight || Math.max(0, gross - less));
                      const tunch = Number(it.tunch_percent || 0);
                      const fine = Number(it.fine_weight || (net * tunch) / 100);
                      const metalRate = Number(it.rate_per_gram ?? it.metal_rate ?? 0);
                      const wastagePercent = Number(it.wastage_percent ?? 0);
                      const wastageWeight = Number(it.wastage_weight ?? (wastagePercent > 0 ? (net * wastagePercent) / 100 : 0));
                      const wastageAmount = Number(it.wastage_amount ?? (wastageWeight * metalRate));
                      const makingCharge = Number(it.making_charge ?? it.making_charges ?? 0);
                      const metalValue = Number(it.metal_value ?? (fine * metalRate));
                      const itemTotal = Number(it.item_amount ?? it.item_total ?? (metalValue + wastageAmount + makingCharge));

                      return (
                        <tr key={it.id || idx}>
                          <td style={{ textAlign: 'center' }} className="font-mono">{idx + 1}</td>
                          <td className="font-mono text-xs font-semibold whitespace-nowrap">{it.tag_no || '-'}</td>
                          <td>
                            <div className="font-semibold leading-tight">{it.item_name || 'Jewellery Item'}</div>
                            {it.metal_name && (
                              <div className="text-[10px] text-muted">{it.metal_name}</div>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            <div>{it.purity_name || '22K (916)'}</div>
                            {it.huid && (
                              <div className="text-[10px] text-muted font-mono">HUID: {it.huid}</div>
                            )}
                          </td>
                          <td className="text-right font-mono whitespace-nowrap">{formatWeight(gross, 3)}</td>
                          <td className="text-right font-mono text-muted whitespace-nowrap">{formatWeight(less, 3)}</td>
                          <td className="text-right font-mono font-bold whitespace-nowrap">{formatWeight(net, 3)}</td>
                          <td className="text-right font-mono whitespace-nowrap">{tunch > 0 ? `${tunch.toFixed(2)}%` : '-'}</td>
                          <td className="text-right font-mono text-muted whitespace-nowrap">{fine > 0 ? formatFineWeight(fine, 4) : '-'}</td>
                          <td className="text-right font-mono text-xs whitespace-nowrap">
                            {wastagePercent > 0 ? (
                              <div>
                                <div>{formatWeight(wastageWeight, 3)}g</div>
                                <div className="text-[10px] text-muted">({wastagePercent}%)</div>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="text-right font-mono whitespace-nowrap">{formatMetalRate(metalRate)}</td>
                          <td className="text-right font-mono whitespace-nowrap">
                            <div className="font-semibold">{formatCurrency(makingCharge, false)}</div>
                            {it.making_rate ? (
                              <div className="text-[10px] text-muted">
                                {it.making_charge_type === 'PER_PIECE'
                                  ? `(${it.pieces || 1} pc @ ₹${it.making_rate})`
                                  : it.making_charge_type === 'FIXED'
                                  ? '(Fix)'
                                  : it.making_charge_type === 'PERCENTAGE'
                                  ? `(${it.making_rate}%)`
                                  : `(@₹${it.making_rate}/g)`}
                              </div>
                            ) : null}
                          </td>
                          <td className="text-right font-mono font-bold whitespace-nowrap">
                            {formatCurrency(itemTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="print-totals-row">
                      <td colSpan={4} className="text-right font-bold uppercase whitespace-nowrap">
                        Totals ({selectedInvoice.items?.length || 0} item{selectedInvoice.items?.length === 1 ? '' : 's'}):
                      </td>
                      <td className="text-right font-mono font-bold whitespace-nowrap">
                        {formatWeight(
                          (selectedInvoice.items || []).reduce((acc, it) => acc + Number(it.gross_weight || 0), 0),
                          3
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                        {formatWeight(
                          (selectedInvoice.items || []).reduce((acc, it) => acc + Number(it.less_weight || 0), 0),
                          3
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                        {formatWeight(
                          (selectedInvoice.items || []).reduce((acc, it) => acc + Number(it.net_weight || 0), 0),
                          3
                        )}
                      </td>
                      <td></td>
                      <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                        {formatFineWeight(
                          (selectedInvoice.items || []).reduce((acc, it) => acc + Number(it.fine_weight || 0), 0),
                          4
                        )}
                      </td>
                      <td></td>
                      <td></td>
                      <td className="text-right font-mono font-bold whitespace-nowrap">
                        {formatCurrency(
                          (selectedInvoice.items || []).reduce((acc, it) => acc + Number(it.making_charge ?? it.making_charges ?? 0), 0)
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-base text-amber-800 whitespace-nowrap">
                        {formatCurrency(
                          (selectedInvoice.items || []).reduce((acc, it) => {
                            const metalRate = Number(it.rate_per_gram ?? it.metal_rate ?? 0);
                            const makingCharge = Number(it.making_charge ?? it.making_charges ?? 0);
                            const wastagePercent = Number(it.wastage_percent ?? 0);
                            const net = Number(it.net_weight || 0);
                            const wastageWeight = Number(it.wastage_weight ?? (wastagePercent > 0 ? (net * wastagePercent) / 100 : 0));
                            const wastageAmount = Number(it.wastage_amount ?? (wastageWeight * metalRate));
                            const tunch = Number(it.tunch_percent || 0);
                            const fine = Number(it.fine_weight || (net * tunch) / 100);
                            const metalValue = Number(it.metal_value ?? (fine * metalRate));
                            return acc + Number(it.item_amount ?? it.item_total ?? (metalValue + wastageAmount + makingCharge));
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Customer Scrap / Old Metal Exchange Table (If any) */}
              {selectedInvoice.exchange && selectedInvoice.exchange.items && selectedInvoice.exchange.items.length > 0 && (
                <div className="tax-invoice-exchange-section">
                  <div className="exchange-section-title">
                    <span>Customer Old Scrap / Metal Exchange Return</span>
                    <span className="font-mono text-xs text-muted">
                      Exchange Ref: {selectedInvoice.exchange.exchange_number}
                    </span>
                  </div>
                  <div className="print-table-wrapper">
                    <table className="print-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                          <th>Tag #</th>
                          <th>Old Scrap Item</th>
                          <th>Metal & Purity</th>
                          <th className="text-right">Gross (g)</th>
                          <th className="text-right">Less (g)</th>
                          <th className="text-right">Net (g)</th>
                          <th className="text-right">Tunch %</th>
                          <th className="text-right">Fine Wt</th>
                          <th className="text-right">Deduct %</th>
                          <th className="text-right">Ex. Rate</th>
                          <th className="text-right">Credit Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.exchange.items.map((exIt: any, exIdx: number) => (
                          <tr key={exIt.id || exIdx}>
                            <td style={{ textAlign: 'center' }} className="font-mono">{exIdx + 1}</td>
                            <td className="font-mono text-xs">{exIt.tag_no || '-'}</td>
                            <td className="font-semibold">{exIt.item_name || 'Customer Scrap'}</td>
                            <td>{exIt.metal_name || 'Gold'} {exIt.purity_name || ''}</td>
                            <td className="text-right font-mono">{formatWeight(exIt.gross_weight, 3)}</td>
                            <td className="text-right font-mono text-muted">{formatWeight(exIt.less_weight, 3)}</td>
                            <td className="text-right font-mono font-bold">{formatWeight(exIt.net_weight, 3)}</td>
                            <td className="text-right font-mono">{Number(exIt.tunch_percent || 0).toFixed(2)}%</td>
                            <td className="text-right font-mono">{formatFineWeight(exIt.fine_weight, 4)}</td>
                            <td className="text-right font-mono">{Number(exIt.deduction_percent || 0).toFixed(1)}%</td>
                            <td className="text-right font-mono">{formatMetalRate(exIt.exchange_rate)}</td>
                            <td className="text-right font-mono font-bold text-emerald-700">
                              {formatCurrency(exIt.exchange_value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="print-totals-row">
                          <td colSpan={4} className="text-right font-bold uppercase">Total Old Metal Deducted:</td>
                          <td className="text-right font-mono font-bold">{formatWeight(selectedInvoice.exchange.total_gross_weight, 3)}</td>
                          <td className="text-right font-mono text-muted">{formatWeight(selectedInvoice.exchange.total_less_weight, 3)}</td>
                          <td className="text-right font-mono font-bold">{formatWeight(selectedInvoice.exchange.total_net_weight, 3)}</td>
                          <td></td>
                          <td className="text-right font-mono font-bold">{formatFineWeight(selectedInvoice.exchange.total_fine_weight, 4)}</td>
                          <td></td>
                          <td></td>
                          <td className="text-right font-mono font-bold text-emerald-700">
                            − {formatCurrency(selectedInvoice.exchange.total_exchange_value)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottom Split Section: Payment Breakdown, Notes, Signatures & Ledger */}
              <div className="tax-invoice-bottom-grid">
                {/* Left: Payment Tendered Breakdown & Signatures */}
                <div className="print-payment-card">
                  <div className="print-card-header">PAYMENT MODES & TENDERED</div>
                  {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                    selectedInvoice.payments.map((p) => {
                      const metalLabel =
                        p.payment_mode === 'GOLD'
                          ? 'Gold Payment'
                          : p.payment_mode === 'SILVER'
                          ? 'Silver Payment'
                          : p.payment_mode;
                      return (
                        <div key={p.id} className="print-payment-row">
                          <span className="font-semibold text-slate-700">
                            {metalLabel}
                            {p.metal_weight ? ` (${formatWeight(p.metal_weight, 3)}g @ ₹${p.metal_rate || 0}/g)` : ''}
                            {p.reference_number ? ` • Ref: ${p.reference_number}` : ''}:
                          </span>
                          <strong className="font-mono text-slate-900">
                            {formatCurrency(p.amount)}
                          </strong>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-muted italic py-1">
                      No advance payment recorded (Full balance due on account)
                    </div>
                  )}

                  {selectedInvoice.notes && (
                    <div className="print-notes-box">
                      <strong>Invoice Notes:</strong> {selectedInvoice.notes}
                    </div>
                  )}

                  {/* Signature Boxes */}
                  <div className="tax-invoice-sign-grid">
                    <div className="sign-box">
                      <span>Customer Signature</span>
                    </div>
                    <div className="sign-box">
                      <span>For {shopProfile?.name || 'JEWEL SUITE STORE'}</span>
                      <span className="text-[10px] text-muted">(Authorized Signatory)</span>
                    </div>
                  </div>
                </div>

                {/* Right: Authoritative Financial Calculation Ledger */}
                <div className="print-ledger-box">
                  <div className="ledger-row">
                    <span>Taxable Amount (Metal + Labour):</span>
                    <strong className="font-mono">{formatCurrency(selectedInvoice.taxable_amount)}</strong>
                  </div>

                  {Number(selectedInvoice.discount_amount || 0) > 0 && (
                    <div className="ledger-row text-rose-600">
                      <span>Discount Applied:</span>
                      <span className="font-mono">−{formatCurrency(selectedInvoice.discount_amount)}</span>
                    </div>
                  )}

                  {Number(selectedInvoice.gst_amount || 0) > 0 && (
                    <>
                      <div className="ledger-row text-xs text-muted">
                        <span>CGST ({((selectedInvoice.gst_rate || 3) / 2).toFixed(1)}%):</span>
                        <span className="font-mono">
                          {formatCurrency(Number(selectedInvoice.gst_amount || 0) / 2)}
                        </span>
                      </div>
                      <div className="ledger-row text-xs text-muted">
                        <span>SGST ({((selectedInvoice.gst_rate || 3) / 2).toFixed(1)}%):</span>
                        <span className="font-mono">
                          {formatCurrency(Number(selectedInvoice.gst_amount || 0) / 2)}
                        </span>
                      </div>
                    </>
                  )}

                  {Number(selectedInvoice.exchange_amount || 0) > 0 && (
                    <div className="ledger-row highlight text-emerald-700">
                      <span>Old Metal Exchange Deduction:</span>
                      <span className="font-mono">−{formatCurrency(selectedInvoice.exchange_amount)}</span>
                    </div>
                  )}

                  {Number(selectedInvoice.round_off || 0) !== 0 && (
                    <div className="ledger-row text-xs text-muted">
                      <span>Round Off:</span>
                      <span className="font-mono">{formatCurrency(selectedInvoice.round_off)}</span>
                    </div>
                  )}

                  <div className="ledger-row grand-total">
                    <span>Net Amount Payable:</span>
                    <span className="font-mono">{formatCurrency(selectedInvoice.net_payable || selectedInvoice.grand_total)}</span>
                  </div>

                  <div className="ledger-row highlight text-emerald-700">
                    <span>Total Amount Received:</span>
                    <span className="font-mono">{formatCurrency(selectedInvoice.amount_paid)}</span>
                  </div>

                  <div className="ledger-row balance">
                    <span>Balance Remaining:</span>
                    <span
                      className={`font-mono ${
                        Number(selectedInvoice.balance_amount || 0) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'
                      }`}
                    >
                      {Number(selectedInvoice.balance_amount || 0) > 0
                        ? formatCurrency(selectedInvoice.balance_amount)
                        : '₹0.00 (PAID)'}
                    </span>
                  </div>

                  {Number(selectedInvoice.amount_paid || 0) > Number(selectedInvoice.net_payable || selectedInvoice.grand_total || 0) && (
                    <div className="ledger-row text-xs text-emerald-600 font-semibold pt-1 border-t">
                      <span>Change Returned to Customer:</span>
                      <span className="font-mono">
                        {formatCurrency(Number(selectedInvoice.amount_paid) - Number(selectedInvoice.net_payable || selectedInvoice.grand_total))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Legal Terms & Hallmark Policy */}
              <div className="tax-invoice-terms">
                <p className="font-bold">
                  Subject to {shopProfile?.city || 'local'} jurisdiction. Goods once sold will be accepted for exchange/return within 7 days along with original tax bill.
                </p>
                <p>1. All gold jewellery tested for 916 / 750 hallmark purity as per BIS guidelines. 2. No warranty on stone breakage or mishandling.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
