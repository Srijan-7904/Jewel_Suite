import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Supplier, Metal, MetalPurity } from '../../types';
import { supplierApi, rateApi } from '../../services/masters';
import {
  Truck,
  Plus,
  Search,
  Eye,
  Edit2,
  Power,
  X,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building,
  Coins,
  Banknote,
  CreditCard,
  Scale,
  User,
} from 'lucide-react';
import '../../styles/masters.css';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedSupplier, setSelectedSupplier] = useState<Partial<Supplier>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Metals & Purities for Multi-Type Opening Balance
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [primaryDirection, setPrimaryDirection] = useState<'DEBIT' | 'CREDIT'>('CREDIT');

  useEffect(() => {
    if (showModal && purities.length === 0) {
      rateApi.getMetals().then((m: any) => setMetals(m || [])).catch(console.error);
      rateApi.getAllPurities().then((p: any) => setPurities(p || [])).catch(console.error);
    }
  }, [showModal, purities.length]);

  const goldPurities = useMemo(() => {
    const goldMetal = metals.find(
      (m) => (m.code || '').toUpperCase() === 'GOLD' || (m.name || '').toLowerCase().includes('gold')
    );
    if (goldMetal) {
      return purities.filter((p) => p.metal_id === goldMetal.id);
    }
    return purities.filter(
      (p) =>
        (p.name || '').toLowerCase().includes('22k') ||
        (p.name || '').toLowerCase().includes('24k') ||
        (p.name || '').toLowerCase().includes('18k') ||
        (p.code || '').includes('K')
    );
  }, [metals, purities]);

  const silverPurities = useMemo(() => {
    const silverMetal = metals.find(
      (m) => (m.code || '').toUpperCase() === 'SILVER' || (m.name || '').toLowerCase().includes('silver')
    );
    if (silverMetal) {
      return purities.filter((p) => p.metal_id === silverMetal.id);
    }
    return purities.filter(
      (p) =>
        (p.name || '').toLowerCase().includes('925') ||
        (p.name || '').toLowerCase().includes('silver') ||
        (p.code || '').includes('925') ||
        (p.tunch_percent !== null && Number(p.tunch_percent) >= 90)
    );
  }, [metals, purities]);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await supplierApi.list({
        page,
        pageSize,
        search,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setSuppliers(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setPrimaryDirection('CREDIT');
    setSelectedSupplier({
      is_active: 1,
      opening_balance_date: new Date().toISOString().split('T')[0],
      opening_balance_ref: '',
      opening_cash_balance: 0,
      opening_cash_type: 'CREDIT',
      opening_bank_balance: 0,
      opening_bank_type: 'CREDIT',
      opening_gold_weight: 0,
      opening_gold_type: 'CREDIT',
      opening_gold_purity_id: '',
      opening_gold_rate: 0,
      opening_gold_value: 0,
      opening_silver_weight: 0,
      opening_silver_type: 'CREDIT',
      opening_silver_purity_id: '',
      opening_silver_rate: 0,
      opening_silver_value: 0,
    });
    setFormError(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setSelectedSupplier({ ...supplier });
    setFormError(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleOpenView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setModalMode('view');
    setShowModal(true);
  };

  const handlePrimaryDirectionChange = (dir: 'DEBIT' | 'CREDIT') => {
    setPrimaryDirection(dir);
    setSelectedSupplier((prev) => ({
      ...prev,
      opening_cash_type: dir,
      opening_bank_type: dir,
      opening_gold_type: dir,
      opening_silver_type: dir,
    }));
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    const nextStatus = supplier.is_active === 1 ? 0 : 1;
    const confirmMsg = nextStatus === 0
      ? `Deactivate supplier '${supplier.name}'?`
      : `Re-activate supplier '${supplier.name}'?`;

    if (window.confirm(confirmMsg)) {
      try {
        await supplierApi.toggleActive(supplier.id, nextStatus);
        fetchSuppliers();
      } catch (err: any) {
        alert(err.message || 'Failed to update supplier status');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        ...selectedSupplier,
        name: selectedSupplier.name ? selectedSupplier.name.trim().toUpperCase() : '',
        supplier_code: selectedSupplier.supplier_code ? selectedSupplier.supplier_code.trim().toUpperCase() : undefined,
        contact_person: selectedSupplier.contact_person ? selectedSupplier.contact_person.trim().toUpperCase() : null,
        phone: selectedSupplier.phone ? selectedSupplier.phone.trim() : null,
        alternate_phone: selectedSupplier.alternate_phone ? selectedSupplier.alternate_phone.trim() : null,
        email: selectedSupplier.email ? selectedSupplier.email.trim() : null,
        address: selectedSupplier.address ? selectedSupplier.address.trim().toUpperCase() : null,
        city: selectedSupplier.city ? selectedSupplier.city.trim().toUpperCase() : null,
        state: selectedSupplier.state ? selectedSupplier.state.trim().toUpperCase() : null,
        pincode: selectedSupplier.pincode ? selectedSupplier.pincode.trim() : null,
        gstin: selectedSupplier.gstin ? selectedSupplier.gstin.trim().toUpperCase() : null,
        notes: selectedSupplier.notes ? selectedSupplier.notes.trim() : null,
      };

      if (modalMode === 'create') {
        payload.opening_cash_balance = Number(selectedSupplier.opening_cash_balance) || 0;
        payload.opening_cash_type = selectedSupplier.opening_cash_type || 'CREDIT';
        payload.opening_bank_balance = Number(selectedSupplier.opening_bank_balance) || 0;
        payload.opening_bank_type = selectedSupplier.opening_bank_type || 'CREDIT';
        payload.opening_gold_weight = Number(selectedSupplier.opening_gold_weight) || 0;
        payload.opening_gold_type = selectedSupplier.opening_gold_type || 'CREDIT';
        payload.opening_gold_purity_id = selectedSupplier.opening_gold_purity_id || undefined;
        payload.opening_gold_rate = Number(selectedSupplier.opening_gold_rate) || 0;
        payload.opening_gold_value = Number(selectedSupplier.opening_gold_value) || 0;
        payload.opening_silver_weight = Number(selectedSupplier.opening_silver_weight) || 0;
        payload.opening_silver_type = selectedSupplier.opening_silver_type || 'CREDIT';
        payload.opening_silver_purity_id = selectedSupplier.opening_silver_purity_id || undefined;
        payload.opening_silver_rate = Number(selectedSupplier.opening_silver_rate) || 0;
        payload.opening_silver_value = Number(selectedSupplier.opening_silver_value) || 0;
        payload.opening_balance_date = selectedSupplier.opening_balance_date || undefined;
        payload.opening_balance_ref = selectedSupplier.opening_balance_ref ? selectedSupplier.opening_balance_ref.trim().toUpperCase() : undefined;

        await supplierApi.create(payload);
      } else if (modalMode === 'edit' && selectedSupplier.id) {
        await supplierApi.update(selectedSupplier.id, payload);
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      setFormError(err.message || 'Error saving supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="master-page-container">
      {/* Header */}
      <div className="master-header">
        <div className="master-title-group">
          <h2>Supplier Directory</h2>
          <p>Bullion dealers, casting vendors, gemstone suppliers, and manufacturing houses</p>
        </div>
        <div className="master-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchSuppliers()}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="master-filter-bar">
        <div className="search-box">
          <Search size={15} className="text-muted" />
          <input
            type="text"
            placeholder="Search by supplier name, phone, GSTIN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Status</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="master-table-card">
        <div className="master-table-responsive">
          <table className="master-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Supplier Name</th>
                <th>Phone</th>
                <th>City</th>
                <th>GSTIN</th>
                <th>Balance / Metal Dues</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty-state">
                      <Truck size={32} className="text-gold" />
                      <span>No suppliers found matching the criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="master-code">{s.supplier_code}</td>
                    <td>
                      <strong>{s.name}</strong>
                      {s.contact_person && (
                        <div className="text-muted-cell text-[11px] text-gold">Attn: {s.contact_person}</div>
                      )}
                      {s.email && <div className="text-muted-cell">{s.email}</div>}
                    </td>
                    <td>
                      <div>{s.phone || <span className="text-muted-cell">—</span>}</div>
                      {s.alternate_phone && (
                        <div className="text-muted-cell text-[11px] font-mono">Alt: {s.alternate_phone}</div>
                      )}
                    </td>
                    <td>{s.city || <span className="text-muted-cell">—</span>}</td>
                    <td className="font-mono">{s.gstin || <span className="text-muted-cell">—</span>}</td>
                    <td>
                      <div className="font-mono text-xs">
                        {s.current_balance !== undefined && s.current_balance !== null && Number(s.current_balance) !== 0 ? (
                          <div className={`font-bold ${Number(s.current_balance) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            ₹{Math.abs(Number(s.current_balance)).toLocaleString('en-IN')}{' '}
                            {Number(s.current_balance) > 0 ? 'Cr (Payable)' : 'Dr (Adv)'}
                          </div>
                        ) : (
                          <div className="text-muted-cell">₹0.00 (Nil)</div>
                        )}
                        {Number(s.gold_balance_grams || 0) !== 0 && (
                          <div className="text-amber-400 text-[11px] font-semibold">
                            Au: {Number(s.gold_balance_grams).toFixed(3)}g{' '}
                            {Number(s.gold_balance_grams) > 0 ? 'Cr' : 'Dr'}
                          </div>
                        )}
                        {Number(s.silver_balance_grams || 0) !== 0 && (
                          <div className="text-slate-300 text-[11px] font-semibold">
                            Ag: {Number(s.silver_balance_grams).toFixed(3)}g{' '}
                            {Number(s.silver_balance_grams) > 0 ? 'Cr' : 'Dr'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {s.is_active === 1 ? (
                        <span className="badge badge-success">ACTIVE</span>
                      ) : (
                        <span className="badge badge-danger">INACTIVE</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-icon"
                          title="View Details"
                          onClick={() => handleOpenView(s)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit"
                          onClick={() => handleOpenEdit(s)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className={`btn-icon ${s.is_active === 1 ? 'danger' : ''}`}
                          title={s.is_active === 1 ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(s)}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="master-pagination">
          <span>
            Showing {suppliers.length} of {total} records (Page {page} of {totalPages})
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="pagination-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: modalMode === 'create' ? '760px' : '650px' }}>
            <div className="modal-header">
              <h3>
                {modalMode === 'create' && 'Register New Supplier'}
                {modalMode === 'edit' && `Edit Supplier (${selectedSupplier.supplier_code})`}
                {modalMode === 'view' && `Supplier Details: ${selectedSupplier.name}`}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {modalMode === 'view' ? (
              <div className="modal-body">
                {/* Live Balance Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="opening-ledger-card" style={{ borderLeft: '3px solid #d4af37' }}>
                    <div className="card-heading">
                      <span>Monetary Outstanding</span>
                      <Coins size={14} className="text-gold" />
                    </div>
                    <div
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color:
                          Number(selectedSupplier.current_balance ?? 0) > 0
                            ? '#f43f5e'
                            : Number(selectedSupplier.current_balance ?? 0) < 0
                            ? '#10b981'
                            : '#9ca3af',
                      }}
                    >
                      ₹{Math.abs(Number(selectedSupplier.current_balance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9da4b3' }}>
                      {Number(selectedSupplier.current_balance ?? 0) > 0
                        ? 'Shop owes supplier (Payable / Cr)'
                        : Number(selectedSupplier.current_balance ?? 0) < 0
                        ? 'Supplier owes shop (Advance / Dr)'
                        : 'Account fully settled'}
                    </div>
                  </div>

                  <div className="opening-ledger-card card-gold">
                    <div className="card-heading">
                      <span>Gold Metal Balance</span>
                      <span className="metal-badge metal-badge-gold">Au</span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dfb742' }}>
                      {Number(selectedSupplier.gold_balance_grams || 0).toFixed(4)} g
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9da4b3' }}>
                      {Number(selectedSupplier.gold_balance_grams || 0) > 0
                        ? 'Shop owes gold to supplier (Cr)'
                        : Number(selectedSupplier.gold_balance_grams || 0) < 0
                        ? 'Supplier owes gold to shop (Dr)'
                        : 'No gold dues'}
                    </div>
                  </div>

                  <div className="opening-ledger-card card-silver">
                    <div className="card-heading">
                      <span>Silver Metal Balance</span>
                      <span className="metal-badge metal-badge-silver">Ag</span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1' }}>
                      {Number(selectedSupplier.silver_balance_grams || 0).toFixed(3)} g
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9da4b3' }}>
                      {Number(selectedSupplier.silver_balance_grams || 0) > 0
                        ? 'Shop owes silver to supplier (Cr)'
                        : Number(selectedSupplier.silver_balance_grams || 0) < 0
                        ? 'Supplier owes silver to shop (Dr)'
                        : 'No silver dues'}
                    </div>
                  </div>
                </div>

                <div className="modal-form-grid">
                  <div className="form-field">
                    <label>Supplier Code</label>
                    <div className="font-mono text-gold">{selectedSupplier.supplier_code}</div>
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <div>
                      {selectedSupplier.is_active === 1 ? (
                        <span className="badge badge-success">ACTIVE</span>
                      ) : (
                        <span className="badge badge-danger">INACTIVE</span>
                      )}
                    </div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Business Name</label>
                    <div className="text-lg font-semibold">{selectedSupplier.name}</div>
                  </div>
                  <div className="form-field">
                    <label>Contact Person</label>
                    <div className="flex items-center gap-1 font-medium text-gold">
                      <User size={13} /> {selectedSupplier.contact_person || '—'}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Phone / Landline</label>
                    <div className="flex items-center gap-1 font-mono">
                      <Phone size={13} /> {selectedSupplier.phone || '—'}
                      {selectedSupplier.alternate_phone && (
                        <span className="text-muted-cell text-xs"> (Alt: {selectedSupplier.alternate_phone})</span>
                      )}
                    </div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Email</label>
                    <div className="flex items-center gap-1">
                      <Mail size={13} /> {selectedSupplier.email || '—'}
                    </div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Address</label>
                    <div className="flex items-center gap-1">
                      <MapPin size={13} /> {selectedSupplier.address || '—'}, {selectedSupplier.city || ''}{' '}
                      {selectedSupplier.state || ''} {selectedSupplier.pincode || ''}
                    </div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>GSTIN</label>
                    <div className="font-mono flex items-center gap-1">
                      <Building size={13} /> {selectedSupplier.gstin || 'Unregistered'}
                    </div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Notes</label>
                    <div className="text-muted">{selectedSupplier.notes || 'No notes added'}</div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setModalMode('edit')}
                  >
                    Edit Supplier
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <div className="modal-body custom-scrollbar" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
                  {formError && <div className="form-error-alert">{formError}</div>}

                  <div className="modal-form-grid">
                    <div className="form-field col-span-2">
                      <label>Supplier / Business Name *</label>
                      <input
                        type="text"
                        required
                        value={selectedSupplier.name || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, name: e.target.value })}
                        placeholder="e.g. Zaveri Bullion Works"
                        autoFocus
                      />
                    </div>

                    <div className="form-field">
                      <label>Custom Code (Optional)</label>
                      <input
                        type="text"
                        value={selectedSupplier.supplier_code || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, supplier_code: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>

                    <div className="form-field">
                      <label>Contact Person</label>
                      <input
                        type="text"
                        value={selectedSupplier.contact_person || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, contact_person: e.target.value })}
                        placeholder="e.g. Rajesh Shah"
                      />
                    </div>

                    <div className="form-field">
                      <label>Phone Number</label>
                      <input
                        type="text"
                        value={selectedSupplier.phone || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, phone: e.target.value })}
                        placeholder="Primary mobile"
                      />
                    </div>

                    <div className="form-field">
                      <label>Alternate / Landline</label>
                      <input
                        type="text"
                        value={selectedSupplier.alternate_phone || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, alternate_phone: e.target.value })}
                        placeholder="Office landline"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={selectedSupplier.email || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, email: e.target.value })}
                        placeholder="orders@supplier.com"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Street Address</label>
                      <input
                        type="text"
                        value={selectedSupplier.address || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, address: e.target.value })}
                        placeholder="Building, street, area"
                      />
                    </div>

                    <div className="form-field">
                      <label>City</label>
                      <input
                        type="text"
                        value={selectedSupplier.city || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>

                    <div className="form-field">
                      <label>GSTIN</label>
                      <input
                        type="text"
                        value={selectedSupplier.gstin || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, gstin: e.target.value.toUpperCase() })}
                        placeholder="15-character GSTIN"
                      />
                    </div>

                    {/* Opening Balances Section (Only upon Creation) */}
                    {modalMode === 'create' && (
                      <div className="col-span-2 pt-2 border-t border-[var(--border-subtle)] mt-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--gold-primary)]">
                              Opening Khata & Metal Balances (At Registration)
                            </div>
                            <div className="text-[11px] text-[var(--text-dim)]">
                              Carried forward monetary or metal balances with this supplier
                            </div>
                          </div>
                          <div className="flex items-center gap-1 bg-[var(--bg-app)] p-0.5 rounded border border-[var(--border-subtle)] text-xs">
                            <button
                              type="button"
                              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                                primaryDirection === 'CREDIT'
                                  ? 'bg-[var(--gold-primary)] text-black font-bold'
                                  : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                              }`}
                              onClick={() => handlePrimaryDirectionChange('CREDIT')}
                            >
                              Shop Owes Supplier / Jama (Cr - जमा)
                            </button>
                            <button
                              type="button"
                              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                                primaryDirection === 'DEBIT'
                                  ? 'bg-[var(--gold-primary)] text-black font-bold'
                                  : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                              }`}
                              onClick={() => handlePrimaryDirectionChange('DEBIT')}
                            >
                              Supplier Owes Shop / Baaki (Dr - बाकी)
                            </button>
                          </div>
                        </div>

                        {/* Date & Ref */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="form-field">
                            <label style={{ fontSize: '0.75rem' }}>Opening Balance Date</label>
                            <input
                              type="date"
                              className="font-mono text-xs"
                              value={selectedSupplier.opening_balance_date || ''}
                              onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_balance_date: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label style={{ fontSize: '0.75rem' }}>Ref / Old Book Voucher</label>
                            <input
                              type="text"
                              className="font-mono text-xs uppercase"
                              placeholder="e.g. SUP-KHATA-2024"
                              value={selectedSupplier.opening_balance_ref || ''}
                              onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_balance_ref: e.target.value.toUpperCase() })}
                            />
                          </div>
                        </div>

                        {/* 4 Cards Grid: Cash, Bank, Gold, Silver */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Cash Card */}
                          <div className="opening-ledger-card card-cash">
                            <div className="card-heading">
                              <span className="flex items-center gap-1.5 font-semibold text-xs">
                                <Banknote size={14} className="text-emerald-500" />
                                Cash Opening (₹)
                              </span>
                              <select
                                className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] rounded px-1.5 py-0.5 font-mono"
                                value={selectedSupplier.opening_cash_type || 'CREDIT'}
                                onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_cash_type: e.target.value as any })}
                              >
                                <option value="CREDIT">Jama / Cr (Shop owes Supplier - जमा)</option>
                                <option value="DEBIT">Baaki / Dr (Advance to Supplier - बाकी)</option>
                              </select>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="font-mono text-sm font-bold"
                              placeholder="0.00"
                              value={selectedSupplier.opening_cash_balance || ''}
                              onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_cash_balance: parseFloat(e.target.value) || 0 })}
                            />
                          </div>

                          {/* Bank Card */}
                          <div className="opening-ledger-card card-bank">
                            <div className="card-heading">
                              <span className="flex items-center gap-1.5 font-semibold text-xs">
                                <CreditCard size={14} className="text-blue-500" />
                                Bank / RTGS Opening (₹)
                              </span>
                              <select
                                className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] rounded px-1.5 py-0.5 font-mono"
                                value={selectedSupplier.opening_bank_type || 'CREDIT'}
                                onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_bank_type: e.target.value as any })}
                              >
                                <option value="CREDIT">Jama / Cr (Shop owes Supplier - जमा)</option>
                                <option value="DEBIT">Baaki / Dr (Advance to Supplier - बाकी)</option>
                              </select>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="font-mono text-sm font-bold"
                              placeholder="0.00"
                              value={selectedSupplier.opening_bank_balance || ''}
                              onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_bank_balance: parseFloat(e.target.value) || 0 })}
                            />
                          </div>

                          {/* Gold Card */}
                          <div className="opening-ledger-card card-gold">
                            <div className="card-heading">
                              <span className="flex items-center gap-1.5 font-semibold text-xs text-[#dfb742]">
                                <Coins size={14} />
                                Gold Opening (grams)
                              </span>
                              <select
                                className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] rounded px-1.5 py-0.5 font-mono"
                                value={selectedSupplier.opening_gold_type || 'CREDIT'}
                                onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_gold_type: e.target.value as any })}
                              >
                                <option value="CREDIT">Jama / Cr (Payable to Supplier - जमा)</option>
                                <option value="DEBIT">Baaki / Dr (Deposit with Supplier - बाकी)</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="font-mono text-xs"
                                placeholder="Weight (g)"
                                value={selectedSupplier.opening_gold_weight || ''}
                                onChange={(e) => {
                                  const weight = parseFloat(e.target.value) || 0;
                                  const rate = selectedSupplier.opening_gold_rate || 0;
                                  setSelectedSupplier({
                                    ...selectedSupplier,
                                    opening_gold_weight: weight,
                                    opening_gold_value: Math.round(weight * rate * 100) / 100,
                                  });
                                }}
                              />
                              <select
                                className="text-xs font-mono uppercase"
                                value={selectedSupplier.opening_gold_purity_id || ''}
                                onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_gold_purity_id: e.target.value })}
                              >
                                <option value="">Select Karat/Purity</option>
                                {goldPurities.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="font-mono text-[11px]"
                                placeholder="Valuation Rate ₹/g"
                                value={selectedSupplier.opening_gold_rate || ''}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  const weight = selectedSupplier.opening_gold_weight || 0;
                                  setSelectedSupplier({
                                    ...selectedSupplier,
                                    opening_gold_rate: rate,
                                    opening_gold_value: Math.round(weight * rate * 100) / 100,
                                  });
                                }}
                              />
                              <div className="text-[11px] font-mono flex items-center justify-end px-2 bg-[var(--bg-app)] rounded border border-[var(--border-subtle)] text-[var(--text-dim)]">
                                {Number(selectedSupplier.opening_gold_value || 0) > 0
                                  ? `₹${Number(selectedSupplier.opening_gold_value).toLocaleString('en-IN')}`
                                  : 'Value (₹)'}
                              </div>
                            </div>
                          </div>

                          {/* Silver Card */}
                          <div className="opening-ledger-card card-silver">
                            <div className="card-heading">
                              <span className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                                <Scale size={14} />
                                Silver Opening (grams)
                              </span>
                              <select
                                className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] rounded px-1.5 py-0.5 font-mono"
                                value={selectedSupplier.opening_silver_type || 'CREDIT'}
                                onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_silver_type: e.target.value as any })}
                              >
                                <option value="CREDIT">Jama / Cr (Payable to Supplier - जमा)</option>
                                <option value="DEBIT">Baaki / Dr (Deposit with Supplier - बाकी)</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="font-mono text-xs"
                                placeholder="Weight (g)"
                                value={selectedSupplier.opening_silver_weight || ''}
                                onChange={(e) => {
                                  const weight = parseFloat(e.target.value) || 0;
                                  const rate = selectedSupplier.opening_silver_rate || 0;
                                  setSelectedSupplier({
                                    ...selectedSupplier,
                                    opening_silver_weight: weight,
                                    opening_silver_value: Math.round(weight * rate * 100) / 100,
                                  });
                                }}
                              />
                              <select
                                className="text-xs font-mono uppercase"
                                value={selectedSupplier.opening_silver_purity_id || ''}
                                onChange={(e) => setSelectedSupplier({ ...selectedSupplier, opening_silver_purity_id: e.target.value })}
                              >
                                <option value="">Select Purity</option>
                                {silverPurities.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="font-mono text-[11px]"
                                placeholder="Valuation Rate ₹/g"
                                value={selectedSupplier.opening_silver_rate || ''}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  const weight = selectedSupplier.opening_silver_weight || 0;
                                  setSelectedSupplier({
                                    ...selectedSupplier,
                                    opening_silver_rate: rate,
                                    opening_silver_value: Math.round(weight * rate * 100) / 100,
                                  });
                                }}
                              />
                              <div className="text-[11px] font-mono flex items-center justify-end px-2 bg-[var(--bg-app)] rounded border border-[var(--border-subtle)] text-[var(--text-dim)]">
                                {Number(selectedSupplier.opening_silver_value || 0) > 0
                                  ? `₹${Number(selectedSupplier.opening_silver_value).toLocaleString('en-IN')}`
                                  : 'Value (₹)'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="form-field col-span-2">
                      <label>Notes</label>
                      <textarea
                        rows={2}
                        value={selectedSupplier.notes || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, notes: e.target.value })}
                        placeholder="Terms of credit / jama khata terms, delivery lead times..."
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Supplier' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
