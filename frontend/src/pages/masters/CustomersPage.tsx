import React, { useState, useEffect, useCallback } from 'react';
import { Customer, Metal, MetalPurity } from '../../types';
import { customerApi, rateApi } from '../../services/masters';
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
  Coins,
} from 'lucide-react';
import '../../styles/masters.css';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [primaryDirection, setPrimaryDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
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

  useEffect(() => {
    rateApi.getMetals().then(setMetals).catch(console.error);
    rateApi.getAllPurities().then(setPurities).catch(console.error);
  }, []);

  const handleOpenCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedCustomer({
      customer_type: 'RETAIL',
      opening_balance: 0,
      opening_balance_type: 'DEBIT',
      opening_balance_date: today,
      opening_balance_ref: '',
      opening_balance_notes: '',
      opening_cash_balance: 0,
      opening_cash_type: 'DEBIT',
      opening_bank_balance: 0,
      opening_bank_type: 'DEBIT',
      opening_gold_weight: 0,
      opening_gold_type: 'DEBIT',
      opening_gold_purity_id: '',
      opening_gold_rate: 0,
      opening_gold_value: 0,
      opening_silver_weight: 0,
      opening_silver_type: 'DEBIT',
      opening_silver_purity_id: '',
      opening_silver_rate: 0,
      opening_silver_value: 0,
      is_active: 1,
    });
    setPrimaryDirection('DEBIT');
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
                <th>Balance / Metal Dues</th>
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
                    <td>
                      <div className="font-mono" style={{ fontWeight: 600 }}>
                        <span style={{ color: (c.current_balance ?? c.opening_balance) > 0 ? '#f43f5e' : (c.current_balance ?? c.opening_balance) < 0 ? '#10b981' : '#9ca3af' }}>
                          ₹{Math.abs(c.current_balance ?? c.opening_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>{' '}
                        <small className="text-muted-cell">
                          {(c.current_balance ?? c.opening_balance) > 0 ? 'Dr' : (c.current_balance ?? c.opening_balance) < 0 ? 'Cr' : 'Nil'}
                        </small>
                      </div>
                      {(Boolean(c.gold_balance_grams && c.gold_balance_grams !== 0) || Boolean(c.silver_balance_grams && c.silver_balance_grams !== 0)) && (
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {Boolean(c.gold_balance_grams && c.gold_balance_grams !== 0) && (
                            <span className="metal-badge metal-badge-gold" title="Customer Gold Balance">
                              Au: {c.gold_balance_grams! > 0 ? '+' : ''}{c.gold_balance_grams}g
                            </span>
                          )}
                          {Boolean(c.silver_balance_grams && c.silver_balance_grams !== 0) && (
                            <span className="metal-badge metal-badge-silver" title="Customer Silver Balance">
                              Ag: {c.silver_balance_grams! > 0 ? '+' : ''}{c.silver_balance_grams}g
                            </span>
                          )}
                        </div>
                      )}
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
          <div className="modal-content modal-lg">
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
                {/* Live Balance Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div className="opening-ledger-card" style={{ borderLeft: '3px solid #d4af37' }}>
                    <div className="card-heading">
                      <span>Monetary Outstanding</span>
                      <Coins size={14} className="text-gold" />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (selectedCustomer.current_balance ?? selectedCustomer.opening_balance ?? 0) > 0 ? '#f43f5e' : (selectedCustomer.current_balance ?? selectedCustomer.opening_balance ?? 0) < 0 ? '#10b981' : '#9ca3af' }}>
                      ₹{Math.abs(selectedCustomer.current_balance ?? selectedCustomer.opening_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9da4b3' }}>
                      {(selectedCustomer.current_balance ?? selectedCustomer.opening_balance ?? 0) > 0
                        ? 'Customer owes shop / Baaki (Receivable - बाकी)'
                        : (selectedCustomer.current_balance ?? selectedCustomer.opening_balance ?? 0) < 0
                        ? 'Shop owes customer / Jama (Store Credit - जमा)'
                        : 'Account fully settled'}
                    </div>
                  </div>

                  <div className="opening-ledger-card card-gold">
                    <div className="card-heading">
                      <span>Gold Metal Balance</span>
                      <span className="metal-badge metal-badge-gold">Au</span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dfb742' }}>
                      {Number(selectedCustomer.gold_balance_grams || 0).toFixed(4)} g
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9da4b3' }}>
                      {(selectedCustomer.gold_balance_grams || 0) > 0
                        ? 'Customer owes gold to shop'
                        : (selectedCustomer.gold_balance_grams || 0) < 0
                        ? 'Shop owes gold to customer'
                        : 'No gold dues'}
                    </div>
                  </div>

                  <div className="opening-ledger-card card-silver">
                    <div className="card-heading">
                      <span>Silver Metal Balance</span>
                      <span className="metal-badge metal-badge-silver">Ag</span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1' }}>
                      {Number(selectedCustomer.silver_balance_grams || 0).toFixed(3)} g
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9da4b3' }}>
                      {(selectedCustomer.silver_balance_grams || 0) > 0
                        ? 'Customer owes silver to shop'
                        : (selectedCustomer.silver_balance_grams || 0) < 0
                        ? 'Shop owes silver to customer'
                        : 'No silver dues'}
                    </div>
                  </div>
                </div>

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
                  <div className="form-field col-span-2">
                    <label>GSTIN</label>
                    <div className="font-mono flex items-center gap-1"><Building size={13} /> {selectedCustomer.gstin || 'Unregistered'}</div>
                  </div>

                  {/* Recorded Opening Balance Breakdown */}
                  <div className="col-span-2 opening-balance-container" style={{ padding: '0.85rem' }}>
                    <div className="opening-balance-title" style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                      <Coins size={14} /> Registered Opening Balances Record
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.8rem' }}>
                      <div>
                        <span className="text-muted">Opening Date: </span>
                        <strong>{selectedCustomer.opening_balance_date || 'At Creation'}</strong>
                      </div>
                      <div>
                        <span className="text-muted">Reference: </span>
                        <strong>{selectedCustomer.opening_balance_ref || 'None'}</strong>
                      </div>
                      <div>
                        <span className="text-muted">Opening Cash: </span>
                        <strong>₹{(selectedCustomer.opening_cash_balance || 0).toFixed(2)} ({selectedCustomer.opening_cash_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})</strong>
                      </div>
                      <div>
                        <span className="text-muted">Opening Bank: </span>
                        <strong>₹{(selectedCustomer.opening_bank_balance || 0).toFixed(2)} ({selectedCustomer.opening_bank_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'})</strong>
                      </div>
                      <div>
                        <span className="text-muted">Opening Gold: </span>
                        <strong className="text-gold">
                          {(selectedCustomer.opening_gold_weight || 0)}g {selectedCustomer.opening_gold_purity_name ? `(${selectedCustomer.opening_gold_purity_name})` : ''} - {selectedCustomer.opening_gold_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'}
                        </strong>
                        {Boolean(selectedCustomer.opening_gold_rate && selectedCustomer.opening_gold_rate > 0) && (
                          <span style={{ fontSize: '0.7rem', color: '#9da4b3', marginLeft: '0.3rem' }}>
                            (@ ₹{selectedCustomer.opening_gold_rate}/g = ₹{(selectedCustomer.opening_gold_value || 0).toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted">Opening Silver: </span>
                        <strong style={{ color: '#cbd5e1' }}>
                          {(selectedCustomer.opening_silver_weight || 0)}g {selectedCustomer.opening_silver_purity_name ? `(${selectedCustomer.opening_silver_purity_name})` : ''} - {selectedCustomer.opening_silver_type === 'DEBIT' ? 'Baaki (Dr)' : 'Jama (Cr)'}
                        </strong>
                        {Boolean(selectedCustomer.opening_silver_rate && selectedCustomer.opening_silver_rate > 0) && (
                          <span style={{ fontSize: '0.7rem', color: '#9da4b3', marginLeft: '0.3rem' }}>
                            (@ ₹{selectedCustomer.opening_silver_rate}/g = ₹{(selectedCustomer.opening_silver_value || 0).toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedCustomer.opening_balance_notes && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#9da4b3' }}>
                        Note: {selectedCustomer.opening_balance_notes}
                      </div>
                    )}
                  </div>

                  <div className="form-field col-span-2">
                    <label>General Notes</label>
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

                    {modalMode === 'create' ? (
                      /* Multi-Type Opening Balance Section */
                      <div className="opening-balance-container">
                        <div className="opening-balance-header">
                          <div className="opening-balance-title">
                            <Coins size={16} /> Opening Balance (Monetary & Metal Ledgers)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#9da4b3' }}>Default Direction:</span>
                            <select
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', background: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-default)' }}
                              value={primaryDirection}
                              onChange={(e) => {
                                const dir = e.target.value as 'DEBIT' | 'CREDIT';
                                setPrimaryDirection(dir);
                                setSelectedCustomer((prev) => ({
                                  ...prev,
                                  opening_cash_type: dir,
                                  opening_bank_type: dir,
                                  opening_gold_type: dir,
                                  opening_silver_type: dir,
                                  opening_balance_type: dir,
                                }));
                              }}
                            >
                              <option value="DEBIT">Customer Owes Us / Baaki (Dr - बाकी)</option>
                              <option value="CREDIT">We Owe Customer / Jama (Cr - जमा)</option>
                            </select>
                          </div>
                        </div>

                        {/* Date, Ref, Notes row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', width: '100%' }}>
                          <div className="form-field">
                            <label>Opening Date</label>
                            <input
                              type="date"
                              value={selectedCustomer.opening_balance_date || new Date().toISOString().split('T')[0]}
                              onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_balance_date: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Reference # (Old Bill/Khata)</label>
                            <input
                              type="text"
                              placeholder="e.g. KHATA-2024-45"
                              value={selectedCustomer.opening_balance_ref || ''}
                              onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_balance_ref: e.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Opening Balance Notes</label>
                            <input
                              type="text"
                              placeholder="e.g. Carried forward balance from old register"
                              value={selectedCustomer.opening_balance_notes || ''}
                              onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_balance_notes: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* 4 Cards Grid: Cash, Bank, Gold, Silver */}
                        <div className="opening-balance-grid">
                          {/* 1. Cash Opening Balance */}
                          <div className="opening-ledger-card card-cash">
                            <div className="card-heading">
                              <span>Cash Opening Balance</span>
                              <span className="badge badge-success">₹ Cash</span>
                            </div>
                            <div className="card-inputs-row">
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Amount (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={selectedCustomer.opening_cash_balance ?? 0}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_cash_balance: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Direction</label>
                                <select
                                  value={selectedCustomer.opening_cash_type || 'DEBIT'}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_cash_type: e.target.value as any })}
                                >
                                  <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                                  <option value="CREDIT">Jama / Cr (Advance Deposit - जमा)</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* 2. Bank / RTGS Opening Balance */}
                          <div className="opening-ledger-card card-bank">
                            <div className="card-heading">
                              <span>Bank / RTGS Balance</span>
                              <span className="badge badge-info">₹ Bank</span>
                            </div>
                            <div className="card-inputs-row">
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Amount (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={selectedCustomer.opening_bank_balance ?? 0}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_bank_balance: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Direction</label>
                                <select
                                  value={selectedCustomer.opening_bank_type || 'DEBIT'}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_bank_type: e.target.value as any })}
                                >
                                  <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                                  <option value="CREDIT">Jama / Cr (Advance Deposit - जमा)</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* 3. Gold Opening Balance */}
                          <div className="opening-ledger-card card-gold">
                            <div className="card-heading">
                              <span>Gold Opening Weight</span>
                              <span className="metal-badge metal-badge-gold">Au (Grams)</span>
                            </div>
                            <div className="card-inputs-row">
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Physical Weight (g)</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  placeholder="0.000"
                                  value={selectedCustomer.opening_gold_weight ?? 0}
                                  onChange={(e) => {
                                    const wt = parseFloat(e.target.value) || 0;
                                    const rate = selectedCustomer.opening_gold_rate || 0;
                                    setSelectedCustomer({
                                      ...selectedCustomer,
                                      opening_gold_weight: wt,
                                      opening_gold_value: rate > 0 ? Number((wt * rate).toFixed(2)) : selectedCustomer.opening_gold_value || 0,
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Direction</label>
                                <select
                                  value={selectedCustomer.opening_gold_type || 'DEBIT'}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_gold_type: e.target.value as any })}
                                >
                                  <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                                  <option value="CREDIT">Jama / Cr (Deposited - जमा)</option>
                                </select>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Purity / Karat</label>
                                <select
                                  value={selectedCustomer.opening_gold_purity_id || ''}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_gold_purity_id: e.target.value })}
                                >
                                  <option value="">Select Karat</option>
                                  {purities
                                    .filter((p) => p.code.includes('K') || (metals.find((m) => m.id === p.metal_id)?.code === 'GOLD'))
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.code})
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Rate (₹/g)</label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="₹/g"
                                  value={selectedCustomer.opening_gold_rate ?? 0}
                                  onChange={(e) => {
                                    const rate = parseFloat(e.target.value) || 0;
                                    const wt = selectedCustomer.opening_gold_weight || 0;
                                    setSelectedCustomer({
                                      ...selectedCustomer,
                                      opening_gold_rate: rate,
                                      opening_gold_value: Number((wt * rate).toFixed(2)),
                                    });
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'var(--bg-app)', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                              <span style={{ color: '#9da4b3' }}>Rupee Valuation:</span>
                              <strong style={{ color: '#dfb742', fontFamily: 'monospace' }}>
                                ₹{Number(selectedCustomer.opening_gold_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          </div>

                          {/* 4. Silver Opening Balance */}
                          <div className="opening-ledger-card card-silver">
                            <div className="card-heading">
                              <span>Silver Opening Weight</span>
                              <span className="metal-badge metal-badge-silver">Ag (Grams)</span>
                            </div>
                            <div className="card-inputs-row">
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Physical Weight (g)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={selectedCustomer.opening_silver_weight ?? 0}
                                  onChange={(e) => {
                                    const wt = parseFloat(e.target.value) || 0;
                                    const rate = selectedCustomer.opening_silver_rate || 0;
                                    setSelectedCustomer({
                                      ...selectedCustomer,
                                      opening_silver_weight: wt,
                                      opening_silver_value: rate > 0 ? Number((wt * rate).toFixed(2)) : selectedCustomer.opening_silver_value || 0,
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Direction</label>
                                <select
                                  value={selectedCustomer.opening_silver_type || 'DEBIT'}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_silver_type: e.target.value as any })}
                                >
                                  <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                                  <option value="CREDIT">Jama / Cr (Deposited - जमा)</option>
                                </select>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Purity</label>
                                <select
                                  value={selectedCustomer.opening_silver_purity_id || ''}
                                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, opening_silver_purity_id: e.target.value })}
                                >
                                  <option value="">Select Purity</option>
                                  {purities
                                    .filter((p) => p.code.includes('999') || p.code.includes('925') || (metals.find((m) => m.id === p.metal_id)?.code === 'SILVER'))
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.code})
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#9da4b3' }}>Rate (₹/g)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  placeholder="₹/g"
                                  value={selectedCustomer.opening_silver_rate ?? 0}
                                  onChange={(e) => {
                                    const rate = parseFloat(e.target.value) || 0;
                                    const wt = selectedCustomer.opening_silver_weight || 0;
                                    setSelectedCustomer({
                                      ...selectedCustomer,
                                      opening_silver_rate: rate,
                                      opening_silver_value: Number((wt * rate).toFixed(2)),
                                    });
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'var(--bg-app)', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                              <span style={{ color: '#9da4b3' }}>Rupee Valuation:</span>
                              <strong style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                                ₹{Number(selectedCustomer.opening_silver_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Summary pills */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-subtle)' }}>
                          <div className="summary-pill">
                            <span style={{ color: '#9da4b3' }}>Net Currency:</span>
                            <strong style={{ color: '#d4af37' }}>
                              ₹{Math.abs(
                                ((selectedCustomer.opening_cash_type === 'DEBIT' ? 1 : -1) * (selectedCustomer.opening_cash_balance || 0)) +
                                ((selectedCustomer.opening_bank_type === 'DEBIT' ? 1 : -1) * (selectedCustomer.opening_bank_balance || 0))
                              ).toFixed(2)}
                              {(((selectedCustomer.opening_cash_type === 'DEBIT' ? 1 : -1) * (selectedCustomer.opening_cash_balance || 0)) +
                                ((selectedCustomer.opening_bank_type === 'DEBIT' ? 1 : -1) * (selectedCustomer.opening_bank_balance || 0))) >= 0
                                ? ' (Dr / Customer Owes Us)'
                                : ' (Cr / We Owe Customer)'}
                            </strong>
                          </div>
                          {Boolean(selectedCustomer.opening_gold_weight && selectedCustomer.opening_gold_weight > 0) && (
                            <div className="summary-pill">
                              <span style={{ color: '#9da4b3' }}>Gold Opening:</span>
                              <span className="metal-badge metal-badge-gold">
                                {selectedCustomer.opening_gold_weight}g ({selectedCustomer.opening_gold_type})
                              </span>
                            </div>
                          )}
                          {Boolean(selectedCustomer.opening_silver_weight && selectedCustomer.opening_silver_weight > 0) && (
                            <div className="summary-pill">
                              <span style={{ color: '#9da4b3' }}>Silver Opening:</span>
                              <span className="metal-badge metal-badge-silver">
                                {selectedCustomer.opening_silver_weight}g ({selectedCustomer.opening_silver_type})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* In Edit Mode: Display opening balance note */
                      <div className="form-field col-span-2">
                        <label>Opening Balance (Recorded on Creation)</label>
                        <div className="text-muted" style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'var(--bg-app)', borderRadius: '6px' }}>
                          Opening balance was posted to the ledger upon initial customer creation. To record new transactions or adjust balances, use the Customer Ledger page.
                        </div>
                      </div>
                    )}

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
