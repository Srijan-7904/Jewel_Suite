import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { purchaseApi } from '../../services/purchase';
import { supplierApi, productApi, rateApi } from '../../services/masters';
import { settingsApi, ShopProfile } from '../../services/settings';
import {
  PurchaseBill,
  PurchaseBillDetails,
  Supplier,
  Product,
  Metal,
  MetalPurity,
  CurrentRate,
} from '../../types';
import {
  toDecimal,
  formatWeight,
  formatFineWeight,
  formatCurrency,
  parseDecimalInput,
} from '../../utils/precision';
import {
  Receipt,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Printer,
  ArrowLeft,
  AlertCircle,
  Truck,
  UserPlus,
  Sparkles,
  Calculator,
  CreditCard,
  Coins,
  Check,
  Search,
  XCircle,
  RefreshCw,
  Eye,
  RotateCcw,
} from 'lucide-react';
import './CreateInvoicePage.css';
import './PurchaseBillsPage.css';
import { LessWeightCalculatorModal, LessBreakdownEntry } from '../../components/LessWeightCalculatorModal';

interface PurchaseItemRow {
  id: string;
  product_id: string;
  tag_no: string;
  item_name: string;
  metal_id: string;
  metal_name: string;
  purity_id: string;
  purity_name: string;
  gross_weight: number | string;
  less_weight: number | string;
  less_breakdown?: LessBreakdownEntry[];
  tunch_percent: number | string;
  badla_percent?: number | string;
  wastage_percent: number | string;
  pieces?: number | string;
  making_rate: number | string;
  making_charge_type: 'PER_GRAM' | 'FIXED' | 'PER_PIECE' | 'PERCENTAGE';
  rate_per_gram: number | string;
  huid?: string;
  notes?: string;
}

interface ExchangeItemRow {
  id: string;
  tag_no: string;
  item_name: string;
  metal_id: string;
  metal_name: string;
  purity_id: string;
  purity_name: string;
  gross_weight: number | string;
  less_weight: number | string;
  less_breakdown?: LessBreakdownEntry[];
  tunch_percent: number | string;
  badla_percent?: number | string;
  wastage_percent?: number | string;
  making_rate?: number | string;
  making_charge_type?: 'PER_GRAM' | 'FIXED' | 'PER_PIECE' | 'PERCENTAGE';
  pieces?: number | string;
  deduction_percent?: number | string;
  exchange_rate: number | string;
  notes?: string;
}

interface PaymentRow {
  id: string;
  payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT' | 'GOLD' | 'SILVER' | 'OTHER';
  amount: number | string;
  reference_number?: string;
  notes?: string;

  // Metal payment fields (for GOLD / SILVER)
  metal_id?: string;
  metal_name?: string;
  purity_id?: string;
  purity_name?: string;
  metal_weight?: number | string;
  metal_rate?: number | string;
  rate_error?: string;
  last_edited?: 'weight' | 'amount';
}

export const PurchaseBillsPage: React.FC = () => {
  const navigate = useNavigate();

  // Navigation mode: 'form' (Workstation POS) or 'list' (Registry)
  const [viewMode, setViewMode] = useState<'form' | 'list'>('form');

  // Master Reference Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  // Workstation Purchase Header State
  const [_activeBillId, setActiveBillId] = useState<string | null>(null);
  void _activeBillId;
  const [activePurchaseNumber, setActivePurchaseNumber] = useState<string>(
    () => `PUR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [gstRate, setGstRate] = useState<number>(3.0);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState<string>('');

  // Workstation Items, Exchange Items, and Payments State
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItemRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([
    {
      id: 'pay-init-pur',
      payment_mode: 'BANK',
      amount: '',
      reference_number: '',
    },
  ]);

  // Toast Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Supplier Creation Modal State
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [supplierSubmitting, setSupplierSubmitting] = useState<boolean>(false);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    supplier_code: '',
    phone: '',
    alternate_phone: '',
    email: '',
    contact_person: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    opening_balance: 0,
    opening_balance_type: 'CREDIT' as 'DEBIT' | 'CREDIT',
    notes: '',
  });

  // Print/Voucher Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printBill, setPrintBill] = useState<PurchaseBillDetails | null>(null);

  // Less Weight Calculator Modal State
  const [activeLessCalc, setActiveLessCalc] = useState<{
    itemId: string;
    itemName: string;
    currentLess: number | string;
    breakdown?: LessBreakdownEntry[];
  } | null>(null);

  const handleOpenPurchaseLessCalculator = (item: PurchaseItemRow) => {
    setActiveLessCalc({
      itemId: item.id,
      itemName: item.item_name || 'Purchase Item',
      currentLess: item.less_weight,
      breakdown: item.less_breakdown,
    });
  };

  const handleApplyPurchaseLessTotal = (totalWeight: number, breakdown: LessBreakdownEntry[]) => {
    if (!activeLessCalc) return;
    handleUpdatePurchaseRow(activeLessCalc.itemId, {
      less_weight: totalWeight,
      less_breakdown: breakdown,
    });
    setActiveLessCalc(null);
  };

  // Registry (List View) State
  const [purchases, setPurchases] = useState<PurchaseBill[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoadingRegistry, setIsLoadingRegistry] = useState<boolean>(false);

  // Load Reference Masters on Mount
  useEffect(() => {
    Promise.all([
      supplierApi.list({ pageSize: 150, status: 'active' }).catch(() => ({ items: [] })),
      productApi.list({ pageSize: 150, status: 'active' }).catch(() => ({ items: [] })),
      rateApi.getCurrentRates().catch(() => []),
      rateApi.getMetals().catch(() => []),
      rateApi.getAllPurities().catch(() => []),
      settingsApi.getShopProfile().catch(() => null),
    ]).then(([supRes, prodRes, ratesRes, metalsRes, puritiesRes, profileRes]) => {
      const supList = (supRes as any)?.items || [];
      const prodList = (prodRes as any)?.items || [];
      const currentRates = ratesRes || [];
      const allMetals = metalsRes || [];
      const allPurities = puritiesRes || [];

      setSuppliers(supList);
      setProducts(prodList);
      setRates(currentRates);
      setMetals(allMetals);
      setPurities(allPurities);
      setShopProfile(profileRes);

      if (supList.length > 0) {
        setSupplierId(supList[0].id);
      }

      // Find standard 22K 916 gold rate
      const goldRate =
        currentRates.find(
          (r) =>
            (r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') &&
            (r.purity_name?.includes('22') || r.purity_name?.includes('916'))
        ) ||
        currentRates.find((r) => r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') ||
        currentRates[0];

      const defaultMetalId = goldRate?.metal_id || allMetals[0]?.id || '';
      const defaultPurityId = goldRate?.purity_id || allPurities[0]?.id || '';
      const firstProd = prodList[0];

      // Seed initial purchase item row
      const randomTag = Math.floor(1000 + Math.random() * 9000);
      setPurchaseItems([
        {
          id: `pur-row-${Date.now()}-1`,
          product_id: firstProd?.id || '',
          tag_no: `PUR-G-${randomTag}`,
          item_name: firstProd?.name || 'Gold Ring',
          metal_id: defaultMetalId,
          metal_name: goldRate?.metal_name || 'Gold',
          purity_id: defaultPurityId,
          purity_name: goldRate?.purity_name || '22K (916)',
          gross_weight: 10.0,
          less_weight: 0.1,
          tunch_percent: goldRate?.tunch_percent || 91.6,
          badla_percent: 0,
          wastage_percent: 0,
          pieces: 1,
          making_rate: 350,
          making_charge_type: 'PER_GRAM',
          rate_per_gram: goldRate?.rate || 7200,
        },
      ]);
    });
  }, []);

  // Fetch Purchases for Registry
  const fetchPurchases = useCallback(async () => {
    setIsLoadingRegistry(true);
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
      setIsLoadingRegistry(false);
    }
  }, [page, pageSize, search, supplierFilter, statusFilter]);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchPurchases();
    }
  }, [viewMode, fetchPurchases]);

  // Aggregate Metrics for Registry View
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

  // Selected Supplier Details
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId) || null;
  }, [suppliers, supplierId]);

  // Dynamic Item Row Helper
  const handleAddPurchaseRow = () => {
    const goldRate =
      rates.find(
        (r) =>
          (r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') &&
          (r.purity_name?.includes('22') || r.purity_name?.includes('916'))
      ) ||
      rates.find((r) => r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') ||
      rates[0];

    const defaultMetalId = goldRate?.metal_id || metals[0]?.id || '';
    const defaultPurityId = goldRate?.purity_id || purities[0]?.id || '';
    const randomTag = Math.floor(1000 + Math.random() * 9000);
    const firstProd = products[0];

    const newRow: PurchaseItemRow = {
      id: `pur-row-${Date.now()}-${purchaseItems.length + 1}`,
      product_id: firstProd?.id || '',
      tag_no: `PUR-G-${randomTag}`,
      item_name: firstProd?.name || 'Jewellery Item',
      metal_id: defaultMetalId,
      metal_name: goldRate?.metal_name || 'Gold',
      purity_id: defaultPurityId,
      purity_name: goldRate?.purity_name || '22K (916)',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: goldRate?.tunch_percent || 91.6,
      badla_percent: 0,
      wastage_percent: 0,
      pieces: 1,
      making_rate: 350,
      making_charge_type: 'PER_GRAM',
      rate_per_gram: goldRate?.rate || 7200,
    };

    setPurchaseItems((prev) => [...prev, newRow]);
  };

  const handleRemovePurchaseRow = (id: string) => {
    if (purchaseItems.length <= 1) {
      showToast('error', 'Purchase inward must have at least one line item');
      return;
    }
    setPurchaseItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdatePurchaseRow = (id: string, updates: Partial<PurchaseItemRow>) => {
    setPurchaseItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // When product changes, sync default metal, purity, tunch, and rate
        if (updates.product_id && updates.product_id !== item.product_id) {
          const prod = products.find((p) => p.id === updates.product_id);
          if (prod) {
            updated.item_name = prod.name;
            if (prod.default_metal) {
              const m = metals.find((met) => met.code === prod.default_metal);
              if (m) updated.metal_id = m.id;
            }
            if (updated.metal_id && prod.default_purity) {
              const p = purities.find((pur) => pur.metal_id === updated.metal_id && pur.code === prod.default_purity);
              if (p) {
                updated.purity_id = p.id;
                if (p.tunch_percent) updated.tunch_percent = p.tunch_percent;
              }
            }
            const matchingRate = rates.find(
              (r) => r.metal_id === updated.metal_id && r.purity_id === updated.purity_id
            );
            if (matchingRate && matchingRate.rate) {
              updated.rate_per_gram = matchingRate.rate;
            }
          }
        }

        // When metal changes, find first purity for metal
        if (updates.metal_id && updates.metal_id !== item.metal_id) {
          const m = metals.find((met) => met.id === updates.metal_id);
          if (m) updated.metal_name = m.name;
          const available = purities.filter((pur) => pur.metal_id === updates.metal_id);
          if (available.length > 0) {
            updated.purity_id = available[0].id;
            updated.purity_name = available[0].name;
            if (available[0].tunch_percent) updated.tunch_percent = available[0].tunch_percent;
            const matchingRate = rates.find(
              (r) => r.metal_id === updates.metal_id && r.purity_id === available[0].id
            );
            if (matchingRate && matchingRate.rate) {
              updated.rate_per_gram = matchingRate.rate;
            }
          }
        }

        // When purity changes, sync tunch% and rate
        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((pur) => pur.id === updates.purity_id);
          if (p) {
            updated.purity_name = p.name;
            if (p.tunch_percent) updated.tunch_percent = p.tunch_percent;
            const matchingRate = rates.find(
              (r) => r.metal_id === updated.metal_id && r.purity_id === p.id
            );
            if (matchingRate && matchingRate.rate) {
              updated.rate_per_gram = matchingRate.rate;
            }
          }
        }

        // If tunch_percent (Purity / Badla) was edited, auto-resolve closest purity
        if (updates.tunch_percent !== undefined) {
          const tVal = Number(updates.tunch_percent);
          if (!isNaN(tVal) && tVal > 0) {
            const metalPurities = purities.filter((p) => p.metal_id === updated.metal_id);
            const pool = metalPurities.length > 0 ? metalPurities : purities;
            if (pool.length > 0) {
              const closest = pool.reduce((prev, curr) =>
                Math.abs(Number(curr.tunch_percent) - tVal) < Math.abs(Number(prev.tunch_percent) - tVal) ? curr : prev
              );
              if (closest) {
                updated.purity_id = closest.id;
                updated.purity_name = closest.name;
              }
            }
          }
        }

        return updated;
      })
    );
  };

  // Exchange Items Handlers (Old Metal Deduction / Exchange)
  const handleAddExchangeRow = () => {
    const goldMetal = metals.find((m) => m.name.toUpperCase().includes('GOLD')) || metals[0];
    const goldPurity = purities.find((p) => p.name.includes('22') || p.name.includes('916')) || purities[0];
    const currentRate = rates.find((r) => r.purity_id === goldPurity?.id) || rates[0];

    const newExRow: ExchangeItemRow = {
      id: `ex-pur-${Date.now()}-${exchangeItems.length + 1}`,
      tag_no: `EX-P-${Math.floor(Math.random() * 900 + 100)}`,
      item_name: 'Old Gold Scrap Return',
      metal_id: goldMetal?.id || '',
      metal_name: goldMetal?.name || 'Gold',
      purity_id: goldPurity?.id || '',
      purity_name: goldPurity?.name || '22K (916)',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: goldPurity?.tunch_percent || 91.67,
      badla_percent: 0,
      wastage_percent: 0,
      making_rate: 2,
      making_charge_type: 'PERCENTAGE',
      pieces: 1,
      deduction_percent: 2,
      exchange_rate: (currentRate?.rate || 7200) - 200,
    };
    setExchangeItems((prev) => [...prev, newExRow]);
  };

  const handleRemoveExchangeRow = (id: string) => {
    setExchangeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateExchangeRow = (id: string, updates: Partial<ExchangeItemRow>) => {
    setExchangeItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };

        if (updates.metal_id && updates.metal_id !== item.metal_id) {
          const m = metals.find((m) => m.id === updates.metal_id);
          updated.metal_name = m ? m.name : '';
          const metalPurities = purities.filter((p) => p.metal_id === updates.metal_id);
          if (metalPurities.length > 0) {
            updated.purity_id = metalPurities[0].id;
            updated.purity_name = metalPurities[0].name;
            updated.tunch_percent = metalPurities[0].tunch_percent || 85;
          }
        }

        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((p) => p.id === updates.purity_id);
          updated.purity_name = p ? p.name : '';
          if (p && p.tunch_percent) updated.tunch_percent = p.tunch_percent;
        }

        // If tunch_percent (Purity / Badla) was edited, auto-resolve closest purity
        if (updates.tunch_percent !== undefined) {
          const tVal = Number(updates.tunch_percent);
          if (!isNaN(tVal) && tVal > 0) {
            const metalPurities = purities.filter((p) => p.metal_id === updated.metal_id);
            const pool = metalPurities.length > 0 ? metalPurities : purities;
            if (pool.length > 0) {
              const closest = pool.reduce((prev, curr) =>
                Math.abs(Number(curr.tunch_percent) - tVal) < Math.abs(Number(prev.tunch_percent) - tVal) ? curr : prev
              );
              if (closest) {
                updated.purity_id = closest.id;
                updated.purity_name = closest.name;
              }
            }
          }
        }

        return updated;
      })
    );
  };

  // Helper to find metal & default purity with rate for metal payments
  const findMetalAndPurity = (metalType: 'GOLD' | 'SILVER') => {
    const isGold = metalType === 'GOLD';
    const metal =
      metals.find((m) =>
        isGold
          ? m.code === 'GOLD' || m.name.toUpperCase().includes('GOLD')
          : m.code === 'SILVER' || m.name.toUpperCase().includes('SILVER')
      ) || metals[0];

    const metalPurities = purities.filter((p) => p.metal_id === metal?.id);
    const defaultPurity =
      metalPurities.find((p) =>
        isGold
          ? p.name.includes('22') || p.name.includes('916')
          : p.name.includes('999') || p.name.includes('925')
      ) || metalPurities[0];

    const matchingRate =
      rates.find((r) => r.purity_id === defaultPurity?.id && r.metal_id === metal?.id) ||
      rates.find((r) => r.purity_id === defaultPurity?.id) ||
      rates.find((r) => r.metal_id === metal?.id);

    const applicableRate = matchingRate && matchingRate.rate > 0 ? matchingRate.rate : 0;

    return {
      metalId: metal?.id || '',
      metalName: metal?.name || (isGold ? 'Gold' : 'Silver'),
      purityId: defaultPurity?.id || '',
      purityName: defaultPurity?.name || '',
      applicableRate,
    };
  };

  // Payment Rows Helpers
  const handleAddPaymentRow = () => {
    setPayments((prev) => [
      ...prev,
      {
        id: `pay-${Date.now()}-${prev.length + 1}`,
        payment_mode: 'BANK',
        amount: '',
        reference_number: '',
      },
    ]);
  };

  const handleAddMetalPaymentRow = (metalType: 'GOLD' | 'SILVER') => {
    const info = findMetalAndPurity(metalType);
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: metalType,
      amount: '',
      reference_number: '',
      metal_id: info.metalId,
      metal_name: info.metalName,
      purity_id: info.purityId,
      purity_name: info.purityName,
      metal_weight: '',
      metal_rate: info.applicableRate > 0 ? info.applicableRate : '',
      rate_error: info.applicableRate <= 0 ? 'No active rate configured for this metal & purity' : undefined,
      last_edited: 'amount',
    };
    setPayments((prev) => [...prev, newPay]);
  };

  const handleRemovePaymentRow = (id: string) => {
    if (payments.length <= 1) {
      setPayments([
        {
          id: `pay-${Date.now()}`,
          payment_mode: 'BANK',
          amount: '',
          reference_number: '',
        },
      ]);
      return;
    }
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePaymentRow = (id: string, updates: Partial<PaymentRow>) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };

        // If mode switched to GOLD or SILVER, initialize metal fields
        if (updates.payment_mode && updates.payment_mode !== p.payment_mode) {
          if (updates.payment_mode === 'GOLD' || updates.payment_mode === 'SILVER') {
            const info = findMetalAndPurity(updates.payment_mode);
            updated.metal_id = info.metalId;
            updated.metal_name = info.metalName;
            updated.purity_id = info.purityId;
            updated.purity_name = info.purityName;
            updated.metal_rate = info.applicableRate > 0 ? info.applicableRate : '';
            updated.rate_error = info.applicableRate <= 0 ? 'No active rate configured for this metal & purity' : undefined;

            const r = toDecimal(info.applicableRate || 0);
            if (r.gt(0)) {
              if (updated.metal_weight && toDecimal(updated.metal_weight).gt(0)) {
                updated.amount = toDecimal(updated.metal_weight).times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
              } else if (updated.amount && toDecimal(updated.amount).gt(0)) {
                updated.metal_weight = toDecimal(updated.amount).dividedBy(r).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
              }
            }
          }
        }

        // If purity changed for metal payment
        if (updates.purity_id && updates.purity_id !== p.purity_id) {
          const pur = purities.find((pu) => pu.id === updates.purity_id);
          updated.purity_name = pur ? pur.name : '';
          const matchingRate =
            rates.find((r) => r.purity_id === updates.purity_id && r.metal_id === updated.metal_id) ||
            rates.find((r) => r.purity_id === updates.purity_id);
          const newRate = matchingRate && matchingRate.rate > 0 ? matchingRate.rate : 0;
          updated.metal_rate = newRate > 0 ? newRate : '';
          updated.rate_error = newRate <= 0 ? 'No active rate configured for this purity' : undefined;

          const r = toDecimal(newRate);
          if (r.gt(0)) {
            if (updated.last_edited === 'weight' && updated.metal_weight) {
              const w = toDecimal(updated.metal_weight);
              updated.amount = w.times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
            } else if (updated.amount) {
              const a = toDecimal(updated.amount);
              updated.metal_weight = a.dividedBy(r).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
            }
          }
        }

        // If rate per gram was edited directly
        if (updates.metal_rate !== undefined) {
          const r = toDecimal(updates.metal_rate || 0);
          if (r.lte(0)) {
            updated.rate_error = 'Rate per gram must be greater than zero';
          } else {
            updated.rate_error = undefined;
            if (updated.last_edited === 'weight' && updated.metal_weight) {
              const w = toDecimal(updated.metal_weight);
              updated.amount = w.times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
            } else if (updated.amount) {
              const a = toDecimal(updated.amount);
              updated.metal_weight = a.dividedBy(r).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
            }
          }
        }

        return updated;
      })
    );
  };

  const handleMetalWeightChange = (id: string, value: string) => {
    const sanitized = parseDecimalInput(value, 4);
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const rate = toDecimal(p.metal_rate || 0);
        if (rate.lte(0)) {
          return {
            ...p,
            metal_weight: sanitized,
            amount: '',
            last_edited: 'weight',
            rate_error: 'Valid applicable rate is required to calculate payment value',
          };
        }
        const w = toDecimal(sanitized || 0);
        const amount =
          sanitized && !w.isZero()
            ? w.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
            : '';
        return {
          ...p,
          metal_weight: sanitized,
          amount,
          last_edited: 'weight',
          rate_error: undefined,
        };
      })
    );
  };

  const handlePaymentAmountChange = (id: string, value: string) => {
    const sanitized = parseDecimalInput(value, 2);
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const isMetal = ['GOLD', 'SILVER'].includes(p.payment_mode);
        if (isMetal) {
          const rate = toDecimal(p.metal_rate || 0);
          if (rate.gt(0)) {
            const a = toDecimal(sanitized || 0);
            const metal_weight =
              sanitized && !a.isZero()
                ? a.dividedBy(rate).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber()
                : '';
            return {
              ...p,
              amount: sanitized,
              metal_weight,
              last_edited: 'amount',
              rate_error: undefined,
            };
          }
        }
        return {
          ...p,
          amount: sanitized,
          last_edited: 'amount',
        };
      })
    );
  };

  // Live Precision Calculations (Ditto Math to Sales)
  const calculations = useMemo(() => {
    let totalGrossWeight = new Decimal(0);
    let totalLessWeight = new Decimal(0);
    let totalNetWeight = new Decimal(0);
    let totalFineWeight = new Decimal(0);
    let totalAdjustedFineWeight = new Decimal(0);
    let totalWastageWeight = new Decimal(0);
    let totalWastageAmount = new Decimal(0);
    let totalMakingCharges = new Decimal(0);
    let totalPurchaseAmount = new Decimal(0);

    let goldNetWeight = new Decimal(0);
    let goldFineWeight = new Decimal(0);
    let silverNetWeight = new Decimal(0);
    let silverFineWeight = new Decimal(0);

    purchaseItems.forEach((item) => {
      const gross = toDecimal(item.gross_weight);
      const less = toDecimal(item.less_weight);
      const net = Decimal.max(0, gross.minus(less));
      const tunch = toDecimal(item.tunch_percent);
      const wastage = toDecimal(item.wastage_percent);
      const badla = toDecimal(item.badla_percent || 0);
      const rate = toDecimal(item.rate_per_gram);

      // Fine weight is strictly pure metal content:
      // fineWeight = netWeight * (tunchPercent / 100)
      const pureFine = net.times(tunch).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

      // Wastage and Badla calculations are both based on pure fine weight (gold after purity):
      const badlaWeight = pureFine.times(badla).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const wasteOnlyWeight = pureFine.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const additionWeight = badlaWeight.plus(wasteOnlyWeight);
      const wastageWeight = additionWeight;
      const wastageAmount = wastageWeight.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      // Billable weight = fine weight + wastage weight + badla weight (positive adds, negative subtracts)
      const billableFine = !additionWeight.isZero()
        ? Decimal.max(0, pureFine.plus(additionWeight)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
        : pureFine;
      const metalVal = billableFine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const makingRate = toDecimal(item.making_rate);
      const pcs = toDecimal(item.pieces || 1);
      let making = new Decimal(0);
      if (item.making_charge_type === 'PERCENTAGE') {
        making = metalVal.times(makingRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else if (item.making_charge_type === 'PER_PIECE') {
        making = pcs.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else if (item.making_charge_type === 'FIXED') {
        making = makingRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        making = net.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      const rowAmount = metalVal.plus(making);

      totalGrossWeight = totalGrossWeight.plus(gross);
      totalLessWeight = totalLessWeight.plus(less);
      totalNetWeight = totalNetWeight.plus(net);
      totalFineWeight = totalFineWeight.plus(pureFine);
      totalAdjustedFineWeight = totalAdjustedFineWeight.plus(billableFine);
      totalWastageWeight = totalWastageWeight.plus(wastageWeight);
      totalWastageAmount = totalWastageAmount.plus(wastageAmount);
      totalMakingCharges = totalMakingCharges.plus(making);
      totalPurchaseAmount = totalPurchaseAmount.plus(rowAmount);

      const metalName = (item.metal_name || '').toUpperCase();
      const isSilver = metalName.includes('SILVER');
      const isDiamond = metalName.includes('DIAMOND');
      const isPlatinum = metalName.includes('PLATINUM');
      if (isSilver) {
        silverNetWeight = silverNetWeight.plus(net);
        silverFineWeight = silverFineWeight.plus(pureFine);
      } else if (!isDiamond && !isPlatinum) {
        goldNetWeight = goldNetWeight.plus(net);
        goldFineWeight = goldFineWeight.plus(pureFine);
      }
    });

    // Exchange calculations
    let totalExchangeGross = new Decimal(0);
    let totalExchangeLess = new Decimal(0);
    let totalExchangeNet = new Decimal(0);
    let totalExchangeFine = new Decimal(0);
    let totalExchangeAdjustedFine = new Decimal(0);
    let totalExchangeBadlaWeight = new Decimal(0);
    let totalExchangeWasteWeight = new Decimal(0);
    let totalExchangeDeduction = new Decimal(0);
    let totalExchangeValue = new Decimal(0);

    exchangeItems.forEach((ex) => {
      const gross = toDecimal(ex.gross_weight);
      const less = toDecimal(ex.less_weight);
      const net = Decimal.max(0, gross.minus(less));
      const tunch = toDecimal(ex.tunch_percent);
      const badla = toDecimal(ex.badla_percent || 0);
      const wastage = toDecimal(ex.wastage_percent || 0);
      const rate = toDecimal(ex.exchange_rate);

      const pureFine = net.times(tunch).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const badlaWeight = pureFine.times(badla).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const wasteWeight = pureFine.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const additionWeight = badlaWeight.plus(wasteWeight);

      const billableFine = !additionWeight.isZero()
        ? Decimal.max(0, pureFine.plus(additionWeight)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
        : pureFine;
      const metalVal = billableFine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const chargeType = ex.making_charge_type || 'PERCENTAGE';
      const makingRate = toDecimal(
        ex.making_rate !== undefined && ex.making_rate !== ''
          ? ex.making_rate
          : (ex.deduction_percent !== undefined ? ex.deduction_percent : 0)
      );
      const pcs = toDecimal(ex.pieces || 1);

      let deduction = new Decimal(0);
      if (chargeType === 'PERCENTAGE') {
        deduction = metalVal.times(makingRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else if (chargeType === 'PER_PIECE') {
        deduction = pcs.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else if (chargeType === 'FIXED') {
        deduction = makingRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        deduction = net.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      const exVal = Decimal.max(0, metalVal.minus(deduction));

      totalExchangeGross = totalExchangeGross.plus(gross);
      totalExchangeLess = totalExchangeLess.plus(less);
      totalExchangeNet = totalExchangeNet.plus(net);
      totalExchangeFine = totalExchangeFine.plus(pureFine);
      totalExchangeAdjustedFine = totalExchangeAdjustedFine.plus(billableFine);
      totalExchangeBadlaWeight = totalExchangeBadlaWeight.plus(badlaWeight);
      totalExchangeWasteWeight = totalExchangeWasteWeight.plus(wasteWeight);
      totalExchangeDeduction = totalExchangeDeduction.plus(deduction);
      totalExchangeValue = totalExchangeValue.plus(exVal);
    });

    const discount = toDecimal(discountAmount || 0);
    const netTaxable = Decimal.max(0, totalPurchaseAmount.minus(discount));
    const gstRateDec = toDecimal(gstRate);
    const gstAmount = netTaxable.times(gstRateDec).dividedBy(100);
    const cgst = gstAmount.dividedBy(2);
    const sgst = gstAmount.dividedBy(2);
    const rawGrandTotal = netTaxable.plus(gstAmount);
    const grandTotal = rawGrandTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const roundOff = grandTotal.minus(rawGrandTotal);

    // netPayable = grandTotal - totalExchangeValue
    const netPayable = Decimal.max(0, grandTotal.minus(totalExchangeValue));

    let cashAndOtherPayments = new Decimal(0);
    let goldPaymentValue = new Decimal(0);
    let goldPaymentGrams = new Decimal(0);
    let silverPaymentValue = new Decimal(0);
    let silverPaymentGrams = new Decimal(0);
    let totalPaid = new Decimal(0);

    payments.forEach((p) => {
      const amt = toDecimal(p.amount || 0);
      if (amt.gt(0)) {
        totalPaid = totalPaid.plus(amt);
        if (p.payment_mode === 'GOLD') {
          goldPaymentValue = goldPaymentValue.plus(amt);
          goldPaymentGrams = goldPaymentGrams.plus(toDecimal(p.metal_weight || 0));
        } else if (p.payment_mode === 'SILVER') {
          silverPaymentValue = silverPaymentValue.plus(amt);
          silverPaymentGrams = silverPaymentGrams.plus(toDecimal(p.metal_weight || 0));
        } else {
          cashAndOtherPayments = cashAndOtherPayments.plus(amt);
        }
      }
    });

    const balanceDue = Decimal.max(0, netPayable.minus(totalPaid));
    const excessPaid = Decimal.max(0, totalPaid.minus(netPayable));
    const isSettled = netPayable.gt(0) ? totalPaid.gte(netPayable) : false;

    return {
      totalGrossWeight: totalGrossWeight.toNumber(),
      totalLessWeight: totalLessWeight.toNumber(),
      totalNetWeight: totalNetWeight.toNumber(),
      totalFineWeight: totalFineWeight.toNumber(),
      totalAdjustedFineWeight: totalAdjustedFineWeight.toNumber(),
      totalWastageWeight: totalWastageWeight.toNumber(),
      totalWastageAmount: totalWastageAmount.toNumber(),
      totalMakingCharges: totalMakingCharges.toNumber(),
      totalPurchaseAmount: totalPurchaseAmount.toNumber(),
      goldNetWeight: goldNetWeight.toNumber(),
      goldFineWeight: goldFineWeight.toNumber(),
      silverNetWeight: silverNetWeight.toNumber(),
      silverFineWeight: silverFineWeight.toNumber(),
      totalExchangeGross: totalExchangeGross.toNumber(),
      totalExchangeLess: totalExchangeLess.toNumber(),
      totalExchangeNet: totalExchangeNet.toNumber(),
      totalExchangeFine: totalExchangeFine.toNumber(),
      totalExchangeAdjustedFine: totalExchangeAdjustedFine.toNumber(),
      totalExchangeBadlaWeight: totalExchangeBadlaWeight.toNumber(),
      totalExchangeWasteWeight: totalExchangeWasteWeight.toNumber(),
      totalExchangeDeduction: totalExchangeDeduction.toNumber(),
      totalExchangeValue: totalExchangeValue.toNumber(),
      netTaxable: netTaxable.toNumber(),
      gstAmount: gstAmount.toNumber(),
      cgst: cgst.toNumber(),
      sgst: sgst.toNumber(),
      roundOff: roundOff.toNumber(),
      grandTotal: grandTotal.toNumber(),
      netPayable: netPayable.toNumber(),
      cashAndOtherPayments: cashAndOtherPayments.toNumber(),
      goldPaymentValue: goldPaymentValue.toNumber(),
      goldPaymentGrams: goldPaymentGrams.toNumber(),
      silverPaymentValue: silverPaymentValue.toNumber(),
      silverPaymentGrams: silverPaymentGrams.toNumber(),
      totalPaid: totalPaid.toNumber(),
      balanceDue: balanceDue.toNumber(),
      excessPaid: excessPaid.toNumber(),
      isSettled,
    };
  }, [purchaseItems, exchangeItems, discountAmount, gstRate, payments]);

  // Quick Settle Full Payment
  const handleQuickSettle = (mode: 'BANK' | 'CASH' | 'UPI') => {
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payment_mode: mode,
        amount: calculations.netPayable,
        reference_number: mode !== 'CASH' ? 'NEFT/INWARD-PMT' : '',
      },
    ]);
  };

  const handleClearPayments = () => {
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payment_mode: 'BANK',
        amount: '',
        reference_number: '',
      },
    ]);
  };

  // Reset to Fresh Blank Purchase
  const handleStartNewBill = () => {
    setActiveBillId(null);
    setActivePurchaseNumber(
      `PUR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    );
    setSupplierInvoiceNumber('');
    setDiscountAmount(0);
    setNotes('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setExchangeItems([]);

    const goldRate =
      rates.find(
        (r) =>
          (r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') &&
          (r.purity_name?.includes('22') || r.purity_name?.includes('916'))
      ) || rates[0];

    const defaultMetalId = goldRate?.metal_id || metals[0]?.id || '';
    const defaultPurityId = goldRate?.purity_id || purities[0]?.id || '';
    const firstProd = products[0];

    const randomTag = Math.floor(1000 + Math.random() * 9000);
    setPurchaseItems([
      {
        id: `pur-row-${Date.now()}-1`,
        product_id: firstProd?.id || '',
        tag_no: `PUR-G-${randomTag}`,
        item_name: firstProd?.name || 'Gold Jewellery',
        metal_id: defaultMetalId,
        metal_name: goldRate?.metal_name || 'Gold',
        purity_id: defaultPurityId,
        purity_name: goldRate?.purity_name || '22K (916)',
        gross_weight: 10.0,
        less_weight: 0.1,
        tunch_percent: goldRate?.tunch_percent || 91.6,
        wastage_percent: 0,
        pieces: 1,
        making_rate: 350,
        making_charge_type: 'PER_GRAM',
        rate_per_gram: goldRate?.rate || 7200,
      },
    ]);

    setPayments([
      {
        id: `pay-init-${Date.now()}`,
        payment_mode: 'BANK',
        amount: '',
        reference_number: '',
      },
    ]);

    setViewMode('form');
    showToast('success', 'Ready for new purchase inward bill');
  };

  // Open Existing Bill from Registry
  const handleOpenExistingBill = async (billId: string) => {
    try {
      setIsSubmitting(true);
      const bill = await purchaseApi.getById(billId);
      setActiveBillId(bill.id);
      setActivePurchaseNumber(bill.purchase_number);
      setSupplierId(bill.supplier_id);
      setPurchaseDate(bill.purchase_date);
      setSupplierInvoiceNumber(bill.supplier_invoice_number || '');
      setDiscountAmount(bill.discount_amount);
      setGstRate(bill.gst_rate);
      setNotes(bill.notes || '');

      if (bill.items && bill.items.length > 0) {
        setPurchaseItems(
          bill.items.map((it) => ({
            id: it.id,
            product_id: it.product_id,
            tag_no: it.tag_no,
            item_name: it.item_name || it.product_name || 'Jewellery Item',
            metal_id: it.metal_id,
            metal_name: it.metal_name || 'Gold',
            purity_id: it.purity_id,
            purity_name: it.purity_name || '22K',
            gross_weight: it.gross_weight,
            less_weight: it.less_weight,
            tunch_percent: it.tunch_percent,
            badla_percent: 0,
            wastage_percent: it.wastage_percent || 0,
            pieces: 1,
            making_rate: it.making_charge,
            making_charge_type: 'FIXED',
            rate_per_gram: it.rate_per_gram,
            huid: it.huid || undefined,
            notes: it.notes || undefined,
          }))
        );
      }

      if (bill.payments && bill.payments.length > 0) {
        setPayments(
          bill.payments.map((p) => ({
            id: p.id,
            payment_mode: p.payment_mode,
            amount: p.amount,
            metal_weight: p.metal_weight,
            metal_rate: p.metal_rate,
            metal_id: p.metal_id,
            purity_id: p.purity_id,
            reference_number: p.reference_number || undefined,
            notes: p.notes || undefined,
          }))
        );
      } else {
        setPayments([
          {
            id: `pay-${Date.now()}`,
            payment_mode: 'BANK',
            amount: '',
            reference_number: '',
          },
        ]);
      }

      setViewMode('form');
      showToast('success', `Loaded purchase bill: ${bill.purchase_number}`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load purchase bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit / Save Purchase Bill (Draft or Finalize)
  const handleSavePurchase = async (finalize = false) => {
    if (!supplierId) {
      showToast('error', 'Please select a supplier');
      return;
    }

    if (purchaseItems.length === 0 && exchangeItems.length === 0) {
      showToast('error', 'Please add at least one purchase item or exchange item');
      return;
    }

    // Validate weights and inputs
    for (const item of purchaseItems) {
      const gross = toDecimal(item.gross_weight);
      const less = toDecimal(item.less_weight);
      const rate = toDecimal(item.rate_per_gram);

      if (!item.tag_no.trim()) {
        showToast('error', `Tag number is required for "${item.item_name}"`);
        return;
      }
      if (gross.lte(0)) {
        showToast('error', `Gross weight must be greater than zero for "${item.item_name}"`);
        return;
      }
      if (less.gt(gross)) {
        showToast('error', `Less weight cannot exceed gross weight for "${item.item_name}"`);
        return;
      }
      if (rate.lte(0)) {
        showToast('error', `Rate per gram must be greater than zero for "${item.item_name}"`);
        return;
      }
    }

    for (const ex of exchangeItems) {
      const gross = toDecimal(ex.gross_weight);
      const less = toDecimal(ex.less_weight);
      if (gross.lte(0)) {
        showToast('error', `Gross weight must be greater than zero for exchange item "${ex.item_name}"`);
        return;
      }
      if (less.gt(gross)) {
        showToast('error', `Less weight cannot exceed gross weight for exchange item "${ex.item_name}"`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Include exchange return details in purchase notes if exchange items exist
      let combinedNotes = notes.trim();
      if (exchangeItems.length > 0) {
        const exSummary = exchangeItems
          .map(
            (e) =>
              `[Scrap Deduct: ${e.item_name} Net:${formatWeight(toDecimal(e.gross_weight).minus(toDecimal(e.less_weight)), 3)}g Val:₹${formatCurrency(
                toDecimal(e.gross_weight).minus(toDecimal(e.less_weight)).times(toDecimal(e.tunch_percent)).dividedBy(100).times(toDecimal(e.exchange_rate)).toNumber()
              )}]`
          )
          .join(' ');
        combinedNotes = combinedNotes ? `${combinedNotes} | ${exSummary}` : exSummary;
      }

      const payload = {
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        supplier_invoice_number: supplierInvoiceNumber.trim() || undefined,
        discount_amount: toDecimal(discountAmount).toNumber(),
        gst_rate: toDecimal(gstRate).toNumber(),
        notes: combinedNotes || undefined,
        items: purchaseItems.map((item) => {
          const gross = toDecimal(item.gross_weight);
          const less = toDecimal(item.less_weight);
          const net = Decimal.max(0, gross.minus(less));
          const tunch = toDecimal(item.tunch_percent);
          const fine = net.times(tunch).dividedBy(100);
          const wastage = toDecimal(item.wastage_percent);
          const badla = toDecimal(item.badla_percent || 0);
          const totalAdditionPercent = wastage.plus(badla);
          const wastageWeight = fine.times(totalAdditionPercent).dividedBy(100);
          const billableFine = !totalAdditionPercent.isZero() ? Decimal.max(0, fine.plus(wastageWeight)) : fine;
          const rate = toDecimal(item.rate_per_gram);
          const metalVal = billableFine.times(rate);

          const makingRate = toDecimal(item.making_rate);
          const pcs = toDecimal(item.pieces || 1);
          let making = new Decimal(0);
          if (item.making_charge_type === 'PERCENTAGE') {
            making = metalVal.times(makingRate).dividedBy(100);
          } else if (item.making_charge_type === 'PER_PIECE') {
            making = pcs.times(makingRate);
          } else if (item.making_charge_type === 'FIXED') {
            making = makingRate;
          } else {
            making = net.times(makingRate);
          }

          return {
            product_id: item.product_id,
            metal_id: item.metal_id,
            purity_id: item.purity_id,
            tag_no: item.tag_no.trim().toUpperCase(),
            gross_weight: gross.toNumber(),
            less_weight: less.toNumber(),
            tunch_percent: tunch.toNumber(),
            badla_percent: badla.toNumber(),
            wastage_percent: toDecimal(item.wastage_percent).toNumber(),
            making_charge: making.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
            rate_per_gram: rate.toNumber(),
            huid: item.huid?.trim() || undefined,
            notes: item.notes?.trim() || undefined,
          };
        }),
        payments: payments
          .filter((p) => toDecimal(p.amount).gt(0))
          .map((p) => ({
            payment_mode: p.payment_mode,
            amount: toDecimal(p.amount).toNumber(),
            metal_weight: p.metal_weight ? toDecimal(p.metal_weight).toNumber() : undefined,
            metal_rate: p.metal_rate ? toDecimal(p.metal_rate).toNumber() : undefined,
            metal_id: p.metal_id || undefined,
            purity_id: p.purity_id || undefined,
            reference_number: p.reference_number?.trim() || undefined,
            notes: p.notes?.trim() || undefined,
          })),
      };

      const created = await purchaseApi.create(payload);

      if (finalize) {
        try {
          const finalized = await purchaseApi.finalize(created.id);
          setPrintBill(finalized);
          setShowPrintModal(true);
          showToast(
            'success',
            `Purchase ${finalized.purchase_number} finalized! ${finalized.items.length} items added to inventory stock.`
          );
          fetchPurchases();
        } catch (finErr: any) {
          showToast('error', `Bill saved as draft, but finalization failed: ${finErr.message}`);
          setPrintBill(created);
          setShowPrintModal(true);
        }
      } else {
        setPrintBill(created);
        setShowPrintModal(true);
        showToast('success', `Purchase Draft ${created.purchase_number} saved successfully!`);
        fetchPurchases();
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save purchase bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Supplier Creation Modal Handlers
  const handleOpenSupplierModal = () => {
    setSupplierFormError(null);
    setSupplierForm({
      name: '',
      supplier_code: '',
      phone: '',
      alternate_phone: '',
      email: '',
      contact_person: '',
      address: '',
      city: shopProfile?.city || '',
      state: shopProfile?.state || 'Maharashtra',
      pincode: shopProfile?.pincode || '',
      gstin: '',
      opening_balance: 0,
      opening_balance_type: 'CREDIT',
      notes: '',
    });
    setShowSupplierModal(true);
  };

  const handleCreateSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      setSupplierFormError('Supplier full company/firm name is required');
      return;
    }

    setSupplierSubmitting(true);
    setSupplierFormError(null);

    try {
      const created = await supplierApi.create({
        name: supplierForm.name.trim(),
        supplier_code: supplierForm.supplier_code.trim() || undefined,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        address: supplierForm.address.trim() || null,
        city: supplierForm.city.trim() || null,
        state: supplierForm.state.trim() || null,
        pincode: supplierForm.pincode.trim() || null,
        gstin: supplierForm.gstin.trim() ? supplierForm.gstin.trim().toUpperCase() : null,
        notes: supplierForm.notes.trim() || null,
      });

      setSuppliers((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      setSupplierId(created.id);
      showToast('success', `Supplier "${created.name}" created & selected!`);
      setShowSupplierModal(false);
    } catch (err: any) {
      setSupplierFormError(err.message || 'Failed to create supplier in Master');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  // Quick Bullion Market Walk-in Supplier
  const handleQuickMarketSupplier = async () => {
    try {
      const existing = suppliers.find(
        (s) =>
          s.name.toLowerCase().includes('bullion market') ||
          s.name.toLowerCase().includes('cash purchase') ||
          s.name.toLowerCase().includes('zaveri')
      );
      if (existing) {
        setSupplierId(existing.id);
        showToast('success', `Selected ${existing.name}`);
        return;
      }

      const created = await supplierApi.create({
        name: 'Zaveri Bullion Market Supplier',
        supplier_code: 'SUP-BULLION',
        phone: '9820000000',
        address: 'Zaveri Bazaar Bullion Counter',
        city: shopProfile?.city || 'Mumbai',
        state: shopProfile?.state || 'Maharashtra',
      });
      setSuppliers((prev) => [created, ...prev]);
      setSupplierId(created.id);
      showToast('success', 'Selected Zaveri Bullion Market Supplier');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create bullion supplier');
    }
  };

  return (
    <div className="pos-page-container">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`pos-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* WORKSTATION TOP HEADER */}
      <div className="pos-workstation-header">
        <div className="pos-header-left">
          <button
            type="button"
            className="back-nav-btn"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
          <div className="header-title-wrapper">
            <h1 className="pos-main-title font-serif">
              {viewMode === 'form' ? 'New Purchase Bill' : 'Purchase Inward Registry'}
            </h1>
            {viewMode === 'form' && (
              <span className="bill-tag-badge font-mono">
                {activePurchaseNumber}
                <span className="badge-draft">DRAFT</span>
              </span>
            )}
          </div>
        </div>

        {/* View Toggle and Actions */}
        <div className="pos-header-right">
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'form' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              if (viewMode !== 'form') {
                handleStartNewBill();
              }
            }}
          >
            <Plus size={14} />
            <span>New Purchase Inward</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              setViewMode('list');
              fetchPurchases();
            }}
          >
            <Receipt size={14} />
            <span>Purchase Registry ({total})</span>
          </button>

          {viewMode === 'form' && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleStartNewBill}
                disabled={isSubmitting}
                title="Clear current purchase form"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSavePurchase(false)}
                disabled={isSubmitting}
              >
                <Save size={15} />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm font-semibold"
                onClick={() => handleSavePurchase(true)}
                disabled={isSubmitting}
              >
                <CheckCircle size={15} />
                <span>{isSubmitting ? 'Processing...' : 'Save & Finalize Bill'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TRANSACTION NAVIGATION TABS BAR (DITTO TO SALES) */}
      <div className="pos-nav-tabs-bar">
        <div className="nav-tabs-group">
          <button
            type="button"
            className="pos-tab-pill link-tab"
            onClick={() => navigate('/billing/create')}
          >
            Retail Sale
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab"
            onClick={() => navigate('/billing/create')}
          >
            Wholesale
          </button>
          <button
            type="button"
            className="pos-tab-pill active"
            onClick={() => setViewMode('form')}
          >
            Purchase Bill
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab"
            onClick={() => navigate('/billing/karigar-bill')}
          >
            Karigar Bill
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab"
            onClick={() => navigate('/billing/exchange')}
          >
            Exchange
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab"
            onClick={() => navigate('/billing/repair')}
          >
            Repair Bill
          </button>
        </div>

        {/* Live Board Rates Indicator */}
        <div className="live-rates-ticker">
          <span className="ticker-label">Today's Board:</span>
          {rates.slice(0, 3).map((r) => (
            <span key={r.purity_id} className="rate-pill font-mono">
              {r.metal_name} {r.purity_name}: <strong>₹{r.rate?.toLocaleString('en-IN')}/g</strong>
            </span>
          ))}
        </div>
      </div>

      {viewMode === 'form' ? (
        <>
          {/* SUPPLIER & INVOICE META CARD (DITTO TO CUSTOMER & META CARD) */}
          <div className="pos-meta-card">
            <div className="meta-grid">
              {/* Supplier Selection */}
              <div className="meta-col customer-col">
                <div className="flex items-center justify-between mb-1">
                  <label className="meta-label">Supplier Name *</label>
                  <div className="customer-header-actions">
                    <button
                      type="button"
                      className="quick-walkin-link"
                      onClick={handleQuickMarketSupplier}
                      title="Select or create Zaveri Bullion Market Supplier"
                    >
                      <Truck size={12} />
                      <span>+ Bullion Supplier</span>
                    </button>
                    <button
                      type="button"
                      className="quick-add-customer-link"
                      onClick={handleOpenSupplierModal}
                      title="Create new supplier in Master directory & select for purchase"
                    >
                      <UserPlus size={12} />
                      <span>+ Add Supplier</span>
                    </button>
                  </div>
                </div>
                <select
                  className="pos-input customer-select font-mono"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  {suppliers.length === 0 ? (
                    <option value="">No suppliers found — Click + Add Supplier</option>
                  ) : (
                    suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code}) {s.phone ? `• ${s.phone}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Phone, GSTIN & Address Box */}
              <div className="meta-col contact-col">
                <label className="meta-label">Supplier Info & GSTIN</label>
                <div className="customer-info-box font-mono text-xs">
                  <span className="text-main font-semibold">
                    {selectedSupplier?.phone || 'No Phone'}
                  </span>
                  {selectedSupplier?.gstin && (
                    <span className="text-gold ml-2">GSTIN: {selectedSupplier.gstin}</span>
                  )}
                  <span className="text-muted ml-2">
                    {selectedSupplier?.city ? `(${selectedSupplier.city})` : ''}
                  </span>
                </div>
              </div>

              {/* Purchase Inward Date */}
              <div className="meta-col date-col">
                <label className="meta-label">Purchase Date *</label>
                <input
                  type="date"
                  className="pos-input font-mono"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              {/* Supplier Invoice / Challan Number */}
              <div className="meta-col supply-col">
                <label className="meta-label">Supplier Bill / Invoice #</label>
                <input
                  type="text"
                  className="pos-input font-mono uppercase"
                  placeholder="e.g. ZAV/2026/894"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: PURCHASE ITEMS TABLE (DITTO TO SALE ITEMS) */}
          <div className="pos-section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="gold" />
                <h2 className="section-title">Purchase Items</h2>
                <span className="item-count-badge font-mono">{purchaseItems.length} item(s)</span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAddPurchaseRow}
              >
                <Plus size={14} />
                <span>Add Row</span>
              </button>
            </div>

            <div className="table-responsive">
              <table className="pos-grid-table">
                <thead>
                  <tr>
                    <th className="col-idx">#</th>
                    <th className="col-tag">Tag No</th>
                    <th className="col-desc">Product / Design ▾</th>
                    <th className="col-metal">Metal</th>
                    <th className="col-purity text-right" title="Tunch% (Acts as Purity)">Tunch%</th>
                    <th className="col-gross text-right">Gross (g)</th>
                    <th className="col-less text-right">Less (g)</th>
                    <th className="col-net text-right">Net (g)</th>
                    <th className="col-badla text-right" title="Badla% (Added to Fine Weight)">Badla%</th>
                    <th className="col-waste text-right" title="Waste% (Added to Fine Weight)">Waste%</th>
                    <th className="col-making text-center">Making Charge</th>
                    <th className="col-fine text-right">Fine Wt</th>
                    <th className="col-rate text-right">Rate/g (₹)</th>
                    <th className="col-amount text-right">Amount (₹)</th>
                    <th className="col-action text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseItems.map((item, idx) => {
                    const gross = toDecimal(item.gross_weight);
                    const less = toDecimal(item.less_weight);
                    const net = Decimal.max(0, gross.minus(less));
                    const tunch = toDecimal(item.tunch_percent);
                    const badla = toDecimal(item.badla_percent || 0);
                    const wastage = toDecimal(item.wastage_percent);
                    const rate = toDecimal(item.rate_per_gram);

                    const pureFine = net.times(tunch).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                    const badlaWeight = pureFine.times(badla).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                    const wasteWeight = pureFine.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                    const additionWeight = badlaWeight.plus(wasteWeight);
                    const totalAdditionPercent = badla.plus(wastage);

                    const billableFine = !additionWeight.isZero()
                      ? Decimal.max(0, pureFine.plus(additionWeight)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
                      : pureFine;
                    const metalVal = billableFine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                    const makingRate = toDecimal(item.making_rate);
                    const pcs = toDecimal(item.pieces || 1);
                    let making = new Decimal(0);
                    if (item.making_charge_type === 'PERCENTAGE') {
                      making = metalVal.times(makingRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                    } else if (item.making_charge_type === 'PER_PIECE') {
                      making = pcs.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                    } else if (item.making_charge_type === 'FIXED') {
                      making = makingRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                    } else {
                      making = net.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                    }
                    const rowAmount = metalVal.plus(making);

                    return (
                      <tr key={item.id} className="pos-grid-row">
                        <td className="text-center">
                          <div className="grid-index-cell font-mono text-muted text-xs">{idx + 1}</div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="grid-input font-mono text-xs text-gold uppercase"
                            value={item.tag_no}
                            onChange={(e) => handleUpdatePurchaseRow(item.id, { tag_no: e.target.value })}
                            placeholder="TAG-NO"
                          />
                        </td>
                        <td>
                          <select
                            className="grid-select font-semibold"
                            value={item.product_id}
                            onChange={(e) => handleUpdatePurchaseRow(item.id, { product_id: e.target.value })}
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.product_code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="grid-select font-mono text-xs"
                            value={item.metal_id}
                            onChange={(e) => handleUpdatePurchaseRow(item.id, { metal_id: e.target.value })}
                          >
                            {metals.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="grid-input text-right font-mono text-xs"
                            value={item.tunch_percent ?? ''}
                            onChange={(e) =>
                              handleUpdatePurchaseRow(item.id, {
                                tunch_percent: parseDecimalInput(e.target.value, 4),
                              })
                            }
                            placeholder="91.67"
                            title={item.purity_name ? `${item.purity_name} (Tunch: ${item.tunch_percent}%)` : 'Tunch% (Purity)'}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="grid-input text-right font-mono text-main font-bold"
                            value={item.gross_weight ?? ''}
                            onChange={(e) =>
                              handleUpdatePurchaseRow(item.id, {
                                gross_weight: parseDecimalInput(e.target.value, 4),
                              })
                            }
                            placeholder="0.000"
                          />
                        </td>
                        <td>
                          <div className="less-cell-wrap">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="grid-input text-right font-mono text-muted"
                              value={item.less_weight ?? ''}
                              onChange={(e) =>
                                handleUpdatePurchaseRow(item.id, {
                                  less_weight: parseDecimalInput(e.target.value, 4),
                                })
                              }
                              placeholder="0.000"
                              title="Less Weight in grams (Stones, Wax, etc.)"
                            />
                            <button
                              type="button"
                              className={`btn-less-calc ${item.less_breakdown && item.less_breakdown.length > 0 ? 'has-breakdown' : ''}`}
                              onClick={() => handleOpenPurchaseLessCalculator(item)}
                              title={
                                item.less_breakdown && item.less_breakdown.length > 0
                                  ? `Less Weight Breakdown (${item.less_breakdown.length} entries: ${formatWeight(item.less_weight, 3)}g)`
                                  : "Open Less Weight Breakdown Calculator"
                              }
                            >
                              <Calculator size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="grid-readonly-cell net">
                            {formatWeight(net, 3)}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="text"
                            className="grid-input text-right font-mono text-xs"
                            value={item.badla_percent ?? ''}
                            onChange={(e) =>
                              handleUpdatePurchaseRow(item.id, {
                                badla_percent: parseDecimalInput(e.target.value, 2, true),
                              })
                            }
                            placeholder="0"
                            title="Badla % (Positive adds, Negative subtracts from Fine Weight)"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="text"
                            className="grid-input text-right font-mono text-xs"
                            value={item.wastage_percent ?? ''}
                            onChange={(e) =>
                              handleUpdatePurchaseRow(item.id, {
                                wastage_percent: parseDecimalInput(e.target.value, 2, true),
                              })
                            }
                            placeholder="0"
                            title="Waste % (Positive adds, Negative subtracts from Fine Weight)"
                          />
                        </td>
                        <td>
                          <div className="making-cell-wrap">
                            <div className="making-input-group">
                              <select
                                className="making-select font-mono"
                                value={item.making_charge_type}
                                onChange={(e) =>
                                  handleUpdatePurchaseRow(item.id, {
                                    making_charge_type: e.target.value as any,
                                  })
                                }
                                title="Making Mode: /g (Per Gram), /pc (Per Piece), Fix (Fixed Lump Sum), or % (Percentage)"
                              >
                                <option value="PER_GRAM">/g</option>
                                <option value="PER_PIECE">/pc</option>
                                <option value="FIXED">Fix</option>
                                <option value="PERCENTAGE">%</option>
                              </select>
                              {item.making_charge_type === 'PER_PIECE' && (
                                <div className="making-pcs-box" title="Number of pieces">
                                  <input
                                    type="number"
                                    min={1}
                                    className="making-pcs-input font-mono"
                                    value={item.pieces ?? 1}
                                    onChange={(e) =>
                                      handleUpdatePurchaseRow(item.id, {
                                        pieces: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    placeholder="1"
                                  />
                                  <span className="making-pcs-unit">pc</span>
                                </div>
                              )}
                              <div className="making-rate-box">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="making-rate-input font-mono text-right"
                                  value={item.making_rate ?? ''}
                                  onChange={(e) =>
                                    handleUpdatePurchaseRow(item.id, {
                                      making_rate: parseDecimalInput(e.target.value, 2),
                                    })
                                  }
                                  placeholder={
                                    item.making_charge_type === 'PER_PIECE'
                                      ? '₹/pc'
                                      : item.making_charge_type === 'FIXED'
                                      ? '₹ Fix'
                                      : item.making_charge_type === 'PERCENTAGE'
                                      ? '%'
                                      : '350'
                                  }
                                />
                              </div>
                            </div>
                            <div className="making-sub-label font-mono">
                              {item.making_charge_type === 'PER_PIECE'
                                ? `₹${making.toFixed(2)} (${item.pieces || 1} pc)`
                                : item.making_charge_type === 'FIXED'
                                ? `₹${making.toFixed(2)} (Fixed)`
                                : item.making_charge_type === 'PERCENTAGE'
                                ? `₹${making.toFixed(2)} (${item.making_rate || 0}%)`
                                : `₹${making.toFixed(2)} (@₹${item.making_rate || 0}/g)`}
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          <div
                            className="grid-readonly-cell fine font-mono font-bold"
                            title={
                              !totalAdditionPercent.isZero()
                                ? `Pure Fine Wt: ${formatFineWeight(pureFine, 4)}g | ${totalAdditionPercent.gt(0) ? 'Addition' : 'Deduction'} (Badla+Waste): ${totalAdditionPercent.gt(0) ? '+' : ''}${formatFineWeight(additionWeight, 4)}g | Billable Fine Wt: ${formatFineWeight(billableFine, 4)}g`
                                : `Fine Weight: ${formatFineWeight(pureFine, 4)}g`
                            }
                          >
                            {formatFineWeight(billableFine, 4)}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="grid-input text-right font-mono font-semibold text-main"
                            value={item.rate_per_gram ?? ''}
                            onChange={(e) =>
                              handleUpdatePurchaseRow(item.id, {
                                rate_per_gram: parseDecimalInput(e.target.value, 2),
                              })
                            }
                            placeholder="7200"
                          />
                        </td>
                        <td className="text-right">
                          <div className="grid-readonly-cell amount">
                            {formatCurrency(rowAmount.toNumber())}
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="grid-action-cell">
                            <button
                              type="button"
                              className="btn-trash-row"
                              onClick={() => handleRemovePurchaseRow(item.id)}
                              title="Delete line"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* TOTALS FOOTER ROW */}
                <tfoot>
                  <tr className="pos-totals-row">
                    <td colSpan={5} className="font-bold text-main text-xs uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>TOTAL</span>
                        <span className="badge-metal-summary whitespace-nowrap">
                          ■ Gold: {formatWeight(calculations.goldNetWeight, 3)}g
                        </span>
                        {calculations.silverNetWeight > 0 && (
                          <span className="badge-metal-summary silver whitespace-nowrap">
                            ■ Silv: {formatWeight(calculations.silverNetWeight, 3)}g
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-mono font-bold text-main whitespace-nowrap">
                      {formatWeight(calculations.totalGrossWeight, 3)}
                    </td>
                    <td className="text-right font-mono text-muted whitespace-nowrap">
                      {formatWeight(calculations.totalLessWeight, 3)}
                    </td>
                    <td className="text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                      {formatWeight(calculations.totalNetWeight, 3)}
                    </td>
                    <td></td>
                    <td></td>
                    <td className="text-right font-mono text-xs text-muted whitespace-nowrap">
                      Labour: {formatCurrency(calculations.totalMakingCharges)}
                    </td>
                    <td className="text-right font-mono font-bold text-muted whitespace-nowrap" title={`Total Pure Fine: ${formatFineWeight(calculations.totalFineWeight, 4)}g | Total Billable Fine: ${formatFineWeight(calculations.totalAdjustedFineWeight, 4)}g`}>
                      {formatFineWeight(calculations.totalAdjustedFineWeight, 4)}
                    </td>
                    <td></td>
                    <td className="text-right font-mono font-bold text-gold text-base whitespace-nowrap">
                      {formatCurrency(calculations.totalPurchaseAmount)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* SECTION 2: EXCHANGE / OLD METAL RETURN (DITTO TO SALES EXCHANGE) */}
          <div className="pos-section-card mt-4">
            <div className="section-card-header exchange-header">
              <div className="flex items-center gap-2">
                <Coins size={17} className="gold" />
                <div>
                  <h2 className="section-title">Exchange / Old Metal Return</h2>
                  <span className="section-subtitle">Old scrap jewellery deduction & touch valuation</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAddExchangeRow}
              >
                <Plus size={14} />
                <span>Add Row</span>
              </button>
            </div>

            {exchangeItems.length === 0 ? (
              <div className="no-exchange-box">
                <div className="no-exchange-icon-wrap">
                  <Coins size={24} className="gold" />
                </div>
                <p className="no-exchange-title">No old metal exchange items linked to this purchase bill.</p>
                <p className="no-exchange-hint">Record old scrap or return metal purity & valuation to deduct from purchase</p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddExchangeRow}
                >
                  <Coins size={14} />
                  <span>+ Add Old Metal Scrap / Exchange</span>
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="pos-grid-table">
                  <thead>
                    <tr>
                      <th className="col-idx">#</th>
                      <th className="col-tag">Tag No</th>
                      <th className="col-desc">Item Description</th>
                      <th className="col-metal">Metal</th>
                      <th className="col-purity text-right" title="Tunch% (Acts as Purity)">Tunch%</th>
                      <th className="col-gross text-right">Gross (g)</th>
                      <th className="col-less text-right">Less (g)</th>
                      <th className="col-net text-right">Net (g)</th>
                      <th className="col-badla text-right" title="Badla% (Added to/Subtracted from Fine Weight)">Badla%</th>
                      <th className="col-waste text-right" title="Waste% (Refining / Melting Loss)">Waste%</th>
                      <th className="col-making text-center" title="Making / Melting / Deduction Charge">Making Charge</th>
                      <th className="col-fine text-right">Fine Wt</th>
                      <th className="col-rate text-right">Rate/g (₹)</th>
                      <th className="col-amount text-right">Amount (₹)</th>
                      <th className="col-action text-center">✕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exchangeItems.map((ex, idx) => {
                      const gross = toDecimal(ex.gross_weight);
                      const less = toDecimal(ex.less_weight);
                      const net = Decimal.max(0, gross.minus(less));
                      const tunch = toDecimal(ex.tunch_percent);
                      const badla = toDecimal(ex.badla_percent || 0);
                      const wastage = toDecimal(ex.wastage_percent || 0);
                      const rate = toDecimal(ex.exchange_rate);

                      const pureFine = net.times(tunch).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                      const badlaWeight = pureFine.times(badla).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                      const wasteWeight = pureFine.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                      const additionWeight = badlaWeight.plus(wasteWeight);
                      const totalAdditionPercent = badla.plus(wastage);

                      const billableFine = !additionWeight.isZero()
                        ? Decimal.max(0, pureFine.plus(additionWeight)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
                        : pureFine;
                      const metalVal = billableFine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                      const chargeType = ex.making_charge_type || 'PERCENTAGE';
                      const makingRate = toDecimal(
                        ex.making_rate !== undefined && ex.making_rate !== ''
                          ? ex.making_rate
                          : (ex.deduction_percent !== undefined ? ex.deduction_percent : 0)
                      );
                      const pcs = toDecimal(ex.pieces || 1);

                      let deduction = new Decimal(0);
                      if (chargeType === 'PERCENTAGE') {
                        deduction = metalVal.times(makingRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                      } else if (chargeType === 'PER_PIECE') {
                        deduction = pcs.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                      } else if (chargeType === 'FIXED') {
                        deduction = makingRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                      } else {
                        deduction = net.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                      }

                      const rowAmount = Decimal.max(0, metalVal.minus(deduction));

                      return (
                        <tr key={ex.id} className="pos-grid-row">
                          <td className="text-center">
                            <div className="grid-index-cell font-mono text-muted text-xs">{idx + 1}</div>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="grid-input font-mono text-xs uppercase"
                              value={ex.tag_no}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { tag_no: e.target.value })}
                              placeholder="EX-TAG"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="grid-input"
                              value={ex.item_name}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { item_name: e.target.value })}
                              placeholder="Old Gold Scrap"
                            />
                          </td>
                          <td>
                            <select
                              className="grid-select font-mono text-xs"
                              value={ex.metal_id}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { metal_id: e.target.value })}
                            >
                              {metals.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="grid-input text-right font-mono text-xs"
                              value={ex.tunch_percent ?? ''}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, {
                                  tunch_percent: parseDecimalInput(e.target.value, 4),
                                })
                              }
                              placeholder="91.67"
                              title={ex.purity_name ? `${ex.purity_name} (Tunch: ${ex.tunch_percent}%)` : 'Tunch% (Purity)'}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="grid-input text-right font-mono text-main font-bold"
                              value={ex.gross_weight ?? ''}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, {
                                  gross_weight: parseDecimalInput(e.target.value, 4),
                                })
                              }
                              placeholder="0.000"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="grid-input text-right font-mono text-muted"
                              value={ex.less_weight ?? ''}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, {
                                  less_weight: parseDecimalInput(e.target.value, 4),
                                })
                              }
                              placeholder="0.000"
                            />
                          </td>
                          <td className="text-right">
                            <div className="grid-readonly-cell net">
                              {formatWeight(net, 3)}
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="text"
                              className="grid-input text-right font-mono text-xs"
                              value={ex.badla_percent ?? ''}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { badla_percent: parseDecimalInput(e.target.value, 2, true) })}
                              placeholder="0"
                              title={!badla.isZero() ? `Badla: ${badlaWeight.gt(0) ? '+' : ''}${formatFineWeight(badlaWeight.toNumber(), 4)}g (${formatCurrency(badlaWeight.times(rate).toNumber())})` : 'Badla % (Commercial margin/discount)'}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="text"
                              className="grid-input text-right font-mono text-xs"
                              value={ex.wastage_percent ?? ''}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { wastage_percent: parseDecimalInput(e.target.value, 2, true) })}
                              placeholder="0"
                              title={!wastage.isZero() ? `Waste: +${formatFineWeight(wasteWeight.toNumber(), 4)}g (${formatCurrency(wasteWeight.times(rate).toNumber())})` : 'Waste % (Refining/melting loss)'}
                            />
                          </td>
                          <td>
                            <div className="making-cell-wrap">
                              <div className="making-input-group">
                                <select
                                  className="making-select font-mono"
                                  value={chargeType}
                                  onChange={(e) =>
                                    handleUpdateExchangeRow(ex.id, {
                                      making_charge_type: e.target.value as any,
                                    })
                                  }
                                  title="Deduction / Charge Mode: % (Percentage), /g (Per Gram), Fix (Fixed Lump Sum), or /pc (Per Piece)"
                                >
                                  <option value="PERCENTAGE">%</option>
                                  <option value="PER_GRAM">/g</option>
                                  <option value="FIXED">Fix</option>
                                  <option value="PER_PIECE">/pc</option>
                                </select>
                                {chargeType === 'PER_PIECE' && (
                                  <div className="making-pcs-box" title="Number of pieces">
                                    <input
                                      type="number"
                                      min={1}
                                      className="making-pcs-input font-mono"
                                      value={ex.pieces ?? 1}
                                      onChange={(e) => handleUpdateExchangeRow(ex.id, { pieces: parseInt(e.target.value) || 1 })}
                                      placeholder="1"
                                    />
                                    <span className="making-pcs-unit">pc</span>
                                  </div>
                                )}
                                <div className="making-rate-box">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="making-rate-input font-mono text-right"
                                    value={ex.making_rate !== undefined ? ex.making_rate : (ex.deduction_percent ?? '')}
                                    onChange={(e) => {
                                      const val = parseDecimalInput(e.target.value, 2);
                                      handleUpdateExchangeRow(ex.id, {
                                        making_rate: val,
                                        deduction_percent: chargeType === 'PERCENTAGE' ? val : ex.deduction_percent,
                                      });
                                    }}
                                    placeholder={
                                      chargeType === 'PER_PIECE'
                                        ? '₹/pc'
                                        : chargeType === 'FIXED'
                                        ? '₹ Fix'
                                        : chargeType === 'PERCENTAGE'
                                        ? '%'
                                        : '50'
                                    }
                                    title={
                                      chargeType === 'PER_PIECE'
                                        ? 'Deduction rate per piece (₹/pc)'
                                        : chargeType === 'FIXED'
                                        ? 'Fixed lump-sum deduction (₹)'
                                        : chargeType === 'PERCENTAGE'
                                        ? 'Deduction percentage of metal value (%)'
                                        : 'Deduction rate per gram (₹/g)'
                                    }
                                  />
                                </div>
                              </div>
                              <div className="making-sub-label font-mono">
                                {deduction.gt(0) ? (
                                  chargeType === 'PER_PIECE'
                                    ? `−₹${deduction.toFixed(2)} (${ex.pieces || 1} pc @ ₹${makingRate})`
                                    : chargeType === 'FIXED'
                                    ? `−₹${deduction.toFixed(2)} (Fixed)`
                                    : chargeType === 'PERCENTAGE'
                                    ? `−₹${deduction.toFixed(2)} (${makingRate}%)`
                                    : `−₹${deduction.toFixed(2)} (@₹${makingRate}/g)`
                                ) : (
                                  <span className="text-muted">₹0.00</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-right">
                            <div
                              className="grid-readonly-cell fine font-mono font-bold"
                              title={
                                !totalAdditionPercent.isZero()
                                  ? `Pure Fine Wt: ${formatFineWeight(pureFine, 4)}g | Billable Fine Wt: ${formatFineWeight(billableFine, 4)}g (Badla/Waste: ${totalAdditionPercent.gt(0) ? '+' : ''}${totalAdditionPercent.toFixed(2)}%)`
                                  : `Fine Weight: ${formatFineWeight(billableFine, 4)}g`
                              }
                            >
                              {formatFineWeight(billableFine, 4)}
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="grid-input text-right font-mono font-semibold"
                              value={ex.exchange_rate ?? ''}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, {
                                  exchange_rate: parseDecimalInput(e.target.value, 2),
                                })
                              }
                              placeholder="6990"
                            />
                          </td>
                          <td className="text-right">
                            <div className="grid-readonly-cell exchange-amount font-mono font-bold">
                              {formatCurrency(rowAmount.toNumber())}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="grid-action-cell">
                              <button
                                type="button"
                                className="btn-trash-row"
                                onClick={() => handleRemoveExchangeRow(ex.id)}
                                title="Delete line"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="pos-totals-row exchange-totals">
                      <td colSpan={5} className="font-bold text-main text-xs uppercase tracking-wider whitespace-nowrap">
                        TOTAL EXCHANGE DEDUCTION
                      </td>
                      <td className="text-right font-mono font-bold whitespace-nowrap">
                        {formatWeight(calculations.totalExchangeGross, 3)}
                      </td>
                      <td className="text-right font-mono text-muted whitespace-nowrap">
                        {formatWeight(calculations.totalExchangeLess, 3)}
                      </td>
                      <td className="text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                        {formatWeight(calculations.totalExchangeNet, 3)}
                      </td>
                      <td></td>
                      <td></td>
                      <td className="text-right font-mono text-xs text-muted whitespace-nowrap">
                        Deduct: −{formatCurrency(calculations.totalExchangeDeduction)}
                      </td>
                      <td className="text-right font-mono font-bold text-muted whitespace-nowrap" title={`Total Pure Fine: ${formatFineWeight(calculations.totalExchangeFine, 4)}g | Total Billable Fine: ${formatFineWeight(calculations.totalExchangeAdjustedFine, 4)}g`}>
                        <div>{formatFineWeight(calculations.totalExchangeAdjustedFine, 4)}</div>
                      </td>
                      <td></td>
                      <td className="text-right font-mono font-bold text-emerald-400 text-base whitespace-nowrap">
                        − {formatCurrency(calculations.totalExchangeValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* LOWER SECTION: PAYMENT OUTWARD & SUMMARY BALANCE (DITTO 2-COLUMN GRID) */}
          <div className="pos-lower-grid mt-4">
            {/* LEFT COLUMN: Payment Outward Tender */}
            <div className="pos-payment-column">
              <div className="pos-section-card h-full">
                <div className="section-card-header">
                  <div className="flex items-center gap-2">
                    <CreditCard size={17} className="gold" />
                    <h2 className="section-title">Payment Paid / Outward</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="btn btn-outline btn-xs text-gold"
                      title="Add Gold Metal Payment"
                      onClick={() => handleAddMetalPaymentRow('GOLD')}
                    >
                      <Plus size={12} />
                      <span>Gold</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs text-slate-300"
                      title="Add Silver Metal Payment"
                      onClick={() => handleAddMetalPaymentRow('SILVER')}
                    >
                      <Plus size={12} />
                      <span>Silver</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleAddPaymentRow}
                    >
                      <Plus size={13} />
                      <span>Add Mode</span>
                    </button>
                  </div>
                </div>

                <div className="quick-tender-bar">
                  <span className="text-xs text-muted mr-1">Quick Settle:</span>
                  <button
                    type="button"
                    className="btn-quick-tender bank"
                    onClick={() => handleQuickSettle('BANK')}
                  >
                    Bank Full (₹{calculations.netPayable.toLocaleString('en-IN')})
                  </button>
                  <button
                    type="button"
                    className="btn-quick-tender cash"
                    onClick={() => handleQuickSettle('CASH')}
                  >
                    Cash Full
                  </button>
                  <button
                    type="button"
                    className="btn-quick-tender upi"
                    onClick={() => handleQuickSettle('UPI')}
                  >
                    UPI Full
                  </button>
                  <button
                    type="button"
                    className="btn-quick-tender clear"
                    onClick={handleClearPayments}
                  >
                    Zero
                  </button>
                </div>

                <div className="payments-list mt-3">
                  {payments.map((p) => {
                    const isMetal = ['GOLD', 'SILVER'].includes(p.payment_mode);
                    const availablePurities = purities.filter((pur) => pur.metal_id === p.metal_id);

                    return (
                      <div key={p.id} className={`payment-entry-row ${isMetal ? 'metal-payment' : ''}`}>
                        <select
                          className="payment-mode-select font-mono"
                          value={p.payment_mode}
                          onChange={(e) =>
                            handleUpdatePaymentRow(p.id, { payment_mode: e.target.value as any })
                          }
                        >
                          <option value="BANK">Bank Transfer / NEFT</option>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI / QR</option>
                          <option value="CARD">Debit / Credit Card</option>
                          <option value="CREDIT">Supplier Credit Ledger</option>
                          <option value="GOLD">Gold Payment (Metal)</option>
                          <option value="SILVER">Silver Payment (Metal)</option>
                          <option value="OTHER">Other Tender</option>
                        </select>

                        {isMetal && (
                          <>
                            <select
                              className="payment-purity-select font-mono text-xs"
                              value={p.purity_id || ''}
                              onChange={(e) =>
                                handleUpdatePaymentRow(p.id, { purity_id: e.target.value })
                              }
                              title="Select Purity for Metal Rate"
                            >
                              {availablePurities.map((pur) => (
                                <option key={pur.id} value={pur.id}>
                                  {pur.name}
                                </option>
                              ))}
                            </select>

                            <div className="payment-rate-input-box" title="Applicable Metal Rate (₹/g)">
                              <span className="rate-prefix">₹</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="payment-rate-input font-mono"
                                value={p.metal_rate !== undefined ? p.metal_rate : ''}
                                onChange={(e) =>
                                  handleUpdatePaymentRow(p.id, {
                                    metal_rate: parseDecimalInput(e.target.value, 2),
                                  })
                                }
                                placeholder="Rate/g"
                              />
                              <span className="rate-suffix">/g</span>
                            </div>

                            <div className="payment-weight-input-box" title="Payment Weight in Grams">
                              <input
                                type="text"
                                inputMode="decimal"
                                className="payment-weight-input font-mono"
                                value={p.metal_weight !== undefined ? p.metal_weight : ''}
                                onChange={(e) => handleMetalWeightChange(p.id, e.target.value)}
                                placeholder="0.000"
                              />
                              <span className="weight-suffix">g</span>
                            </div>
                          </>
                        )}

                        <div
                          className="payment-amount-input-box"
                          title={isMetal ? 'Metal Payment Rupee Value (₹)' : 'Paid Amount (₹)'}
                        >
                          <span className="currency-prefix">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="payment-amount-input font-mono font-bold"
                            value={p.amount !== undefined ? p.amount : ''}
                            onChange={(e) => handlePaymentAmountChange(p.id, e.target.value)}
                            placeholder="0"
                          />
                        </div>

                        <input
                          type="text"
                          className="payment-ref-input font-mono text-xs"
                          value={p.reference_number || ''}
                          onChange={(e) =>
                            handleUpdatePaymentRow(p.id, { reference_number: e.target.value })
                          }
                          placeholder={isMetal ? 'Notes / Bullion Bar No' : 'Ref / UTR / Cheque No'}
                        />

                        {payments.length > 1 && (
                          <button
                            type="button"
                            className="btn-trash-row"
                            onClick={() => handleRemovePaymentRow(p.id)}
                            title="Remove payment row"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {p.rate_error && (
                          <div className="payment-row-warning flex items-center gap-1">
                            <AlertCircle size={12} />
                            <span>{p.rate_error}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Purchase Inward Notes */}
                <div className="invoice-notes-box mt-4">
                  <label className="text-xs text-muted block mb-1">Purchase Notes / Consignment Details</label>
                  <textarea
                    className="pos-textarea font-mono text-xs"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Bullion inward challan, hallmarking batch, purity verification remarks..."
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Summary & Balance (DITTO TOTALS CARD) */}
            <div className="pos-summary-column">
              <div className="pos-section-card summary-card">
                <div className="section-card-header">
                  <div className="flex items-center gap-2">
                    <Calculator size={17} className="gold" />
                    <h2 className="section-title">Summary & Balance</h2>
                  </div>
                </div>

                <div className="summary-breakdown-list">
                  <div className="summary-line">
                    <span className="summary-label">Inward Total</span>
                    <span className="summary-value font-mono">
                      {formatCurrency(calculations.totalPurchaseAmount)}
                    </span>
                  </div>

                  <div className="summary-line">
                    <span className="summary-label">Discount (₹)</span>
                    <div className="summary-input-wrapper">
                      <span className="currency-prefix">₹</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="summary-inline-input font-mono"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(parseDecimalInput(e.target.value, 2))}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="summary-line border-t pt-2">
                    <span className="summary-label">Taxable Amount</span>
                    <span className="summary-value font-mono font-semibold">
                      {formatCurrency(calculations.netTaxable)}
                    </span>
                  </div>

                  <div className="summary-line">
                    <div className="flex items-center gap-2">
                      <span className="summary-label">GST Rate</span>
                      <select
                        className="gst-rate-select font-mono"
                        value={gstRate}
                        onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                      >
                        <option value={3.0}>3.0% (Jewellery GST)</option>
                        <option value={0.0}>0% (Exempted / Bullion)</option>
                      </select>
                    </div>
                    <span className="summary-value font-mono text-amber-300">
                      {formatCurrency(calculations.gstAmount)}
                    </span>
                  </div>

                  {gstRate > 0 && (
                    <div className="summary-line sub-gst text-xs text-muted">
                      <span>CGST (1.5%) + SGST (1.5%)</span>
                      <span className="font-mono">
                        {formatCurrency(calculations.cgst)} + {formatCurrency(calculations.sgst)}
                      </span>
                    </div>
                  )}

                  <div className="summary-line">
                    <span className="summary-label text-muted">Gross Total</span>
                    <span className="summary-value font-mono font-semibold">
                      {formatCurrency(calculations.grandTotal)}
                    </span>
                  </div>

                  {calculations.totalExchangeValue > 0 && (
                    <div className="summary-line text-amber-400">
                      <span className="summary-label">Old Metal Exchange Deduction</span>
                      <span className="summary-value font-mono">
                        − {formatCurrency(calculations.totalExchangeValue)}
                      </span>
                    </div>
                  )}

                  {/* Net Payable Highlight */}
                  <div className="summary-grand-total-box mt-2">
                    <span className="grand-label">Net Payable</span>
                    <span className="grand-value font-mono">
                      {formatCurrency(calculations.netPayable)}
                    </span>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="summary-line mt-3">
                    <span className="summary-label text-emerald-400 font-semibold">Total Paid</span>
                    <span className="summary-value font-mono font-bold text-emerald-400">
                      {formatCurrency(calculations.totalPaid)}
                    </span>
                  </div>

                  {calculations.goldPaymentValue > 0 && (
                    <div className="summary-line sub-gst text-xs text-gold">
                      <span>↳ Gold Payment ({formatWeight(calculations.goldPaymentGrams, 3)}g):</span>
                      <span className="font-mono">{formatCurrency(calculations.goldPaymentValue)}</span>
                    </div>
                  )}

                  {calculations.silverPaymentValue > 0 && (
                    <div className="summary-line sub-gst text-xs text-slate-300">
                      <span>↳ Silver Payment ({formatWeight(calculations.silverPaymentGrams, 3)}g):</span>
                      <span className="font-mono">{formatCurrency(calculations.silverPaymentValue)}</span>
                    </div>
                  )}

                  {calculations.cashAndOtherPayments > 0 &&
                    (calculations.goldPaymentValue > 0 || calculations.silverPaymentValue > 0) && (
                      <div className="summary-line sub-gst text-xs text-muted">
                        <span>↳ Cash & Other Payments:</span>
                        <span className="font-mono">{formatCurrency(calculations.cashAndOtherPayments)}</span>
                      </div>
                    )}

                  <div className="summary-line">
                    <span className="summary-label font-bold text-main">Remaining Balance</span>
                    <span
                      className={`summary-value font-mono font-bold text-base ${
                        calculations.balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatCurrency(calculations.balanceDue)}
                    </span>
                  </div>

                  {calculations.excessPaid > 0 && (
                    <div className="summary-line text-emerald-300 font-semibold">
                      <span className="summary-label">Advance / Excess Paid</span>
                      <span className="summary-value font-mono font-bold">
                        {formatCurrency(calculations.excessPaid)}
                      </span>
                    </div>
                  )}

                  <div className="balance-status-badge mt-2">
                    {calculations.isSettled ? (
                      <div className="settled-pill">
                        <Check size={14} />
                        <span>Settled ✓</span>
                      </div>
                    ) : calculations.netPayable > 0 ? (
                      <div className="pending-pill">
                        <span>Balance Due: ₹{calculations.balanceDue.toLocaleString('en-IN')}</span>
                      </div>
                    ) : (
                      <div className="pending-pill">
                        <span>Zero Bill</span>
                      </div>
                    )}
                  </div>

                  {/* Fine Metal Reconciliation */}
                  <div className="metal-fine-reconciliation mt-3 pt-3 border-t">
                    <div className="flex justify-between text-xs py-0.5">
                      <span className="text-muted font-medium">Fine Gold Net Inward:</span>
                      <strong className="font-mono text-gold">{formatFineWeight(calculations.goldFineWeight, 4)} g</strong>
                    </div>
                    {calculations.totalWastageWeight > 0 && (
                      <>
                        <div className="flex justify-between text-xs py-0.5 text-muted">
                          <span>↳ Wastage Addition:</span>
                          <span className="font-mono text-emerald-400">+{formatFineWeight(calculations.totalWastageWeight, 4)} g</span>
                        </div>
                        <div className="flex justify-between text-xs py-0.5 font-semibold text-amber-400">
                          <span>Billable Fine Gold:</span>
                          <strong className="font-mono">
                            {formatFineWeight(calculations.goldFineWeight + calculations.totalWastageWeight, 4)} g
                          </strong>
                        </div>
                      </>
                    )}
                    {calculations.silverFineWeight > 0 && (
                      <div className="flex justify-between text-xs py-0.5">
                        <span className="text-muted font-medium">Fine Silver Net Inward:</span>
                        <strong className="font-mono">{formatFineWeight(calculations.silverFineWeight, 4)} g</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* POS BOTTOM ACTION BAR */}
          <div className="pos-bottom-action-bar">
            <div className="action-bar-left">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleStartNewBill}
                disabled={isSubmitting}
              >
                Reset / Cancel
              </button>
            </div>
            <div className="action-bar-right">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSavePurchase(false)}
                disabled={isSubmitting}
              >
                <Save size={16} />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                className="btn btn-primary font-bold"
                onClick={() => handleSavePurchase(true)}
                disabled={isSubmitting}
              >
                <CheckCircle size={16} />
                <span>{isSubmitting ? 'Processing...' : 'Save & Finalize Bill'}</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* REGISTRY / ALL BILLS VIEW */
        <div className="purchase-registry-container">
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
              <div className="purchase-metric-sub">Settled via Cash / Bank / UPI</div>
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
                  {isLoadingRegistry ? (
                    <tr>
                      <td colSpan={9} className="table-empty py-12 text-center text-muted font-mono">
                        <RefreshCw size={24} className="spin text-gold mx-auto mb-2" />
                        <span>Loading purchase inward records...</span>
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="table-empty py-12">
                        <div className="empty-registry-state text-center">
                          <Truck size={44} className="text-muted mb-3 opacity-40 mx-auto" />
                          <h4 className="text-base font-serif text-gold font-semibold">No Purchase Bills Found</h4>
                          <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4">
                            Create an inward purchase bill to restock physical jewellery inventory and log supplier bills.
                          </p>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm mx-auto"
                            onClick={handleStartNewBill}
                          >
                            <Plus size={14} />
                            <span>Create First Purchase Bill</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="font-mono font-bold text-gold">{p.purchase_number}</span>
                        </td>
                        <td className="font-mono text-xs">{p.purchase_date}</td>
                        <td>
                          <div className="font-semibold text-main">{p.supplier_name || 'N/A'}</div>
                          {p.supplier_code && (
                            <span className="text-xs text-muted font-mono">({p.supplier_code})</span>
                          )}
                        </td>
                        <td>
                          {p.supplier_invoice_number ? (
                            <span className="font-mono text-xs">{p.supplier_invoice_number}</span>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="text-right font-mono font-bold">
                          ₹{p.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-mono text-emerald-400">
                          ₹{p.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-mono font-bold text-amber-300">
                          ₹{p.balance_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          <span className={`purchase-badge ${p.status.toLowerCase()}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              title="View and Print Voucher"
                              onClick={async () => {
                                try {
                                  const bill = await purchaseApi.getById(p.id);
                                  setPrintBill(bill);
                                  setShowPrintModal(true);
                                } catch (err) {
                                  showToast('error', 'Failed to load purchase voucher');
                                }
                              }}
                            >
                              <Eye size={14} />
                            </button>

                            {p.status === 'DRAFT' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-gold"
                                title="Open in Workstation"
                                onClick={() => handleOpenExistingBill(p.id)}
                              >
                                <span>Edit</span>
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

            {/* Pagination Footer */}
            <div className="purchase-table-footer flex justify-between items-center p-3 border-t border-border">
              <span className="text-xs text-muted font-mono">
                Showing {purchases.length} of {total} bills
              </span>
              {totalPages > 1 && (
                <div className="pagination-controls flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  <span className="font-mono text-xs text-gold px-2">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK CREATE SUPPLIER MASTER MODAL */}
      {showSupplierModal && (
        <div className="modal-backdrop customer-modal-backdrop">
          <div className="modal-dialog customer-modal-dialog">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="modal-header-icon-box">
                  <UserPlus size={18} className="gold" />
                </div>
                <div>
                  <h3 className="modal-title font-serif">Add Supplier (Master)</h3>
                  <p className="modal-subtitle">
                    Saves to Supplier Directory and automatically selects for this inward purchase
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSupplierModal(false)}
                disabled={supplierSubmitting}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSupplierSubmit}>
              <div className="customer-modal-body">
                {supplierFormError && (
                  <div className="customer-form-error-alert">
                    <AlertCircle size={16} />
                    <span>{supplierFormError}</span>
                  </div>
                )}

                <div className="customer-modal-grid">
                  {/* Company / Supplier Name */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Supplier / Company Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="customer-field-input font-semibold"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      placeholder="e.g. Surat Bullion Refinery / Zaveri Gems Ltd"
                    />
                  </div>

                  {/* Supplier Code */}
                  <div className="customer-field">
                    <label className="customer-field-label">Supplier Code (Optional)</label>
                    <input
                      type="text"
                      className="customer-field-input font-mono text-xs"
                      value={supplierForm.supplier_code}
                      onChange={(e) => setSupplierForm({ ...supplierForm, supplier_code: e.target.value })}
                      placeholder="Auto-generated if blank"
                    />
                  </div>

                  {/* Contact Person */}
                  <div className="customer-field">
                    <label className="customer-field-label">Contact Person</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={supplierForm.contact_person}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                      placeholder="e.g. Rajesh Shah"
                    />
                  </div>

                  {/* Phone */}
                  <div className="customer-field">
                    <label className="customer-field-label">Mobile Phone</label>
                    <input
                      type="tel"
                      className="customer-field-input font-mono"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      placeholder="10-digit mobile"
                    />
                  </div>

                  {/* Alternate Phone */}
                  <div className="customer-field">
                    <label className="customer-field-label">Alternate / Landline</label>
                    <input
                      type="tel"
                      className="customer-field-input font-mono"
                      value={supplierForm.alternate_phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, alternate_phone: e.target.value })}
                      placeholder="Office landline"
                    />
                  </div>

                  {/* Email */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Email Address</label>
                    <input
                      type="email"
                      className="customer-field-input"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      placeholder="accounts@supplier.com"
                    />
                  </div>

                  {/* Address */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Address / Refinery / Shop</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                      placeholder="Building, Street, Bazaar"
                    />
                  </div>

                  {/* City */}
                  <div className="customer-field">
                    <label className="customer-field-label">City</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={supplierForm.city}
                      onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                      placeholder="Mumbai / Surat"
                    />
                  </div>

                  {/* State */}
                  <div className="customer-field">
                    <label className="customer-field-label">State</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={supplierForm.state}
                      onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value })}
                      placeholder="Maharashtra"
                    />
                  </div>

                  {/* Pincode */}
                  <div className="customer-field">
                    <label className="customer-field-label">Pincode</label>
                    <input
                      type="text"
                      className="customer-field-input font-mono"
                      value={supplierForm.pincode}
                      onChange={(e) => setSupplierForm({ ...supplierForm, pincode: e.target.value })}
                      placeholder="400002"
                    />
                  </div>

                  {/* GSTIN */}
                  <div className="customer-field">
                    <label className="customer-field-label">GSTIN (Optional)</label>
                    <input
                      type="text"
                      className="customer-field-input font-mono uppercase"
                      value={supplierForm.gstin}
                      onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                      placeholder="15-digit GSTIN"
                    />
                  </div>

                  {/* Opening Balance */}
                  <div className="customer-field">
                    <label className="customer-field-label">Opening Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="customer-field-input font-mono"
                      value={supplierForm.opening_balance || 0}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          opening_balance: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  {/* Balance Type */}
                  <div className="customer-field">
                    <label className="customer-field-label">Balance Type</label>
                    <select
                      className="customer-field-select font-mono text-xs"
                      value={supplierForm.opening_balance_type}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          opening_balance_type: e.target.value as any,
                        })
                      }
                    >
                      <option value="CREDIT">Credit (Shop owes Supplier)</option>
                      <option value="DEBIT">Debit (Supplier owes Shop advance)</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Internal Notes</label>
                    <textarea
                      rows={2}
                      className="customer-field-textarea"
                      value={supplierForm.notes}
                      onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                      placeholder="Bullion purity terms, RTGS payment details..."
                    />
                  </div>
                </div>
              </div>

              <div className="customer-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowSupplierModal(false)}
                  disabled={supplierSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm font-bold"
                  disabled={supplierSubmitting}
                >
                  <Save size={14} />
                  <span>{supplierSubmitting ? 'Saving to Master...' : 'Save & Select for Purchase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT / PURCHASE VOUCHER MODAL */}
      {showPrintModal && printBill && (
        <div className="modal-backdrop print-modal-backdrop">
          <div className="modal-dialog print-modal-dialog">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="gold" />
                <h3 className="modal-title font-serif">Purchase Inward Voucher: {printBill.purchase_number}</h3>
                <span className={`status-pill ${printBill.status.toLowerCase()}`}>
                  {printBill.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Printer size={15} />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setShowPrintModal(false);
                    setViewMode('list');
                    fetchPurchases();
                  }}
                >
                  Back to Registry
                </button>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowPrintModal(false)}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="printable-tax-invoice">
              {/* Store Header Letterhead */}
              <div className="tax-invoice-shop-header">
                <h1 className="tax-invoice-shop-title">
                  {shopProfile?.name || 'JEWEL SUITE DEMO STORE'}
                </h1>
                {shopProfile?.legal_name && (
                  <p className="tax-invoice-shop-subtitle">{shopProfile.legal_name}</p>
                )}
                <p className="tax-invoice-shop-address">
                  {shopProfile?.address ? `${shopProfile.address}, ` : ''}
                  {shopProfile?.city ? `${shopProfile.city}, ` : ''}
                  {shopProfile?.state || 'Maharashtra'} - {shopProfile?.pincode || '400001'}
                </p>
                <div className="tax-invoice-shop-tax-bar">
                  <span>Phone: <strong>{shopProfile?.phone || '+91 98765 43210'}</strong></span>
                  <span>GSTIN: <strong>{shopProfile?.gstin || '27AAAAA0000A1Z5'}</strong></span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="tax-invoice-meta-grid">
                {/* Left: Supplier Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">PURCHASE FROM (SUPPLIER DETAILS)</div>
                  <div className="meta-customer-name">
                    {printBill.supplier_name || 'Bullion Supplier'}
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Supplier Code:</span>
                    <span className="meta-info-val font-mono">
                      {printBill.supplier_code || 'N/A'}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Contact / Phone:</span>
                    <span className="meta-info-val font-mono">
                      {printBill.supplier_phone || 'N/A'}
                    </span>
                  </div>
                  {printBill.supplier_gstin && (
                    <div className="meta-info-row">
                      <span className="meta-info-label">GSTIN:</span>
                      <span className="meta-info-val font-mono font-bold text-gold">
                        {printBill.supplier_gstin}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Voucher Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">PURCHASE VOUCHER DETAILS</div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Purchase Number:</span>
                    <span className="invoice-number-highlight">
                      {printBill.purchase_number}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Inward Date:</span>
                    <span className="meta-info-val font-mono">
                      {printBill.purchase_date}
                    </span>
                  </div>
                  {printBill.supplier_invoice_number && (
                    <div className="meta-info-row">
                      <span className="meta-info-label">Supplier Bill #:</span>
                      <span className="meta-info-val font-mono font-bold">
                        {printBill.supplier_invoice_number}
                      </span>
                    </div>
                  )}
                  <div className="meta-info-row">
                    <span className="meta-info-label">Status:</span>
                    <span className="meta-info-val font-bold">
                      {printBill.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="tax-invoice-table-wrap">
                <table className="tax-invoice-table">
                  <thead>
                    <tr>
                      <th className="text-center">#</th>
                      <th>Tag No</th>
                      <th>Product / Description</th>
                      <th>Metal & Purity</th>
                      <th className="text-right">Gross (g)</th>
                      <th className="text-right">Less (g)</th>
                      <th className="text-right">Net (g)</th>
                      <th className="text-right">Tunch%</th>
                      <th className="text-right">Fine Wt</th>
                      <th className="text-right">Rate/g (₹)</th>
                      <th className="text-right">Making (₹)</th>
                      <th className="text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printBill.items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="text-center font-mono text-xs">{idx + 1}</td>
                        <td className="font-mono text-xs font-bold text-gold">{item.tag_no}</td>
                        <td className="font-semibold">{item.item_name || item.product_name}</td>
                        <td className="text-xs">{item.metal_name} {item.purity_name}</td>
                        <td className="text-right font-mono">{formatWeight(item.gross_weight, 3)}</td>
                        <td className="text-right font-mono">{formatWeight(item.less_weight, 3)}</td>
                        <td className="text-right font-mono font-bold">{formatWeight(item.net_weight, 3)}</td>
                        <td className="text-right font-mono">{item.tunch_percent}%</td>
                        <td className="text-right font-mono font-bold">{formatFineWeight(item.fine_weight, 4)}</td>
                        <td className="text-right font-mono">₹{item.rate_per_gram.toLocaleString('en-IN')}</td>
                        <td className="text-right font-mono">₹{item.making_charge.toLocaleString('en-IN')}</td>
                        <td className="text-right font-mono font-bold">
                          ₹{item.item_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Settlement */}
              <div className="tax-invoice-bottom-grid">
                <div className="tax-invoice-payments-box">
                  <div className="invoice-meta-header mb-2">PAYMENTS RECORDED</div>
                  {printBill.payments.length === 0 ? (
                    <p className="text-xs text-muted">No payments recorded. Balance outstanding on supplier credit ledger.</p>
                  ) : (
                    printBill.payments.map((p, idx) => (
                      <div key={idx} className="payment-receipt-line flex justify-between text-xs py-1 border-b border-border">
                        <span className="font-semibold">
                          {p.payment_mode}{' '}
                          {p.reference_number
                            ? `(${p.reference_number})`
                            : p.metal_weight
                            ? `(${formatWeight(p.metal_weight, 3)}g)`
                            : ''}
                        </span>
                        <span className="font-mono font-bold">
                          ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="tax-invoice-summary-box">
                  <div className="summary-line">
                    <span>Subtotal:</span>
                    <span className="font-mono">
                      ₹{printBill.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {printBill.discount_amount > 0 && (
                    <div className="summary-line">
                      <span>Discount:</span>
                      <span className="font-mono">
                        − ₹{printBill.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="summary-line font-bold">
                    <span>Taxable:</span>
                    <span className="font-mono">
                      ₹{printBill.taxable_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-line text-xs">
                    <span>GST ({printBill.gst_rate}%):</span>
                    <span className="font-mono">
                      ₹{printBill.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-line grand-total-highlight">
                    <span>Grand Total:</span>
                    <span className="font-mono font-bold text-base">
                      ₹{printBill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-line">
                    <span>Paid Amount:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ₹{printBill.amount_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="summary-line font-bold">
                    <span>Balance Payable:</span>
                    <span className="font-mono text-amber-300">
                      ₹{printBill.balance_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voucher Signatures */}
              <div className="tax-invoice-signatures flex justify-between mt-8 pt-4 border-t border-border">
                <div className="sig-box text-center">
                  <p className="text-xs text-muted">Received & Weighed By</p>
                  <div className="sig-line mt-8 border-b border-muted w-40"></div>
                </div>
                <div className="sig-box text-center">
                  <p className="text-xs text-muted">Authorised Signatory</p>
                  <div className="sig-line mt-8 border-b border-muted w-40"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LESS WEIGHT CALCULATOR POPUP */}
      {activeLessCalc && (
        <LessWeightCalculatorModal
          isOpen={true}
          itemName={activeLessCalc.itemName}
          initialLessWeight={activeLessCalc.currentLess}
          initialBreakdown={activeLessCalc.breakdown}
          purities={purities}
          onApply={handleApplyPurchaseLessTotal}
          onClose={() => setActiveLessCalc(null)}
        />
      )}
    </div>
  );
};
