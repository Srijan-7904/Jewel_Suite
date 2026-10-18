import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PurchaseBill,
  PurchaseBillDetails,
  Supplier,
  Product,
  Metal,
  MetalPurity,
  CurrentRate,
} from '../../types';
import { purchaseApi } from '../../services/purchase';
import { supplierApi, productApi, rateApi } from '../../services/masters';
import Decimal from 'decimal.js';
import {
  toDecimal,
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatPercentage,
  formatCurrency,
  parseDecimalInput,
} from '../../utils/precision';
import {
  Receipt,
  Plus,
  Search,
  Eye,
  Edit2,
  CheckCircle,
  XCircle,
  Printer,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Truck,
  RefreshCw,
} from 'lucide-react';
import '../../styles/masters.css';
import './PurchaseBillsPage.css';

export const PurchaseBillsPage: React.FC = () => {

  // Navigation mode: 'list' or 'form'
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');

  // Master Reference Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [currentRates, setCurrentRates] = useState<CurrentRate[]>([]);

  // List View State
  const [purchases, setPurchases] = useState<PurchaseBill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Active Bill State for Form/Edit/View
  const [activeBill, setActiveBill] = useState<PurchaseBillDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Print/Detail Modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printBill, setPrintBill] = useState<PurchaseBillDetails | null>(null);

  // Form State for New/Edit Purchase
  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_invoice_number: '',
    discount_amount: '0',
    gst_rate: '3.0',
    notes: '',
  });

  // Add Item Sub-Form State
  const [itemForm, setItemForm] = useState({
    product_id: '',
    metal_id: '',
    purity_id: '',
    tag_no: '',
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

  // Add Payment Sub-Form State
  const [paymentForm, setPaymentForm] = useState({
    payment_mode: 'BANK' as 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT',
    amount: '',
    reference_number: '',
    notes: '',
  });

  // Load Reference Masters
  useEffect(() => {
    supplierApi.list({ pageSize: 100, status: 'active' }).then((res) => setSuppliers(res.items)).catch(console.error);
    productApi.list({ pageSize: 100, status: 'active' }).then((res) => setProducts(res.items)).catch(console.error);
    rateApi.getMetals().then(setMetals).catch(console.error);
    rateApi.getAllPurities().then(setPurities).catch(console.error);
    rateApi.getCurrentRates().then(setCurrentRates).catch(console.error);
  }, []);

  // Fetch Purchase Bills List
  const fetchPurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await purchaseApi.list({
        page,
        pageSize,
        search,
        supplier_id: supplierFilter !== 'ALL' ? supplierFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setPurchases(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to load purchase bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, supplierFilter, statusFilter]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalPurchasesVal = 0;
    let totalPaidVal = 0;
    let totalPayableVal = 0;
    let finalizedCount = 0;

    for (const p of purchases) {
      if (p.status === 'FINALIZED') {
        finalizedCount++;
        totalPurchasesVal += p.grand_total;
        totalPaidVal += p.amount_paid;
        totalPayableVal += p.balance_amount;
      }
    }

    return { totalPurchasesVal, totalPaidVal, totalPayableVal, finalizedCount };
  }, [purchases]);

  // Filter purities by selected metal
  const availablePurities = useMemo(() => {
    if (!itemForm.metal_id) return [];
    return purities.filter((p) => p.metal_id === itemForm.metal_id);
  }, [purities, itemForm.metal_id]);

  // Live Calculations for Item Sub-Form
  const liveItemCalc = useMemo(() => {
    const gross = toDecimal(itemForm.gross_weight);
    const less = toDecimal(itemForm.less_weight);
    const tunch = toDecimal(itemForm.tunch_percent);
    const rate = toDecimal(itemForm.rate_per_gram);
    const wastage = toDecimal(itemForm.wastage_percent);

    const net = Decimal.max(0, gross.minus(less));
    const fine = net.times(tunch).dividedBy(100);
    const metalVal = fine.times(rate);
    const wastageFine = net.times(wastage).dividedBy(100);
    const wastageVal = wastageFine.times(rate);

    const makingRateDec = toDecimal(itemForm.making_rate);
    let making = toDecimal(itemForm.making_charge);
    if (itemForm.making_charge_type === 'PER_GRAM') {
      making = net.times(makingRateDec);
    } else if (itemForm.making_charge_type === 'PERCENTAGE') {
      making = metalVal.times(makingRateDec).dividedBy(100);
    } else if (itemForm.making_charge_type === 'PER_PIECE') {
      making = makingRateDec;
    } else if (itemForm.making_charge_type === 'FIXED') {
      making = makingRateDec;
    }

    const itemAmount = metalVal.plus(wastageVal).plus(making);

    return {
      net: net.toNumber(),
      fine: fine.toNumber(),
      metalVal: metalVal.toNumber(),
      making: making.toDecimalPlaces(2).toNumber(),
      itemAmount: itemAmount.toNumber(),
    };
  }, [itemForm.gross_weight, itemForm.less_weight, itemForm.tunch_percent, itemForm.rate_per_gram, itemForm.making_charge, itemForm.making_rate, itemForm.making_charge_type, itemForm.wastage_percent]);

  const handleMakingChange = (rateStr: string, type: 'FIXED' | 'PER_PIECE' | 'PER_GRAM' | 'PERCENTAGE') => {
    const rateDec = toDecimal(rateStr);
    const gross = toDecimal(itemForm.gross_weight);
    const less = toDecimal(itemForm.less_weight);
    const net = Decimal.max(0, gross.minus(less));
    const tunch = toDecimal(itemForm.tunch_percent);
    const rate = toDecimal(itemForm.rate_per_gram);
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

    setItemForm((prev) => ({
      ...prev,
      making_charge_type: type,
      making_rate: rateStr,
      making_charge: calculatedMaking.toDecimalPlaces(2).toString(),
    }));
  };

  // Handle Product Change in Item Sub-Form
  const handleItemProductChange = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    let targetMetalId = itemForm.metal_id;
    if (prod.default_metal) {
      const m = metals.find((met) => met.code === prod.default_metal);
      if (m) targetMetalId = m.id;
    }

    let targetPurityId = itemForm.purity_id;
    let tunch = itemForm.tunch_percent;
    let rate = itemForm.rate_per_gram;

    if (targetMetalId && prod.default_purity) {
      const p = purities.find((pur) => pur.metal_id === targetMetalId && pur.code === prod.default_purity);
      if (p) {
        targetPurityId = p.id;
        if (p.tunch_percent !== null) tunch = p.tunch_percent.toString();

        const cr = currentRates.find((r) => r.metal_id === targetMetalId && r.purity_id === p.id);
        if (cr) rate = cr.rate.toString();
      }
    }

    setItemForm((prev) => ({
      ...prev,
      product_id: productId,
      metal_id: targetMetalId,
      purity_id: targetPurityId,
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Handle Metal Change
  const handleItemMetalChange = (metalId: string) => {
    const pList = purities.filter((p) => p.metal_id === metalId);
    const defaultP = pList.length > 0 ? pList[0] : null;

    let tunch = '';
    let rate = '';
    if (defaultP) {
      if (defaultP.tunch_percent !== null) tunch = defaultP.tunch_percent.toString();
      const cr = currentRates.find((r) => r.metal_id === metalId && r.purity_id === defaultP.id);
      if (cr) rate = cr.rate.toString();
    }

    setItemForm((prev) => ({
      ...prev,
      metal_id: metalId,
      purity_id: defaultP ? defaultP.id : '',
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Handle Purity Change
  const handleItemPurityChange = (purityId: string) => {
    const p = purities.find((pur) => pur.id === purityId);
    let tunch = itemForm.tunch_percent;
    let rate = itemForm.rate_per_gram;

    if (p) {
      if (p.tunch_percent !== null) tunch = p.tunch_percent.toString();
      const cr = currentRates.find((r) => r.metal_id === p.metal_id && r.purity_id === p.id);
      if (cr) rate = cr.rate.toString();
    }

    setItemForm((prev) => ({
      ...prev,
      purity_id: purityId,
      tunch_percent: tunch,
      rate_per_gram: rate,
    }));
  };

  // Start Create Purchase Bill
  const handleStartCreate = () => {
    const defaultSupplier = suppliers[0];
    const firstMetal = metals.find((m) => m.code === 'GOLD') || metals[0];
    const defaultPurity = firstMetal
      ? purities.find((p) => p.metal_id === firstMetal.id && p.code === '22K') || purities.find((p) => p.metal_id === firstMetal.id)
      : null;

    let defaultRate = '';
    if (firstMetal && defaultPurity) {
      const cr = currentRates.find((r) => r.metal_id === firstMetal.id && r.purity_id === defaultPurity.id);
      if (cr) defaultRate = cr.rate.toString();
    }

    const randomTagSuffix = Math.floor(1000 + Math.random() * 9000);

    setFormData({
      supplier_id: defaultSupplier ? defaultSupplier.id : '',
      purchase_date: new Date().toISOString().split('T')[0],
      supplier_invoice_number: '',
      discount_amount: '0',
      gst_rate: '3.0',
      notes: '',
    });

    setItemForm({
      product_id: products[0] ? products[0].id : '',
      metal_id: firstMetal ? firstMetal.id : '',
      purity_id: defaultPurity ? defaultPurity.id : '',
      tag_no: `PUR-G-${randomTagSuffix}`,
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

    setActiveBill(null);
    setFormError(null);
    setViewMode('form');
  };

  // Open Existing Bill in Form Mode
  const handleEditBill = async (billId: string) => {
    try {
      setIsLoading(true);
      const bill = await purchaseApi.getById(billId);
      setActiveBill(bill);
      setFormData({
        supplier_id: bill.supplier_id,
        purchase_date: bill.purchase_date,
        supplier_invoice_number: bill.supplier_invoice_number || '',
        discount_amount: bill.discount_amount.toString(),
        gst_rate: bill.gst_rate.toString(),
        notes: bill.notes || '',
      });
      setFormError(null);
      setViewMode('form');
    } catch (err: any) {
      console.error('Failed to load bill for editing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save/Create Draft Header
  const handleSaveDraft = async () => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (!formData.supplier_id) throw new Error('Please select a supplier');

      if (!activeBill) {
        // Create new draft
        const created = await purchaseApi.create({
          supplier_id: formData.supplier_id,
          purchase_date: formData.purchase_date,
          supplier_invoice_number: formData.supplier_invoice_number.trim() || undefined,
          discount_amount: parseFloat(formData.discount_amount) || 0,
          gst_rate: parseFloat(formData.gst_rate) || 0,
          notes: formData.notes.trim() || undefined,
        });
        setActiveBill(created);
      } else {
        // Update existing draft
        const updated = await purchaseApi.update(activeBill.id, {
          supplier_id: formData.supplier_id,
          purchase_date: formData.purchase_date,
          supplier_invoice_number: formData.supplier_invoice_number.trim() || undefined,
          discount_amount: parseFloat(formData.discount_amount) || 0,
          gst_rate: parseFloat(formData.gst_rate) || 0,
          notes: formData.notes.trim() || undefined,
        });
        setActiveBill(updated);
      }
      await fetchPurchases();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save draft purchase bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Item to Current Draft Bill
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const gross = toDecimal(itemForm.gross_weight);
      const less = toDecimal(itemForm.less_weight);
      const tunch = toDecimal(itemForm.tunch_percent);
      const rate = toDecimal(itemForm.rate_per_gram);

      if (!itemForm.tag_no.trim()) throw new Error('Tag number is required');
      if (!itemForm.product_id) throw new Error('Please select a product');
      if (gross.lte(0)) throw new Error('Gross weight must be greater than zero');
      if (less.lt(0) || less.gt(gross)) throw new Error('Less weight cannot exceed gross weight');
      if (tunch.lt(0) || tunch.gt(100)) throw new Error('Tunch % must be between 0 and 100');
      if (rate.lte(0)) throw new Error('Purchase rate per gram must be greater than zero');

      let currentBill = activeBill;
      if (!currentBill) {
        // Auto-create draft bill if not created yet
        if (!formData.supplier_id) throw new Error('Please select a supplier first');
        currentBill = await purchaseApi.create({
          supplier_id: formData.supplier_id,
          purchase_date: formData.purchase_date,
          supplier_invoice_number: formData.supplier_invoice_number.trim() || undefined,
          discount_amount: toDecimal(formData.discount_amount).toNumber(),
          gst_rate: toDecimal(formData.gst_rate).toNumber(),
          notes: formData.notes.trim() || undefined,
        });
        setActiveBill(currentBill);
      }

      const updated = await purchaseApi.addItem(currentBill.id, {
        product_id: itemForm.product_id,
        metal_id: itemForm.metal_id,
        purity_id: itemForm.purity_id,
        tag_no: itemForm.tag_no.trim().toUpperCase(),
        gross_weight: gross.toNumber(),
        less_weight: less.toNumber(),
        tunch_percent: tunch.toNumber(),
        wastage_percent: toDecimal(itemForm.wastage_percent).toNumber(),
        making_charge: liveItemCalc.making,
        rate_per_gram: rate.toNumber(),
        huid: itemForm.huid.trim() || undefined,
        notes: itemForm.notes.trim() || undefined,
      });

      setActiveBill(updated);

      // Generate next suggested tag
      const randomTagSuffix = Math.floor(1000 + Math.random() * 9000);
      setItemForm((prev) => ({
        ...prev,
        tag_no: `PUR-G-${randomTagSuffix}`,
        gross_weight: '',
        less_weight: '0',
        huid: '',
        notes: '',
      }));

      await fetchPurchases();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add item to purchase bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove Item from Draft
  const handleRemoveItem = async (itemId: string) => {
    if (!activeBill) return;
    try {
      setIsSubmitting(true);
      const updated = await purchaseApi.removeItem(activeBill.id, itemId);
      setActiveBill(updated);
      await fetchPurchases();
    } catch (err: any) {
      setFormError(err.message || 'Failed to remove item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBill) {
      setFormError('Please save the purchase bill draft before adding payments');
      return;
    }
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Payment amount must be greater than zero');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const updated = await purchaseApi.addPayment(activeBill.id, {
        payment_mode: paymentForm.payment_mode,
        amount: amt,
        reference_number: paymentForm.reference_number.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
      });

      setActiveBill(updated);
      setPaymentForm({
        payment_mode: 'BANK',
        amount: '',
        reference_number: '',
        notes: '',
      });
      await fetchPurchases();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Finalize Purchase & Inward Stock
  const handleFinalize = async () => {
    if (!activeBill) return;
    if (activeBill.items.length === 0) {
      setFormError('Cannot finalize a purchase bill with zero items. Add at least one item.');
      return;
    }

    if (!window.confirm(`Finalize Purchase ${activeBill.purchase_number}? This will create ${activeBill.items.length} new stock items in inventory and record PURCHASE_IN inward movements.`)) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const finalized = await purchaseApi.finalize(activeBill.id);
      setActiveBill(finalized);
      await fetchPurchases();
      alert(`Success! Purchase ${finalized.purchase_number} finalized. ${finalized.items.length} stock items inwarded into inventory.`);
      setViewMode('list');
    } catch (err: any) {
      setFormError(err.message || 'Failed to finalize purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Printable Invoice View
  const handleOpenPrint = async (billId: string) => {
    try {
      const bill = await purchaseApi.getById(billId);
      setPrintBill(bill);
      setShowPrintModal(true);
    } catch (err) {
      console.error('Failed to load bill for print:', err);
    }
  };

  return (
    <div className="purchase-page">
      {viewMode === 'list' ? (
        <>
          {/* Page Header */}
          <div className="purchase-header">
            <div className="purchase-header-left">
              <div className="purchase-icon-box">
                <Truck size={24} className="gold" />
              </div>
              <div>
                <h1 className="purchase-title font-serif">Purchase & Inward Bills</h1>
                <p className="purchase-subtitle">
                  Supplier purchase bills, bullion inward, inventory replenishment, and payables.
                </p>
              </div>
            </div>

            <div className="purchase-header-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={fetchPurchases}
                disabled={isLoading}
              >
                <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>

              <button type="button" className="btn btn-primary" onClick={handleStartCreate}>
                <Plus size={16} />
                <span>New Purchase Inward</span>
              </button>
            </div>
          </div>

          {/* Top Metrics Row */}
          <div className="purchase-metrics-grid">
            <div className="purchase-metric-card">
              <div className="purchase-metric-label">Total Inward Purchases</div>
              <div className="purchase-metric-val emerald font-mono">
                ₹{metrics.totalPurchasesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="purchase-metric-sub">{metrics.finalizedCount} Finalized Inward Bills</div>
            </div>

            <div className="purchase-metric-card">
              <div className="purchase-metric-label">Total Amount Paid</div>
              <div className="purchase-metric-val font-mono">
                ₹{metrics.totalPaidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="purchase-metric-sub">Settled via Cash/Bank/UPI</div>
            </div>

            <div className="purchase-metric-card">
              <div className="purchase-metric-label">Supplier Balance Payable</div>
              <div className="purchase-metric-val amber font-mono">
                ₹{metrics.totalPayableVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="purchase-metric-sub">Outstanding Supplier Credit</div>
            </div>

            <div className="purchase-metric-card">
              <div className="purchase-metric-label">Total Registered Bills</div>
              <div className="purchase-metric-val font-mono">{total}</div>
              <div className="purchase-metric-sub">Draft & Finalized Inward Bills</div>
            </div>
          </div>

          {/* Filter and Action Toolbar */}
          <div className="purchase-toolbar">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="font-mono text-xs"
                placeholder="Search by Purchase No, Supplier Invoice, or Supplier Name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button type="button" className="clear-search-btn" onClick={() => setSearch('')}>
                  <XCircle size={14} />
                </button>
              )}
            </div>

            <div className="filter-group">
              <select
                className="filter-select font-mono"
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>
                ))}
              </select>

              <select
                className="filter-select font-mono"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="FINALIZED">FINALIZED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              {(search || supplierFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => {
                    setSearch('');
                    setSupplierFilter('ALL');
                    setStatusFilter('ALL');
                    setPage(1);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Purchase Bills Data Table Card */}
          <div className="purchase-table-card">
            <div className="table-responsive">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Supplier Invoice</th>
                    <th className="text-right">Grand Total (₹)</th>
                    <th className="text-right">Paid (₹)</th>
                    <th className="text-right">Balance Payable (₹)</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="table-empty py-12 text-center text-muted font-mono">
                        <RefreshCw size={24} className="spin text-gold mx-auto mb-2" />
                        <span>Loading purchase inward records from SQLite...</span>
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="table-empty py-12">
                        <div className="empty-registry-state">
                          <Truck size={44} className="text-muted mb-3 opacity-40 mx-auto" />
                          <h4 className="text-base font-serif text-gold font-semibold">No Purchase Bills Found</h4>
                          <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                            Create an inward purchase bill to restock physical jewellery inventory and log supplier bills.
                          </p>
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleStartCreate}>
                            <Plus size={14} />
                            <span>Create Purchase Bill</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchases.map((bill) => (
                      <tr key={bill.id} className="purchase-row">
                        <td>
                          <span className="tag-pill font-mono">{bill.purchase_number}</span>
                        </td>
                        <td className="font-mono text-sm">{bill.purchase_date}</td>
                        <td>
                          <div className="font-medium text-main">{bill.supplier_name}</div>
                          <div className="text-xs text-muted font-mono">{bill.supplier_code}</div>
                        </td>
                        <td className="font-mono text-sm">
                          {bill.supplier_invoice_number || <span className="text-muted">-</span>}
                        </td>
                        <td className="text-right font-mono font-bold text-emerald">
                          ₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-mono text-muted">
                          ₹{bill.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-mono font-bold text-amber">
                          ₹{bill.balance_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          <span className={`purchase-badge ${bill.status.toLowerCase()}`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn-icon"
                              title="View / Print Tax Invoice"
                              onClick={() => handleOpenPrint(bill.id)}
                            >
                              <Eye size={15} />
                            </button>
                            {bill.status === 'DRAFT' && (
                              <>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="Edit Draft Items"
                                  onClick={() => handleEditBill(bill.id)}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon text-emerald"
                                  title="Finalize and Inward to Inventory"
                                  onClick={() => handleEditBill(bill.id)}
                                >
                                  <CheckCircle size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="purchase-pagination">
              <span className="pagination-info font-mono text-xs text-muted">
                Showing {total > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)} of {total} bill(s)
              </span>
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="pagination-pages font-mono text-xs text-gold px-2">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Create / Edit Purchase Inward Screen */
        <div className="purchase-form-container">
          {/* Header Bar */}
          <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-secondary btn-sm flex items-center gap-1"
                onClick={() => setViewMode('list')}
              >
                <ArrowLeft size={14} />
                <span>Back to All Bills</span>
              </button>
              <h2 className="text-lg font-serif font-bold text-gold">
                {activeBill ? `Purchase Inward: ${activeBill.purchase_number}` : 'New Jewellery Purchase Inward'}
              </h2>
            </div>
            {activeBill && (
              <span className={`purchase-badge ${activeBill.status.toLowerCase()}`}>
                {activeBill.status}
              </span>
            )}
          </div>

          {formError && (
            <div className="error-alert mb-4">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Supplier & Bill Metadata */}
          <div className="purchase-section-card">
            <div className="section-card-title">
              <span>1. Supplier & Invoice Details</span>
              {activeBill?.status === 'DRAFT' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                >
                  Update Header Info
                </button>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  Supplier <span className="text-gold">*</span>
                </label>
                <select
                  className="form-select font-medium"
                  required
                  value={formData.supplier_id}
                  disabled={activeBill?.status === 'FINALIZED'}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                >
                  <option value="" disabled>Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplier_code}) {s.phone ? `• ${s.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Purchase Inward Date</label>
                <input
                  type="date"
                  className="form-input font-mono"
                  value={formData.purchase_date}
                  disabled={activeBill?.status === 'FINALIZED'}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Supplier Bill / Invoice Number</label>
                <input
                  type="text"
                  className="form-input font-mono uppercase"
                  placeholder="e.g. ZAV/2026/894"
                  value={formData.supplier_invoice_number}
                  disabled={activeBill?.status === 'FINALIZED'}
                  onChange={(e) => setFormData({ ...formData, supplier_invoice_number: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 22K Hallmarked Bullion Shipment"
                  value={formData.notes}
                  disabled={activeBill?.status === 'FINALIZED'}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Add Purchase Item (only if DRAFT) */}
          {(!activeBill || activeBill.status === 'DRAFT') && (
            <div className="purchase-section-card">
              <div className="section-card-title">
                <span>2. Inward Jewellery Item (Physical Tag & Weight)</span>
              </div>

              <form onSubmit={handleAddItem}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Product Design <span className="text-gold">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={itemForm.product_id}
                      onChange={(e) => handleItemProductChange(e.target.value)}
                    >
                      <option value="" disabled>Select Product Design</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_code} — {p.name} ({p.category_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Metal <span className="text-gold">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={itemForm.metal_id}
                      onChange={(e) => handleItemMetalChange(e.target.value)}
                    >
                      {metals.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purity <span className="text-gold">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={itemForm.purity_id}
                      onChange={(e) => handleItemPurityChange(e.target.value)}
                    >
                      {availablePurities.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.tunch_percent ? `${p.tunch_percent}%` : 'Stone/Carat'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tag No <span className="text-gold">*</span></label>
                    <input
                      type="text"
                      className="form-input font-mono font-bold uppercase"
                      required
                      placeholder="e.g. PUR-G-001"
                      value={itemForm.tag_no}
                      onChange={(e) => setItemForm({ ...itemForm, tag_no: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gross Weight (g) <span className="text-gold">*</span></label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      required
                      placeholder="0.000"
                      value={itemForm.gross_weight}
                      onChange={(e) => setItemForm({ ...itemForm, gross_weight: parseDecimalInput(e.target.value, 4) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Less Weight (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      placeholder="0.000"
                      value={itemForm.less_weight}
                      onChange={(e) => setItemForm({ ...itemForm, less_weight: parseDecimalInput(e.target.value, 4) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tunch % <span className="text-gold">*</span></label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      required
                      placeholder="91.67"
                      value={itemForm.tunch_percent}
                      onChange={(e) => setItemForm({ ...itemForm, tunch_percent: parseDecimalInput(e.target.value, 4) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purchase Rate/g (₹) <span className="text-gold">*</span></label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono font-bold"
                      required
                      placeholder="7000.00"
                      value={itemForm.rate_per_gram}
                      onChange={(e) => setItemForm({ ...itemForm, rate_per_gram: parseDecimalInput(e.target.value, 2) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center justify-between">
                      <span>Making Charge</span>
                      <span className="text-xs text-gold font-mono">
                        ₹{liveItemCalc.making.toFixed(2)}
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        className="form-select font-mono text-xs w-28"
                        value={itemForm.making_charge_type}
                        onChange={(e) => handleMakingChange(itemForm.making_rate, e.target.value as any)}
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
                          itemForm.making_charge_type === 'PER_PIECE'
                            ? '₹/pc'
                            : itemForm.making_charge_type === 'FIXED'
                            ? '₹ Fix'
                            : itemForm.making_charge_type === 'PERCENTAGE'
                            ? '%'
                            : '₹/g'
                        }
                        value={itemForm.making_rate}
                        onChange={(e) => handleMakingChange(parseDecimalInput(e.target.value, 2), itemForm.making_charge_type)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Wastage %</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input font-mono"
                      placeholder="0.0"
                      value={itemForm.wastage_percent}
                      onChange={(e) => setItemForm({ ...itemForm, wastage_percent: parseDecimalInput(e.target.value, 2) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">HUID (Hallmark)</label>
                    <input
                      type="text"
                      className="form-input font-mono uppercase"
                      placeholder="e.g. HZ9812"
                      value={itemForm.huid}
                      onChange={(e) => setItemForm({ ...itemForm, huid: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Casting finish with rodium"
                      value={itemForm.notes}
                      onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Real-time Calculation Preview */}
                <div className="calc-preview-bar">
                  <div className="calc-box">
                    <span className="calc-box-label">Net Weight</span>
                    <span className="calc-box-val net">{formatWeight(liveItemCalc.net, 3)} g</span>
                  </div>
                  <div className="calc-box">
                    <span className="calc-box-label">Fine Bullion Wt</span>
                    <span className="calc-box-val fine">{formatFineWeight(liveItemCalc.fine, 4)} g</span>
                  </div>
                  <div className="calc-box">
                    <span className="calc-box-label">Total Item Inward Cost</span>
                    <span className="calc-box-val value">
                      {formatCurrency(liveItemCalc.itemAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end mt-3">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    <Plus size={15} />
                    <span>Add Item to Bill</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Section 3: Inward Items Table */}
          <div className="purchase-section-card">
            <div className="section-card-title">
              <span>3. Purchase Bill Items ({activeBill?.items.length || 0})</span>
            </div>

            <div className="purchase-table-card">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Tag No</th>
                    <th>Product</th>
                    <th>Metal & Purity</th>
                    <th className="text-right">Gross Wt</th>
                    <th className="text-right">Net Wt</th>
                    <th className="text-right">Tunch %</th>
                    <th className="text-right">Fine Wt</th>
                    <th className="text-right">Wastage</th>
                    <th className="text-right">Rate/g</th>
                    <th className="text-right">Making</th>
                    <th className="text-right">Amount</th>
                    {activeBill?.status === 'DRAFT' && <th className="text-center">Remove</th>}
                  </tr>
                </thead>
                <tbody>
                  {!activeBill || activeBill.items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="table-empty py-6 text-xs font-mono">
                        No items added to this purchase bill yet. Add item above.
                      </td>
                    </tr>
                  ) : (
                    activeBill.items.map((it) => {
                      const wastagePercent = Number(it.wastage_percent || 0);
                      const wastageWeight = Number(it.wastage_weight ?? (wastagePercent > 0 ? (Number(it.net_weight || 0) * wastagePercent) / 100 : 0));
                      return (
                        <tr key={it.id}>
                          <td>
                            <span className="tag-pill">{it.tag_no}</span>
                            {it.huid && <div className="text-xs text-muted font-mono">HUID: {it.huid}</div>}
                          </td>
                          <td>
                            <div className="font-medium text-primary">{it.product_name}</div>
                            <div className="text-xs text-muted">{it.category_name}</div>
                          </td>
                          <td className="font-mono text-sm text-gold">
                            {it.metal_code} • {it.purity_code}
                          </td>
                          <td className="text-right font-mono">{formatWeight(it.gross_weight, 3)}g</td>
                          <td className="text-right font-mono font-medium">{formatWeight(it.net_weight, 3)}g</td>
                          <td className="text-right font-mono text-muted">{formatPercentage(it.tunch_percent)}</td>
                          <td className="text-right font-mono font-bold text-gold">{formatFineWeight(it.fine_weight, 4)}g</td>
                          <td className="text-right font-mono text-xs">
                            {wastagePercent > 0 ? (
                              <span>
                                {formatWeight(wastageWeight, 4)}g ({wastagePercent}%)
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="text-right font-mono text-xs">{formatMetalRate(it.rate_per_gram, true)}</td>
                          <td className="text-right font-mono text-xs">{formatCurrency(it.making_charge)}</td>
                          <td className="text-right font-mono font-bold text-emerald">
                            {formatCurrency(it.item_amount)}
                          </td>
                        {activeBill.status === 'DRAFT' && (
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn-icon text-red-400"
                              title="Remove item"
                              onClick={() => handleRemoveItem(it.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Settlement & Financial Totals */}
          <div className="purchase-section-card">
            <div className="section-card-title">
              <span>4. Commercial Settlement & Supplier Payments</span>
            </div>

            <div className="settlement-grid">
              {/* Payments Tender Column */}
              <div>
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">
                  Payments Made to Supplier
                </h4>

                {/* Add Payment Form */}
                {(!activeBill || activeBill.status === 'DRAFT') && (
                  <form onSubmit={handleAddPayment} className="flex gap-2 mb-3">
                    <select
                      className="form-select text-xs w-32"
                      value={paymentForm.payment_mode}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value as any })}
                    >
                      <option value="BANK">BANK / NEFT</option>
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">CARD</option>
                      <option value="CREDIT">CREDIT</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input text-xs font-mono w-36"
                      placeholder="Amount (₹)"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-input text-xs font-mono flex-1"
                      placeholder="Ref / UTR / Chq No"
                      value={paymentForm.reference_number}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={isSubmitting}>
                      Add
                    </button>
                  </form>
                )}

                {/* Payments Table */}
                <div className="purchase-table-card">
                  <table className="purchase-table">
                    <thead>
                      <tr>
                        <th>Mode</th>
                        <th className="text-right">Amount</th>
                        <th>Reference</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!activeBill || activeBill.payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="table-empty py-3 text-xs font-mono">
                            No payment recorded yet. Balance will be marked as supplier credit payable.
                          </td>
                        </tr>
                      ) : (
                        activeBill.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="font-mono text-xs font-bold text-gold">{p.payment_mode}</td>
                            <td className="text-right font-mono font-medium">
                              ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="font-mono text-xs">{p.reference_number || 'N/A'}</td>
                            <td className="font-mono text-xs text-muted">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Breakdown Column */}
              <div className="totals-box font-mono">
                <div className="totals-row">
                  <span className="text-muted">Subtotal (Items Total):</span>
                  <span>₹{(activeBill?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="totals-row">
                  <span className="text-muted">Discount Allowed:</span>
                  <span>- ₹{(activeBill?.discount_amount || parseFloat(formData.discount_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="totals-row">
                  <span className="text-muted">Taxable Amount:</span>
                  <span>₹{(activeBill?.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="totals-row">
                  <span className="text-muted">GST ({activeBill?.gst_rate || formData.gst_rate}%):</span>
                  <span>+ ₹{(activeBill?.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="totals-row">
                  <span className="text-muted">Round Off:</span>
                  <span>₹{(activeBill?.round_off || 0).toFixed(2)}</span>
                </div>

                <div className="totals-row grand-total">
                  <span>Grand Total:</span>
                  <span>₹{(activeBill?.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="totals-row">
                  <span className="text-muted">Amount Paid:</span>
                  <span className="text-emerald font-bold">
                    ₹{(activeBill?.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="totals-row balance">
                  <span>Balance Payable to Supplier:</span>
                  <span>₹{(activeBill?.balance_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setViewMode('list')}
            >
              Back to List
            </button>

            <div className="flex gap-2">
              {activeBill?.status === 'DRAFT' && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isSubmitting}
                    onClick={handleSaveDraft}
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex items-center gap-1.5"
                    disabled={isSubmitting || !activeBill || activeBill.items.length === 0}
                    onClick={handleFinalize}
                  >
                    <CheckCircle size={16} />
                    <span>Finalize Purchase & Inward Stock</span>
                  </button>
                </>
              )}

              {activeBill?.status === 'FINALIZED' && (
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-1.5"
                  onClick={() => handleOpenPrint(activeBill.id)}
                >
                  <Printer size={16} />
                  <span>Print Tax Invoice</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Printable Purchase Invoice / Details */}
      {showPrintModal && printBill && (
        <div className="modal-backdrop">
          <div className="modal-content modal-lg">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-gold" />
                <h3 className="modal-title font-serif">Purchase Inward Bill: {printBill.purchase_number}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm flex items-center gap-1"
                  onClick={() => window.print()}
                >
                  <Printer size={14} />
                  <span>Print A4 Invoice</span>
                </button>
                <button type="button" className="btn-icon" onClick={() => setShowPrintModal(false)}>
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="invoice-print-container">
                {/* Print Header */}
                <div className="invoice-print-header">
                  <div>
                    <div className="shop-brand-name">JEWEL SUITE ERP</div>
                    <div className="text-xs text-gray-600 mt-1">101 Goldsmith Market, Zaveri Bazaar, Mumbai</div>
                    <div className="text-xs text-gray-600">Phone: +91 98765 43210 • GSTIN: 27AABCT1234F1Z8</div>
                  </div>
                  <div>
                    <div className="invoice-badge-title">PURCHASE INVOICE</div>
                    <div className="text-xs font-mono text-gray-700 text-right mt-1">
                      <strong>Bill No:</strong> {printBill.purchase_number}
                    </div>
                    <div className="text-xs font-mono text-gray-700 text-right">
                      <strong>Date:</strong> {printBill.purchase_date}
                    </div>
                    <div className="text-xs font-mono text-gray-700 text-right">
                      <strong>Status:</strong> {printBill.status}
                    </div>
                  </div>
                </div>

                {/* Parties Grid */}
                <div className="invoice-party-grid">
                  <div className="party-box">
                    <div className="party-box-title">Supplier Details</div>
                    <div className="font-bold text-gray-900">{printBill.supplier_name}</div>
                    <div className="text-gray-600 text-xs">Code: {printBill.supplier_code}</div>
                    <div className="text-gray-600 text-xs">Phone: {printBill.supplier_phone || 'N/A'}</div>
                    <div className="text-gray-600 text-xs">GSTIN: {printBill.supplier_gstin || 'Unregistered'}</div>
                  </div>

                  <div className="party-box">
                    <div className="party-box-title">Supplier Reconciliation</div>
                    <div className="text-gray-700 text-xs">
                      <strong>Supplier Invoice No:</strong> {printBill.supplier_invoice_number || 'N/A'}
                    </div>
                    <div className="text-gray-700 text-xs mt-1">
                      <strong>Acquisition Type:</strong> PURCHASE_INWARD
                    </div>
                    {printBill.notes && (
                      <div className="text-gray-600 text-xs mt-1">
                        <strong>Notes:</strong> {printBill.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inward Items Table */}
                <table className="print-table font-mono">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tag No</th>
                      <th>Item Description</th>
                      <th>Metal/Purity</th>
                      <th className="text-right">Gross Wt</th>
                      <th className="text-right">Net Wt</th>
                      <th className="text-right">Tunch</th>
                      <th className="text-right">Fine Wt</th>
                      <th className="text-right">Wastage</th>
                      <th className="text-right">Rate/g</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printBill.items.map((it, idx) => {
                      const wastagePercent = Number(it.wastage_percent || 0);
                      const wastageWeight = Number(it.wastage_weight ?? (wastagePercent > 0 ? (Number(it.net_weight || 0) * wastagePercent) / 100 : 0));
                      return (
                        <tr key={it.id}>
                          <td>{idx + 1}</td>
                          <td className="font-bold">{it.tag_no}</td>
                          <td>{it.product_name}</td>
                          <td>{it.metal_code} {it.purity_code}</td>
                          <td className="text-right">{formatWeight(it.gross_weight, 3)}g</td>
                          <td className="text-right">{formatWeight(it.net_weight, 3)}g</td>
                          <td className="text-right">{formatPercentage(it.tunch_percent)}</td>
                          <td className="text-right">{formatFineWeight(it.fine_weight, 4)}g</td>
                          <td className="text-right">
                            {wastagePercent > 0 ? (
                              <span>
                                {formatWeight(wastageWeight, 4)}g ({wastagePercent}%)
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="text-right">{formatMetalRate(it.rate_per_gram, true)}</td>
                          <td className="text-right font-bold">
                            {formatCurrency(it.item_amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Print Totals Box */}
                <div className="print-totals-box">
                  <table className="print-totals-table font-mono">
                    <tbody>
                      <tr>
                        <td className="text-gray-600">Subtotal:</td>
                        <td className="text-right">{formatCurrency(printBill.subtotal)}</td>
                      </tr>
                      {printBill.discount_amount > 0 && (
                        <tr>
                          <td className="text-gray-600">Discount:</td>
                          <td className="text-right">− {formatCurrency(printBill.discount_amount)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="text-gray-600">Taxable Amount:</td>
                        <td className="text-right">{formatCurrency(printBill.taxable_amount)}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-600">GST ({printBill.gst_rate}%):</td>
                        <td className="text-right">+ {formatCurrency(printBill.gst_amount)}</td>
                      </tr>
                      {printBill.round_off !== 0 && (
                        <tr>
                          <td className="text-gray-600">Round Off:</td>
                          <td className="text-right">{formatCurrency(printBill.round_off)}</td>
                        </tr>
                      )}
                      <tr className="total-bold">
                        <td>Grand Total:</td>
                        <td className="text-right">{formatCurrency(printBill.grand_total)}</td>
                      </tr>
                      <tr>
                        <td className="text-emerald font-bold">Amount Paid:</td>
                        <td className="text-right text-emerald font-bold">
                          {formatCurrency(printBill.amount_paid)}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-amber-700 font-bold">Balance Payable:</td>
                        <td className="text-right text-amber-700 font-bold">
                          {formatCurrency(printBill.balance_amount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 flex justify-between">
                  <div>Received By / Shop Signature: __________________</div>
                  <div>Supplier Authorized Signature: __________________</div>
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary flex items-center gap-1.5"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
