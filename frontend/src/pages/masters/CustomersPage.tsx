import React, { useState, useEffect, useCallback } from 'react';
import { Customer } from '../../types';
import { customerApi } from '../../services/masters';
import {
  Users,
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

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedCustomer, setSelectedCustomer] = useState<Partial<Customer>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await customerApi.list({
        page,
        pageSize,
        search,
        customer_type: typeFilter !== 'ALL' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setCustomers(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenCreate = () => {
    setSelectedCustomer({
      customer_type: 'RETAIL',
      opening_balance: 0,
      opening_balance_type: 'DEBIT',
      is_active: 1,
    });
    setFormError(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setSelectedCustomer({ ...customer });
    setFormError(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleOpenView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setModalMode('view');
    setShowModal(true);
  };

  const handleToggleStatus = async (customer: Customer) => {
    const nextStatus = customer.is_active === 1 ? 0 : 1;
    const confirmMsg = nextStatus === 0
      ? `Deactivate customer '${customer.name}'?`
      : `Re-activate customer '${customer.name}'?`;

    if (window.confirm(confirmMsg)) {
      try {
        await customerApi.toggleActive(customer.id, nextStatus);
        fetchCustomers();
      } catch (err: any) {
        alert(err.message || 'Failed to update customer status');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (modalMode === 'create') {
        await customerApi.create(selectedCustomer);
      } else if (modalMode === 'edit' && selectedCustomer.id) {
        await customerApi.update(selectedCustomer.id, selectedCustomer);
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Error saving customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="master-page-container">
      {/* Header */}
      <div className="master-header">
        <div className="master-title-group">
          <h2>Customer Directory</h2>
          <p>Manage retail, wholesale, and girvi clients with contact and opening balance records</p>
        </div>
        <div className="master-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchCustomers()}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="master-filter-bar">
        <div className="search-box">
          <Search size={15} className="text-muted" />
          <input
            type="text"
            placeholder="Search by name, phone, code..."
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Types</option>
            <option value="RETAIL">Retail Customer</option>
            <option value="WHOLESALE">Wholesale Dealer</option>
            <option value="GIRVI_CLIENT">Girvi Client</option>
          </select>

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

      {/* Customers Table */}
      <div className="master-table-card">
        <div className="master-table-responsive">
          <table className="master-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>City</th>
                <th>Type</th>
                <th>Opening Bal</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty-state">
                      <Users size={32} className="text-gold" />
                      <span>No customers found matching the search criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td className="master-code">{c.customer_code}</td>
                    <td>
                      <strong>{c.name}</strong>
                      {c.gstin && <div className="text-muted-cell font-mono">GST: {c.gstin}</div>}
                    </td>
                    <td>{c.phone || <span className="text-muted-cell">—</span>}</td>
                    <td>{c.city || <span className="text-muted-cell">—</span>}</td>
                    <td>
                      <span className="badge badge-gold">{c.customer_type}</span>
                    </td>
                    <td className="font-mono">
                      ₹{c.opening_balance.toFixed(2)}{' '}
                      <small className="text-muted-cell">{c.opening_balance_type}</small>
                    </td>
                    <td>
                      {c.is_active === 1 ? (
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
                          onClick={() => handleOpenView(c)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className={`btn-icon ${c.is_active === 1 ? 'danger' : ''}`}
                          title={c.is_active === 1 ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(c)}
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
            Showing {customers.length} of {total} records (Page {page} of {totalPages})
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

      {/* Modal Dialog */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {modalMode === 'create' && 'Add New Customer'}
                {modalMode === 'edit' && `Edit Customer (${selectedCustomer.customer_code})`}
                {modalMode === 'view' && `Customer Profile: ${selectedCustomer.name}`}
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
                    <label>Customer Code</label>
                    <div className="font-mono text-gold">{selectedCustomer.customer_code}</div>
                  </div>
                  <div className="form-field">
                    <label>Type</label>
                    <div><span className="badge badge-gold">{selectedCustomer.customer_type}</span></div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Full Name</label>
                    <div className="text-lg font-semibold">{selectedCustomer.name}</div>
                  </div>
                  <div className="form-field">
                    <label>Primary Phone</label>
                    <div className="flex items-center gap-1"><Phone size={13} /> {selectedCustomer.phone || '—'}</div>
                  </div>
                  <div className="form-field">
                    <label>Alternate Phone</label>
                    <div>{selectedCustomer.alternate_phone || '—'}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Email Address</label>
                    <div className="flex items-center gap-1"><Mail size={13} /> {selectedCustomer.email || '—'}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Address</label>
                    <div className="flex items-center gap-1"><MapPin size={13} /> {selectedCustomer.address || '—'}, {selectedCustomer.city || ''} {selectedCustomer.state || ''} {selectedCustomer.pincode || ''}</div>
                  </div>
                  <div className="form-field">
                    <label>GSTIN</label>
                    <div className="font-mono flex items-center gap-1"><Building size={13} /> {selectedCustomer.gstin || 'Unregistered'}</div>
                  </div>
                  <div className="form-field">
                    <label>Opening Balance</label>
                    <div className="font-mono">₹{selectedCustomer.opening_balance?.toFixed(2)} ({selectedCustomer.opening_balance_type})</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Notes</label>
                    <div className="text-muted">{selectedCustomer.notes || 'No notes added'}</div>
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
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <div className="modal-body">
                  {formError && <div className="form-error-alert">{formError}</div>}

                  <div className="modal-form-grid">
                    <div className="form-field col-span-2">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        required
                        value={selectedCustomer.name || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                        placeholder="e.g. Ramesh Chandra"
                        autoFocus
                      />
                    </div>

                    <div className="form-field">
                      <label>Customer Type</label>
                      <select
                        value={selectedCustomer.customer_type || 'RETAIL'}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, customer_type: e.target.value as any })}
                      >
                        <option value="RETAIL">Retail Customer</option>
                        <option value="WHOLESALE">Wholesale Party</option>
                        <option value="GIRVI_CLIENT">Girvi Client</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Custom Code (Optional)</label>
                      <input
                        type="text"
                        value={selectedCustomer.customer_code || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, customer_code: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>

                    <div className="form-field">
                      <label>Primary Phone</label>
                      <input
                        type="text"
                        value={selectedCustomer.phone || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                        placeholder="10-digit mobile number"
                      />
                    </div>

                    <div className="form-field">
                      <label>Alternate Phone</label>
                      <input
                        type="text"
                        value={selectedCustomer.alternate_phone || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, alternate_phone: e.target.value })}
                        placeholder="Landline / second number"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={selectedCustomer.email || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                        placeholder="customer@domain.com"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Address / Street</label>
                      <input
                        type="text"
                        value={selectedCustomer.address || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                        placeholder="Door / Building / Street name"
                      />
                    </div>

                    <div className="form-field">
                      <label>City</label>
                      <input
                        type="text"
                        value={selectedCustomer.city || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, city: e.target.value })}
                        placeholder="City / Town"
                      />
                    </div>

                    <div className="form-field">
                      <label>GSTIN (Optional)</label>
                      <input
                        type="text"
                        value={selectedCustomer.gstin || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, gstin: e.target.value.toUpperCase() })}
                        placeholder="15-character GSTIN"
                      />
                    </div>

                    <div className="form-field">
                      <label>Opening Balance (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedCustomer.opening_balance ?? 0}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_balance: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Balance Type</label>
                      <select
                        value={selectedCustomer.opening_balance_type || 'DEBIT'}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_balance_type: e.target.value as any })}
                      >
                        <option value="DEBIT">Debit (Party owes shop)</option>
                        <option value="CREDIT">Credit (Shop owes party)</option>
                      </select>
                    </div>

                    <div className="form-field col-span-2">
                      <label>Internal Notes</label>
                      <textarea
                        rows={2}
                        value={selectedCustomer.notes || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, notes: e.target.value })}
                        placeholder="Customer preferences, referral, etc."
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
                    {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Customer' : 'Save Changes'}
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
