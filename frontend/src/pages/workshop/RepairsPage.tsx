// frontend/src/pages/workshop/RepairsPage.tsx
import React, { useState, useEffect } from 'react';
import { repairApi, CreateRepairInput } from '../../services/repair';
import { customerApi, karigarApi } from '../../services/masters';
import { inventoryApi } from '../../services/inventory';
import { Repair, Customer, Karigar, StockItem } from '../../types';
import {
  Wrench,
  Plus,
  CheckCircle2,
  Send,
  Play,
  PackageCheck,
  XCircle,
  User,
  Store,
} from 'lucide-react';
import './Workshop.css';

export const RepairsPage: React.FC = () => {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [availableStock, setAvailableStock] = useState<StockItem[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);

  // Intake Form
  const [ownership, setOwnership] = useState<'CUSTOMER_OWNED' | 'SHOP_OWNED'>('CUSTOMER_OWNED');
  const [customerId, setCustomerId] = useState('');
  const [stockItemId, setStockItemId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [metalType, setMetalType] = useState('GOLD');
  const [purity, setPurity] = useState('22K');
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [instructions, setInstructions] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  // Assign Form
  const [assignKarigarId, setAssignKarigarId] = useState('');

  // Complete Form
  const [actualCost, setActualCost] = useState<number>(0);

  const loadRepairs = async () => {
    setLoading(true);
    try {
      const res = await repairApi.listRepairs({
        page,
        pageSize: 15,
        search: search || undefined,
        ownership: ownershipFilter,
        status: statusFilter,
      });
      setRepairs(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load repairs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [cRes, kRes, sRes] = await Promise.all([
        customerApi.list({ pageSize: 100 }),
        karigarApi.list({ pageSize: 100 }),
        inventoryApi.list({ status: 'IN_STOCK', pageSize: 100 }),
      ]);
      setCustomers(cRes.items);
      setKarigars(kRes.items);
      setAvailableStock(sRes.items);
      if (kRes.items.length > 0 && !assignKarigarId) {
        setAssignKarigarId(kRes.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  useEffect(() => {
    loadRepairs();
  }, [page, search, ownershipFilter, statusFilter]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDescription.trim() || !problemDescription.trim()) return;

    try {
      const payload: CreateRepairInput = {
        ownership,
        customer_id: ownership === 'CUSTOMER_OWNED' ? customerId || null : null,
        stock_item_id: ownership === 'SHOP_OWNED' ? stockItemId || null : null,
        item_description: itemDescription,
        problem_description: problemDescription,
        metal_type: metalType,
        purity,
        gross_weight: Number(grossWeight) || 0,
        estimated_cost: Number(estimatedCost) || 0,
        instructions: instructions || undefined,
        expected_completion_date: expectedDate || undefined,
        priority,
      };

      await repairApi.createRepair(payload);
      setShowIntakeModal(false);
      resetIntakeForm();
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to intake repair');
    }
  };

  const resetIntakeForm = () => {
    setItemDescription('');
    setProblemDescription('');
    setGrossWeight(0);
    setEstimatedCost(0);
    setInstructions('');
    setExpectedDate('');
  };

  const openAssignModal = (rep: Repair) => {
    setSelectedRepair(rep);
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair || !assignKarigarId) return;
    try {
      await repairApi.assignRepair(selectedRepair.id, assignKarigarId);
      setShowAssignModal(false);
      setSelectedRepair(null);
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to assign repair');
    }
  };

  const handleStartRepair = async (repId: string) => {
    try {
      await repairApi.startRepair(repId);
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to start repair');
    }
  };

  const openCompleteModal = (rep: Repair) => {
    setSelectedRepair(rep);
    setActualCost(rep.estimated_cost || 0);
    setShowCompleteModal(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepair) return;
    try {
      await repairApi.completeRepair(selectedRepair.id, Number(actualCost) || 0);
      setShowCompleteModal(false);
      setSelectedRepair(null);
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to complete repair');
    }
  };

  const handleDeliverRepair = async (rep: Repair) => {
    const isCustomerOwned = rep.ownership === 'CUSTOMER_OWNED';
    const msg = isCustomerOwned
      ? 'Deliver completed repair to customer? (No shop inventory affected)'
      : 'Deliver completed repair back to shop inventory as IN_STOCK?';
    if (!confirm(msg)) return;

    try {
      await repairApi.deliverRepair(rep.id);
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to deliver repair');
    }
  };

  const handleCancelRepair = async (repId: string) => {
    if (!confirm('Are you sure you want to cancel this repair?')) return;
    try {
      await repairApi.cancelRepair(repId);
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel repair');
    }
  };

  return (
    <div className="workshop-page">
      <div className="workshop-header">
        <div>
          <h1 className="workshop-title">
            <Wrench size={26} className="text-gold" />
            Repair Management
          </h1>
          <div className="workshop-subtitle">
            Customer intake receipts & internal shop inventory repairs with strict ownership separation
          </div>
        </div>
        <div className="workshop-actions">
          <button className="btn-primary" onClick={() => setShowIntakeModal(true)}>
            <Plus size={16} /> New Repair Intake
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search Repair No, Customer, Item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
          style={{ width: '240px' }}
        />

        <select
          value={ownershipFilter}
          onChange={(e) => setOwnershipFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Ownerships</option>
          <option value="CUSTOMER_OWNED">Customer Owned</option>
          <option value="SHOP_OWNED">Shop Inventory</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Statuses</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="ASSIGNED">ASSIGNED</option>
          <option value="IN_REPAIR">IN REPAIR</option>
          <option value="READY">READY</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {/* Repairs Table */}
      <div className="workshop-table-container">
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Repair No</th>
              <th>Ownership</th>
              <th>Customer / Stock</th>
              <th>Item Description</th>
              <th>Problem / Issue</th>
              <th>Assigned Karigar</th>
              <th>Received</th>
              <th>Cost (Est/Act)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading repairs...
                </td>
              </tr>
            ) : repairs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                  No repair jobs found.
                </td>
              </tr>
            ) : (
              repairs.map((rep) => (
                <tr key={rep.id}>
                  <td style={{ fontWeight: 600, color: '#d4af37' }}>{rep.repair_number}</td>
                  <td>
                    {rep.ownership === 'CUSTOMER_OWNED' ? (
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                        <User size={12} style={{ marginRight: '4px' }} /> Customer
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                        <Store size={12} style={{ marginRight: '4px' }} /> Shop Stock
                      </span>
                    )}
                  </td>
                  <td>
                    {rep.ownership === 'CUSTOMER_OWNED' ? (
                      <div>
                        <strong>{rep.customer_name || 'Walk-in Client'}</strong>
                        {rep.customer_phone && (
                          <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>{rep.customer_phone}</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <strong>Tag: {rep.tag_no || 'Internal'}</strong>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{rep.item_description}</div>
                    {rep.gross_weight && (
                      <span style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
                        {rep.gross_weight}g • {rep.purity || '22K'}
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: '200px' }}>
                    <div style={{ fontSize: '0.85rem' }}>{rep.problem_description}</div>
                  </td>
                  <td>{rep.karigar_name || <span style={{ color: '#8e95a5' }}>Unassigned</span>}</td>
                  <td>{rep.received_date}</td>
                  <td>
                    <div>₹{rep.estimated_cost.toLocaleString('en-IN')}</div>
                    {rep.actual_cost > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                        Act: ₹{rep.actual_cost.toLocaleString('en-IN')}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${rep.status.toLowerCase().replace('_', '-')}`}>
                      {rep.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {rep.status === 'RECEIVED' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Assign to Karigar"
                          onClick={() => openAssignModal(rep)}
                        >
                          <Send size={13} /> Assign
                        </button>
                      )}

                      {rep.status === 'ASSIGNED' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Start Repair"
                          onClick={() => handleStartRepair(rep.id)}
                        >
                          <Play size={13} /> Start
                        </button>
                      )}

                      {(rep.status === 'ASSIGNED' || rep.status === 'IN_REPAIR') && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Complete Repair"
                          onClick={() => openCompleteModal(rep)}
                        >
                          <CheckCircle2 size={13} /> Ready
                        </button>
                      )}

                      {rep.status === 'READY' && (
                        <button
                          className="btn"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#10b981', color: '#fff' }}
                          title="Deliver to Customer / Stock"
                          onClick={() => handleDeliverRepair(rep)}
                        >
                          <PackageCheck size={13} /> Deliver
                        </button>
                      )}

                      {rep.status === 'RECEIVED' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#f87171' }}
                          title="Cancel Repair"
                          onClick={() => handleCancelRepair(rep.id)}
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
            Page {page} ({total} repairs)
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

      {/* INTAKE MODAL */}
      {showIntakeModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>New Repair Order Intake</h3>
              <button className="modal-close" onClick={() => setShowIntakeModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleIntakeSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Ownership Model *</label>
                    <select
                      className="form-select"
                      value={ownership}
                      onChange={(e) => setOwnership(e.target.value as any)}
                    >
                      <option value="CUSTOMER_OWNED">Customer Owned (Separate Context)</option>
                      <option value="SHOP_OWNED">Shop Inventory (Stock Item)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      className="form-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="LOW">LOW</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                {ownership === 'CUSTOMER_OWNED' ? (
                  <div className="form-group">
                    <label>Customer *</label>
                    <select
                      className="form-select"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <option value="">Walk-in Customer / Select Customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || c.customer_code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Shop Stock Item *</label>
                    <select
                      className="form-select"
                      value={stockItemId}
                      onChange={(e) => {
                        setStockItemId(e.target.value);
                        const it = availableStock.find((s) => s.id === e.target.value);
                        if (it) {
                          setItemDescription(it.product_name || '');
                          setGrossWeight(it.gross_weight);
                        }
                      }}
                      required
                    >
                      <option value="">Select In-Stock Item to Repair</option>
                      {availableStock.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.tag_no} - {s.product_name} ({s.gross_weight}g)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label>Item Description *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 22K Ladies Diamond Ring"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Gross Weight (g)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="form-input"
                      value={grossWeight}
                      onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Metal Type</label>
                    <select
                      className="form-select"
                      value={metalType}
                      onChange={(e) => setMetalType(e.target.value)}
                    >
                      <option value="GOLD">GOLD</option>
                      <option value="SILVER">SILVER</option>
                      <option value="PLATINUM">PLATINUM</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Purity</label>
                    <select
                      className="form-select"
                      value={purity}
                      onChange={(e) => setPurity(e.target.value)}
                    >
                      <option value="24K">24K (999)</option>
                      <option value="22K">22K (916)</option>
                      <option value="18K">18K (750)</option>
                      <option value="14K">14K (585)</option>
                      <option value="999">SILVER 999</option>
                      <option value="925">SILVER 925</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Defect / Problem Description *</label>
                  <textarea
                    rows={2}
                    className="form-textarea"
                    placeholder="Describe broken latch, loose diamond prong, bent shank, sizing..."
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>Estimated Repair Charge (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Completion Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Special Instructions</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Customer pickup remarks, rhodium finish notes..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowIntakeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Intake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedRepair && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Assign Repair to Karigar</h3>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#9da4b3' }}>
                  Assigning repair <strong>{selectedRepair.repair_number}</strong> ({selectedRepair.item_description})
                </p>
                <div className="form-group">
                  <label>Select Karigar *</label>
                  <select
                    className="form-select"
                    value={assignKarigarId}
                    onChange={(e) => setAssignKarigarId(e.target.value)}
                    required
                  >
                    {karigars.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.specialization})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && selectedRepair && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Complete Repair: {selectedRepair.repair_number}</h3>
              <button className="modal-close" onClick={() => setShowCompleteModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCompleteSubmit}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#9da4b3' }}>
                  Mark item <strong>{selectedRepair.item_description}</strong> as READY for delivery.
                </p>
                <div className="form-group">
                  <label>Actual Repair Cost / Labour (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={actualCost}
                    onChange={(e) => setActualCost(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCompleteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Mark as READY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
