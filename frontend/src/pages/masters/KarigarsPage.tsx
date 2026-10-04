import React, { useState, useEffect, useCallback } from 'react';
import { Karigar } from '../../types';
import { karigarApi } from '../../services/masters';
import {
  Hammer,
  Plus,
  Search,
  Eye,
  Edit2,
  Power,
  X,
  RefreshCw,
  Phone,
  MapPin,
} from 'lucide-react';
import '../../styles/masters.css';

export const KarigarsPage: React.FC = () => {
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedKarigar, setSelectedKarigar] = useState<Partial<Karigar>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchKarigars = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await karigarApi.list({
        page,
        pageSize,
        search,
        specialization: specializationFilter !== 'ALL' ? specializationFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setKarigars(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load karigars:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, specializationFilter, statusFilter]);

  useEffect(() => {
    fetchKarigars();
  }, [fetchKarigars]);

  const handleOpenCreate = () => {
    setSelectedKarigar({
      specialization: 'GOLD',
      is_active: 1,
    });
    setFormError(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenEdit = (karigar: Karigar) => {
    setSelectedKarigar({ ...karigar });
    setFormError(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleOpenView = (karigar: Karigar) => {
    setSelectedKarigar(karigar);
    setModalMode('view');
    setShowModal(true);
  };

  const handleToggleStatus = async (karigar: Karigar) => {
    const nextStatus = karigar.is_active === 1 ? 0 : 1;
    const confirmMsg = nextStatus === 0
      ? `Deactivate artisan '${karigar.name}'?`
      : `Re-activate artisan '${karigar.name}'?`;

    if (window.confirm(confirmMsg)) {
      try {
        await karigarApi.toggleActive(karigar.id, nextStatus);
        fetchKarigars();
      } catch (err: any) {
        alert(err.message || 'Failed to update karigar status');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (modalMode === 'create') {
        await karigarApi.create(selectedKarigar);
      } else if (modalMode === 'edit' && selectedKarigar.id) {
        await karigarApi.update(selectedKarigar.id, selectedKarigar);
      }
      setShowModal(false);
      fetchKarigars();
    } catch (err: any) {
      setFormError(err.message || 'Error saving karigar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="master-page-container">
      {/* Header */}
      <div className="master-header">
        <div className="master-title-group">
          <h2>Workshop Karigars</h2>
          <p>Artisans, goldsmiths, diamond setters, and polishers for custom orders and repairs</p>
        </div>
        <div className="master-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchKarigars()}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} />
            <span>Add Karigar</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="master-filter-bar">
        <div className="search-box">
          <Search size={15} className="text-muted" />
          <input
            type="text"
            placeholder="Search by karigar name, phone, code..."
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
            value={specializationFilter}
            onChange={(e) => {
              setSpecializationFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Specializations</option>
            <option value="GOLD">Gold Crafting</option>
            <option value="SILVER">Silver Articles</option>
            <option value="DIAMOND">Diamond Setting</option>
            <option value="POLISHING">Polishing & Finishing</option>
            <option value="SETTING">Stone / Jadau Setting</option>
            <option value="REPAIR">Sizing & Repairs</option>
            <option value="OTHER">Other Crafts</option>
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

      {/* Karigars Table */}
      <div className="master-table-card">
        <div className="master-table-responsive">
          <table className="master-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Artisan Name</th>
                <th>Phone</th>
                <th>Specialization</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {karigars.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="table-empty-state">
                      <Hammer size={32} className="text-gold" />
                      <span>No karigars found matching the criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                karigars.map((k) => (
                  <tr key={k.id}>
                    <td className="master-code">{k.karigar_code}</td>
                    <td>
                      <strong>{k.name}</strong>
                    </td>
                    <td>{k.phone || <span className="text-muted-cell">—</span>}</td>
                    <td>
                      <span className="badge badge-gold">{k.specialization}</span>
                    </td>
                    <td>
                      {k.is_active === 1 ? (
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
                          onClick={() => handleOpenView(k)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit"
                          onClick={() => handleOpenEdit(k)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className={`btn-icon ${k.is_active === 1 ? 'danger' : ''}`}
                          title={k.is_active === 1 ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(k)}
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
            Showing {karigars.length} of {total} records (Page {page} of {totalPages})
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
                {modalMode === 'create' && 'Register New Karigar'}
                {modalMode === 'edit' && `Edit Karigar (${selectedKarigar.karigar_code})`}
                {modalMode === 'view' && `Artisan Profile: ${selectedKarigar.name}`}
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
                    <label>Karigar Code</label>
                    <div className="font-mono text-gold">{selectedKarigar.karigar_code}</div>
                  </div>
                  <div className="form-field">
                    <label>Specialization</label>
                    <div><span className="badge badge-gold">{selectedKarigar.specialization}</span></div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Artisan Name</label>
                    <div className="text-lg font-semibold">{selectedKarigar.name}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Phone</label>
                    <div className="flex items-center gap-1"><Phone size={13} /> {selectedKarigar.phone || '—'}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Workshop / Residence Address</label>
                    <div className="flex items-center gap-1"><MapPin size={13} /> {selectedKarigar.address || '—'}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Notes & Craft Skill</label>
                    <div className="text-muted">{selectedKarigar.notes || 'No notes added'}</div>
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
                    Edit Karigar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <div className="modal-body">
                  {formError && <div className="form-error-alert">{formError}</div>}

                  <div className="modal-form-grid">
                    <div className="form-field col-span-2">
                      <label>Artisan Name *</label>
                      <input
                        type="text"
                        required
                        value={selectedKarigar.name || ''}
                        onChange={(e) => setSelectedKarigar({ ...selectedKarigar, name: e.target.value })}
                        placeholder="e.g. Shyamal Da"
                        autoFocus
                      />
                    </div>

                    <div className="form-field">
                      <label>Specialization</label>
                      <select
                        value={selectedKarigar.specialization || 'GOLD'}
                        onChange={(e) => setSelectedKarigar({ ...selectedKarigar, specialization: e.target.value as any })}
                      >
                        <option value="GOLD">Gold Crafting</option>
                        <option value="SILVER">Silver Articles</option>
                        <option value="DIAMOND">Diamond Setting</option>
                        <option value="POLISHING">Polishing & Finishing</option>
                        <option value="SETTING">Stone Setting</option>
                        <option value="REPAIR">Repairs & Sizing</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Karigar Code (Optional)</label>
                      <input
                        type="text"
                        value={selectedKarigar.karigar_code || ''}
                        onChange={(e) => setSelectedKarigar({ ...selectedKarigar, karigar_code: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Phone Number</label>
                      <input
                        type="text"
                        value={selectedKarigar.phone || ''}
                        onChange={(e) => setSelectedKarigar({ ...selectedKarigar, phone: e.target.value })}
                        placeholder="Mobile number"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Workshop / Residence Address</label>
                      <input
                        type="text"
                        value={selectedKarigar.address || ''}
                        onChange={(e) => setSelectedKarigar({ ...selectedKarigar, address: e.target.value })}
                        placeholder="Locality or workshop unit"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Notes / Craft Experience</label>
                      <textarea
                        rows={2}
                        value={selectedKarigar.notes || ''}
                        onChange={(e) => setSelectedKarigar({ ...selectedKarigar, notes: e.target.value })}
                        placeholder="Speciality, wastage tolerance agreement..."
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
                    {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Karigar' : 'Save Changes'}
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
