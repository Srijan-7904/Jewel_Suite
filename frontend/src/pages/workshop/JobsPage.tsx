// frontend/src/pages/workshop/JobsPage.tsx
import React, { useState, useEffect } from 'react';
import { workshopApi, CreateJobInput, ReturnJobInput } from '../../services/workshop';
import { karigarApi, customerApi } from '../../services/masters';
import { inventoryApi } from '../../services/inventory';
import { WorkshopJob, Karigar, Customer, StockItem } from '../../types';
import {
  Hammer,
  Plus,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Send,
  Scale,
} from 'lucide-react';
import {
  formatWeight,
  formatCurrency,
  toDecimal,
  parseDecimalInput,
} from '../../utils/precision';
import Decimal from 'decimal.js';
import './Workshop.css';

export const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<WorkshopJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableStock, setAvailableStock] = useState<StockItem[]>([]);

  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [karigarFilter, setKarigarFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<WorkshopJob | null>(null);

  // Create Job Form
  const [newJobType, setNewJobType] = useState('MANUFACTURING');
  const [newKarigarId, setNewKarigarId] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newPriority, setNewPriority] = useState('NORMAL');
  const [newExpectedDate, setNewExpectedDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newEstimatedLabour, setNewEstimatedLabour] = useState<number>(0);
  const [selectedTag, setSelectedTag] = useState('');

  // Return Job Form
  const [returnGross, setReturnGross] = useState<string | number>('');
  const [returnLess, setReturnLess] = useState<string | number>('0');
  const [actualLabour, setActualLabour] = useState<number>(0);
  const [materialReturned, setMaterialReturned] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await workshopApi.listJobs({
        page,
        pageSize: 15,
        search: search || undefined,
        status: statusFilter,
        job_type: typeFilter,
        karigar_id: karigarFilter,
      });
      setJobs(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load workshop jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [kRes, cRes, sRes] = await Promise.all([
        karigarApi.list({ pageSize: 100 }),
        customerApi.list({ pageSize: 100 }),
        inventoryApi.list({ status: 'IN_STOCK', pageSize: 100 }),
      ]);
      setKarigars(kRes.items);
      setCustomers(cRes.items);
      setAvailableStock(sRes.items);
      if (kRes.items.length > 0 && !newKarigarId) {
        setNewKarigarId(kRes.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [page, search, statusFilter, typeFilter, karigarFilter]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKarigarId || !newDescription.trim()) return;

    try {
      const payload: CreateJobInput = {
        job_type: newJobType,
        karigar_id: newKarigarId,
        customer_id: newCustomerId || null,
        priority: newPriority,
        expected_return_date: newExpectedDate || undefined,
        description: newDescription,
        instructions: newInstructions || undefined,
        estimated_labour: Number(newEstimatedLabour) || 0,
      };

      if (selectedTag) {
        const stockItem = availableStock.find((s) => s.tag_no === selectedTag);
        payload.items = [
          {
            tag_no: selectedTag,
            stock_item_id: stockItem ? stockItem.id : undefined,
          },
        ];
      }

      await workshopApi.createJob(payload);
      setShowCreateModal(false);
      resetCreateForm();
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to create job');
    }
  };

  const resetCreateForm = () => {
    setNewDescription('');
    setNewInstructions('');
    setNewEstimatedLabour(0);
    setSelectedTag('');
    setNewExpectedDate('');
  };

  const handleIssueJob = async (jobId: string) => {
    if (!confirm('Issue this job and transfer jewellery items to Karigar custody?')) return;
    try {
      await workshopApi.issueJob(jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to issue job');
    }
  };

  const handleStartJob = async (jobId: string) => {
    try {
      await workshopApi.startJob(jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to start job');
    }
  };

  const openReturnModal = (job: WorkshopJob) => {
    setSelectedJob(job);
    const firstItem = job.items && job.items[0];
    if (firstItem) {
      setReturnGross(firstItem.issue_gross_weight.toString());
      setReturnLess(firstItem.issue_less_weight ? firstItem.issue_less_weight.toString() : '0');
    } else {
      setReturnGross(job.estimated_weight ? job.estimated_weight.toString() : '0');
      setReturnLess('0');
    }
    setActualLabour(job.estimated_labour || 0);
    setMaterialReturned('');
    setReturnNotes('');
    setShowReturnModal(true);
  };

  const handleReturnJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      const payload: ReturnJobInput = {
        actual_labour: Number(actualLabour) || 0,
        notes: returnNotes || undefined,
      };

      if (selectedJob.items && selectedJob.items.length > 0) {
        payload.returned_items = [
          {
            item_id: selectedJob.items[0].id,
            return_gross_weight: toDecimal(returnGross).toNumber(),
            return_less_weight: toDecimal(returnLess).toNumber(),
            material_returned: materialReturned || undefined,
          },
        ];
      }

      await workshopApi.returnJob(selectedJob.id, payload);
      setShowReturnModal(false);
      setSelectedJob(null);
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to process return');
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    if (!confirm('Mark job as COMPLETED and record Karigar payable for labour?')) return;
    try {
      await workshopApi.completeJob(jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to complete job');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      await workshopApi.cancelJob(jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  // Weight difference preview in return modal
  const itemToReturn = selectedJob?.items && selectedJob.items[0];
  const issueNet = itemToReturn ? itemToReturn.issue_net_weight : 0;
  const currentReturnNetD = toDecimal(returnGross).minus(toDecimal(returnLess));
  const currentReturnNet = currentReturnNetD.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const diffNet = toDecimal(issueNet).minus(currentReturnNetD).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const diffToleranceExceeded = Math.abs(diffNet) > 0.2; // 200mg tolerance warning

  return (
    <div className="workshop-page">
      <div className="workshop-header">
        <div>
          <h1 className="workshop-title">
            <Hammer size={26} className="text-gold" />
            Karigar Workshop Jobs
          </h1>
          <div className="workshop-subtitle">
            Track goldsmith artisan assignments, weight reconciliations, labour charges, and custody
          </div>
        </div>
        <div className="workshop-actions">
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Job Card
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search Job No, Karigar, Tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
          style={{ width: '240px' }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="READY_TO_ISSUE">READY TO ISSUE</option>
          <option value="ISSUED">ISSUED</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="RETURNED">RETURNED</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Types</option>
          <option value="MANUFACTURING">MANUFACTURING</option>
          <option value="REPAIR">REPAIR</option>
          <option value="POLISHING">POLISHING</option>
          <option value="SETTING">SETTING</option>
          <option value="ALTERATION">ALTERATION</option>
          <option value="OTHER">OTHER</option>
        </select>

        <select
          value={karigarFilter}
          onChange={(e) => setKarigarFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Karigars</option>
          {karigars.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} ({k.specialization})
            </option>
          ))}
        </select>
      </div>

      {/* Jobs Table */}
      <div className="workshop-table-container">
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Job Number</th>
              <th>Type</th>
              <th>Karigar</th>
              <th>Customer</th>
              <th>Tags / Items</th>
              <th>Issue Date</th>
              <th>Expected Return</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Labour (Est/Act)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading workshop jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                  No workshop jobs found matching current filters.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ fontWeight: 600, color: '#d4af37' }}>{job.job_number}</td>
                  <td>{job.job_type}</td>
                  <td>
                    <div>{job.karigar_name}</div>
                    {job.karigar_phone && (
                      <span style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{job.karigar_phone}</span>
                    )}
                  </td>
                  <td>{job.customer_name || 'Counter Order'}</td>
                  <td>
                    {job.items && job.items.length > 0 ? (
                      job.items.map((it) => (
                        <div key={it.id} style={{ fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: 600 }}>{it.tag_no}</span>
                          <span style={{ color: '#8e95a5', marginLeft: '4px' }}>
                            ({formatWeight(it.issue_net_weight)}g)
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#6b7280' }}>No tags linked</span>
                    )}
                  </td>
                  <td>{job.issue_date || '-'}</td>
                  <td>{job.expected_return_date || '-'}</td>
                  <td>
                    <span className={`badge badge-${job.status.toLowerCase().replace('_', '-')}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>
                    <span className={`priority-${job.priority.toLowerCase()}`}>{job.priority}</span>
                  </td>
                  <td>
                    <div>{formatCurrency(job.estimated_labour)}</div>
                    {job.actual_labour > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                        Act: {formatCurrency(job.actual_labour)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {(job.status === 'DRAFT' || job.status === 'READY_TO_ISSUE') && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Issue to Karigar"
                          onClick={() => handleIssueJob(job.id)}
                        >
                          <Send size={13} /> Issue
                        </button>
                      )}

                      {job.status === 'ISSUED' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Start Working"
                          onClick={() => handleStartJob(job.id)}
                        >
                          <Play size={13} /> Start
                        </button>
                      )}

                      {(job.status === 'ISSUED' || job.status === 'IN_PROGRESS') && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Return from Karigar"
                          onClick={() => openReturnModal(job)}
                        >
                          <RotateCcw size={13} /> Return
                        </button>
                      )}

                      {job.status === 'RETURNED' && (
                        <button
                          className="btn"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#10b981', color: '#fff' }}
                          title="Complete Job"
                          onClick={() => handleCompleteJob(job.id)}
                        >
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      )}

                      {(job.status === 'DRAFT' || job.status === 'READY_TO_ISSUE') && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#f87171' }}
                          title="Cancel Job"
                          onClick={() => handleCancelJob(job.id)}
                        >
                          <XCircle size={13} />
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

      {total > 15 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#9da4b3' }}>
            Page {page} ({total} jobs)
          </span>
          <button
            className="btn-secondary"
            disabled={page * 15 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* CREATE JOB MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create Workshop Job Card</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateJob}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Job Type</label>
                    <select
                      className="form-select"
                      value={newJobType}
                      onChange={(e) => setNewJobType(e.target.value)}
                    >
                      <option value="MANUFACTURING">MANUFACTURING</option>
                      <option value="REPAIR">REPAIR</option>
                      <option value="POLISHING">POLISHING</option>
                      <option value="SETTING">SETTING</option>
                      <option value="ALTERATION">ALTERATION</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      className="form-select"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                    >
                      <option value="LOW">LOW</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Assign to Karigar *</label>
                    <select
                      className="form-select"
                      value={newKarigarId}
                      onChange={(e) => setNewKarigarId(e.target.value)}
                      required
                    >
                      {karigars.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({k.specialization})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Customer (Optional)</label>
                    <select
                      className="form-select"
                      value={newCustomerId}
                      onChange={(e) => setNewCustomerId(e.target.value)}
                    >
                      <option value="">None (Shop Inventory Order)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || c.customer_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Link IN_STOCK Item (Optional)</label>
                    <select
                      className="form-select"
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                    >
                      <option value="">No stock tag (Raw/Design only)</option>
                      {availableStock.map((s) => (
                        <option key={s.id} value={s.tag_no}>
                          {s.tag_no} - {s.product_name} ({s.net_weight}g)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Return Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newExpectedDate}
                      onChange={(e) => setNewExpectedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Estimated Labour Charge (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={newEstimatedLabour}
                    onChange={(e) => setNewEstimatedLabour(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>Job Description *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 22K Gold traditional choker necklace setting"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Artisan Instructions</label>
                  <textarea
                    rows={2}
                    className="form-textarea"
                    placeholder="Specific design notes, stone setting prongs, finish level..."
                    value={newInstructions}
                    onChange={(e) => setNewInstructions(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Job Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN FROM KARIGAR MODAL */}
      {showReturnModal && selectedJob && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Return from Karigar: {selectedJob.job_number}</h3>
              <button className="modal-close" onClick={() => setShowReturnModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleReturnJob}>
              <div className="modal-body">
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Karigar: <strong style={{ color: 'var(--text-main, #211D17)' }}>{selectedJob.karigar_name}</strong>
                  </div>
                  {itemToReturn && (
                    <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                      Issued Tag: <strong style={{ color: '#d4af37' }}>{itemToReturn.tag_no}</strong> |
                      Gross: {formatWeight(itemToReturn.issue_gross_weight)}g | Net: {formatWeight(itemToReturn.issue_net_weight)}g
                    </div>
                  )}
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Return Gross Weight (g) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      value={returnGross}
                      onChange={(e) => setReturnGross(parseDecimalInput(e.target.value, 3))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Return Less / Stones / Dust (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      value={returnLess}
                      onChange={(e) => setReturnLess(parseDecimalInput(e.target.value, 3))}
                    />
                  </div>
                </div>

                {/* Weight Reconciliation Card */}
                <div
                  className={`diff-alert ${diffToleranceExceeded ? 'diff-warning' : 'diff-normal'}`}
                >
                  <Scale size={18} />
                  <div>
                    <div>
                      Return Net Weight: <strong>{formatWeight(currentReturnNet)}g</strong> | Net Weight
                      Difference: <strong>{diffNet > 0 ? `+${formatWeight(diffNet)}` : `${formatWeight(diffNet)}`}g</strong>
                    </div>
                    {diffToleranceExceeded && (
                      <div style={{ fontSize: '0.75rem', marginTop: '2px', fontWeight: 600 }}>
                        ⚠️ Weight difference exceeds standard tolerance threshold (0.200g). Please verify scale calibration.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Actual Labour Charge (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={actualLabour}
                      onChange={(e) => setActualLabour(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Material Returned Description</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 0.1g scrap gold dust"
                      value={materialReturned}
                      onChange={(e) => setMaterialReturned(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Return Quality & Reconciliation Notes</label>
                  <textarea
                    rows={2}
                    className="form-textarea"
                    placeholder="Inspection remarks, finish condition, stones verified..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Karigar Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
