// frontend/src/pages/billing/KarigarBillsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { workshopApi, WorkshopListParams } from '../../services/workshop';
import { karigarApi } from '../../services/masters';
import { financeApi } from '../../services/finance';
import { settingsApi, ShopProfile } from '../../services/settings';
import { WorkshopJob, Karigar } from '../../types';
import {
  Hammer,
  Search,
  Filter,
  Eye,
  Printer,
  RefreshCw,
  Wallet,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
} from 'lucide-react';
import { formatWeight, formatCurrency } from '../../utils/precision';
import './KarigarBillsPage.css';

export const KarigarBillsPage: React.FC = () => {
  // Data States
  const [jobs, setJobs] = useState<WorkshopJob[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedKarigar, setSelectedKarigar] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [selectedJob, setSelectedJob] = useState<WorkshopJob | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    karigar_id: '',
    job_id: '',
    job_number: '',
    amount: 0,
    payment_mode: 'BANK' as 'CASH' | 'CARD' | 'UPI' | 'BANK',
    reference_number: '',
    notes: '',
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Reference Data
  useEffect(() => {
    karigarApi.list({ pageSize: 100, status: 'active' })
      .then((res) => setKarigars(res.items || []))
      .catch(() => {});

    settingsApi.getShopProfile()
      .then(setShopProfile)
      .catch(() => {});
  }, []);

  // Fetch Workshop Jobs from SQLite
  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: WorkshopListParams = {
        page,
        pageSize,
        search: search.trim() || undefined,
        karigar_id: selectedKarigar !== 'ALL' ? selectedKarigar : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        job_type: typeFilter !== 'ALL' ? typeFilter : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };

      const res = await workshopApi.listJobs(params);
      setJobs(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load Karigar labour bills from database');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, selectedKarigar, statusFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalLabourBilled = 0;
    let totalIssuedWeight = 0;
    let totalReturnedWeight = 0;
    let completedCount = 0;

    for (const j of jobs) {
      const labour = j.actual_labour > 0 ? j.actual_labour : j.estimated_labour;
      totalLabourBilled += labour;
      totalIssuedWeight += j.estimated_weight || 0;
      totalReturnedWeight += j.returned_weight || 0;
      if (j.status === 'COMPLETED' || j.status === 'RETURNED') {
        completedCount++;
      }
    }

    const netWastage = Math.max(0, totalIssuedWeight - totalReturnedWeight);

    return {
      totalLabourBilled,
      totalIssuedWeight,
      totalReturnedWeight,
      netWastage,
      completedCount,
    };
  }, [jobs]);

  // View Detailed Voucher
  const handleViewVoucher = async (jobId: string) => {
    try {
      const job = await workshopApi.getJobById(jobId);
      setSelectedJob(job);
      setShowVoucherModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch job details');
    }
  };

  // Open Payment Settle Modal
  const handleOpenPayment = (job: WorkshopJob) => {
    const labourDue = job.actual_labour > 0 ? job.actual_labour : job.estimated_labour;
    setPaymentForm({
      karigar_id: job.karigar_id,
      job_id: job.id,
      job_number: job.job_number,
      amount: labourDue,
      payment_mode: 'BANK',
      reference_number: '',
      notes: `Settlement of labour charges for Job #${job.job_number}`,
    });
    setShowPaymentModal(true);
  };

  // Submit Payment Settlement
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.karigar_id || paymentForm.amount <= 0) {
      showToast('error', 'Please provide a valid karigar and payment amount');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await financeApi.createPayment({
        party_type: 'KARIGAR',
        party_id: paymentForm.karigar_id,
        payment_type: 'PAYMENT',
        payment_mode: paymentForm.payment_mode,
        amount: paymentForm.amount,
        reference_number: paymentForm.reference_number || undefined,
        reference_type: 'WORKSHOP_JOB',
        reference_id: paymentForm.job_id || undefined,
        notes: paymentForm.notes || undefined,
      });

      showToast('success', `Payment of ₹${paymentForm.amount.toLocaleString('en-IN')} settled to Karigar`);
      setShowPaymentModal(false);
      loadJobs();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to record Karigar settlement payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="karigar-bills-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`karigar-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="karigar-header">
        <div className="karigar-header-left">
          <div className="karigar-icon-box">
            <Hammer size={24} className="gold" />
          </div>
          <div>
            <h1 className="karigar-title font-serif">Karigar Labour & Settlement Bills</h1>
            <p className="karigar-subtitle">
              Artisan making charges, job labour vouchers, gold wastage reconciliation, and account settlements.
            </p>
          </div>
        </div>

        <div className="karigar-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadJobs}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="karigar-metrics-grid">
        <div className="karigar-metric-card">
          <div className="karigar-metric-label">Total Labour Billed</div>
          <div className="karigar-metric-val emerald font-mono">
            ₹{metrics.totalLabourBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="karigar-metric-sub">Across {total} Tracked Workshop Jobs</div>
        </div>

        <div className="karigar-metric-card">
          <div className="karigar-metric-label">Total Metal Issued</div>
          <div className="karigar-metric-val font-mono">
            {formatWeight(metrics.totalIssuedWeight)} g
          </div>
          <div className="karigar-metric-sub">Issued to Artisans for Work</div>
        </div>

        <div className="karigar-metric-card">
          <div className="karigar-metric-label">Total Metal Returned</div>
          <div className="karigar-metric-val font-mono">
            {formatWeight(metrics.totalReturnedWeight)} g
          </div>
          <div className="karigar-metric-sub">Reconciled Inward to Stock</div>
        </div>

        <div className="karigar-metric-card">
          <div className="karigar-metric-label">Net Metal Wastage / Diff</div>
          <div className="karigar-metric-val amber font-mono">
            {formatWeight(metrics.netWastage)} g
          </div>
          <div className="karigar-metric-sub">Filing, Dust & Polishing Loss</div>
        </div>
      </div>

      {/* Filter and Action Toolbar */}
      <div className="karigar-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="font-mono text-xs"
            placeholder="Search by Job No, Karigar, Tag, or Description..."
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

          {/* Karigar Filter */}
          <select
            className="filter-select font-mono"
            value={selectedKarigar}
            onChange={(e) => {
              setSelectedKarigar(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Karigars</option>
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.karigar_code})
              </option>
            ))}
          </select>

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
            <option value="COMPLETED">COMPLETED</option>
            <option value="RETURNED">RETURNED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="ISSUED">ISSUED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Job Type Filter */}
          <select
            className="filter-select font-mono"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Job Types</option>
            <option value="MANUFACTURING">MANUFACTURING</option>
            <option value="REPAIR">REPAIR</option>
            <option value="POLISHING">POLISHING</option>
            <option value="SETTING">SETTING</option>
            <option value="ALTERATION">ALTERATION</option>
            <option value="OTHER">OTHER</option>
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

        {(search || selectedKarigar !== 'ALL' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || fromDate || toDate) && (
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => {
              setSearch('');
              setSelectedKarigar('ALL');
              setStatusFilter('ALL');
              setTypeFilter('ALL');
              setFromDate('');
              setToDate('');
              setPage(1);
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Karigar Bills Table Card */}
      <div className="karigar-table-card">
        <div className="table-responsive">
          <table className="karigar-table">
            <thead>
              <tr>
                <th>Job / Bill No</th>
                <th>Issue Date</th>
                <th>Return Date</th>
                <th>Karigar / Artisan</th>
                <th>Job Type</th>
                <th className="text-right">Issued Wt (g)</th>
                <th className="text-right">Returned Wt (g)</th>
                <th className="text-right">Wastage / Diff (g)</th>
                <th className="text-right">Labour Charge (₹)</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted">
                    <RefreshCw size={24} className="spin gold mx-auto mb-2" />
                    <span>Loading Karigar labour settlement bills from SQLite...</span>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <div className="empty-registry-state">
                      <Hammer size={44} className="text-muted mb-3 opacity-40 mx-auto" />
                      <h4 className="text-base font-serif text-gold font-semibold">No Karigar Settlement Bills Found</h4>
                      <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                        There are currently no artisan labour bills or workshop jobs matching your search in SQLite.
                        When manufacturing or repair jobs are logged with karigars, their making charges, metal wastage,
                        and labour vouchers will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const labour = job.actual_labour > 0 ? job.actual_labour : job.estimated_labour;
                  const weightDiff = (job.estimated_weight || 0) - (job.returned_weight || 0);

                  return (
                    <tr key={job.id} className="karigar-row">
                      <td className="font-mono font-bold text-gold">
                        <span className="tag-pill">{job.job_number}</span>
                      </td>
                      <td className="font-mono text-xs">{job.issue_date || '-'}</td>
                      <td className="font-mono text-xs text-muted">{job.actual_return_date || job.expected_return_date || '-'}</td>
                      <td>
                        <div className="font-semibold text-main">{job.karigar_name || 'Artisan'}</div>
                        <div className="text-xs text-muted font-mono">{job.karigar_phone || job.karigar_specialization || '-'}</div>
                      </td>
                      <td>
                        <span className="job-type-badge font-mono">{job.job_type}</span>
                      </td>
                      <td className="font-mono text-right font-medium">
                        {formatWeight(job.estimated_weight || 0)}g
                      </td>
                      <td className="font-mono text-right font-medium text-emerald-400">
                        {formatWeight(job.returned_weight || 0)}g
                      </td>
                      <td className="font-mono text-right">
                        {job.returned_weight > 0 ? (
                          <span className={weightDiff > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                            {formatWeight(weightDiff)}g
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="font-mono text-right font-bold text-emerald">
                        {formatCurrency(labour)}
                      </td>
                      <td className="text-center">
                        <span className={`status-pill ${job.status.toLowerCase()}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            title="View & Print Labour Settlement Voucher"
                            onClick={() => handleViewVoucher(job.id)}
                          >
                            <Eye size={15} />
                          </button>
                          {labour > 0 && (
                            <button
                              type="button"
                              className="btn-icon text-gold"
                              title="Settle Labour Payment"
                              onClick={() => handleOpenPayment(job)}
                            >
                              <Wallet size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="karigar-pagination">
            <span className="text-xs text-muted font-mono">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} bill(s)
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

      {/* MODAL 1: VIEW & PRINT LABOUR VOUCHER */}
      {showVoucherModal && selectedJob && (
        <div className="modal-backdrop print-modal-backdrop">
          <div className="modal-dialog print-modal-dialog">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <FileText size={18} className="gold" />
                <h3 className="modal-title font-serif">Karigar Labour Bill: {selectedJob.job_number}</h3>
                <span className={`status-pill ${selectedJob.status.toLowerCase()}`}>
                  {selectedJob.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer size={15} />
                  <span>Print Voucher</span>
                </button>
                <button type="button" className="close-btn" onClick={() => setShowVoucherModal(false)}>
                  &times;
                </button>
              </div>
            </div>

            <div className="printable-labour-voucher">
              {/* Workshop Shop Header */}
              <div className="voucher-shop-header text-center pb-4 border-b">
                <h2 className="text-xl font-bold font-serif text-gold tracking-wide">
                  {shopProfile?.name || 'JEWEL SUITE WORKSHOP'}
                </h2>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Artisan Manufacturing & Repair Labour Voucher</p>
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

              {/* Voucher Meta Grid */}
              <div className="voucher-meta-grid py-3 border-b text-xs">
                <div>
                  <span className="text-muted block">Artisan / Karigar Details:</span>
                  <strong className="text-sm font-semibold">{selectedJob.karigar_name || 'Master Artisan'}</strong>
                  {selectedJob.karigar_phone && (
                    <span className="block font-mono text-muted">Tel: {selectedJob.karigar_phone}</span>
                  )}
                  {selectedJob.karigar_specialization && (
                    <span className="block text-muted">Specialization: {selectedJob.karigar_specialization}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-muted block">Voucher / Job Number:</span>
                  <strong className="text-sm font-mono text-gold">{selectedJob.job_number}</strong>
                  <span className="block font-mono text-muted">Issue Date: {selectedJob.issue_date || '-'}</span>
                  <span className="block font-mono text-muted">Return Date: {selectedJob.actual_return_date || selectedJob.expected_return_date || '-'}</span>
                  <span className="block text-muted font-mono font-semibold">Job Type: {selectedJob.job_type}</span>
                </div>
              </div>

              {/* Job Instructions */}
              {selectedJob.description && (
                <div className="py-2 border-b text-xs">
                  <span className="font-semibold text-gold">Job Description: </span>
                  <span>{selectedJob.description}</span>
                  {selectedJob.instructions && (
                    <div className="text-muted mt-0.5">Instructions: {selectedJob.instructions}</div>
                  )}
                </div>
              )}

              {/* Itemized Table */}
              <div className="voucher-items-table py-3">
                <table className="print-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tag No</th>
                      <th>Material Issued / Returned</th>
                      <th className="text-right">Issue Net (g)</th>
                      <th className="text-right">Return Net (g)</th>
                      <th className="text-right">Wastage / Diff (g)</th>
                      <th className="text-right">Labour Charge (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJob.items && selectedJob.items.length > 0 ? (
                      selectedJob.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td>{idx + 1}</td>
                          <td className="font-mono text-xs font-bold">{item.tag_no}</td>
                          <td>
                            <div>{item.material_issued || 'Jewellery Stock Piece'}</div>
                            {item.material_returned && (
                              <div className="text-muted text-xs">Ret: {item.material_returned}</div>
                            )}
                          </td>
                          <td className="text-right font-mono">{formatWeight(item.issue_net_weight)}</td>
                          <td className="text-right font-mono">
                            {item.return_net_weight !== null ? formatWeight(item.return_net_weight) : '-'}
                          </td>
                          <td className="text-right font-mono">
                            {item.return_net_weight !== null ? (
                              <span className={item.weight_difference > 0 ? 'text-amber' : ''}>
                                {formatWeight(item.weight_difference)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="text-right font-mono font-bold">
                            {formatCurrency(item.labour_charge)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>1</td>
                        <td className="font-mono text-xs">{selectedJob.job_number}</td>
                        <td>{selectedJob.description}</td>
                        <td className="text-right font-mono">{formatWeight(selectedJob.estimated_weight || 0)}</td>
                        <td className="text-right font-mono">{formatWeight(selectedJob.returned_weight || 0)}</td>
                        <td className="text-right font-mono">
                          {formatWeight((selectedJob.estimated_weight || 0) - (selectedJob.returned_weight || 0))}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {formatCurrency(selectedJob.actual_labour || selectedJob.estimated_labour || 0)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Settlement Totals */}
              <div className="voucher-totals-grid py-3 border-t">
                <div className="text-xs text-muted">
                  <span className="font-bold text-gold uppercase block mb-1">Purity & Wastage Reconciliation</span>
                  <p>1. Metal difference beyond permitted workshop dust tolerance is subject to review.</p>
                  <p>2. Labour charges are credited directly to Karigar Cr/Dr account upon completion.</p>
                  {selectedJob.notes && <p className="mt-1 italic">Notes: {selectedJob.notes}</p>}
                </div>

                <div className="totals-column text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Total Net Wt Issued:</span>
                    <strong className="font-mono">{(selectedJob.estimated_weight || 0).toFixed(3)} g</strong>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Total Net Wt Returned:</span>
                    <strong className="font-mono">{(selectedJob.returned_weight || 0).toFixed(3)} g</strong>
                  </div>
                  <div className="flex justify-between py-0.5 text-amber">
                    <span>Net Dust / Wastage Diff:</span>
                    <strong className="font-mono">
                      {((selectedJob.estimated_weight || 0) - (selectedJob.returned_weight || 0)).toFixed(3)} g
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-t text-sm font-bold text-gold">
                    <span>Total Labour Payable:</span>
                    <span className="font-mono">
                      ₹{(selectedJob.actual_labour || selectedJob.estimated_labour || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="voucher-signatures grid grid-cols-2 gap-8 pt-8 mt-4 border-t text-xs">
                <div className="text-center">
                  <div className="sig-line mb-1" />
                  <span className="font-semibold text-muted uppercase">Karigar / Artisan Signature</span>
                </div>
                <div className="text-center">
                  <div className="sig-line mb-1" />
                  <span className="font-semibold text-muted uppercase">Workshop Manager Signature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SETTLE LABOUR PAYMENT */}
      {showPaymentModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog settle-payment-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="gold" />
                <h3 className="modal-title font-serif">Settle Karigar Labour Charge</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowPaymentModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="modal-body">
              <div className="form-group mb-3">
                <label>Job / Bill Reference</label>
                <input
                  type="text"
                  className="form-control font-mono font-bold"
                  value={paymentForm.job_number}
                  disabled
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Labour Amount to Settle (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control font-mono font-bold text-emerald"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Payment Tender Mode *</label>
                  <select
                    className="form-control font-mono"
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value as any })}
                    required
                  >
                    <option value="BANK">BANK / NEFT</option>
                    <option value="CASH">CASH</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CARD">CARD</option>
                  </select>
                </div>
              </div>

              <div className="form-group mt-2">
                <label>Payment Reference / UTR Number</label>
                <input
                  type="text"
                  className="form-control font-mono"
                  placeholder="e.g. UTR-9823102391"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                />
              </div>

              <div className="form-group mt-2">
                <label>Settlement Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Labour voucher settlement notes..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingPayment}>
                  <CheckCircle size={16} />
                  <span>{isSubmittingPayment ? 'Settling...' : 'Confirm Labour Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
