import React, { useState, useEffect, useCallback } from 'react';
import { Product, Category, Metal, MetalPurity } from '../../types';
import { productApi, categoryApi, rateApi } from '../../services/masters';
import {
  Gem,
  Plus,
  Search,
  Eye,
  Edit2,
  Power,
  X,
  RefreshCw,
} from 'lucide-react';
import '../../styles/masters.css';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [metalFilter, setMetalFilter] = useState('ALL');
  const [purityFilter, setPurityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedProduct, setSelectedProduct] = useState<Partial<Product>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load categories and metals for dropdowns
  useEffect(() => {
    categoryApi.getAll(true).then(setCategories).catch(console.error);
    rateApi.getMetals().then(setMetals).catch(console.error);
    rateApi.getAllPurities().then(setPurities).catch(console.error);
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await productApi.list({
        page,
        pageSize,
        search,
        category_id: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        metal: metalFilter !== 'ALL' ? metalFilter : undefined,
        purity: purityFilter !== 'ALL' ? purityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setProducts(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, categoryFilter, metalFilter, purityFilter, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setSelectedProduct({
      category_id: categories.length > 0 ? categories[0].id : '',
      default_metal: 'GOLD',
      default_purity: '22K',
      default_unit: 'g',
      is_active: 1,
    });
    setFormError(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct({ ...product });
    setFormError(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleOpenView = (product: Product) => {
    setSelectedProduct(product);
    setModalMode('view');
    setShowModal(true);
  };

  const handleToggleStatus = async (product: Product) => {
    const nextStatus = product.is_active === 1 ? 0 : 1;
    const confirmMsg = nextStatus === 0
      ? `Deactivate product definition '${product.name}'?`
      : `Re-activate product definition '${product.name}'?`;

    if (window.confirm(confirmMsg)) {
      try {
        await productApi.toggleActive(product.id, nextStatus);
        fetchProducts();
      } catch (err: any) {
        alert(err.message || 'Failed to update product status');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (modalMode === 'create') {
        await productApi.create(selectedProduct);
      } else if (modalMode === 'edit' && selectedProduct.id) {
        await productApi.update(selectedProduct.id, selectedProduct);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="master-page-container">
      {/* Header */}
      <div className="master-header">
        <div className="master-title-group">
          <h2>Product Definitions</h2>
          <p>Product templates and designs (Stock tag numbers and weights are tracked separately in Inventory)</p>
        </div>
        <div className="master-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchProducts()}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="master-filter-bar">
        <div className="search-box">
          <Search size={15} className="text-muted" />
          <input
            type="text"
            placeholder="Search by product name, code..."
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
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={metalFilter}
            onChange={(e) => {
              setMetalFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Metals</option>
            {metals.map((m) => (
              <option key={m.id} value={m.code}>{m.name}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={purityFilter}
            onChange={(e) => {
              setPurityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Purities</option>
            {purities.map((p) => (
              <option key={p.id} value={p.code}>{p.metal_code} {p.code}</option>
            ))}
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

      {/* Products Table */}
      <div className="master-table-card">
        <div className="master-table-responsive">
          <table className="master-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Default Metal</th>
                <th>Purity</th>
                <th>HSN</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty-state">
                      <Gem size={32} className="text-gold" />
                      <span>No product definitions found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td className="master-code">{p.product_code}</td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>
                      <span className="badge badge-gold">{p.category_name || '—'}</span>
                    </td>
                    <td>
                      {p.default_metal ? (
                        <span className={`metal-pill ${p.default_metal.toLowerCase() === 'gold' ? 'gold' : p.default_metal.toLowerCase() === 'silver' ? 'silver' : p.default_metal.toLowerCase() === 'platinum' ? 'platinum' : 'other'}`}>
                          {p.default_metal}
                        </span>
                      ) : (
                        <span className="text-muted-cell">—</span>
                      )}
                    </td>
                    <td>{p.default_purity || <span className="text-muted-cell">—</span>}</td>
                    <td className="font-mono">{p.hsn_code || <span className="text-muted-cell">—</span>}</td>
                    <td>
                      {p.is_active === 1 ? (
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
                          onClick={() => handleOpenView(p)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit"
                          onClick={() => handleOpenEdit(p)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className={`btn-icon ${p.is_active === 1 ? 'danger' : ''}`}
                          title={p.is_active === 1 ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(p)}
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
            Showing {products.length} of {total} products (Page {page} of {totalPages})
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
                {modalMode === 'create' && 'Create Product Definition'}
                {modalMode === 'edit' && `Edit Product (${selectedProduct.product_code})`}
                {modalMode === 'view' && `Product Details: ${selectedProduct.name}`}
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
                    <label>Product Code</label>
                    <div className="font-mono text-gold">{selectedProduct.product_code}</div>
                  </div>
                  <div className="form-field">
                    <label>Category</label>
                    <div><span className="badge badge-gold">{selectedProduct.category_name}</span></div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Product Name</label>
                    <div className="text-lg font-semibold">{selectedProduct.name}</div>
                  </div>
                  <div className="form-field">
                    <label>Default Metal</label>
                    <div>{selectedProduct.default_metal || '—'}</div>
                  </div>
                  <div className="form-field">
                    <label>Default Purity</label>
                    <div>{selectedProduct.default_purity || '—'}</div>
                  </div>
                  <div className="form-field">
                    <label>Unit of Measure</label>
                    <div className="font-mono">{selectedProduct.default_unit || 'g'}</div>
                  </div>
                  <div className="form-field">
                    <label>HSN Code</label>
                    <div className="font-mono">{selectedProduct.hsn_code || '—'}</div>
                  </div>
                  <div className="form-field col-span-2">
                    <label>Description / Design Notes</label>
                    <div className="text-muted">{selectedProduct.description || 'No description added'}</div>
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
                    Edit Product
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <div className="modal-body">
                  {formError && <div className="form-error-alert">{formError}</div>}

                  <div className="modal-form-grid">
                    <div className="form-field col-span-2">
                      <label>Product Name *</label>
                      <input
                        type="text"
                        required
                        value={selectedProduct.name || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                        placeholder="e.g. Traditional Temple Ring"
                        autoFocus
                      />
                    </div>

                    <div className="form-field">
                      <label>Category *</label>
                      <select
                        required
                        value={selectedProduct.category_id || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, category_id: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Product Code (Optional)</label>
                      <input
                        type="text"
                        value={selectedProduct.product_code || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, product_code: e.target.value })}
                        placeholder="Auto-generated if empty"
                      />
                    </div>

                    <div className="form-field">
                      <label>Default Metal</label>
                      <select
                        value={selectedProduct.default_metal || 'GOLD'}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, default_metal: e.target.value })}
                      >
                        {metals.map((m) => (
                          <option key={m.id} value={m.code}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Default Purity</label>
                      <select
                        value={selectedProduct.default_purity || '22K'}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, default_purity: e.target.value })}
                      >
                        <option value="24K">24K (99.9%)</option>
                        <option value="22K">22K (91.6%)</option>
                        <option value="18K">18K (75.0%)</option>
                        <option value="14K">14K (58.5%)</option>
                        <option value="999">Silver 999</option>
                        <option value="925">Silver 925</option>
                        <option value="950">Platinum 950</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Default Unit</label>
                      <input
                        type="text"
                        value={selectedProduct.default_unit || 'g'}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, default_unit: e.target.value })}
                        placeholder="g, carat, pcs"
                      />
                    </div>

                    <div className="form-field">
                      <label>HSN / Tax Code</label>
                      <input
                        type="text"
                        value={selectedProduct.hsn_code || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, hsn_code: e.target.value })}
                        placeholder="e.g. 7113"
                      />
                    </div>

                    <div className="form-field col-span-2">
                      <label>Description & Design Specifications</label>
                      <textarea
                        rows={2}
                        value={selectedProduct.description || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                        placeholder="Style, finish, motif details..."
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
                    {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Product' : 'Save Changes'}
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
