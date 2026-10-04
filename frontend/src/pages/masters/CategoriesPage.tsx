import React, { useState, useEffect, useCallback } from 'react';
import { Category } from '../../types';
import { categoryApi } from '../../services/masters';
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Power,
  X,
  RefreshCw,
} from 'lucide-react';
import '../../styles/masters.css';

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<Partial<Category>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await categoryApi.list({
        page,
        pageSize,
        search,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setCategories(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenCreate = () => {
    setSelectedCategory({ is_active: 1 });
    setFormError(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenEdit = (category: Category) => {
    setSelectedCategory({ ...category });
    setFormError(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleToggleStatus = async (category: Category) => {
    const nextStatus = category.is_active === 1 ? 0 : 1;
    const confirmMsg = nextStatus === 0
      ? `Deactivate category '${category.name}'?`
      : `Re-activate category '${category.name}'?`;

    if (window.confirm(confirmMsg)) {
      try {
        await categoryApi.toggleActive(category.id, nextStatus);
        fetchCategories();
      } catch (err: any) {
        alert(err.message || 'Failed to update category status');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (modalMode === 'create') {
        await categoryApi.create(selectedCategory);
      } else if (modalMode === 'edit' && selectedCategory.id) {
        await categoryApi.update(selectedCategory.id, selectedCategory);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      setFormError(err.message || 'Error saving category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="master-page-container">
      {/* Header */}
      <div className="master-header">
        <div className="master-title-group">
          <h2>Jewellery Categories</h2>
          <p>Classification catalogue (Rings, Bangles, Necklaces, Chains, Coins, etc.)</p>
        </div>
        <div className="master-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchCategories()}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="master-filter-bar">
        <div className="search-box">
          <Search size={15} className="text-muted" />
          <input
            type="text"
            placeholder="Search by category name, code..."
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

      {/* Categories Table */}
      <div className="master-table-card">
        <div className="master-table-responsive">
          <table className="master-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Category Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="table-empty-state">
                      <Boxes size={32} className="text-gold" />
                      <span>No categories found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td className="master-code">{c.code}</td>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.description || <span className="text-muted-cell">—</span>}</td>
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
                          title="Edit Category"
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
            Showing {categories.length} of {total} categories (Page {page} of {totalPages})
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
              <h3>{modalMode === 'create' ? 'Add New Category' : `Edit Category (${selectedCategory.code})`}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && <div className="form-error-alert">{formError}</div>}

                <div className="modal-form-grid">
                  <div className="form-field">
                    <label>Category Code *</label>
                    <input
                      type="text"
                      required
                      value={selectedCategory.code || ''}
                      onChange={(e) => setSelectedCategory({ ...selectedCategory, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. RNG, BNG"
                      autoFocus
                    />
                  </div>

                  <div className="form-field">
                    <label>Category Name *</label>
                    <input
                      type="text"
                      required
                      value={selectedCategory.name || ''}
                      onChange={(e) => setSelectedCategory({ ...selectedCategory, name: e.target.value })}
                      placeholder="e.g. Rings"
                    />
                  </div>

                  <div className="form-field col-span-2">
                    <label>Description</label>
                    <textarea
                      rows={2}
                      value={selectedCategory.description || ''}
                      onChange={(e) => setSelectedCategory({ ...selectedCategory, description: e.target.value })}
                      placeholder="Optional notes or details"
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
                  {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Category' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
