import React, { useState, useEffect, useCallback } from 'react';
import { Supplier } from '../../types';
import { supplierApi } from '../../services/masters';
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
    setSelectedSupplier({ is_active: 1 });
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
      if (modalMode === 'create') {
        await supplierApi.create(selectedSupplier);
      } else if (modalMode === 'edit' && selectedSupplier.id) {
        await supplierApi.update(selectedSupplier.id, selectedSupplier);
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
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
                      {s.email && <div className="text-muted-cell">{s.email}</div>}
                    </td>
                    <td>{s.phone || <span className="text-muted-cell">—</span>}</td>
                    <td>{s.city || <span className="text-muted-cell">—</span>}</td>
                    <td className="font-mono">{s.gstin || <span className="text-muted-cell">—</span>}</td>
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
          <div className="modal-content">
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
                <div className="modal-form-grid">
                  <div className="form-field">
                    <label>Supplier Code</label>
                    <div className="font-mono text-gold">{selectedSupplier.supplier_code}</div>
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <div>{selectedSupplier.is_active === 1 ? <span className="badge badge-success">ACTIVE</span> : <span className="badge badge-danger">INACTIVE</span>}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Business Name</label>
                    <div className="text-lg font-semibold">{selectedSupplier.name}</div>
                  </div>
                  <div className="form-field">
                    <label>Phone</label>
                    <div className="flex items-center gap-1"><Phone size={13} /> {selectedSupplier.phone || '—'}</div>
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <div className="flex items-center gap-1"><Mail size={13} /> {selectedSupplier.email || '—'}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Address</label>
                    <div className="flex items-center gap-1"><MapPin size={13} /> {selectedSupplier.address || '—'}, {selectedSupplier.city || ''} {selectedSupplier.state || ''}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>GSTIN</label>
                    <div className="font-mono flex items-center gap-1"><Building size={13} /> {selectedSupplier.gstin || 'Unregistered'}</div>
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
                <div className="modal-body">
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
                      <label>Phone Number</label>
                      <input
                        type="text"
                        value={selectedSupplier.phone || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, phone: e.target.value })}
                        placeholder="Primary contact"
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

                    <div className="form-field col-span-2">
                      <label>Notes</label>
                      <textarea
                        rows={2}
                        value={selectedSupplier.notes || ''}
                        onChange={(e) => setSelectedSupplier({ ...selectedSupplier, notes: e.target.value })}
                        placeholder="Terms of credit, delivery lead times..."
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
