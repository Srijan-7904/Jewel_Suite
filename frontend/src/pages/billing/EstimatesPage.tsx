// frontend/src/pages/billing/EstimatesPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesApi } from '../../services/sales';
import { customerApi, rateApi } from '../../services/masters';
import { settingsApi, ShopProfile } from '../../services/settings';
import { Customer, CurrentRate } from '../../types';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Eye,
  Printer,
  Plus,
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  Save,
} from 'lucide-react';
import {
  formatWeight,
  formatCurrency,
  formatMetalRate,
  toDecimal,
  parseDecimalInput,
} from '../../utils/precision';
import Decimal from 'decimal.js';
import './EstimatesPage.css';

export interface QuotationEstimate {
  id: string;
  estimate_number: string;
  estimate_date: string;
  valid_until: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  item_name: string;
  metal_id: string;
  metal_name?: string;
  purity_id: string;
  purity_name?: string;
  gross_weight: number;
  less_weight: number;
  net_weight: number;
  tunch_percent: number;
  metal_rate: number;
  making_rate: number;
  making_charge_type: 'PER_GRAM' | 'PER_PIECE' | 'FIXED';
  taxable_amount: number;
  gst_amount: number;
  grand_total: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
  notes?: string;
}

const STORAGE_KEY = 'jewel_suite_estimates';

export const EstimatesPage: React.FC = () => {
  const navigate = useNavigate();

  // Data States
  const [estimates, setEstimates] = useState<QuotationEstimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedEstimate, setSelectedEstimate] = useState<QuotationEstimate | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create Form State
  const [form, setForm] = useState({
    customer_id: '',
    estimate_date: new Date().toISOString().split('T')[0],
    valid_days: 3,
    item_name: '22K Gold Traditional Necklace',
    metal_id: '',
    purity_id: '',
    gross_weight: 15.5,
    less_weight: 0.25,
    tunch_percent: 91.6,
    metal_rate: 7200,
    making_rate: 450,
    making_charge_type: 'PER_GRAM' as 'PER_GRAM' | 'PER_PIECE' | 'FIXED',
    notes: 'Quotation valid for 3 days based on current market rate',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load from Local Storage & Masters
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setEstimates(JSON.parse(stored));
      }
    } catch {
      setEstimates([]);
    }

    customerApi.list({ pageSize: 100 })
      .then((res) => setCustomers(res.items || []))
      .catch(() => {});

    rateApi.getCurrentRates()
      .then((res) => {
        setRates(res || []);
        if (res && res.length > 0) {
          setForm((prev) => ({
            ...prev,
            metal_id: res[0].metal_id,
            purity_id: res[0].purity_id,
            metal_rate: res[0].rate,
            tunch_percent: res[0].tunch_percent || 91.6,
          }));
        }
      })
      .catch(() => {});

    settingsApi.getShopProfile()
      .then(setShopProfile)
      .catch(() => {});
  }, []);

  const saveEstimates = (updated: QuotationEstimate[]) => {
    setEstimates(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Filtered Estimates
  const filteredEstimates = useMemo(() => {
    return estimates.filter((est) => {
      const matchSearch =
        !search ||
        est.estimate_number.toLowerCase().includes(search.toLowerCase()) ||
        est.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        (est.customer_phone && est.customer_phone.includes(search));

      const matchStatus = statusFilter === 'ALL' || est.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [estimates, search, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalQuoted = 0;
    let activeCount = 0;
    let convertedCount = 0;

    for (const est of estimates) {
      totalQuoted += est.grand_total;
      if (est.status === 'ACTIVE') activeCount++;
      if (est.status === 'CONVERTED') convertedCount++;
    }

    return { totalQuoted, activeCount, convertedCount, totalCount: estimates.length };
  }, [estimates]);

  // Create Estimate
  const handleCreateEstimate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id) {
      showToast('error', 'Please select a customer');
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find((c) => c.id === form.customer_id);
      const selRate = rates.find((r) => r.purity_id === form.purity_id);

      const grossD = toDecimal(form.gross_weight);
      const lessD = toDecimal(form.less_weight);
      if (lessD.gt(grossD)) {
        throw new Error('Less weight cannot exceed gross weight');
      }
      const netWeightD = grossD.minus(lessD);
      const netWeight = netWeightD.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
      const metalRateD = toDecimal(form.metal_rate);
      const metalValueD = netWeightD.mul(metalRateD);
      const makingChargesD =
        form.making_charge_type === 'PER_GRAM'
          ? netWeightD.mul(toDecimal(form.making_rate))
          : toDecimal(form.making_rate);

      const taxableD = metalValueD.plus(makingChargesD);
      const gstD = taxableD.mul(0.03);
      const totalAmountD = taxableD.plus(gstD).round();

      const taxable = taxableD.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      const gst = gstD.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      const totalAmount = totalAmountD.toNumber();

      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + form.valid_days);

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const newEstimate: QuotationEstimate = {
        id: `est_${Date.now()}`,
        estimate_number: `EST-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${randomSuffix}`,
        estimate_date: form.estimate_date,
        valid_until: validUntilDate.toISOString().split('T')[0],
        customer_id: form.customer_id,
        customer_name: customer?.name || 'Walk-in Customer',
        customer_phone: customer?.phone || undefined,
        item_name: form.item_name,
        metal_id: form.metal_id,
        metal_name: selRate?.metal_name || 'Gold',
        purity_id: form.purity_id,
        purity_name: selRate?.purity_name || '22K (916)',
        gross_weight: form.gross_weight,
        less_weight: form.less_weight,
        net_weight: netWeight,
        tunch_percent: form.tunch_percent,
        metal_rate: form.metal_rate,
        making_rate: form.making_rate,
        making_charge_type: form.making_charge_type,
        taxable_amount: Math.round(taxable),
        gst_amount: Math.round(gst),
        grand_total: totalAmount,
        status: 'ACTIVE',
        notes: form.notes,
      };

      const updated = [newEstimate, ...estimates];
      saveEstimates(updated);

      showToast('success', `Quotation ${newEstimate.estimate_number} created successfully`);
      setShowCreateModal(false);
      setSelectedEstimate(newEstimate);
      setShowDetailModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Estimate to Tax Invoice
  const handleConvertToInvoice = async (est: QuotationEstimate) => {
    if (!window.confirm(`Convert Quotation ${est.estimate_number} into an official Tax Invoice?`)) {
      return;
    }

    try {
      const draft = await salesApi.createDraft({
        customer_id: est.customer_id,
        invoice_date: new Date().toISOString().split('T')[0],
        gst_rate: 3,
        notes: `Converted from Quotation ${est.estimate_number}`,
        items: [
          {
            item_name: est.item_name,
            metal_id: est.metal_id,
            purity_id: est.purity_id,
            gross_weight: est.gross_weight,
            less_weight: est.less_weight,
            tunch_percent: est.tunch_percent,
            metal_rate: est.metal_rate,
            making_rate: est.making_rate,
            making_charge_type: est.making_charge_type,
          },
        ],
      });

      // Mark estimate as converted
      const updated = estimates.map((e) =>
        e.id === est.id ? { ...e, status: 'CONVERTED' as const } : e
      );
      saveEstimates(updated);

      showToast('success', `Tax Invoice ${draft.invoice_number} created from Quotation!`);
      setShowDetailModal(false);
      navigate('/billing/invoices');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to convert estimate to invoice');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="estimates-page-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`estimates-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="estimates-header">
        <div className="estimates-header-left">
          <div className="estimates-icon-box">
            <FileSpreadsheet size={24} className="gold" />
          </div>
          <div>
            <h1 className="estimates-title font-serif">Quotations & Estimates</h1>
            <p className="estimates-subtitle">
              Customer price quotation bills, live metal rate locking, making breakdown, and 1-click tax invoice generation.
            </p>
          </div>
        </div>

        <div className="estimates-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="estimates-metrics-grid">
        <div className="estimates-metric-card">
          <div className="estimates-metric-label">Total Quoted Value</div>
          <div className="estimates-metric-val emerald font-mono">
            ₹{metrics.totalQuoted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="estimates-metric-sub">Across All Quotations</div>
        </div>

        <div className="estimates-metric-card">
          <div className="estimates-metric-label">Active Quotations</div>
          <div className="estimates-metric-val font-mono">
            {metrics.activeCount}
          </div>
          <div className="estimates-metric-sub">Rate Valid for Conversion</div>
        </div>

        <div className="estimates-metric-card">
          <div className="estimates-metric-label">Converted to Invoices</div>
          <div className="estimates-metric-val amber font-mono">
            {metrics.convertedCount}
          </div>
          <div className="estimates-metric-sub">Finalized Sales Created</div>
        </div>

        <div className="estimates-metric-card">
          <div className="estimates-metric-label">Total Quotation Slips</div>
          <div className="estimates-metric-val font-mono">{metrics.totalCount}</div>
          <div className="estimates-metric-sub">Registered Estimates</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="estimates-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="font-mono text-xs"
            placeholder="Search by Estimate No, Customer Name, Phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CONVERTED">CONVERTED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          {(search || statusFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Estimates Table Card */}
      <div className="estimates-table-card">
        <div className="table-responsive">
          <table className="estimates-table">
            <thead>
              <tr>
                <th>Estimate No</th>
                <th>Date</th>
                <th>Valid Until</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Item Quoted</th>
                <th className="text-right">Net Wt (g)</th>
                <th className="text-right">Rate (₹/g)</th>
                <th className="text-right">Total Quoted (₹)</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <div className="empty-registry-state">
                      <FileSpreadsheet size={44} className="text-muted mb-3 opacity-40 mx-auto" />
                      <h4 className="text-base font-serif text-gold font-semibold">No Quotations Found</h4>
                      <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                        There are currently no customer price quotation slips matching your filters.
                        Create a quotation based on today's metal board rates to share with your customers.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowCreateModal(true)}
                      >
                        <Plus size={14} />
                        <span>Create First Quotation</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEstimates.map((est) => (
                  <tr key={est.id} className="estimates-row">
                    <td className="font-mono font-bold text-gold">
                      <span className="tag-pill">{est.estimate_number}</span>
                    </td>
                    <td className="font-mono text-xs">{est.estimate_date}</td>
                    <td className="font-mono text-xs text-muted">{est.valid_until}</td>
                    <td>
                      <div className="font-semibold text-main">{est.customer_name}</div>
                    </td>
                    <td className="font-mono text-xs text-muted">{est.customer_phone || '-'}</td>
                    <td>
                      <div className="text-main text-xs">{est.item_name}</div>
                      <div className="text-xs text-muted">{est.purity_name}</div>
                    </td>
                    <td className="font-mono text-right font-medium">
                      {formatWeight(est.net_weight)}g
                    </td>
                    <td className="font-mono text-right text-muted">
                      {formatMetalRate(est.metal_rate)}
                    </td>
                    <td className="font-mono text-right font-bold text-emerald">
                      {formatCurrency(est.grand_total)}
                    </td>
                    <td className="text-center">
                      <span className={`status-pill ${est.status.toLowerCase()}`}>
                        {est.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          title="View & Print Quotation Slip"
                          onClick={() => {
                            setSelectedEstimate(est);
                            setShowDetailModal(true);
                          }}
                        >
                          <Eye size={15} />
                        </button>
                        {est.status === 'ACTIVE' && (
                          <button
                            type="button"
                            className="btn-icon text-emerald"
                            title="Convert to Official Tax Invoice"
                            onClick={() => handleConvertToInvoice(est)}
                          >
                            <ArrowRight size={15} />
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
      </div>

      {/* MODAL 1: VIEW & PRINT QUOTATION */}
      {showDetailModal && selectedEstimate && (
        <div className="modal-backdrop print-modal-backdrop">
          <div className="modal-dialog print-modal-dialog">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <FileText size={18} className="gold" />
                <h3 className="modal-title font-serif">Price Quotation: {selectedEstimate.estimate_number}</h3>
                <span className={`status-pill ${selectedEstimate.status.toLowerCase()}`}>
                  {selectedEstimate.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedEstimate.status === 'ACTIVE' && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleConvertToInvoice(selectedEstimate)}
                  >
                    <ArrowRight size={14} />
                    <span>Convert to Invoice</span>
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer size={15} />
                  <span>Print Quotation</span>
                </button>
                <button type="button" className="close-btn" onClick={() => setShowDetailModal(false)}>
                  &times;
                </button>
              </div>
            </div>

            <div className="printable-quotation-slip">
              {/* Shop Header */}
              <div className="quotation-shop-header text-center pb-4 border-b">
                <h2 className="text-xl font-bold font-serif text-gold tracking-wide">
                  {shopProfile?.name || 'JEWEL SUITE STORE'}
                </h2>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Customer Jewellery Price Estimation</p>
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
              <div className="quotation-meta-grid py-3 border-b text-xs">
                <div>
                  <span className="text-muted block">Quotation For:</span>
                  <strong className="text-sm font-semibold">{selectedEstimate.customer_name}</strong>
                  {selectedEstimate.customer_phone && (
                    <span className="block font-mono text-muted">Tel: {selectedEstimate.customer_phone}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-muted block">Estimate Number:</span>
                  <strong className="text-sm font-mono text-gold">{selectedEstimate.estimate_number}</strong>
                  <span className="block font-mono text-muted">Date: {selectedEstimate.estimate_date}</span>
                  <span className="block font-mono text-amber-600 font-bold">Valid Until: {selectedEstimate.valid_until}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="quotation-items-table py-3">
                <table className="print-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Description</th>
                      <th>Purity</th>
                      <th className="text-right">Gross (g)</th>
                      <th className="text-right">Net (g)</th>
                      <th className="text-right">Rate (₹/g)</th>
                      <th className="text-right">Making (₹)</th>
                      <th className="text-right">Taxable (₹)</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td className="font-semibold">{selectedEstimate.item_name}</td>
                      <td>{selectedEstimate.purity_name}</td>
                      <td className="text-right font-mono">{formatWeight(selectedEstimate.gross_weight)}</td>
                      <td className="text-right font-mono">{formatWeight(selectedEstimate.net_weight)}</td>
                      <td className="text-right font-mono">{formatMetalRate(selectedEstimate.metal_rate)}</td>
                      <td className="text-right font-mono">
                        {(selectedEstimate.making_rate * (selectedEstimate.making_charge_type === 'PER_GRAM' ? selectedEstimate.net_weight : 1)).toLocaleString('en-IN')}
                      </td>
                      <td className="text-right font-mono">{formatCurrency(selectedEstimate.taxable_amount)}</td>
                      <td className="text-right font-mono font-bold">{formatCurrency(selectedEstimate.grand_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="quotation-totals-grid py-3 border-t">
                <div className="text-xs text-muted">
                  <span className="font-bold text-gold uppercase block mb-1">Quotation Terms & Conditions</span>
                  <p>1. This is a non-fiscal estimate based on board rate as of {selectedEstimate.estimate_date}.</p>
                  <p>2. Actual invoice price will reflect prevailing bullion rate upon confirmation.</p>
                  <p>3. 3% GST included as per legal tax guidelines.</p>
                  {selectedEstimate.notes && <p className="mt-1 italic">Notes: {selectedEstimate.notes}</p>}
                </div>

                <div className="totals-column text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Taxable Metal & Making:</span>
                    <strong className="font-mono">₹{selectedEstimate.taxable_amount.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Estimated GST (3%):</span>
                    <span className="font-mono">₹{selectedEstimate.gst_amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t text-sm font-bold text-gold">
                    <span>Estimated Grand Total:</span>
                    <span className="font-mono">₹{selectedEstimate.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE QUOTATION */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog create-estimate-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="gold" />
                <h3 className="modal-title font-serif">Create Customer Quotation</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateEstimate} className="modal-body">
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Select Customer *</label>
                  <select
                    className="form-control"
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
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
                  <label>Estimate Date *</label>
                  <input
                    type="date"
                    className="form-control font-mono"
                    value={form.estimate_date}
                    onChange={(e) => setForm({ ...form, estimate_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Validity (Days) *</label>
                  <select
                    className="form-control font-mono"
                    value={form.valid_days}
                    onChange={(e) => setForm({ ...form, valid_days: parseInt(e.target.value, 10) || 3 })}
                  >
                    <option value="1">1 Day (Today only)</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                  </select>
                </div>
              </div>

              <div className="section-divider-sm" />
              <h4 className="font-semibold text-xs text-gold uppercase tracking-wider mb-2">Jewellery Item Estimation</h4>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.item_name}
                    onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Purity / Board Rate</label>
                  <select
                    className="form-control"
                    value={form.purity_id}
                    onChange={(e) => {
                      const sel = rates.find((r) => r.purity_id === e.target.value);
                      if (sel) {
                        setForm({
                          ...form,
                          purity_id: sel.purity_id,
                          metal_id: sel.metal_id,
                          metal_rate: sel.rate,
                          tunch_percent: sel.tunch_percent || 91.6,
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
                  <label>Metal Rate (₹/g) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control font-mono font-bold"
                    value={form.metal_rate}
                    onChange={(e) => setForm({ ...form, metal_rate: parseDecimalInput(e.target.value, 2) as any })}
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
                    value={form.gross_weight}
                    onChange={(e) => setForm({ ...form, gross_weight: parseDecimalInput(e.target.value, 3) as any })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Less Weight (g)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control font-mono"
                    value={form.less_weight}
                    onChange={(e) => setForm({ ...form, less_weight: parseDecimalInput(e.target.value, 3) as any })}
                  />
                </div>

                <div className="form-group">
                  <label>Making Type</label>
                  <select
                    className="form-control font-mono"
                    value={form.making_charge_type}
                    onChange={(e) => setForm({ ...form, making_charge_type: e.target.value as any })}
                  >
                    <option value="PER_GRAM">/g (Per Gram)</option>
                    <option value="PER_PIECE">/pc (Per Piece)</option>
                    <option value="FIXED">Fix (Fixed Amount)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    {form.making_charge_type === 'PER_GRAM'
                      ? 'Making Rate (₹/g)'
                      : form.making_charge_type === 'PER_PIECE'
                      ? 'Making Rate (₹/pc)'
                      : 'Fixed Making Charge (₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="form-control font-mono"
                    value={form.making_rate}
                    onChange={(e) => setForm({ ...form, making_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={16} />
                  <span>{isSubmitting ? 'Generating...' : 'Save Quotation Slip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
