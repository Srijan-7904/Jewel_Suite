import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StockItem,
  StockMovement,
  StockValuationResponse,
  Product,
  Category,
  Metal,
  MetalPurity,
  CurrentRate,
} from '../../types';
import { inventoryApi } from '../../services/inventory';
import { productApi, categoryApi, rateApi } from '../../services/masters';
import {
  Boxes,
  Plus,
  Search,
  Eye,
  RefreshCw,
  X,
  ArrowRightLeft,
  History,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import {
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatPercentage,
  formatCurrency,
  toDecimal,
  parseDecimalInput,
} from '../../utils/precision';
import Decimal from 'decimal.js';
import '../../styles/masters.css';
import './StockPage.css';

// Metal Color & Showcase Styling Helper
export const getMetalTheme = (metalCode?: string) => {
  const code = (metalCode || '').toUpperCase();
  if (code.includes('GOLD') || code.includes('AU')) {
    return {
      type: 'gold' as const,
      label: 'Gold',
      iconText: 'Au',
      accentColor: '#B8860B',
      badgeClass: 'metal-pill gold',
      pillClass: 'tag-pill gold',
      cardClass: 'showcase-card gold',
    };
  }
  if (code.includes('SILVER') || code.includes('AG')) {
    return {
      type: 'silver' as const,
      label: 'Silver',
      iconText: 'Ag',
      accentColor: '#475569',
      badgeClass: 'metal-pill silver',
      pillClass: 'tag-pill silver',
      cardClass: 'showcase-card silver',
    };
  }
  if (code.includes('PLATINUM') || code.includes('PT')) {
    return {
      type: 'platinum' as const,
      label: 'Platinum',
      iconText: 'Pt',
      accentColor: '#4338CA',
      badgeClass: 'metal-pill platinum',
      pillClass: 'tag-pill platinum',
      cardClass: 'showcase-card platinum',
    };
  }
  if (code.includes('DIAMOND') || code.includes('GEM')) {
    return {
      type: 'diamond' as const,
      label: 'Diamond',
      iconText: 'Dia',
      accentColor: '#0F766E',
      badgeClass: 'metal-pill diamond',
      pillClass: 'tag-pill diamond',
      cardClass: 'showcase-card diamond',
    };
  }
  return {
    type: 'other' as const,
    label: metalCode || 'Metal',
    iconText: 'Mt',
    accentColor: '#C2410C',
    badgeClass: 'metal-pill other',
    pillClass: 'tag-pill other',
    cardClass: 'showcase-card other',
  };
};

export const StockPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'showcase' | 'table'>('showcase');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [valuation, setValuation] = useState<StockValuationResponse | null>(null);

  // Reference Masters for Dropdowns
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [currentRates, setCurrentRates] = useState<CurrentRate[]>([]);

  // Filtering & Pagination
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [metalFilter, setMetalFilter] = useState('ALL');
  const [purityFilter, setPurityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [itemMovements, setItemMovements] = useState<StockMovement[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Stock Form State
  const [addForm, setAddForm] = useState({
    tag_no: '',
    product_id: '',
    metal_id: '',
    purity_id: '',
    gross_weight: '',
    less_weight: '0',
    tunch_percent: '',
    wastage_percent: '0',
    making_charge: '0',
    making_charge_type: 'FIXED' as 'FIXED' | 'PER_PIECE' | 'PER_GRAM' | 'PERCENTAGE',
    making_rate: '0',
    rate_per_gram: '',
    huid: '',
    notes: '',
  });

  // Status Change Modal State
  const [targetStatus, setTargetStatus] = useState<string>('REPAIR');
  const [statusNotes, setStatusNotes] = useState<string>('');

  // Initial Data Fetch
  useEffect(() => {
    productApi.list({ pageSize: 100 }).then((res) => setProducts(res.items)).catch(console.error);
    categoryApi.getAll(true).then(setCategories).catch(console.error);
    rateApi.getMetals().then(setMetals).catch(console.error);
    rateApi.getAllPurities().then(setPurities).catch(console.error);
    rateApi.getCurrentRates().then(setCurrentRates).catch(console.error);
  }, []);

  // Fetch Stock Items & Valuation
  const fetchStockData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listRes, valRes] = await Promise.all([
        inventoryApi.list({
          page,
          pageSize,
          search,
          category_id: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          metal: metalFilter !== 'ALL' ? metalFilter : undefined,
          purity: purityFilter !== 'ALL' ? purityFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        }),
        inventoryApi.getValuation(),
      ]);

      setStockItems(listRes.items);
      setTotal(listRes.total);
      setTotalPages(listRes.totalPages);
      setValuation(valRes);
    } catch (err: any) {
      console.error('Failed to load inventory stock:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, categoryFilter, metalFilter, purityFilter, statusFilter]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Filter purities by selected metal in add form
  const availablePurities = useMemo(() => {
    if (!addForm.metal_id) return [];
    return purities.filter((p) => p.metal_id === addForm.metal_id);
  }, [purities, addForm.metal_id]);

  // Real-time Jewellery Calculations for Add Stock
  const liveCalculations = useMemo(() => {
    try {
      const grossD = toDecimal(addForm.gross_weight);
      const lessD = toDecimal(addForm.less_weight);
      const tunchD = toDecimal(addForm.tunch_percent);
      const rateD = toDecimal(addForm.rate_per_gram);

      const netD = grossD.gt(lessD) ? grossD.minus(lessD) : new Decimal(0);
      const fineD = netD.mul(tunchD).div(100);
      const metalValD = fineD.mul(rateD);

      return {
        net: netD.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
        fine: fineD.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
        metalVal: metalValD.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      };
    } catch {
      return { net: 0, fine: 0, metalVal: 0 };
    }
  }, [addForm.gross_weight, addForm.less_weight, addForm.tunch_percent, addForm.rate_per_gram]);

  // Handle Product Select in Add Form (Auto-fills defaults)
  const handleProductChange = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    let targetMetalId = addForm.metal_id;
    if (prod.default_metal) {
      const m = metals.find((met) => met.code === prod.default_metal);
      if (m) targetMetalId = m.id;
    }

    let targetPurityId = addForm.purity_id;
    let tunch = addForm.tunch_percent;
    let rate = addForm.rate_per_gram;

    if (targetMetalId && prod.default_purity) {
      const p = purities.find((pur) => pur.metal_id === targetMetalId && pur.code === prod.default_purity);
      if (p) {
        targetPurityId = p.id;
        if (p.tunch_percent !== null) tunch = p.tunch_percent.toString();

        const cr = currentRates.find((r) => r.metal_id === targetMetalId && r.purity_id === p.id);
        if (cr) rate = cr.rate.toString();
      }
    }

    setAddForm((prev) => ({
      ...prev,
      product_id: productId,
      metal_id: targetMetalId,
      purity_id: targetPurityId,
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Handle Metal Change
  const handleMetalChange = (metalId: string) => {
    const pList = purities.filter((p) => p.metal_id === metalId);
    const defaultP = pList.length > 0 ? pList[0] : null;

    let tunch = '';
    let rate = '';
    if (defaultP) {
      if (defaultP.tunch_percent !== null) tunch = defaultP.tunch_percent.toString();
      const cr = currentRates.find((r) => r.metal_id === metalId && r.purity_id === defaultP.id);
      if (cr) rate = cr.rate.toString();
    }

    setAddForm((prev) => ({
      ...prev,
      metal_id: metalId,
      purity_id: defaultP ? defaultP.id : '',
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Handle Purity Change
  const handlePurityChange = (purityId: string) => {
    const p = purities.find((pur) => pur.id === purityId);
    let tunch = addForm.tunch_percent;
    let rate = addForm.rate_per_gram;

    if (p) {
      if (p.tunch_percent !== null) tunch = p.tunch_percent.toString();
      const cr = currentRates.find((r) => r.metal_id === p.metal_id && r.purity_id === p.id);
      if (cr) rate = cr.rate.toString();
    }

    setAddForm((prev) => ({
      ...prev,
      purity_id: purityId,
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    const firstProd = products[0];
    const firstMetal = metals.find((m) => m.code === 'GOLD') || metals[0];
    const defaultPurity = firstMetal
      ? purities.find((p) => p.metal_id === firstMetal.id && p.code === '22K') || purities.find((p) => p.metal_id === firstMetal.id)
      : null;

    let defaultRate = '';
    if (firstMetal && defaultPurity) {
      const cr = currentRates.find((r) => r.metal_id === firstMetal.id && r.purity_id === defaultPurity.id);
      if (cr) defaultRate = cr.rate.toString();
    }

    // Auto-generate tag suggestion (e.g. TAG-XXXX)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const suggestedTag = `TAG-G${randomSuffix}`;

    setAddForm({
      tag_no: suggestedTag,
      product_id: firstProd ? firstProd.id : '',
      metal_id: firstMetal ? firstMetal.id : '',
      purity_id: defaultPurity ? defaultPurity.id : '',
      gross_weight: '',
      less_weight: '0',
      tunch_percent: defaultPurity && defaultPurity.tunch_percent !== null ? defaultPurity.tunch_percent.toString() : '91.67',
      wastage_percent: '0',
      making_charge: '0',
      making_charge_type: 'FIXED',
      making_rate: '0',
      rate_per_gram: defaultRate,
      huid: '',
      notes: '',
    });

    setFormError(null);
    setShowAddModal(true);
  };

  const handleMakingChange = (rateStr: string, type: 'FIXED' | 'PER_PIECE' | 'PER_GRAM' | 'PERCENTAGE') => {
    const rateDec = toDecimal(rateStr);
    const gross = toDecimal(addForm.gross_weight);
    const less = toDecimal(addForm.less_weight);
    const net = Decimal.max(0, gross.minus(less));
    const tunch = toDecimal(addForm.tunch_percent);
    const rate = toDecimal(addForm.rate_per_gram);
    const fine = net.times(tunch).dividedBy(100);
    const metalVal = fine.times(rate);

    let calculatedMaking = rateDec;
    if (type === 'PER_GRAM') {
      calculatedMaking = net.times(rateDec);
    } else if (type === 'PERCENTAGE') {
      calculatedMaking = metalVal.times(rateDec).dividedBy(100);
    } else if (type === 'PER_PIECE' || type === 'FIXED') {
      calculatedMaking = rateDec;
    }

    setAddForm((prev) => ({
      ...prev,
      making_charge_type: type,
      making_rate: rateStr,
      making_charge: calculatedMaking.toDecimalPlaces(2).toString(),
    }));
  };

  // Submit Add Stock
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const grossD = toDecimal(addForm.gross_weight);
      const lessD = toDecimal(addForm.less_weight);
      const tunchD = toDecimal(addForm.tunch_percent);
      const rateD = toDecimal(addForm.rate_per_gram);

      if (!addForm.tag_no.trim()) {
        throw new Error('Tag number is required');
      }
      if (!addForm.product_id) {
        throw new Error('Please select a product');
      }
      if (grossD.lte(0)) {
        throw new Error('Gross weight must be greater than zero');
      }
      if (lessD.lt(0) || lessD.gt(grossD)) {
        throw new Error('Less weight cannot exceed gross weight');
      }
      if (tunchD.lt(0) || tunchD.gt(100)) {
        throw new Error('Tunch % must be between 0 and 100');
      }

      await inventoryApi.create({
        tag_no: addForm.tag_no.trim().toUpperCase(),
        product_id: addForm.product_id,
        metal_id: addForm.metal_id,
        purity_id: addForm.purity_id,
        gross_weight: grossD.toNumber(),
        less_weight: lessD.toNumber(),
        tunch_percent: tunchD.toNumber(),
        wastage_percent: toDecimal(addForm.wastage_percent).toNumber(),
        making_charge: toDecimal(addForm.making_charge).toNumber(),
        rate_per_gram: rateD.toNumber(),
        huid: addForm.huid.trim() || undefined,
        notes: addForm.notes.trim() || undefined,
        acquisition_type: 'OPENING_STOCK',
      });

      setShowAddModal(false);
      await fetchStockData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add stock item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Details Modal
  const handleOpenDetail = async (item: StockItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
    try {
      const movements = await inventoryApi.getMovements(item.id);
      setItemMovements(movements);
    } catch (err) {
      console.error('Failed to load item movements:', err);
    }
  };

  // Open Status Change Modal
  const handleOpenStatus = (item: StockItem) => {
    setSelectedItem(item);
    let defaultNext = 'REPAIR';
    if (item.status === 'REPAIR' || item.status === 'WITH_KARIGAR' || item.status === 'RESERVED') {
      defaultNext = 'IN_STOCK';
    } else if (item.status === 'IN_STOCK') {
      defaultNext = 'WITH_KARIGAR';
    }
    setTargetStatus(defaultNext);
    setStatusNotes('');
    setFormError(null);
    setShowStatusModal(true);
  };

  // Submit Status Change
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await inventoryApi.changeStatus(selectedItem.id, {
        to_status: targetStatus,
        notes: statusNotes.trim() || undefined,
      });

      setShowStatusModal(false);
      await fetchStockData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update stock status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stock-page">
      {/* Real-Time Stock Valuation Banner */}
      <div className="stock-valuation-banner">
        <div className="valuation-header">
          <div className="valuation-title-group">
            <Boxes className="text-gold" size={22} />
            <span className="valuation-title font-serif">JEWELLERY INVENTORY & VALUATION</span>
            <span className="valuation-badge">LIVE DATABASE ENGINE</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1"
            onClick={fetchStockData}
            title="Refresh Stock Valuation"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="valuation-grid">
          <div className="valuation-metric">
            <span className="valuation-label">Total Stock Valuation</span>
            <span className="valuation-val emerald font-mono">
              ₹{valuation ? valuation.total_current_valuation.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
            <span className="valuation-sub font-mono">
              Acquisition Value: ₹{valuation ? valuation.total_acquisition_value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>

          <div className="valuation-metric">
            <span className="valuation-label">Total Stock Items</span>
            <span className="valuation-val font-mono">{valuation?.total_items || 0}</span>
            <span className="valuation-sub">Physical Tagged Items</span>
          </div>

          <div className="valuation-metric">
            <span className="valuation-label">Total Gross Weight</span>
            <span className="valuation-val font-mono">
              {formatWeight(valuation?.total_gross_weight)} <span className="text-sm font-normal">g</span>
            </span>
            <span className="valuation-sub font-mono">Net Wt: {formatWeight(valuation?.total_net_weight)} g</span>
          </div>

          <div className="valuation-metric">
            <span className="valuation-label">Total Fine Bullion Wt</span>
            <span className="valuation-val gold font-mono">
              {formatFineWeight(valuation?.total_fine_weight)} <span className="text-sm font-normal">g</span>
            </span>
            <span className="valuation-sub">Calculated via Tunch %</span>
          </div>
        </div>

        {/* Metal & Purity Breakdown Pills */}
        {valuation && valuation.groups.length > 0 && (
          <div className="valuation-groups">
            {valuation.groups.map((g) => {
              const theme = getMetalTheme(g.metal_code);
              return (
                <div key={`${g.metal_code}_${g.purity_code}`} className={`group-pill ${theme.type} font-mono`}>
                  <span className="group-pill-name">{g.metal_name} {g.purity_code}</span>
                  <span className="group-pill-weight">{g.item_count} pcs • {formatFineWeight(g.fine_weight)}g fine</span>
                  <span className="group-pill-val">{formatCurrency(g.current_valuation)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Metal Showcase Filter Tabs */}
      <div className="showcase-metal-tabs">
        <button
          type="button"
          className={`metal-tab-pill ${metalFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setMetalFilter('ALL');
            setPage(1);
          }}
        >
          <span>All Showcase Items</span>
          <span className="metal-tab-count font-mono">{valuation?.total_items || total}</span>
        </button>
        <button
          type="button"
          className={`metal-tab-pill gold ${metalFilter === 'GOLD' ? 'active' : ''}`}
          onClick={() => {
            setMetalFilter(metalFilter === 'GOLD' ? 'ALL' : 'GOLD');
            setPage(1);
          }}
        >
          <span className="metal-tab-dot gold"></span>
          <span>✦ Gold Showcase</span>
          <span className="metal-tab-count font-mono">
            {valuation?.groups
              ?.filter((g) => g.metal_code === 'GOLD')
              .reduce((acc, curr) => acc + curr.item_count, 0) || 0}
          </span>
        </button>
        <button
          type="button"
          className={`metal-tab-pill silver ${metalFilter === 'SILVER' ? 'active' : ''}`}
          onClick={() => {
            setMetalFilter(metalFilter === 'SILVER' ? 'ALL' : 'SILVER');
            setPage(1);
          }}
        >
          <span className="metal-tab-dot silver"></span>
          <span>◈ Silver Showcase</span>
          <span className="metal-tab-count font-mono">
            {valuation?.groups
              ?.filter((g) => g.metal_code === 'SILVER')
              .reduce((acc, curr) => acc + curr.item_count, 0) || 0}
          </span>
        </button>
        <button
          type="button"
          className={`metal-tab-pill platinum ${metalFilter === 'PLATINUM' ? 'active' : ''}`}
          onClick={() => {
            setMetalFilter(metalFilter === 'PLATINUM' ? 'ALL' : 'PLATINUM');
            setPage(1);
          }}
        >
          <span className="metal-tab-dot platinum"></span>
          <span>❖ Platinum Showcase</span>
          <span className="metal-tab-count font-mono">
            {valuation?.groups
              ?.filter((g) => g.metal_code === 'PLATINUM')
              .reduce((acc, curr) => acc + curr.item_count, 0) || 0}
          </span>
        </button>
      </div>

      {/* Filter and Action Bar */}
      <div className="masters-toolbar mb-4">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Tag No, Product, or HUID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="filter-group">
          {/* Metal Filter */}
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

          {/* Purity Filter */}
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
              <option key={p.id} value={p.code}>{p.metal_code} - {p.name}</option>
            ))}
          </select>

          {/* Category Filter */}
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

          {/* Status Filter */}
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="WITH_KARIGAR">With Karigar</option>
            <option value="REPAIR">In Repair</option>
            <option value="RESERVED">Reserved</option>
            <option value="SOLD">Sold</option>
            <option value="ADJUSTED">Adjusted</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Showcase Cards vs Table */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'showcase' ? 'active' : ''}`}
              onClick={() => setViewMode('showcase')}
              title="Showcase Tray Display Grid"
            >
              <LayoutGrid size={15} />
              <span>Showcase</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Detailed Table View"
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>

          <button type="button" className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Main Stock Content: Showcase View OR Table View */}
      {viewMode === 'showcase' ? (
        <div className="stock-showcase-container mb-4">
          {isLoading ? (
            <div className="table-empty font-mono py-12 text-center">
              Loading jewellery showcase inventory...
            </div>
          ) : stockItems.length === 0 ? (
            <div className="table-empty py-12 text-center">
              <Boxes size={48} className="text-muted mb-3 opacity-40 mx-auto" />
              <p className="text-secondary font-medium">No jewellery stock items found in showcase.</p>
              <p className="text-muted text-xs mt-1">
                Add your first jewellery piece with Tag, Gross, Less, and Tunch to start managing inventory.
              </p>
              <button type="button" className="btn btn-primary btn-sm mt-4" onClick={handleOpenAdd}>
                <Plus size={14} />
                <span>Add First Stock Item</span>
              </button>
            </div>
          ) : (
            <div className="stock-showcase-grid">
              {stockItems.map((item) => {
                const theme = getMetalTheme(item.metal_code);
                return (
                  <div key={item.id} className={`showcase-card ${theme.type}`}>
                    <div className="showcase-header">
                      <div className="showcase-metal-badge-group">
                        <span className={`showcase-metal-icon ${theme.type}`}>
                          {theme.iconText}
                        </span>
                        <span className={`tag-pill ${theme.type}`}>{item.tag_no}</span>
                      </div>
                      <span className={`status-badge ${item.status.toLowerCase()}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="showcase-body">
                      <div className="showcase-title-row">
                        <div>
                          <h4 className="showcase-product-name">{item.product_name}</h4>
                          <span className="showcase-cat-name">{item.category_name}</span>
                        </div>
                        <span className={`metal-pill ${theme.type}`}>
                          {item.metal_code} • {item.purity_code}
                        </span>
                      </div>

                      <div className="showcase-specs-table">
                        <div className="showcase-spec-item">
                          <span className="showcase-spec-label">Gross Wt</span>
                          <span className="showcase-spec-val">{formatWeight(item.gross_weight)}g</span>
                        </div>
                        <div className="showcase-spec-item">
                          <span className="showcase-spec-label">Net Wt</span>
                          <span className="showcase-spec-val">{formatWeight(item.net_weight)}g</span>
                        </div>
                        <div className="showcase-spec-item">
                          <span className="showcase-spec-label">Tunch / Touch</span>
                          <span className="showcase-spec-val font-mono">{formatPercentage(item.tunch_percent)}</span>
                        </div>
                        <div className="showcase-spec-item">
                          <span className="showcase-spec-label">Fine Metal Wt</span>
                          <span className={`showcase-spec-val text-fine-${theme.type}`}>
                            {formatFineWeight(item.fine_weight)}g
                          </span>
                        </div>
                      </div>

                      {item.huid && (
                        <div className="showcase-huid-row font-mono text-xs text-muted">
                          <span>HUID:</span>
                          <span className="font-semibold text-main">{item.huid}</span>
                        </div>
                      )}

                      <div className="showcase-val-row">
                        <span className="showcase-val-label">Live Valuation:</span>
                        <span className="showcase-val-amount font-mono">
                          {formatCurrency(item.current_valuation || item.metal_value)}
                        </span>
                      </div>
                    </div>

                    <div className="showcase-footer">
                      <div className="text-xs text-muted font-mono">
                        @ {formatMetalRate(item.rate_per_gram)}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleOpenDetail(item)}
                          title="View Full Item Details & History"
                        >
                          <Eye size={12} />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleOpenStatus(item)}
                          title="Transfer / Change Stock Status"
                        >
                          <ArrowRightLeft size={12} />
                          <span>Status</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Main Stock Table */
        <div className="masters-table-wrapper">
          <table className="masters-table">
            <thead>
              <tr>
                <th>Tag No</th>
                <th>Product</th>
                <th>Metal & Purity</th>
                <th className="text-right">Gross Wt</th>
                <th className="text-right">Net Wt</th>
                <th className="text-right">Tunch %</th>
                <th className="text-right">Fine Wt</th>
                <th className="text-right">Rate/g</th>
                <th className="text-right">Metal Value</th>
                <th className="text-right">Live Valuation</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="table-empty font-mono">
                    Loading jewellery stock records...
                  </td>
                </tr>
              ) : stockItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="table-empty py-12">
                    <div className="flex flex-col items-center justify-center">
                      <Boxes size={48} className="text-muted mb-3 opacity-40" />
                      <p className="text-secondary font-medium">No jewellery stock items found.</p>
                      <p className="text-muted text-xs mt-1">
                        Add your first jewellery piece with Tag, Gross, Less, and Tunch to start managing inventory.
                      </p>
                      <button type="button" className="btn btn-primary btn-sm mt-4" onClick={handleOpenAdd}>
                        <Plus size={14} />
                        <span>Add First Stock Item</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                stockItems.map((item) => {
                  const theme = getMetalTheme(item.metal_code);
                  return (
                    <tr key={item.id} className={`stock-row metal-${theme.type}`}>
                      <td>
                        <span className={`tag-pill ${theme.type}`}>{item.tag_no}</span>
                        {item.huid && (
                          <div className="text-xs text-muted font-mono mt-0.5">HUID: {item.huid}</div>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-main">{item.product_name}</div>
                        <div className="text-xs text-muted">{item.category_name}</div>
                      </td>
                      <td>
                        <span className={`metal-pill ${theme.type}`}>
                          {item.metal_code} • {item.purity_code}
                        </span>
                      </td>
                      <td className="text-right font-mono font-medium">
                        {formatWeight(item.gross_weight)}g
                      </td>
                      <td className="text-right font-mono">
                        {formatWeight(item.net_weight)}g
                      </td>
                      <td className="text-right font-mono text-muted">
                        {formatPercentage(item.tunch_percent)}
                      </td>
                      <td className={`text-right font-mono font-bold text-fine-${theme.type}`}>
                        {formatFineWeight(item.fine_weight)}g
                      </td>
                      <td className="text-right font-mono text-muted text-xs">
                        {formatMetalRate(item.rate_per_gram)}
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(item.metal_value)}
                      </td>
                      <td className="text-right font-mono font-bold text-emerald">
                        {formatCurrency(item.current_valuation || item.metal_value)}
                      </td>
                      <td className="text-center">
                        <span className={`status-badge ${item.status.toLowerCase()}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            title="View Full Item Details & History"
                            onClick={() => handleOpenDetail(item)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Transfer / Change Stock Status"
                            onClick={() => handleOpenStatus(item)}
                          >
                            <ArrowRightLeft size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="masters-pagination">
          <span className="pagination-info font-mono">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} items
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="pagination-pages font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal 1: Add Stock Item */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Boxes size={20} className="text-gold" />
                <h3 className="modal-title font-serif">Add New Jewellery Item (Opening Stock)</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStock}>
              <div className="modal-body">
                {formError && (
                  <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-grid">
                  {/* Tag Number */}
                  <div className="form-group">
                    <label className="form-label">
                      Tag No <span className="text-gold">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input font-mono font-bold uppercase"
                      required
                      placeholder="e.g. GOLD-R-1025"
                      value={addForm.tag_no}
                      onChange={(e) => setAddForm({ ...addForm, tag_no: e.target.value.toUpperCase() })}
                    />
                  </div>

                  {/* Product Definition */}
                  <div className="form-group">
                    <label className="form-label">
                      Product Definition <span className="text-gold">*</span>
                    </label>
                    <select
                      className="form-select"
                      required
                      value={addForm.product_id}
                      onChange={(e) => handleProductChange(e.target.value)}
                    >
                      <option value="" disabled>Select Product Design</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_code} — {p.name} ({p.category_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Metal */}
                  <div className="form-group">
                    <label className="form-label">
                      Metal <span className="text-gold">*</span>
                    </label>
                    <select
                      className="form-select"
                      required
                      value={addForm.metal_id}
                      onChange={(e) => handleMetalChange(e.target.value)}
                    >
                      {metals.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Purity */}
                  <div className="form-group">
                    <label className="form-label">
                      Purity / Grade <span className="text-gold">*</span>
                    </label>
                    <select
                      className="form-select"
                      required
                      value={addForm.purity_id}
                      onChange={(e) => handlePurityChange(e.target.value)}
                    >
                      {availablePurities.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.tunch_percent ? `${p.tunch_percent}%` : 'Stone/Carat'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Gross Weight */}
                  <div className="form-group">
                    <label className="form-label">
                      Gross Weight (g) <span className="text-gold">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono font-medium"
                      required
                      placeholder="0.000"
                      value={addForm.gross_weight}
                      onChange={(e) => setAddForm({ ...addForm, gross_weight: parseDecimalInput(e.target.value, 3) })}
                    />
                  </div>

                  {/* Less Weight */}
                  <div className="form-group">
                    <label className="form-label">Less Weight / Stones (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      placeholder="0.000"
                      value={addForm.less_weight}
                      onChange={(e) => setAddForm({ ...addForm, less_weight: parseDecimalInput(e.target.value, 3) })}
                    />
                  </div>

                  {/* Tunch % */}
                  <div className="form-group">
                    <label className="form-label">
                      Purity Tunch % <span className="text-gold">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      required
                      placeholder="e.g. 91.67"
                      value={addForm.tunch_percent}
                      onChange={(e) => setAddForm({ ...addForm, tunch_percent: parseDecimalInput(e.target.value, 2) })}
                    />
                  </div>

                  {/* Acquisition Rate per gram */}
                  <div className="form-group">
                    <label className="form-label">Acquisition Rate / gram (₹)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      placeholder="7250.00"
                      value={addForm.rate_per_gram}
                      onChange={(e) => setAddForm({ ...addForm, rate_per_gram: parseDecimalInput(e.target.value, 2) })}
                    />
                  </div>

                  {/* Making Charge */}
                  <div className="form-group">
                    <label className="form-label flex items-center justify-between">
                      <span>Making Charge</span>
                      <span className="text-xs text-gold font-mono">
                        ₹{toDecimal(addForm.making_charge).toFixed(2)}
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        className="form-select font-mono text-xs w-28"
                        value={addForm.making_charge_type}
                        onChange={(e) => handleMakingChange(addForm.making_rate, e.target.value as any)}
                        title="Making Charge Mode: /g (Per Gram), /pc (Per Piece), Fix (Fixed Amount), or % (Percentage)"
                      >
                        <option value="PER_GRAM">/g (Per Gram)</option>
                        <option value="PER_PIECE">/pc (Per Piece)</option>
                        <option value="FIXED">Fix (Fixed)</option>
                        <option value="PERCENTAGE">% (Percent)</option>
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-input font-mono flex-1"
                        placeholder={
                          addForm.making_charge_type === 'PER_PIECE'
                            ? '₹/pc'
                            : addForm.making_charge_type === 'FIXED'
                            ? '₹ Fix'
                            : addForm.making_charge_type === 'PERCENTAGE'
                            ? '%'
                            : '₹/g'
                        }
                        value={addForm.making_rate}
                        onChange={(e) => handleMakingChange(parseDecimalInput(e.target.value, 2), addForm.making_charge_type)}
                      />
                    </div>
                  </div>

                  {/* Wastage % */}
                  <div className="form-group">
                    <label className="form-label">Wastage %</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      placeholder="0.0"
                      value={addForm.wastage_percent}
                      onChange={(e) => setAddForm({ ...addForm, wastage_percent: parseDecimalInput(e.target.value, 2) })}
                    />
                  </div>

                  {/* HUID */}
                  <div className="form-group">
                    <label className="form-label">HUID (Hallmark Unique ID)</label>
                    <input
                      type="text"
                      className="form-input font-mono uppercase"
                      placeholder="e.g. HD9281"
                      value={addForm.huid}
                      onChange={(e) => setAddForm({ ...addForm, huid: e.target.value.toUpperCase() })}
                    />
                  </div>

                  {/* Notes */}
                  <div className="form-group">
                    <label className="form-label">Notes / Description</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 22K CZ Designer Ring"
                      value={addForm.notes}
                      onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Live Auto-Calculated Summary Bar */}
                <div className="calc-preview-bar">
                  <div className="calc-box">
                    <span className="calc-box-label">Calculated Net Weight</span>
                    <span className="calc-box-val net">{formatWeight(liveCalculations.net)} g</span>
                  </div>
                  <div className="calc-box">
                    <span className="calc-box-label">Calculated Fine Weight</span>
                    <span className="calc-box-val fine">{formatFineWeight(liveCalculations.fine)} g</span>
                  </div>
                  <div className="calc-box">
                    <span className="calc-box-label">Calculated Metal Value</span>
                    <span className="calc-box-val value">
                      {formatCurrency(liveCalculations.metalVal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving to Database...' : 'Save Stock Item & Log Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Stock Item Detail & Movement History */}
      {showDetailModal && selectedItem && (
        <div className="modal-backdrop">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <span className={`tag-pill ${getMetalTheme(selectedItem.metal_code).type} font-mono`}>
                  {selectedItem.tag_no}
                </span>
                <h3 className="modal-title font-serif">{selectedItem.product_name}</h3>
                <span className={`status-badge ${selectedItem.status.toLowerCase()}`}>
                  {selectedItem.status.replace('_', ' ')}
                </span>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowDetailModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* 3 Overview Cards */}
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-card-title">Specification</div>
                  <div className="detail-row">
                    <span className="detail-row-label">Category</span>
                    <span className="detail-row-value">{selectedItem.category_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Metal</span>
                    <span className="detail-row-value">{selectedItem.metal_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Purity</span>
                    <span className={`detail-row-value font-bold text-fine-${getMetalTheme(selectedItem.metal_code).type}`}>
                      {selectedItem.purity_name}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">HUID</span>
                    <span className="detail-row-value font-mono">{selectedItem.huid || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Added Date</span>
                    <span className="detail-row-value text-muted font-mono">
                      {new Date(selectedItem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-card-title">Weight Accounting</div>
                  <div className="detail-row">
                    <span className="detail-row-label">Gross Weight</span>
                    <span className="detail-row-value font-mono">{formatWeight(selectedItem.gross_weight)}g</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Less Weight</span>
                    <span className="detail-row-value font-mono">{formatWeight(selectedItem.less_weight)}g</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Net Weight</span>
                    <span className="detail-row-value font-mono text-primary font-bold">
                      {formatWeight(selectedItem.net_weight)}g
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Tunch %</span>
                    <span className="detail-row-value font-mono">{formatPercentage(selectedItem.tunch_percent)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Fine Weight</span>
                    <span className="detail-row-value font-mono text-gold font-bold">
                      {formatFineWeight(selectedItem.fine_weight)}g
                    </span>
                  </div>
                </div>

                <div className="detail-card">
                  <div className="detail-card-title">Commercials & Valuation</div>
                  <div className="detail-row">
                    <span className="detail-row-label">Acq. Rate/g</span>
                    <span className="detail-row-value font-mono">
                      ₹{selectedItem.rate_per_gram.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Acq. Metal Value</span>
                    <span className="detail-row-value font-mono">
                      ₹{selectedItem.metal_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Making Charge</span>
                    <span className="detail-row-value font-mono">
                      ₹{selectedItem.making_charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Today's Rate</span>
                    <span className="detail-row-value font-mono text-gold">
                      ₹{selectedItem.current_rate?.toLocaleString('en-IN') || 'N/A'}/g
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-row-label">Live Valuation</span>
                    <span className="detail-row-value font-mono text-emerald font-bold">
                      ₹{(selectedItem.current_valuation || selectedItem.metal_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Movement History Timeline */}
              <div className="movement-section mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <History size={16} className="text-gold" />
                  <h4 className="text-sm font-semibold text-gold uppercase tracking-wider">
                    Immutable Stock Movement Audit Trail
                  </h4>
                </div>

                <div className="movement-timeline">
                  {itemMovements.length === 0 ? (
                    <div className="text-xs text-muted font-mono p-4 text-center">
                      Loading movements audit trail...
                    </div>
                  ) : (
                    itemMovements.map((mov) => (
                      <div key={mov.id} className="movement-item">
                        <div className="movement-dot-box">
                          <span className="movement-dot" />
                        </div>
                        <div className="movement-body">
                          <div className="movement-header">
                            <span className="movement-title font-mono">{mov.movement_type}</span>
                            <span className="movement-date font-mono">
                              {new Date(mov.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="movement-details font-mono">
                            <span>Status: {mov.from_status || 'INITIAL'} → <strong className="text-gold">{mov.to_status}</strong></span>
                            <span>Net: {formatWeight(mov.net_weight)}g</span>
                            <span>Fine: {formatFineWeight(mov.fine_weight)}g</span>
                            {mov.created_by_username && <span>By: {mov.created_by_username}</span>}
                          </div>
                          {mov.notes && (
                            <div className="movement-notes">"{mov.notes}"</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Change Status / Dispatch */}
      {showStatusModal && selectedItem && (
        <div className="modal-backdrop">
          <div className="modal-content modal-md">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-gold" />
                <h3 className="modal-title font-serif">Transition Stock Status: {selectedItem.tag_no}</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowStatusModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStatus}>
              <div className="modal-body">
                {formError && (
                  <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="p-3 bg-secondary rounded mb-4 text-xs font-mono">
                  <div>Current Status: <strong className="text-gold">{selectedItem.status}</strong></div>
                  <div>Product: {selectedItem.product_name} ({formatWeight(selectedItem.net_weight)}g net)</div>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">
                    Target Status <span className="text-gold">*</span>
                  </label>
                  <select
                    className="form-select font-mono"
                    required
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                  >
                    {selectedItem.status === 'IN_STOCK' && (
                      <>
                        <option value="WITH_KARIGAR">WITH_KARIGAR (Issue to workshop artisan)</option>
                        <option value="REPAIR">REPAIR (Send to repair tray)</option>
                        <option value="RESERVED">RESERVED (Hold for customer)</option>
                        <option value="ADJUSTED">ADJUSTED (Stock audit adjustment)</option>
                        <option value="DAMAGED">DAMAGED (Damaged ornament)</option>
                      </>
                    )}
                    {selectedItem.status === 'WITH_KARIGAR' && (
                      <>
                        <option value="IN_STOCK">IN_STOCK (Receive back from artisan)</option>
                        <option value="REPAIR">REPAIR (Re-route to repair)</option>
                      </>
                    )}
                    {selectedItem.status === 'REPAIR' && (
                      <>
                        <option value="IN_STOCK">IN_STOCK (Repaired and restocked)</option>
                        <option value="ADJUSTED">ADJUSTED (Melted / written off)</option>
                      </>
                    )}
                    {selectedItem.status === 'RESERVED' && (
                      <>
                        <option value="IN_STOCK">IN_STOCK (Reservation cancelled / released)</option>
                      </>
                    )}
                    {selectedItem.status === 'ADJUSTED' && (
                      <>
                        <option value="IN_STOCK">IN_STOCK (Re-added to inventory)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Movement Notes / Reason</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Enter reason or dispatch details..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating Status...' : 'Apply Transition & Log Audit Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
