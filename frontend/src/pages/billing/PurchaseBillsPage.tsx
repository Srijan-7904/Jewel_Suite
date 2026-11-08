import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { purchaseApi } from '../../services/purchase';
import { supplierApi, productApi, rateApi, customerApi } from '../../services/masters';
import { settingsApi, ShopProfile, ShopReceivingAccount, InvoiceColumnSettings, DEFAULT_INVOICE_COLUMN_SETTINGS } from '../../services/settings';
import {
  PurchaseBill,
  PurchaseBillDetails,
  Supplier,
  Customer,
  Product,
  Metal,
  MetalPurity,
  CurrentRate,
} from '../../types';
import {
  toDecimal,
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatCurrency,
  parseDecimalInput,
} from '../../utils/precision';
import { COMMON_INDIAN_BANKS } from './CreateInvoicePage';
import {
  Receipt,
  Plus,
  Trash2,
  Copy,
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
  Banknote,
  MapPin,
  Phone,
  Scale,
} from 'lucide-react';
import './CreateInvoicePage.css';
import './PurchaseBillsPage.css';
import { LessWeightCalculatorModal, LessBreakdownEntry } from '../../components/LessWeightCalculatorModal';
import { SupplierSearchSelect } from '../../components/SupplierSearchSelect';

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

  // Payment source & destination
  payer_type?: 'CUSTOMER' | 'ANOTHER_CUSTOMER' | 'SUPPLIER' | 'OTHER_PARTY' | 'EXTERNAL' | 'SELF' | 'CR_PARTY' | 'DR_PARTY' | 'EXISTING_PARTY';
  payer_name?: string;
  payer_bank?: string;
  received_in?: string;
  payer_party_id?: string;

  // Metal payment fields (for GOLD / SILVER)
  metal_id?: string;
  metal_name?: string;
  purity_id?: string;
  purity_name?: string;
  metal_weight?: number | string;
  fine_weight?: number | string;
  tunch_percent?: number | string;
  metal_rate?: number | string;
  rate_error?: string;
  is_auto_weight?: boolean;
  last_edited?: 'weight' | 'fine' | 'amount';
}

export const PurchaseBillsPage: React.FC = () => {
  const navigate = useNavigate();

  // Navigation mode: 'form' (Workstation POS) or 'list' (Registry)
  const [viewMode, setViewMode] = useState<'form' | 'list'>('form');

  // Master Reference Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivingAccounts, setReceivingAccounts] = useState<ShopReceivingAccount[]>([]);
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

  // Workstation Items, Exchange Items, and Payments State - initialized with 1 row, default 0 for weights/charges
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([
    {
      id: 'pur-row-init-1',
      product_id: '',
      tag_no: '',
      item_name: '',
      metal_id: '',
      metal_name: '',
      purity_id: '',
      purity_name: '',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: 0,
      badla_percent: 0,
      wastage_percent: 0,
      making_rate: 0,
      making_charge_type: 'PER_GRAM',
      rate_per_gram: '',
    },
  ]);
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
  const [supplierPrimaryDirection, setSupplierPrimaryDirection] = useState<'DEBIT' | 'CREDIT'>('CREDIT');
  const [supplierMetals, setSupplierMetals] = useState<Metal[]>([]);
  const [supplierPurities, setSupplierPurities] = useState<MetalPurity[]>([]);

  useEffect(() => {
    if (showSupplierModal && supplierPurities.length === 0) {
      rateApi.getMetals().then((m: any) => setSupplierMetals(m || [])).catch(console.error);
      rateApi.getAllPurities().then((p: any) => setSupplierPurities(p || [])).catch(console.error);
    }
  }, [showSupplierModal, supplierPurities.length]);

  const supplierGoldPurities = useMemo(() => {
    const goldMetal = supplierMetals.find(
      (m) => (m.code || '').toUpperCase() === 'GOLD' || (m.name || '').toLowerCase().includes('gold')
    );
    if (goldMetal) {
      return supplierPurities.filter((p) => p.metal_id === goldMetal.id);
    }
    return supplierPurities.filter(
      (p) =>
        (p.name || '').toLowerCase().includes('22k') ||
        (p.name || '').toLowerCase().includes('24k') ||
        (p.name || '').toLowerCase().includes('18k') ||
        (p.code || '').includes('K')
    );
  }, [supplierMetals, supplierPurities]);

  const supplierSilverPurities = useMemo(() => {
    const silverMetal = supplierMetals.find(
      (m) => (m.code || '').toUpperCase() === 'SILVER' || (m.name || '').toLowerCase().includes('silver')
    );
    if (silverMetal) {
      return supplierPurities.filter((p) => p.metal_id === silverMetal.id);
    }
    return supplierPurities.filter(
      (p) =>
        (p.name || '').toLowerCase().includes('925') ||
        (p.name || '').toLowerCase().includes('silver') ||
        (p.code || '').includes('925') ||
        (p.tunch_percent !== null && Number(p.tunch_percent) >= 90)
    );
  }, [supplierMetals, supplierPurities]);

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
    opening_balance_date: new Date().toISOString().split('T')[0],
    opening_balance_ref: '',
    opening_balance_notes: '',
    opening_cash_balance: 0,
    opening_cash_type: 'CREDIT' as 'DEBIT' | 'CREDIT',
    opening_bank_balance: 0,
    opening_bank_type: 'CREDIT' as 'DEBIT' | 'CREDIT',
    opening_gold_weight: 0,
    opening_gold_type: 'CREDIT' as 'DEBIT' | 'CREDIT',
    opening_gold_purity_id: '',
    opening_gold_rate: 0,
    opening_gold_value: 0,
    opening_silver_weight: 0,
    opening_silver_type: 'CREDIT' as 'DEBIT' | 'CREDIT',
    opening_silver_purity_id: '',
    opening_silver_rate: 0,
    opening_silver_value: 0,
    notes: '',
  });

  const handleSupplierPrimaryDirectionChange = (dir: 'DEBIT' | 'CREDIT') => {
    setSupplierPrimaryDirection(dir);
    setSupplierForm((prev) => ({
      ...prev,
      opening_balance_type: dir,
      opening_cash_type: dir,
      opening_bank_type: dir,
      opening_gold_type: dir,
      opening_silver_type: dir,
    }));
  };

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
  const [invoiceColumns, setInvoiceColumns] = useState<InvoiceColumnSettings>(DEFAULT_INVOICE_COLUMN_SETTINGS);

  // Load Reference Masters on Mount
  useEffect(() => {
    Promise.all([
      supplierApi.list({ pageSize: 150, status: 'active' }).catch(() => ({ items: [] })),
      customerApi.list({ pageSize: 500 }).catch(() => ({ items: [] })),
      settingsApi.getReceivingAccounts().catch(() => []),
      productApi.list({ pageSize: 150, status: 'active' }).catch(() => ({ items: [] })),
      rateApi.getCurrentRates().catch(() => []),
      rateApi.getMetals().catch(() => []),
      rateApi.getAllPurities().catch(() => []),
      settingsApi.getShopProfile().catch(() => null),
      settingsApi.getInvoiceColumns().catch(() => DEFAULT_INVOICE_COLUMN_SETTINGS),
    ]).then(([supRes, custRes, recvRes, prodRes, ratesRes, metalsRes, puritiesRes, profileRes, columnsRes]) => {
      const supList = (supRes as any)?.items || [];
      const custList = (custRes as any)?.items || [];
      const activeRecv = Array.isArray(recvRes) ? recvRes : [];
      const prodList = (prodRes as any)?.items || [];
      const currentRates = ratesRes || [];
      const allMetals = metalsRes || [];
      const allPurities = puritiesRes || [];

      setSuppliers(supList);
      setCustomers(custList);
      setReceivingAccounts(activeRecv);
      setProducts(prodList);
      setRates(currentRates);
      setMetals(allMetals);
      setPurities(allPurities);
      setShopProfile(profileRes);
      setInvoiceColumns(columnsRes || DEFAULT_INVOICE_COLUMN_SETTINGS);

      if (supList.length > 0) {
        setSupplierId(supList[0].id);
      }

      const defGoldMetal = allMetals.find(
        (m: any) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold')
      ) || allMetals[0];
      const defGoldPurity = allPurities.find(
        (p: any) =>
          p.metal_id === defGoldMetal?.id &&
          (p.code?.toUpperCase() === '24K' || p.name?.toLowerCase().includes('24k') || p.code === '999')
      ) || allPurities.find((p: any) => p.metal_id === defGoldMetal?.id);
      const defRateObj = currentRates.find((r: any) => r.purity_id === defGoldPurity?.id);
      const defRate = defRateObj?.rate ? defRateObj.rate : '';

      // Ensure initial purchase row is defaulted with today's 24K rate and weights/charges 0
      setPurchaseItems((prev) =>
        prev.length > 0
          ? prev.map((item) => {
              if (!item.rate_per_gram && defRate) {
                return {
                  ...item,
                  metal_id: item.metal_id || defGoldMetal?.id || '',
                  metal_name: item.metal_name || defGoldMetal?.name || '',
                  purity_id: item.purity_id || defGoldPurity?.id || '',
                  purity_name: item.purity_name || defGoldPurity?.name || '',
                  gross_weight: item.gross_weight !== '' && item.gross_weight !== undefined ? item.gross_weight : 0,
                  less_weight: item.less_weight !== '' && item.less_weight !== undefined ? item.less_weight : 0,
                  tunch_percent: item.tunch_percent !== '' && item.tunch_percent !== undefined ? item.tunch_percent : 0,
                  badla_percent: item.badla_percent !== '' && item.badla_percent !== undefined ? item.badla_percent : 0,
                  wastage_percent: item.wastage_percent !== '' && item.wastage_percent !== undefined ? item.wastage_percent : 0,
                  making_rate: item.making_rate !== '' && item.making_rate !== undefined ? item.making_rate : 0,
                  rate_per_gram: defRate,
                };
              }
              return item;
            })
          : [
              {
                id: `pur-row-${Date.now()}-1`,
                product_id: '',
                tag_no: '',
                item_name: '',
                metal_id: defGoldMetal?.id || '',
                metal_name: defGoldMetal?.name || '',
                purity_id: defGoldPurity?.id || '',
                purity_name: defGoldPurity?.name || '',
                gross_weight: 0,
                less_weight: 0,
                tunch_percent: 0,
                badla_percent: 0,
                wastage_percent: 0,
                making_rate: 0,
                making_charge_type: 'PER_GRAM',
                rate_per_gram: defRate,
              },
            ]
      );
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

  // Dynamic Item Row Helper - defaults to today's active board rate
  const handleAddPurchaseRow = () => {
    const defGoldMetal = metals.find(
      (m) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold')
    ) || metals[0];
    const defGoldPurity = purities.find(
      (p) =>
        p.metal_id === defGoldMetal?.id &&
        (p.code?.toUpperCase() === '24K' || p.name?.toLowerCase().includes('24k') || p.code === '999')
    ) || purities.find((p) => p.metal_id === defGoldMetal?.id);
    const defRateObj = rates.find((r) => r.purity_id === defGoldPurity?.id);
    const defRate = defRateObj?.rate ? defRateObj.rate : '';

    const newRow: PurchaseItemRow = {
      id: `pur-row-${Date.now()}-${purchaseItems.length + 1}`,
      product_id: '',
      tag_no: '',
      item_name: '',
      metal_id: defGoldMetal?.id || '',
      metal_name: defGoldMetal?.name || '',
      purity_id: defGoldPurity?.id || '',
      purity_name: defGoldPurity?.name || '',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: 0,
      badla_percent: 0,
      wastage_percent: 0,
      making_rate: 0,
      making_charge_type: 'PER_GRAM',
      rate_per_gram: defRate,
    };

    setPurchaseItems((prev) => [...prev, newRow]);
  };

  const handleCopyPurchaseRow = (id: string) => {
    const itemToCopy = purchaseItems.find((item) => item.id === id);
    if (!itemToCopy) return;
    const targetIdx = purchaseItems.findIndex((item) => item.id === id);
    const clonedRow: PurchaseItemRow = {
      ...itemToCopy,
      id: `pur-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tag_no: itemToCopy.tag_no ? `${itemToCopy.tag_no}-COPY` : '',
    };
    setPurchaseItems((prev) => [
      ...prev.slice(0, targetIdx + 1),
      clonedRow,
      ...prev.slice(targetIdx + 1),
    ]);
    showToast('success', 'Purchase item duplicated');
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

        // Helper to find benchmark rate for current metal
        const isGold = updated.metal_name?.toUpperCase().includes('GOLD') || (!updated.metal_name && !updated.metal_id);
        const baseBenchmark = isGold
          ? rates.find((r) => r.metal_code?.toUpperCase() === 'GOLD' && (r.purity_code?.toUpperCase() === '24K' || r.purity_name?.includes('24K') || r.purity_name?.includes('999')))
          : rates.find((r) => r.metal_code?.toUpperCase() === 'SILVER' && (r.purity_code === '999' || r.purity_name?.includes('999')));

        // When item_name changes, auto-link to matching product if exists
        if (updates.item_name !== undefined) {
          const matchProd = products.find(
            (p) => p.name.trim().toUpperCase() === updates.item_name!.trim().toUpperCase()
          );
          if (matchProd) {
            updated.product_id = matchProd.id;
          }
        }

        // If metal changed, auto-select standard default 24K / 999 purity & benchmark rate
        if (updates.metal_id !== undefined && updates.metal_id !== item.metal_id) {
          if (!updates.metal_id) {
            updated.metal_id = '';
            updated.metal_name = '';
            updated.purity_id = '';
            updated.purity_name = '';
            updated.rate_per_gram = '';
          } else {
            const m = metals.find((met) => met.id === updates.metal_id);
            updated.metal_name = m ? m.name : '';
            const metalPurities = purities.filter((p) => p.metal_id === updates.metal_id);
            const defPurity = metalPurities.find(
              (p) =>
                p.code?.toUpperCase() === '24K' ||
                p.code === '999' ||
                p.name?.toLowerCase().includes('24k') ||
                p.name?.includes('999')
            ) || metalPurities[0];

            if (defPurity) {
              updated.purity_id = defPurity.id;
              updated.purity_name = defPurity.name;
              if (defPurity.tunch_percent) updated.tunch_percent = defPurity.tunch_percent;
              const matchingRate = rates.find((r) => r.purity_id === defPurity.id);
              if (matchingRate && matchingRate.rate) {
                updated.rate_per_gram = matchingRate.rate;
              }
            }
          }
        }

        // When purity changes directly, sync tunch%, while rate remains the 24K / Pure benchmark rate
        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((pur) => pur.id === updates.purity_id);
          if (p) {
            updated.purity_name = p.name;
            if (p.tunch_percent) updated.tunch_percent = p.tunch_percent;

            // Display rate remains strictly the 24K (or 999 Silver) benchmark rate
            if (baseBenchmark && baseBenchmark.rate > 0) {
              updated.rate_per_gram = baseBenchmark.rate;
            } else if (!updated.rate_per_gram) {
              const matchingRate = rates.find(
                (r) => r.metal_id === updated.metal_id && r.purity_id === p.id
              );
              if (matchingRate && matchingRate.rate) {
                updated.rate_per_gram = matchingRate.rate;
              }
            }
          }
        }

        // If tunch_percent (Touch / Badla) was edited directly, rate STAYS the 24K benchmark rate
        // Amount dynamically changes because: Fine Weight = Net Weight × (Tunch / 100), Amount = Fine Weight × 24K Rate
        if (updates.tunch_percent !== undefined) {
          const tVal = Number(updates.tunch_percent);
          if (!isNaN(tVal) && tVal > 0) {
            // Keep rate_per_gram strictly showing the 24K benchmark rate
            if (baseBenchmark && baseBenchmark.rate > 0) {
              updated.rate_per_gram = baseBenchmark.rate;
            }

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
    const defGoldMetal = metals.find(
      (m) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold')
    ) || metals[0];
    const defGoldPurity = purities.find(
      (p) =>
        p.metal_id === defGoldMetal?.id &&
        (p.code?.toUpperCase() === '24K' || p.name?.toLowerCase().includes('24k') || p.code === '999')
    ) || purities.find((p) => p.metal_id === defGoldMetal?.id);
    const defRateObj = rates.find((r) => r.purity_id === defGoldPurity?.id);
    const defRate = defRateObj?.rate ? defRateObj.rate : '';

    const newExRow: ExchangeItemRow = {
      id: `ex-pur-${Date.now()}-${exchangeItems.length + 1}`,
      tag_no: '',
      item_name: '',
      metal_id: defGoldMetal?.id || '',
      metal_name: defGoldMetal?.name || '',
      purity_id: defGoldPurity?.id || '',
      purity_name: defGoldPurity?.name || '',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: 0,
      badla_percent: 0,
      wastage_percent: 0,
      making_rate: 0,
      making_charge_type: 'PER_GRAM',
      pieces: 1,
      deduction_percent: 0,
      exchange_rate: defRate,
    };
    setExchangeItems((prev) => [...prev, newExRow]);
  };

  const handleCopyExchangeRow = (id: string) => {
    const itemToCopy = exchangeItems.find((item) => item.id === id);
    if (!itemToCopy) return;
    const targetIdx = exchangeItems.findIndex((item) => item.id === id);
    const clonedRow: ExchangeItemRow = {
      ...itemToCopy,
      id: `ex-pur-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tag_no: itemToCopy.tag_no ? `${itemToCopy.tag_no}-COPY` : '',
    };
    setExchangeItems((prev) => [
      ...prev.slice(0, targetIdx + 1),
      clonedRow,
      ...prev.slice(targetIdx + 1),
    ]);
    showToast('success', 'Exchange item duplicated');
  };

  const handleRemoveExchangeRow = (id: string) => {
    setExchangeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateExchangeRow = (id: string, updates: Partial<ExchangeItemRow>) => {
    setExchangeItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };

        // Helper to find benchmark rate for current metal
        const isGold = updated.metal_name?.toUpperCase().includes('GOLD') || (!updated.metal_name && !updated.metal_id);
        const baseBenchmark = isGold
          ? rates.find((r) => r.metal_code?.toUpperCase() === 'GOLD' && (r.purity_code?.toUpperCase() === '24K' || r.purity_name?.includes('24K') || r.purity_name?.includes('999')))
          : rates.find((r) => r.metal_code?.toUpperCase() === 'SILVER' && (r.purity_code === '999' || r.purity_name?.includes('999')));

        // If metal changed, auto-select standard default 24K / 999 purity & benchmark rate
        if (updates.metal_id !== undefined && updates.metal_id !== item.metal_id) {
          if (!updates.metal_id) {
            updated.metal_id = '';
            updated.metal_name = '';
            updated.purity_id = '';
            updated.purity_name = '';
            updated.exchange_rate = '';
          } else {
            const m = metals.find((met) => met.id === updates.metal_id);
            updated.metal_name = m ? m.name : '';
            const metalPurities = purities.filter((p) => p.metal_id === updates.metal_id);
            const defPurity = metalPurities.find(
              (p) =>
                p.code?.toUpperCase() === '24K' ||
                p.code === '999' ||
                p.name?.toLowerCase().includes('24k') ||
                p.name?.includes('999')
            ) || metalPurities[0];

            if (defPurity) {
              updated.purity_id = defPurity.id;
              updated.purity_name = defPurity.name;
              if (defPurity.tunch_percent) updated.tunch_percent = defPurity.tunch_percent;
              const matchingRate = rates.find((r) => r.purity_id === defPurity.id);
              if (matchingRate && matchingRate.rate) {
                updated.exchange_rate = matchingRate.rate;
              }
            }
          }
        }

        // If purity changed directly, update purity & tunch%, while exchange_rate remains the 24K benchmark rate
        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((pur) => pur.id === updates.purity_id);
          updated.purity_name = p ? p.name : '';
          if (p && p.tunch_percent) updated.tunch_percent = p.tunch_percent;

          // Display rate remains strictly the 24K (or 999 Silver) benchmark rate
          if (baseBenchmark && baseBenchmark.rate > 0) {
            updated.exchange_rate = baseBenchmark.rate;
          } else if (!updated.exchange_rate) {
            const matchingRate = rates.find((r) => r.purity_id === updates.purity_id);
            if (matchingRate && matchingRate.rate) {
              updated.exchange_rate = matchingRate.rate;
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

  // Helper to find metal & default purity with rate from dashboard
  const findMetalAndPurity = (metalType: 'GOLD' | 'SILVER', targetPurityId?: string) => {
    const isGold = metalType === 'GOLD';
    const metal = metals.find(
      (m) => (isGold ? m.code === 'GOLD' || m.name.toUpperCase().includes('GOLD') : m.code === 'SILVER' || m.name.toUpperCase().includes('SILVER'))
    ) || metals[0];

    const metalPurities = purities.filter((p) => p.metal_id === metal?.id);
    let defaultPurity = targetPurityId ? metalPurities.find((p) => p.id === targetPurityId) : undefined;
    if (!defaultPurity) {
      defaultPurity = metalPurities.find(
        (p) => (isGold ? p.code?.toUpperCase() === '24K' || p.code === '999' || p.name.includes('24') || p.name.includes('999') : p.code === '999' || p.name.includes('999'))
      ) || metalPurities[0];
    }

    const matchingRate = rates.find((r) => r.purity_id === defaultPurity?.id && r.metal_id === metal?.id)
      || rates.find((r) => r.purity_id === defaultPurity?.id)
      || rates.find((r) => r.metal_id === metal?.id);

    let applicableRate = matchingRate && matchingRate.rate > 0 ? matchingRate.rate : 0;

    const baseBenchmark = isGold
      ? rates.find((r) => r.metal_code?.toUpperCase() === 'GOLD' && (r.purity_code?.toUpperCase() === '24K' || r.purity_name?.includes('24K') || r.purity_name?.includes('999')))
        || rates.find((r) => r.metal_code?.toUpperCase() === 'GOLD' || r.metal_name?.toUpperCase().includes('GOLD'))
      : rates.find((r) => r.metal_code?.toUpperCase() === 'SILVER' && (r.purity_code === '999' || r.purity_name?.includes('999')))
        || rates.find((r) => r.metal_code?.toUpperCase() === 'SILVER' || r.metal_name?.toUpperCase().includes('SILVER'));

    const baseRate = baseBenchmark && baseBenchmark.rate > 0 ? baseBenchmark.rate : 0;

    let tunch = 99.9;
    if (defaultPurity && defaultPurity.tunch_percent) {
      tunch = Number(defaultPurity.tunch_percent);
    } else if (defaultPurity?.name) {
      const nm = defaultPurity.name.toUpperCase();
      if (nm.includes('24K') || nm.includes('999')) tunch = 99.9;
      else if (nm.includes('22K') || nm.includes('916')) tunch = 91.67;
      else if (nm.includes('18K') || nm.includes('750')) tunch = 75.0;
      else if (nm.includes('14K') || nm.includes('585')) tunch = 58.5;
      else if (nm.includes('925')) tunch = 92.5;
    }

    if (applicableRate <= 0 && baseRate > 0) {
      applicableRate = Math.round(baseRate * (tunch / 100) * 100) / 100;
    }

    return {
      metalId: metal?.id || '',
      metalName: metal?.name || (isGold ? 'Gold' : 'Silver'),
      purityId: defaultPurity?.id || '',
      purityName: defaultPurity?.name || '',
      applicableRate,
      baseRate: baseRate > 0 ? baseRate : applicableRate,
      tunchPercent: tunch,
    };
  };

  // Payment Rows Helpers
  const getDefaultReceivingAccount = (mode: string = 'BANK'): string => {
    if (!receivingAccounts || receivingAccounts.length === 0) {
      if (mode === 'CASH') return 'Cash Counter';
      if (mode === 'BANK') return 'SBI Current Account';
      if (mode === 'UPI') return 'Store Primary UPI';
      if (mode === 'CARD') return 'Card POS Terminal';
      return '';
    }
    let match: ShopReceivingAccount | undefined;
    if (mode === 'CASH') {
      match = receivingAccounts.find((a) => a.account_type === 'CASH' && a.is_default && a.is_active)
        || receivingAccounts.find((a) => a.account_type === 'CASH' && a.is_active);
    } else if (mode === 'UPI') {
      match = receivingAccounts.find((a) => a.account_type === 'UPI' && a.is_default && a.is_active)
        || receivingAccounts.find((a) => a.account_type === 'UPI' && a.is_active)
        || receivingAccounts.find((a) => a.account_type === 'BANK' && a.is_default && a.is_active);
    } else if (mode === 'CARD') {
      match = receivingAccounts.find((a) => a.account_type === 'CARD_POS' && a.is_default && a.is_active)
        || receivingAccounts.find((a) => a.account_type === 'CARD_POS' && a.is_active)
        || receivingAccounts.find((a) => a.account_type === 'BANK' && a.is_default && a.is_active);
    } else if (mode === 'BANK') {
      match = receivingAccounts.find((a) => a.account_type === 'BANK' && a.is_default && a.is_active)
        || receivingAccounts.find((a) => a.account_type === 'BANK' && a.is_active);
    }
    return match ? match.account_name : (receivingAccounts[0]?.account_name || '');
  };

  const handleAddPaymentRow = () => {
    const currentSup = suppliers.find((s) => s.id === supplierId);
    const currentSupplierName = currentSup ? currentSup.name : 'CASH SUPPLIER';
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: 'BANK',
      amount: '',
      reference_number: '',
      payer_type: 'SELF',
      payer_name: currentSupplierName,
      payer_party_id: supplierId,
      received_in: getDefaultReceivingAccount('BANK'),
    };
    setPayments((prev) => [...prev, newPay]);
  };

  const handleAddPaymentRowWithMode = (mode: 'CASH' | 'BANK' | 'GOLD' | 'SILVER' | 'CREDIT') => {
    if (mode === 'GOLD' || mode === 'SILVER') {
      handleAddMetalPaymentRow(mode);
      return;
    }
    const currentSup = suppliers.find((s) => s.id === supplierId);
    const currentSupplierName = currentSup ? currentSup.name : 'CASH SUPPLIER';
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: mode,
      amount: '',
      reference_number: '',
      payer_type: 'SELF',
      payer_name: currentSupplierName,
      payer_party_id: supplierId,
      received_in: mode === 'CREDIT' ? '' : getDefaultReceivingAccount(mode),
    };
    setPayments((prev) => [...prev, newPay]);
  };

  const handleAddMetalPaymentRow = (metalType: 'GOLD' | 'SILVER') => {
    const info = findMetalAndPurity(metalType);
    const currentSup = suppliers.find((s) => s.id === supplierId);
    const currentSupplierName = currentSup ? currentSup.name : 'CASH SUPPLIER';
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: metalType,
      amount: '',
      reference_number: '',
      payer_type: 'SELF',
      payer_name: currentSupplierName,
      payer_party_id: supplierId,
      received_in: '',
      metal_id: info.metalId,
      metal_name: info.metalName,
      purity_id: info.purityId,
      purity_name: info.purityName,
      tunch_percent: info.tunchPercent,
      metal_weight: '',
      fine_weight: '',
      metal_rate: info.applicableRate > 0 ? info.applicableRate : '',
      rate_error: info.applicableRate <= 0 ? "Today's benchmark rate not set in dashboard" : undefined,
      last_edited: 'weight',
    };
    setPayments((prev) => [...prev, newPay]);
  };

  const handleRemovePaymentRow = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSetPaymentVia = (id: string, via: 'SELF' | 'CR_PARTY' | 'DR_PARTY') => {
    const currentSup = suppliers.find((s) => s.id === supplierId);
    const currentSupplierName = currentSup ? currentSup.name : 'CASH SUPPLIER';
    if (via === 'SELF') {
      handleUpdatePaymentRow(id, {
        payer_type: 'SELF',
        payer_name: currentSupplierName,
        payer_party_id: supplierId,
      });
    } else if (via === 'CR_PARTY') {
      const otherSup = suppliers.find((s) => s.id !== supplierId) || suppliers[0];
      handleUpdatePaymentRow(id, {
        payer_type: 'CR_PARTY',
        payer_name: otherSup ? otherSup.name : '',
        payer_party_id: otherSup ? otherSup.id : '',
      });
    } else if (via === 'DR_PARTY') {
      const firstCust = customers[0];
      handleUpdatePaymentRow(id, {
        payer_type: 'DR_PARTY',
        payer_name: firstCust ? firstCust.name : '',
        payer_party_id: firstCust ? firstCust.id : '',
      });
    }
  };

  const handleSetPaymentMode = (id: string, mode: 'CASH' | 'BANK' | 'GOLD' | 'SILVER' | 'CREDIT') => {
    if (mode === 'GOLD' || mode === 'SILVER') {
      const info = findMetalAndPurity(mode);
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const tunch = info.tunchPercent || 99.9;
          const rate = info.applicableRate;
          const baseRate = info.baseRate;
          let weight = p.metal_weight;
          let fine = p.fine_weight;
          let calculatedAmount: number | string = '';

          if (weight && toDecimal(weight).gt(0)) {
            const w = toDecimal(weight);
            fine = w.times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
            if (rate > 0) {
              calculatedAmount = w.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
            }
          } else if (fine && toDecimal(fine).gt(0)) {
            const fw = toDecimal(fine);
            weight = fw.times(100).dividedBy(tunch).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
            if (baseRate > 0) {
              calculatedAmount = fw.times(baseRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
            }
          }

          return {
            ...p,
            payment_mode: mode,
            metal_id: info.metalId,
            metal_name: info.metalName,
            purity_id: info.purityId,
            purity_name: info.purityName,
            tunch_percent: tunch,
            metal_rate: rate > 0 ? rate : '',
            metal_weight: weight !== undefined ? weight : '',
            fine_weight: fine !== undefined ? fine : '',
            amount: calculatedAmount,
            rate_error: rate <= 0 ? "Today's benchmark rate not set in dashboard" : undefined,
            received_in: '',
          };
        })
      );
    } else {
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          return {
            ...p,
            payment_mode: mode,
            metal_id: undefined,
            metal_name: undefined,
            purity_id: undefined,
            purity_name: undefined,
            metal_weight: undefined,
            fine_weight: undefined,
            tunch_percent: undefined,
            metal_rate: undefined,
            rate_error: undefined,
            received_in: mode === 'CREDIT' ? '' : getDefaultReceivingAccount(mode),
          };
        })
      );
    }
  };

  const handleUpdatePaymentRow = (id: string, updates: Partial<PaymentRow>) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };

        if (updates.payment_mode && updates.payment_mode !== p.payment_mode) {
          const prevDefault = getDefaultReceivingAccount(p.payment_mode);
          if (!updated.received_in || updated.received_in === prevDefault) {
            updated.received_in = getDefaultReceivingAccount(updates.payment_mode);
          }

          if (updates.payment_mode === 'GOLD' || updates.payment_mode === 'SILVER') {
            const info = findMetalAndPurity(updates.payment_mode);
            updated.metal_id = info.metalId;
            updated.metal_name = info.metalName;
            updated.purity_id = info.purityId;
            updated.purity_name = info.purityName;
            updated.tunch_percent = info.tunchPercent;
            updated.metal_rate = info.applicableRate > 0 ? info.applicableRate : '';
            updated.rate_error = info.applicableRate <= 0 ? 'No active rate configured for this metal & purity' : undefined;

            const r = toDecimal(info.applicableRate || 0);
            const tunch = toDecimal(info.tunchPercent || 99.9);
            if (updated.metal_weight && toDecimal(updated.metal_weight).gt(0)) {
              const w = toDecimal(updated.metal_weight);
              updated.fine_weight = w.times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
              if (r.gt(0)) {
                updated.amount = w.times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
              }
            } else if (updated.fine_weight && toDecimal(updated.fine_weight).gt(0)) {
              const fw = toDecimal(updated.fine_weight);
              if (info.baseRate > 0) {
                updated.amount = fw.times(info.baseRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
              }
            }
          }
        }

        if (updates.purity_id && updates.purity_id !== p.purity_id) {
          const info = findMetalAndPurity(p.payment_mode === 'SILVER' ? 'SILVER' : 'GOLD', updates.purity_id);
          updated.purity_id = info.purityId;
          updated.purity_name = info.purityName;
          updated.metal_rate = info.applicableRate > 0 ? info.applicableRate : '';
          updated.tunch_percent = info.tunchPercent;
          updated.rate_error = info.applicableRate <= 0 ? 'No active rate configured for this purity' : undefined;

          const r = toDecimal(info.applicableRate || 0);
          const tunch = toDecimal(info.tunchPercent || 99.9);
          if (updated.metal_weight && toDecimal(updated.metal_weight).gt(0)) {
            const w = toDecimal(updated.metal_weight);
            updated.fine_weight = w.times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
            if (r.gt(0)) {
              updated.amount = w.times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
            }
          } else if (updated.fine_weight && toDecimal(updated.fine_weight).gt(0)) {
            const fw = toDecimal(updated.fine_weight);
            if (info.baseRate > 0) {
              updated.amount = fw.times(info.baseRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
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
        const isGold = p.payment_mode === 'GOLD';
        const info = findMetalAndPurity(p.payment_mode === 'SILVER' ? 'SILVER' : 'GOLD', p.purity_id);
        const rate = toDecimal(p.metal_rate || info.applicableRate || 0);
        const tunch = toDecimal(p.tunch_percent || info.tunchPercent || (isGold ? 99.9 : 99.9));

        const w = toDecimal(sanitized || 0);
        const fineWeight = sanitized && !w.isZero()
          ? w.times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber()
          : '';

        if (rate.lte(0)) {
          return {
            ...p,
            metal_weight: sanitized,
            fine_weight: fineWeight,
            amount: '',
            last_edited: 'weight',
            rate_error: "Today's benchmark rate not configured on dashboard to calculate payment value",
          };
        }

        const amount = sanitized && !w.isZero()
          ? w.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
          : '';

        return {
          ...p,
          metal_weight: sanitized,
          fine_weight: fineWeight,
          tunch_percent: tunch.toNumber(),
          metal_rate: rate.toNumber(),
          amount,
          last_edited: 'weight',
          rate_error: undefined,
        };
      })
    );
  };

  const handleMetalFineWeightChange = (id: string, value: string) => {
    const sanitized = parseDecimalInput(value, 4);
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const isGold = p.payment_mode === 'GOLD';
        const info = findMetalAndPurity(p.payment_mode === 'SILVER' ? 'SILVER' : 'GOLD', p.purity_id);
        const baseRate = toDecimal(info.baseRate || p.metal_rate || info.applicableRate || 0);
        const tunch = toDecimal(p.tunch_percent || info.tunchPercent || (isGold ? 99.9 : 99.9));

        const fw = toDecimal(sanitized || 0);
        const grossWeight = sanitized && !fw.isZero() && tunch.gt(0)
          ? fw.times(100).dividedBy(tunch).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber()
          : (p.metal_weight || '');

        if (baseRate.lte(0)) {
          return {
            ...p,
            fine_weight: sanitized,
            metal_weight: grossWeight,
            amount: '',
            last_edited: 'fine',
            rate_error: "Today's benchmark rate not configured on dashboard to calculate payment value",
          };
        }

        const amount = sanitized && !fw.isZero()
          ? fw.times(baseRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
          : '';

        return {
          ...p,
          fine_weight: sanitized,
          metal_weight: grossWeight,
          amount,
          last_edited: 'fine',
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
        return {
          ...p,
          amount: sanitized,
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
    let totalBadlaWeight = new Decimal(0);
    let totalBadlaAmount = new Decimal(0);
    let totalWasteOnlyWeight = new Decimal(0);
    let totalWasteOnlyAmount = new Decimal(0);
    let totalWastageWeight = new Decimal(0);
    let totalWastageAmount = new Decimal(0);
    let totalMakingCharges = new Decimal(0);
    let totalPurchaseAmount = new Decimal(0);

    let goldNetWeight = new Decimal(0);
    let goldFineWeight = new Decimal(0);
    let goldAdjustedFineWeight = new Decimal(0);
    let silverNetWeight = new Decimal(0);
    let silverFineWeight = new Decimal(0);
    let silverAdjustedFineWeight = new Decimal(0);

    interface MetalSummaryAcc {
      metalName: string;
      grossWeight: Decimal;
      lessWeight: Decimal;
      netWeight: Decimal;
      pureFineWeight: Decimal;
      badlaWeight: Decimal;
      badlaAmount: Decimal;
      wasteWeight: Decimal;
      wasteAmount: Decimal;
      billableFineWeight: Decimal;
      makingCharges: Decimal;
      purchaseAmount: Decimal;
      itemCount: number;
    }
    const purchaseMetalMap = new Map<string, MetalSummaryAcc>();

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
      const badlaAmount = badlaWeight.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const wasteOnlyWeight = pureFine.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const wasteOnlyAmount = wasteOnlyWeight.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

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
      totalBadlaWeight = totalBadlaWeight.plus(badlaWeight);
      totalBadlaAmount = totalBadlaAmount.plus(badlaAmount);
      totalWasteOnlyWeight = totalWasteOnlyWeight.plus(wasteOnlyWeight);
      totalWasteOnlyAmount = totalWasteOnlyAmount.plus(wasteOnlyAmount);
      totalWastageWeight = totalWastageWeight.plus(wastageWeight);
      totalWastageAmount = totalWastageAmount.plus(wastageAmount);
      totalMakingCharges = totalMakingCharges.plus(making);
      totalPurchaseAmount = totalPurchaseAmount.plus(rowAmount);

      if (net.gt(0) || gross.gt(0)) {
        const rawMetalName = (item.metal_name || 'Gold').trim();
        const standardMetalKey = rawMetalName.toUpperCase();
        let metalAcc = purchaseMetalMap.get(standardMetalKey);
        if (!metalAcc) {
          metalAcc = {
            metalName: rawMetalName,
            grossWeight: new Decimal(0),
            lessWeight: new Decimal(0),
            netWeight: new Decimal(0),
            pureFineWeight: new Decimal(0),
            badlaWeight: new Decimal(0),
            badlaAmount: new Decimal(0),
            wasteWeight: new Decimal(0),
            wasteAmount: new Decimal(0),
            billableFineWeight: new Decimal(0),
            makingCharges: new Decimal(0),
            purchaseAmount: new Decimal(0),
            itemCount: 0,
          };
          purchaseMetalMap.set(standardMetalKey, metalAcc);
        }
        metalAcc.grossWeight = metalAcc.grossWeight.plus(gross);
        metalAcc.lessWeight = metalAcc.lessWeight.plus(less);
        metalAcc.netWeight = metalAcc.netWeight.plus(net);
        metalAcc.pureFineWeight = metalAcc.pureFineWeight.plus(pureFine);
        metalAcc.badlaWeight = metalAcc.badlaWeight.plus(badlaWeight);
        metalAcc.badlaAmount = metalAcc.badlaAmount.plus(badlaAmount);
        metalAcc.wasteWeight = metalAcc.wasteWeight.plus(wasteOnlyWeight);
        metalAcc.wasteAmount = metalAcc.wasteAmount.plus(wasteOnlyAmount);
        metalAcc.billableFineWeight = metalAcc.billableFineWeight.plus(billableFine);
        metalAcc.makingCharges = metalAcc.makingCharges.plus(making);
        metalAcc.purchaseAmount = metalAcc.purchaseAmount.plus(rowAmount);
        metalAcc.itemCount += 1;

        const metalName = rawMetalName.toUpperCase();
        const isSilver = metalName.includes('SILVER');
        const isDiamond = metalName.includes('DIAMOND');
        const isPlatinum = metalName.includes('PLATINUM');
        if (isSilver) {
          silverNetWeight = silverNetWeight.plus(net);
          silverFineWeight = silverFineWeight.plus(pureFine);
          silverAdjustedFineWeight = silverAdjustedFineWeight.plus(billableFine);
        } else if (!isDiamond && !isPlatinum) {
          goldNetWeight = goldNetWeight.plus(net);
          goldFineWeight = goldFineWeight.plus(pureFine);
          goldAdjustedFineWeight = goldAdjustedFineWeight.plus(billableFine);
        }
      }
    });

    const metalBreakdowns = Array.from(purchaseMetalMap.values()).map((m) => ({
      metalName: m.metalName,
      grossWeight: m.grossWeight.toNumber(),
      lessWeight: m.lessWeight.toNumber(),
      netWeight: m.netWeight.toNumber(),
      pureFineWeight: m.pureFineWeight.toNumber(),
      badlaWeight: m.badlaWeight.toNumber(),
      badlaAmount: m.badlaAmount.toNumber(),
      wasteWeight: m.wasteWeight.toNumber(),
      wasteAmount: m.wasteAmount.toNumber(),
      billableFineWeight: m.billableFineWeight.toNumber(),
      makingCharges: m.makingCharges.toNumber(),
      purchaseAmount: m.purchaseAmount.toNumber(),
      itemCount: m.itemCount,
    }));

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

    let goldExchangeNetWeight = new Decimal(0);
    let goldExchangeFineWeight = new Decimal(0);
    let silverExchangeNetWeight = new Decimal(0);
    let silverExchangeFineWeight = new Decimal(0);

    interface ExMetalSummaryAcc {
      metalName: string;
      grossWeight: Decimal;
      lessWeight: Decimal;
      netWeight: Decimal;
      pureFineWeight: Decimal;
      badlaWeight: Decimal;
      badlaAmount: Decimal;
      wasteWeight: Decimal;
      wasteAmount: Decimal;
      deductionAmount: Decimal;
      billableFineWeight: Decimal;
      exchangeValue: Decimal;
      itemCount: number;
    }
    const exMetalMap = new Map<string, ExMetalSummaryAcc>();

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
      const badlaAmt = badlaWeight.times(rate);
      const wasteAmt = wasteWeight.times(rate);

      totalExchangeGross = totalExchangeGross.plus(gross);
      totalExchangeLess = totalExchangeLess.plus(less);
      totalExchangeNet = totalExchangeNet.plus(net);
      totalExchangeFine = totalExchangeFine.plus(pureFine);
      totalExchangeAdjustedFine = totalExchangeAdjustedFine.plus(billableFine);
      totalExchangeBadlaWeight = totalExchangeBadlaWeight.plus(badlaWeight);
      totalExchangeWasteWeight = totalExchangeWasteWeight.plus(wasteWeight);
      totalExchangeDeduction = totalExchangeDeduction.plus(deduction);
      totalExchangeValue = totalExchangeValue.plus(exVal);

      const rawExMetalName = (ex.metal_name || 'Gold').trim();
      const standardExMetalKey = rawExMetalName.toUpperCase();
      const isExSilver = standardExMetalKey.includes('SILVER');
      const isExDiamond = standardExMetalKey.includes('DIAMOND');
      const isExPlatinum = standardExMetalKey.includes('PLATINUM');
      if (isExSilver) {
        silverExchangeNetWeight = silverExchangeNetWeight.plus(net);
        silverExchangeFineWeight = silverExchangeFineWeight.plus(pureFine);
      } else if (!isExDiamond && !isExPlatinum) {
        goldExchangeNetWeight = goldExchangeNetWeight.plus(net);
        goldExchangeFineWeight = goldExchangeFineWeight.plus(pureFine);
      }

      let exAcc = exMetalMap.get(standardExMetalKey);
      if (!exAcc) {
        exAcc = {
          metalName: rawExMetalName,
          grossWeight: new Decimal(0),
          lessWeight: new Decimal(0),
          netWeight: new Decimal(0),
          pureFineWeight: new Decimal(0),
          badlaWeight: new Decimal(0),
          badlaAmount: new Decimal(0),
          wasteWeight: new Decimal(0),
          wasteAmount: new Decimal(0),
          deductionAmount: new Decimal(0),
          billableFineWeight: new Decimal(0),
          exchangeValue: new Decimal(0),
          itemCount: 0,
        };
        exMetalMap.set(standardExMetalKey, exAcc);
      }
      exAcc.grossWeight = exAcc.grossWeight.plus(gross);
      exAcc.lessWeight = exAcc.lessWeight.plus(less);
      exAcc.netWeight = exAcc.netWeight.plus(net);
      exAcc.pureFineWeight = exAcc.pureFineWeight.plus(pureFine);
      exAcc.badlaWeight = exAcc.badlaWeight.plus(badlaWeight);
      exAcc.badlaAmount = exAcc.badlaAmount.plus(badlaAmt);
      exAcc.wasteWeight = exAcc.wasteWeight.plus(wasteWeight);
      exAcc.wasteAmount = exAcc.wasteAmount.plus(wasteAmt);
      exAcc.deductionAmount = exAcc.deductionAmount.plus(deduction);
      exAcc.billableFineWeight = exAcc.billableFineWeight.plus(billableFine);
      exAcc.exchangeValue = exAcc.exchangeValue.plus(exVal);
      exAcc.itemCount += 1;
    });

    const exchangeMetalBreakdowns = Array.from(exMetalMap.values()).map((m) => ({
      metalName: m.metalName,
      grossWeight: m.grossWeight.toNumber(),
      lessWeight: m.lessWeight.toNumber(),
      netWeight: m.netWeight.toNumber(),
      pureFineWeight: m.pureFineWeight.toNumber(),
      badlaWeight: m.badlaWeight.toNumber(),
      badlaAmount: m.badlaAmount.toNumber(),
      wasteWeight: m.wasteWeight.toNumber(),
      wasteAmount: m.wasteAmount.toNumber(),
      deductionAmount: m.deductionAmount.toNumber(),
      billableFineWeight: m.billableFineWeight.toNumber(),
      exchangeValue: m.exchangeValue.toNumber(),
      itemCount: m.itemCount,
    }));

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
    const netPayable = grandTotal.minus(totalExchangeValue);

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

    const isReceivableFromSupplier = netPayable.lt(0);
    const balanceDue = isReceivableFromSupplier ? new Decimal(0) : Decimal.max(0, netPayable.minus(totalPaid));
    const receivableFromSupplier = isReceivableFromSupplier
      ? Decimal.max(0, netPayable.abs().minus(totalPaid))
      : new Decimal(0);
    const excessPaid = !isReceivableFromSupplier
      ? Decimal.max(0, totalPaid.minus(netPayable))
      : Decimal.max(0, totalPaid.minus(netPayable.abs()));
    const isSettled = isReceivableFromSupplier
      ? totalPaid.gte(netPayable.abs())
      : netPayable.gt(0)
      ? totalPaid.gte(netPayable)
      : true;

    return {
      metalBreakdowns,
      exchangeMetalBreakdowns,
      totalGrossWeight: totalGrossWeight.toNumber(),
      totalLessWeight: totalLessWeight.toNumber(),
      totalNetWeight: totalNetWeight.toNumber(),
      totalFineWeight: totalFineWeight.toNumber(),
      totalAdjustedFineWeight: totalAdjustedFineWeight.toNumber(),
      totalBadlaWeight: totalBadlaWeight.toNumber(),
      totalBadlaAmount: totalBadlaAmount.toNumber(),
      totalWasteOnlyWeight: totalWasteOnlyWeight.toNumber(),
      totalWasteOnlyAmount: totalWasteOnlyAmount.toNumber(),
      totalWastageWeight: totalWastageWeight.toNumber(),
      totalWastageAmount: totalWastageAmount.toNumber(),
      totalMakingCharges: totalMakingCharges.toNumber(),
      totalPurchaseAmount: totalPurchaseAmount.toNumber(),
      goldNetWeight: goldNetWeight.toNumber(),
      goldFineWeight: goldFineWeight.toNumber(),
      goldAdjustedFineWeight: goldAdjustedFineWeight.toNumber(),
      silverNetWeight: silverNetWeight.toNumber(),
      silverFineWeight: silverFineWeight.toNumber(),
      silverAdjustedFineWeight: silverAdjustedFineWeight.toNumber(),
      totalExchangeGross: totalExchangeGross.toNumber(),
      totalExchangeLess: totalExchangeLess.toNumber(),
      totalExchangeNet: totalExchangeNet.toNumber(),
      totalExchangeFine: totalExchangeFine.toNumber(),
      totalExchangeAdjustedFine: totalExchangeAdjustedFine.toNumber(),
      totalExchangeBadlaWeight: totalExchangeBadlaWeight.toNumber(),
      totalExchangeWasteWeight: totalExchangeWasteWeight.toNumber(),
      totalExchangeDeduction: totalExchangeDeduction.toNumber(),
      totalExchangeValue: totalExchangeValue.toNumber(),
      goldExchangeNetWeight: goldExchangeNetWeight.toNumber(),
      goldExchangeFineWeight: goldExchangeFineWeight.toNumber(),
      silverExchangeNetWeight: silverExchangeNetWeight.toNumber(),
      silverExchangeFineWeight: silverExchangeFineWeight.toNumber(),
      netTaxable: netTaxable.toNumber(),
      gstAmount: gstAmount.toNumber(),
      cgst: cgst.toNumber(),
      sgst: sgst.toNumber(),
      roundOff: roundOff.toNumber(),
      grandTotal: grandTotal.toNumber(),
      netPayable: netPayable.toNumber(),
      isReceivableFromSupplier,
      receivableFromSupplier: receivableFromSupplier.toNumber(),
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
    const settleAmt = Math.abs(calculations.netPayable);
    const defBank = getDefaultReceivingAccount();
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payer_type: 'SELF',
        payment_mode: mode,
        amount: settleAmt,
        received_in: mode === 'BANK' ? defBank : '',
        payer_bank: mode === 'BANK' ? defBank : '',
        reference_number: mode !== 'CASH' ? 'NEFT/INWARD-PMT' : '',
      },
    ]);
  };

  const handleClearPayments = () => {
    const defBank = getDefaultReceivingAccount();
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payer_type: 'SELF',
        payment_mode: 'BANK',
        amount: '',
        received_in: defBank,
        payer_bank: defBank,
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

    setPurchaseItems([
      {
        id: `pur-row-${Date.now()}-1`,
        product_id: '',
        tag_no: '',
        item_name: '',
        metal_id: '',
        metal_name: '',
        purity_id: '',
        purity_name: '',
        gross_weight: '',
        less_weight: '',
        tunch_percent: '',
        badla_percent: '',
        wastage_percent: '',
        making_rate: '',
        making_charge_type: 'PER_GRAM',
        rate_per_gram: '',
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
      showToast('error', 'Please select a supplier / purchase account');
      return;
    }

    if (purchaseItems.length === 0 && exchangeItems.length === 0) {
      showToast('error', 'Please add at least one purchase item or exchange item');
      return;
    }

    // Validate every mandatory field for purchaseItems
    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i];
      const rowNum = i + 1;
      const itemName = item.item_name?.trim() || `Item #${rowNum}`;

      if (invoiceColumns.show_tag_no) {
        if (!item.tag_no || !item.tag_no.trim()) {
          showToast('error', `Tag number is required for purchase item #${rowNum}`);
          return;
        }
      }
      if (!item.item_name || !item.item_name.trim()) {
        showToast('error', `Item name is required for purchase item #${rowNum}`);
        return;
      }
      if (!item.metal_id) {
        showToast('error', `Metal is required for purchase item "${itemName}"`);
        return;
      }
      if (invoiceColumns.show_tunch) {
        const tunchNum = Number(item.tunch_percent);
        if (item.tunch_percent === '' || item.tunch_percent === null || item.tunch_percent === undefined || isNaN(tunchNum) || tunchNum <= 0 || tunchNum > 100) {
          showToast('error', `Tunch% is required (between 0.01% and 100%) for "${itemName}"`);
          return;
        }
      }
      const grossNum = Number(item.gross_weight);
      if (item.gross_weight === '' || item.gross_weight === null || item.gross_weight === undefined || isNaN(grossNum) || grossNum <= 0) {
        showToast('error', `Gross weight is required and must be greater than zero for "${itemName}"`);
        return;
      }
      if (invoiceColumns.show_less_weight) {
        const lessNum = Number(item.less_weight);
        if (item.less_weight === '' || item.less_weight === null || item.less_weight === undefined || isNaN(lessNum) || lessNum < 0) {
          showToast('error', `Less weight is required (0 or greater) for "${itemName}"`);
          return;
        }
        if (lessNum > grossNum) {
          showToast('error', `Less weight cannot exceed gross weight for "${itemName}"`);
          return;
        }
      }
      if (invoiceColumns.show_badla) {
        if (item.badla_percent === '' || item.badla_percent === null || item.badla_percent === undefined || isNaN(Number(item.badla_percent))) {
          showToast('error', `Badla% is required (enter 0 if none) for "${itemName}"`);
          return;
        }
      }
      if (invoiceColumns.show_wastage) {
        if (item.wastage_percent === '' || item.wastage_percent === null || item.wastage_percent === undefined || isNaN(Number(item.wastage_percent))) {
          showToast('error', `Waste% is required (enter 0 if none) for "${itemName}"`);
          return;
        }
      }
      if (invoiceColumns.show_making_charge) {
        if (item.making_rate === '' || item.making_rate === null || item.making_rate === undefined || isNaN(Number(item.making_rate))) {
          showToast('error', `Making charge is required (enter 0 if zero labour) for "${itemName}"`);
          return;
        }
      }
      const rateNum = Number(item.rate_per_gram);
      if (item.rate_per_gram === '' || item.rate_per_gram === null || item.rate_per_gram === undefined || isNaN(rateNum) || rateNum <= 0) {
        showToast('error', `Rate per gram is required and must be greater than zero for "${itemName}"`);
        return;
      }
    }

    for (let j = 0; j < exchangeItems.length; j++) {
      const ex = exchangeItems[j];
      const rowNum = j + 1;

      if (!ex.item_name || !ex.item_name.trim()) {
        showToast('error', `Exchange Row #${rowNum}: Item Name / Description is mandatory`);
        return;
      }
      if (!ex.metal_id) {
        showToast('error', `Exchange Row #${rowNum}: Metal is mandatory`);
        return;
      }
      const tunch = toDecimal(ex.tunch_percent);
      if (tunch.lte(0) || tunch.gt(100)) {
        showToast('error', `Exchange Row #${rowNum}: Tunch% is mandatory (must be between 0.01% and 100%)`);
        return;
      }
      const gross = toDecimal(ex.gross_weight);
      if (gross.lte(0)) {
        showToast('error', `Exchange Row #${rowNum} ("${ex.item_name}"): Gross weight is mandatory and must be greater than zero`);
        return;
      }
      const less = toDecimal(ex.less_weight);
      if (less.lt(0)) {
        showToast('error', `Exchange Row #${rowNum} ("${ex.item_name}"): Less weight cannot be negative`);
        return;
      }
      if (less.gt(gross)) {
        showToast('error', `Exchange Row #${rowNum} ("${ex.item_name}"): Less weight cannot exceed gross weight`);
        return;
      }
      const rate = toDecimal(ex.exchange_rate);
      if (rate.lte(0)) {
        showToast('error', `Exchange Row #${rowNum} ("${ex.item_name}"): Exchange rate/g is mandatory and must be greater than zero`);
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

          const resolvedPurityId = item.purity_id || purities.find((p) => p.metal_id === item.metal_id)?.id || purities[0]?.id || '';

          return {
            product_id: item.product_id || undefined,
            item_name: item.item_name?.trim() ? item.item_name.trim().toUpperCase() : 'STOCK INWARD',
            metal_id: item.metal_id,
            purity_id: resolvedPurityId,
            tag_no: invoiceColumns.show_tag_no ? item.tag_no?.trim().toUpperCase() : (item.tag_no?.trim().toUpperCase() || ''),
            gross_weight: gross.toNumber(),
            less_weight: invoiceColumns.show_less_weight ? less.toNumber() : 0,
            tunch_percent: invoiceColumns.show_tunch ? tunch.toNumber() : 100,
            badla_percent: invoiceColumns.show_badla ? badla.toNumber() : 0,
            wastage_percent: invoiceColumns.show_wastage ? toDecimal(item.wastage_percent).toNumber() : 0,
            making_charge: invoiceColumns.show_making_charge ? making.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0,
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
            payment_source_type: p.payer_type || 'SELF',
            payer_party_id: p.payer_party_id || undefined,
            payer_name: p.payer_name?.trim() || undefined,
            payer_bank: p.payer_bank?.trim() || undefined,
            received_in: p.received_in?.trim() || undefined,
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
  const handleOpenSupplierModal = (initialQuery?: unknown) => {
    setSupplierFormError(null);
    setSupplierPrimaryDirection('CREDIT');

    let prefillName = '';
    let prefillPhone = '';
    if (initialQuery && typeof initialQuery === 'string') {
      const q = initialQuery.trim();
      if (/^[0-9+\s()-]+$/.test(q)) {
        prefillPhone = q;
      } else {
        prefillName = q.toUpperCase();
      }
    }

    setSupplierForm({
      name: prefillName,
      supplier_code: '',
      phone: prefillPhone,
      alternate_phone: '',
      email: '',
      contact_person: '',
      address: '',
      city: shopProfile?.city ? shopProfile.city.toUpperCase() : '',
      state: shopProfile?.state ? shopProfile.state.toUpperCase() : 'MAHARASHTRA',
      pincode: shopProfile?.pincode || '',
      gstin: '',
      opening_balance: 0,
      opening_balance_type: 'CREDIT',
      opening_balance_date: new Date().toISOString().split('T')[0],
      opening_balance_ref: '',
      opening_balance_notes: '',
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
        name: supplierForm.name.trim().toUpperCase(),
        supplier_code: supplierForm.supplier_code.trim() ? supplierForm.supplier_code.trim().toUpperCase() : undefined,
        phone: supplierForm.phone.trim() || null,
        alternate_phone: supplierForm.alternate_phone.trim() || null,
        email: supplierForm.email.trim() || null,
        contact_person: supplierForm.contact_person.trim() ? supplierForm.contact_person.trim().toUpperCase() : null,
        address: supplierForm.address.trim() ? supplierForm.address.trim().toUpperCase() : null,
        city: supplierForm.city.trim() ? supplierForm.city.trim().toUpperCase() : null,
        state: supplierForm.state.trim() ? supplierForm.state.trim().toUpperCase() : null,
        pincode: supplierForm.pincode.trim() || null,
        gstin: supplierForm.gstin.trim() ? supplierForm.gstin.trim().toUpperCase() : null,
        opening_balance_date: supplierForm.opening_balance_date || undefined,
        opening_balance_ref: supplierForm.opening_balance_ref.trim() ? supplierForm.opening_balance_ref.trim().toUpperCase() : undefined,
        opening_balance_notes: supplierForm.opening_balance_notes.trim() || undefined,
        opening_cash_balance: Number(supplierForm.opening_cash_balance) || 0,
        opening_cash_type: supplierForm.opening_cash_type,
        opening_bank_balance: Number(supplierForm.opening_bank_balance) || 0,
        opening_bank_type: supplierForm.opening_bank_type,
        opening_gold_weight: Number(supplierForm.opening_gold_weight) || 0,
        opening_gold_type: supplierForm.opening_gold_type,
        opening_gold_purity_id: supplierForm.opening_gold_purity_id || undefined,
        opening_gold_rate: Number(supplierForm.opening_gold_rate) || 0,
        opening_gold_value: Number(supplierForm.opening_gold_value) || 0,
        opening_silver_weight: Number(supplierForm.opening_silver_weight) || 0,
        opening_silver_type: supplierForm.opening_silver_type,
        opening_silver_purity_id: supplierForm.opening_silver_purity_id || undefined,
        opening_silver_rate: Number(supplierForm.opening_silver_rate) || 0,
        opening_silver_value: Number(supplierForm.opening_silver_value) || 0,
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

  // Quick Cash Supplier identifier
  const isCashSupplier = useMemo(() => {
    if (!selectedSupplier) return false;
    const n = (selectedSupplier.name || '').toUpperCase();
    const c = (selectedSupplier.supplier_code || '').toUpperCase();
    const phone = selectedSupplier.phone || '';
    return (
      n.includes('CASH') ||
      n.includes('WALK-IN') ||
      n.includes('WALKIN') ||
      c === 'CASH' ||
      phone === '9999999999' ||
      phone === 'COUNTER'
    );
  }, [selectedSupplier]);

  // Quick Walk-in Cash Supplier (Counter Purchase — No Khata Record)
  const handleQuickCashSupplier = async () => {
    try {
      const existing = suppliers.find((s) => {
        const n = (s.name || '').toUpperCase();
        const code = (s.supplier_code || '').toUpperCase();
        const phone = s.phone || '';
        return (
          n.includes('CASH') ||
          n.includes('WALK-IN') ||
          n.includes('WALKIN') ||
          code === 'CASH' ||
          phone === '9999999999' ||
          phone === 'COUNTER'
        );
      });
      if (existing) {
        setSupplierId(existing.id);
        showToast('success', `Selected ${existing.name} (Cash Supplier • No Khata)`);
        return;
      }

      const created = await supplierApi.create({
        name: 'CASH SUPPLIER',
        supplier_code: 'CASH',
        phone: '9999999999',
        address: 'COUNTER CASH PURCHASE',
        city: (shopProfile?.city || 'LOCAL').toUpperCase(),
        state: (shopProfile?.state || '').toUpperCase(),
      });
      setSuppliers((prev) => [created, ...prev]);
      setSupplierId(created.id);
      showToast('success', 'Selected Cash Supplier (Counter Purchase • No Khata Record)');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to select cash supplier');
    }
  };

  // Dynamic Column Count & Alignment based on Store Invoice / Bill Configuration
  const purLeadColSpan = 1 + (invoiceColumns.show_tag_no ? 1 : 0) + 1 + 1 + (invoiceColumns.show_tunch ? 1 : 0);
  const totalVisiblePurCols =
    1 +
    (invoiceColumns.show_tag_no ? 1 : 0) +
    1 +
    1 +
    (invoiceColumns.show_tunch ? 1 : 0) +
    1 +
    (invoiceColumns.show_less_weight ? 1 : 0) +
    (invoiceColumns.show_net_weight ? 1 : 0) +
    (invoiceColumns.show_badla ? 1 : 0) +
    (invoiceColumns.show_wastage ? 1 : 0) +
    (invoiceColumns.show_making_charge ? 1 : 0) +
    (invoiceColumns.show_fine_weight ? 1 : 0) +
    2 +
    1;

  const purExchLeadColSpan = 1 + (invoiceColumns.show_tag_no ? 1 : 0) + 1 + 1 + (invoiceColumns.show_tunch ? 1 : 0);

  return (
    <div className="pos-page-container uppercase">
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
            className="back-nav-btn uppercase"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
          <div className="header-title-wrapper">
            <h1 className="pos-main-title font-serif uppercase">
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
            className={`btn btn-sm uppercase ${viewMode === 'form' ? 'btn-primary' : 'btn-outline'}`}
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
            className={`btn btn-sm uppercase ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
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
                className="btn btn-outline btn-sm uppercase"
                onClick={handleStartNewBill}
                disabled={isSubmitting}
                title="Clear current purchase form"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm uppercase"
                onClick={() => handleSavePurchase(false)}
                disabled={isSubmitting}
              >
                <Save size={15} />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm font-semibold uppercase"
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
      <div className="pos-nav-tabs-bar uppercase">
        <div className="nav-tabs-group">
          <button
            type="button"
            className="pos-tab-pill link-tab uppercase"
            onClick={() => navigate('/billing/create')}
          >
            Retail Sale
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab uppercase"
            onClick={() => navigate('/billing/create')}
          >
            Wholesale
          </button>
          <button
            type="button"
            className="pos-tab-pill active uppercase"
            onClick={() => setViewMode('form')}
          >
            Purchase Bill
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab uppercase"
            onClick={() => navigate('/billing/karigar-bill')}
          >
            Karigar Bill
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab uppercase"
            onClick={() => navigate('/billing/exchange')}
          >
            Exchange
          </button>
          <button
            type="button"
            className="pos-tab-pill link-tab uppercase"
            onClick={() => navigate('/billing/repair')}
          >
            Repair Bill
          </button>
        </div>

        {/* Live Board Rates Indicator */}
        <div className="live-rates-ticker uppercase">
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
          {/* SUPPLIER / PURCHASE ACCOUNT META CARD */}
          <div className="pos-meta-card uppercase">
            <div className="meta-grid">
              {/* Supplier Selection */}
              <div className="meta-col customer-col">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="meta-label whitespace-nowrap mb-0">
                    Supplier / Purchase Account <span className="req-star">*</span>
                  </label>
                  <div className="customer-header-actions flex items-center gap-2 flex-nowrap shrink-0">
                    <button
                      type="button"
                      className="quick-walkin-link uppercase whitespace-nowrap"
                      onClick={handleQuickCashSupplier}
                      title="Spot cash purchase • No supplier khata maintained"
                    >
                      <Banknote size={12} />
                      <span>+ CASH SUPPLIER</span>
                    </button>
                    <button
                      type="button"
                      className="quick-add-customer-link uppercase whitespace-nowrap"
                      onClick={() => handleOpenSupplierModal()}
                      title="Create new supplier in Master directory & select for purchase"
                    >
                      <UserPlus size={12} />
                      <span>+ Add Supplier</span>
                    </button>
                  </div>
                </div>
                <SupplierSearchSelect
                  suppliers={suppliers}
                  selectedSupplierId={supplierId}
                  onSelectSupplier={(s) => setSupplierId(s.id)}
                  onClearSupplier={() => setSupplierId('')}
                  onAddNewSupplier={(initName) => handleOpenSupplierModal(initName)}
                  onQuickCashSupplier={handleQuickCashSupplier}
                  onSupplierDiscovered={(newSup) => {
                    setSuppliers((prev) => {
                      if (prev.some((s) => s.id === newSup.id)) return prev;
                      return [...prev, newSup];
                    });
                  }}
                  placeholder="Search by supplier name, phone, code, or city..."
                />
              </div>

              {/* Phone, GSTIN & Address Box */}
              <div className="meta-col contact-col">
                <label className="meta-label">Supplier Contact & GSTIN</label>
                <div className="customer-info-box font-mono text-xs">
                  {isCashSupplier ? (
                    <div className="cash-walkin-banner">
                      <div className="cash-title-row">
                        <Banknote size={14} className="text-emerald-500" />
                        <span>CASH SUPPLIER (COUNTER PURCHASE)</span>
                      </div>
                      <div className="cash-subtext font-sans">
                        Spot cash payment at counter • No supplier khata record maintained
                      </div>
                    </div>
                  ) : (
                    <div className="customer-contact-wrapper">
                      <div className="customer-contact-line">
                        {selectedSupplier?.contact_person && (
                          <>
                            <span className="text-gold font-medium">Attn: {selectedSupplier.contact_person}</span>
                            <span className="customer-contact-bullet">•</span>
                          </>
                        )}
                        <span className="customer-contact-phone font-mono">
                          <Phone size={11} className="inline-icon text-gold" />
                          <span>{selectedSupplier?.phone || 'No Phone'}</span>
                        </span>
                        {selectedSupplier?.alternate_phone && (
                          <>
                            <span className="customer-contact-bullet">•</span>
                            <span className="font-mono text-muted text-xs">Alt: {selectedSupplier.alternate_phone}</span>
                          </>
                        )}
                        <span className="customer-contact-bullet">•</span>
                        <span
                          className="customer-contact-address"
                          title={[selectedSupplier?.address, selectedSupplier?.city].filter(Boolean).join(', ') || 'Counter Purchase'}
                        >
                          <MapPin size={11} className="inline-icon text-muted" />
                          <span>{[selectedSupplier?.address, selectedSupplier?.city].filter(Boolean).join(', ') || 'Counter Purchase'}</span>
                        </span>
                        {selectedSupplier?.gstin && (
                          <>
                            <span className="customer-contact-bullet">•</span>
                            <span className="text-gold font-mono">GST: {selectedSupplier.gstin}</span>
                          </>
                        )}
                      </div>

                      {/* Supplier Closing & Live Balances Badges */}
                      {selectedSupplier && (
                        <div className="supplier-khata-badges mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          {/* Monetary Balance */}
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                              Number(selectedSupplier.current_balance || 0) > 0
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : Number(selectedSupplier.current_balance || 0) < 0
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                            title="Current Khata balance: Cr = Shop owes Supplier (Payable), Dr = Advance paid to Supplier"
                          >
                            <Banknote size={11} />
                            <span>
                              {Number(selectedSupplier.current_balance || 0) > 0
                                ? `Khata: ₹${Number(selectedSupplier.current_balance).toLocaleString('en-IN')} Cr (Payable)`
                                : Number(selectedSupplier.current_balance || 0) < 0
                                ? `Khata: ₹${Math.abs(Number(selectedSupplier.current_balance)).toLocaleString('en-IN')} Dr (Advance)`
                                : 'Khata: ₹0.00 (Nil)'}
                            </span>
                          </span>

                          {/* Gold Balance */}
                          {Number(selectedSupplier.gold_balance_grams || 0) !== 0 && (
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                                Number(selectedSupplier.gold_balance_grams || 0) > 0
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}
                              title="Live Gold Balance: Cr = Shop owes Gold to Supplier, Dr = Supplier owes Gold to Shop"
                            >
                              <Coins size={11} />
                              <span>
                                Au: {Number(selectedSupplier.gold_balance_grams).toFixed(3)}g{' '}
                                {Number(selectedSupplier.gold_balance_grams || 0) > 0 ? 'Cr (Payable)' : 'Dr (Owed)'}
                              </span>
                            </span>
                          )}

                          {/* Silver Balance */}
                          {Number(selectedSupplier.silver_balance_grams || 0) !== 0 && (
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                                Number(selectedSupplier.silver_balance_grams || 0) > 0
                                  ? 'bg-slate-300/15 text-slate-200 border border-slate-400/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}
                              title="Live Silver Balance: Cr = Shop owes Silver to Supplier, Dr = Supplier owes Silver to Shop"
                            >
                              <Scale size={11} />
                              <span>
                                Ag: {Number(selectedSupplier.silver_balance_grams).toFixed(3)}g{' '}
                                {Number(selectedSupplier.silver_balance_grams || 0) > 0 ? 'Cr (Payable)' : 'Dr (Owed)'}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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

            {/* Datalist for Product Auto-complete */}
            {/* Datalist for Quick Item Name Suggestions (Ring, Chain, Bullion, etc.) */}
            <datalist id="purchase-products-list">
              <option value="Ring">Ring</option>
              <option value="Chain">Chain</option>
              <option value="Bangle">Bangle</option>
              <option value="Necklace">Necklace</option>
              <option value="Earrings">Earrings</option>
              <option value="Pendant">Pendant</option>
              <option value="Bracelet">Bracelet</option>
              <option value="Kada">Kada</option>
              <option value="Mangalsutra">Mangalsutra</option>
              <option value="Payal / Anklet">Payal / Anklet</option>
              <option value="Gold Bar / Biscuit">Gold Bar / Biscuit</option>
              <option value="Silver Bar / Patla">Silver Bar / Patla</option>
              <option value="Coin / Bullion">Coin / Bullion</option>
              <option value="Scrap Metal">Scrap Metal</option>
              {products.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.product_code ? `[${p.product_code}] ` : ''}{p.name}
                </option>
              ))}
            </datalist>

            <div className="table-responsive">
              <table className="pos-grid-table uppercase">
                <thead>
                  <tr>
                    <th className="col-idx">#</th>
                    {invoiceColumns.show_tag_no && <th className="col-tag">Tag No <span className="req-star">*</span></th>}
                    <th className="col-desc">Item Name <span className="req-star">*</span> ▾</th>
                    <th className="col-metal">Metal <span className="req-star">*</span></th>
                    {invoiceColumns.show_tunch && <th className="col-purity text-right" title="Tunch% (Acts as Purity)">Tunch% <span className="req-star">*</span></th>}
                    <th className="col-gross text-right">Gross (g) <span className="req-star">*</span></th>
                    {invoiceColumns.show_less_weight && <th className="col-less text-right">Less (g) <span className="req-star">*</span></th>}
                    {invoiceColumns.show_net_weight && <th className="col-net text-right" title="Calculated: Gross - Less">Net (g)</th>}
                    {invoiceColumns.show_badla && <th className="col-badla text-right" title="Badla% (Added to Fine Weight)">Badla% <span className="req-star">*</span></th>}
                    {invoiceColumns.show_wastage && <th className="col-waste text-right" title="Waste% (Added to Fine Weight)">Waste% <span className="req-star">*</span></th>}
                    {invoiceColumns.show_making_charge && <th className="col-making text-center">Making Charge <span className="req-star">*</span></th>}
                    {invoiceColumns.show_fine_weight && <th className="col-fine text-right" title="Calculated Pure Fine Weight">Fine Wt</th>}
                    <th className="col-rate text-right" title="24K / Pure Metal Benchmark Rate (₹/g)">Rate/g (24K ₹) <span className="req-star">*</span></th>
                    <th className="col-amount text-right" title="Calculated Total Amount">Amount (₹)</th>
                    <th className="col-action text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={totalVisiblePurCols} className="text-center py-4 text-muted">
                        <div className="empty-sale-items-msg uppercase">
                          <button
                            type="button"
                            className="btn btn-primary btn-xs uppercase"
                            onClick={handleAddPurchaseRow}
                          >
                            <Plus size={12} />
                            <span>Add Purchase Item</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchaseItems.map((item, idx) => {
                      const hasGross = item.gross_weight !== '' && item.gross_weight !== null && item.gross_weight !== undefined && Number(item.gross_weight) > 0;
                      const gross = toDecimal(item.gross_weight);
                      const less = toDecimal(item.less_weight);
                      const net = hasGross ? Decimal.max(0, gross.minus(less)) : new Decimal(0);
                      const tunch = toDecimal(item.tunch_percent);
                      const badla = toDecimal(item.badla_percent || 0);
                      const wastage = toDecimal(item.wastage_percent || 0);
                      const rate = toDecimal(item.rate_per_gram);

                      const pureFine = net.gt(0) && tunch.gt(0)
                        ? net.times(tunch).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
                        : new Decimal(0);
                      const badlaWeight = pureFine.times(badla).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                      const wasteWeight = pureFine.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
                      const additionWeight = badlaWeight.plus(wasteWeight);
                      const totalAdditionPercent = badla.plus(wastage);

                      const billableFine = pureFine.gt(0) && !additionWeight.isZero()
                        ? Decimal.max(0, pureFine.plus(additionWeight)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
                        : pureFine;
                      const metalVal = billableFine.gt(0) && rate.gt(0)
                        ? billableFine.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                        : new Decimal(0);

                      const hasMaking = item.making_rate !== '' && item.making_rate !== null && item.making_rate !== undefined;
                      const makingRate = toDecimal(item.making_rate);
                      const pcs = toDecimal(item.pieces || 1);
                      let making = new Decimal(0);
                      if (hasMaking && makingRate.gt(0)) {
                        if (item.making_charge_type === 'PERCENTAGE') {
                          making = metalVal.times(makingRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                        } else if (item.making_charge_type === 'PER_PIECE') {
                          making = pcs.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                        } else if (item.making_charge_type === 'FIXED') {
                          making = makingRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                        } else {
                          making = net.times(makingRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                        }
                      }
                      const rowAmount = metalVal.plus(making);

                      return (
                        <tr key={item.id} className="pos-grid-row uppercase">
                          <td className="text-center">
                            <div className="grid-index-cell font-mono text-muted text-xs">{idx + 1}</div>
                          </td>
                          {invoiceColumns.show_tag_no && (
                            <td>
                              <input
                                type="text"
                                className={`grid-input font-mono text-xs text-gold uppercase ${!item.tag_no?.trim() ? 'input-field-required' : ''}`}
                                value={item.tag_no ?? ''}
                                onChange={(e) => handleUpdatePurchaseRow(item.id, { tag_no: e.target.value })}
                                placeholder="TAG NO *"
                                required
                              />
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              list="purchase-products-list"
                              className="grid-input font-semibold uppercase"
                              value={item.item_name ?? ''}
                              onChange={(e) => {
                                handleUpdatePurchaseRow(item.id, {
                                  item_name: e.target.value,
                                });
                              }}
                              placeholder="ITEM / REMARKS (Optional)"
                            />
                          </td>
                          <td>
                            <select
                              className={`grid-select font-mono text-xs uppercase ${!item.metal_id ? 'input-field-required' : ''}`}
                              value={item.metal_id ?? ''}
                              onChange={(e) => handleUpdatePurchaseRow(item.id, { metal_id: e.target.value })}
                              required
                            >
                              <option value="">SELECT METAL *</option>
                              {metals.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          {invoiceColumns.show_tunch && (
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`grid-input text-right font-mono text-xs uppercase ${!item.tunch_percent || Number(item.tunch_percent) <= 0 ? 'input-field-required' : ''}`}
                                value={item.tunch_percent ?? ''}
                                onChange={(e) =>
                                  handleUpdatePurchaseRow(item.id, {
                                    tunch_percent: parseDecimalInput(e.target.value, 4),
                                  })
                                }
                                placeholder="TUNCH% *"
                                title={item.purity_name ? `${item.purity_name} (Tunch: ${item.tunch_percent}%)` : 'Tunch% * (Purity)'}
                                required
                              />
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`grid-input text-right font-mono text-main font-bold uppercase ${!item.gross_weight || Number(item.gross_weight) <= 0 ? 'input-field-required' : ''}`}
                              value={item.gross_weight ?? ''}
                              onChange={(e) =>
                                handleUpdatePurchaseRow(item.id, {
                                  gross_weight: parseDecimalInput(e.target.value, 4),
                                })
                              }
                              placeholder="GROSS (g) *"
                              required
                            />
                          </td>
                          {invoiceColumns.show_less_weight && (
                            <td>
                              <div className="less-cell-wrap">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className={`grid-input text-right font-mono text-muted uppercase ${item.less_weight === '' || item.less_weight === null || item.less_weight === undefined ? 'input-field-required' : ''}`}
                                  value={item.less_weight ?? ''}
                                  onChange={(e) =>
                                    handleUpdatePurchaseRow(item.id, {
                                      less_weight: parseDecimalInput(e.target.value, 4),
                                    })
                                  }
                                  placeholder="LESS (g) *"
                                  title="Less Weight in grams (Stones, Wax, etc.) *"
                                  required
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
                          )}
                          {invoiceColumns.show_net_weight && (
                            <td className="text-right">
                              <div className="grid-readonly-cell net font-mono">
                                {hasGross && item.less_weight !== '' && item.less_weight !== null && item.less_weight !== undefined ? formatWeight(net, 3) : '-'}
                              </div>
                            </td>
                          )}
                          {invoiceColumns.show_badla && (
                            <td>
                              <input
                                type="text"
                                inputMode="text"
                                className={`grid-input text-right font-mono text-xs uppercase ${item.badla_percent === '' || item.badla_percent === null || item.badla_percent === undefined ? 'input-field-required' : ''}`}
                                value={item.badla_percent ?? ''}
                                onChange={(e) =>
                                  handleUpdatePurchaseRow(item.id, {
                                    badla_percent: parseDecimalInput(e.target.value, 2, true),
                                  })
                                }
                                placeholder="BADLA% *"
                                title={!badla.isZero() ? `Badla: ${badlaWeight.gt(0) ? '+' : ''}${formatFineWeight(badlaWeight.toNumber(), 4)}g (${formatCurrency(badlaWeight.times(rate).toNumber())})` : 'Badla % * (Commercial margin/discount)'}
                                required
                              />
                            </td>
                          )}
                          {invoiceColumns.show_wastage && (
                            <td>
                              <input
                                type="text"
                                inputMode="text"
                                className={`grid-input text-right font-mono text-xs uppercase ${item.wastage_percent === '' || item.wastage_percent === null || item.wastage_percent === undefined ? 'input-field-required' : ''}`}
                                value={item.wastage_percent ?? ''}
                                onChange={(e) =>
                                  handleUpdatePurchaseRow(item.id, {
                                    wastage_percent: parseDecimalInput(e.target.value, 2, true),
                                  })
                                }
                                placeholder="WASTE% *"
                                title={!wastage.isZero() ? `Waste: +${formatFineWeight(wasteWeight.toNumber(), 4)}g (${formatCurrency(wasteWeight.times(rate).toNumber())})` : 'Waste % * (Manufacturing loss/wastage)'}
                                required
                              />
                            </td>
                          )}
                          {invoiceColumns.show_making_charge && (
                            <td>
                              <div className="making-cell-wrap uppercase">
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
                                      className={`making-rate-input font-mono text-right uppercase ${item.making_rate === '' || item.making_rate === null || item.making_rate === undefined ? 'input-field-required' : ''}`}
                                      value={item.making_rate ?? ''}
                                      onChange={(e) =>
                                        handleUpdatePurchaseRow(item.id, {
                                          making_rate: parseDecimalInput(e.target.value, 2),
                                        })
                                      }
                                      placeholder={
                                        item.making_charge_type === 'PER_PIECE'
                                          ? '₹/PC *'
                                          : item.making_charge_type === 'FIXED'
                                          ? 'FIXED ₹ *'
                                          : item.making_charge_type === 'PERCENTAGE'
                                          ? '% *'
                                          : 'RATE/G *'
                                      }
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="making-sub-label font-mono">
                                  {!hasMaking
                                    ? '-'
                                    : makingRate.lte(0)
                                    ? '₹0.00 (Zero Labour)'
                                    : item.making_charge_type === 'PER_PIECE'
                                    ? `₹${making.toFixed(2)} (${item.pieces || 1} pc @ ₹${item.making_rate})`
                                    : item.making_charge_type === 'FIXED'
                                    ? `₹${making.toFixed(2)} (Fixed)`
                                    : item.making_charge_type === 'PERCENTAGE'
                                    ? `₹${making.toFixed(2)} (${item.making_rate}%)`
                                    : `₹${making.toFixed(2)} (@₹${item.making_rate}/g)`}
                                </div>
                              </div>
                            </td>
                          )}
                          {invoiceColumns.show_fine_weight && (
                            <td className="text-right">
                              <div
                                className="grid-readonly-cell fine font-mono font-bold"
                                title={
                                  billableFine.gt(0)
                                    ? !totalAdditionPercent.isZero()
                                      ? `Pure Fine Wt: ${formatFineWeight(pureFine, 4)}g | Billable Fine Wt: ${formatFineWeight(billableFine, 4)}g (Badla+Waste: ${totalAdditionPercent.gt(0) ? '+' : ''}${totalAdditionPercent.toFixed(2)}%)`
                                      : `Fine Weight: ${formatFineWeight(pureFine, 4)}g`
                                    : 'Fine Weight: 0.0000g'
                                }
                              >
                                {pureFine.gt(0) ? formatFineWeight(billableFine, 4) : '-'}
                              </div>
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`grid-input text-right font-mono font-semibold text-main uppercase ${!item.rate_per_gram || Number(item.rate_per_gram) <= 0 ? 'input-field-required' : ''}`}
                              value={item.rate_per_gram ?? ''}
                              onChange={(e) =>
                                handleUpdatePurchaseRow(item.id, {
                                  rate_per_gram: parseDecimalInput(e.target.value, 2),
                                })
                              }
                              placeholder="24K RATE *"
                              title="24K / Pure Metal Base Rate (Amount calculates: Fine Weight × 24K Rate)"
                              required
                            />
                          </td>
                          <td className="text-right">
                            <div className="grid-readonly-cell amount font-mono font-bold">
                              {rowAmount.gt(0) ? formatCurrency(rowAmount.toNumber()) : '-'}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="grid-action-cell">
                              <button
                                type="button"
                                className="btn-copy-row"
                                onClick={() => handleCopyPurchaseRow(item.id)}
                                title="Duplicate line"
                              >
                                <Copy size={13} />
                              </button>
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
                    })
                  )}
                </tbody>
                {/* TOTALS FOOTER ROW */}
                <tfoot>
                  <tr className="pos-totals-row uppercase">
                    <td colSpan={purLeadColSpan} className="font-bold text-main text-xs uppercase tracking-wider pos-totals-label-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="totals-tag font-bold text-gold">TOTALS:</span>
                        {calculations.metalBreakdowns.map((mb) => (
                          <span
                            key={mb.metalName}
                            className={`badge-metal-summary ${mb.metalName.toLowerCase().includes('gold') ? 'gold' : 'silver'} whitespace-nowrap`}
                            title={`${mb.metalName}: Net Wt ${formatWeight(mb.netWeight, 3)}g | Badla: ${formatWeight(mb.badlaWeight, 3)}g | Waste: ${formatWeight(mb.wasteWeight, 3)}g | Fine Wt ${formatFineWeight(mb.billableFineWeight, 4)}g`}
                          >
                            ■ {mb.metalName}: Net {formatWeight(mb.netWeight, 3)}g • Fine {formatFineWeight(mb.billableFineWeight, 4)}g
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right font-mono font-bold text-main whitespace-nowrap">
                      {calculations.metalBreakdowns.length > 1 ? (
                        <div className="metal-split-weights">
                          {calculations.metalBreakdowns.map((mb) => (
                            <div key={mb.metalName} className="metal-split-line">
                              <span className="metal-tag-mini text-muted">{mb.metalName.slice(0, 3)}:</span>
                              <span>{formatWeight(mb.grossWeight, 3)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        formatWeight(calculations.totalGrossWeight, 3)
                      )}
                    </td>
                    {invoiceColumns.show_less_weight && (
                      <td className="text-right font-mono text-muted whitespace-nowrap">
                        {calculations.metalBreakdowns.length > 1 ? (
                          <div className="metal-split-weights">
                            {calculations.metalBreakdowns.map((mb) => (
                              <div key={mb.metalName} className="metal-split-line">
                                <span className="metal-tag-mini">{mb.metalName.slice(0, 3)}:</span>
                                <span>{formatWeight(mb.lessWeight, 3)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          formatWeight(calculations.totalLessWeight, 3)
                        )}
                      </td>
                    )}
                    {invoiceColumns.show_net_weight && (
                      <td className="text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                        {calculations.metalBreakdowns.length === 0 ? (
                          <span>0.000g</span>
                        ) : (
                          <div className="metal-split-weights">
                            {calculations.metalBreakdowns.map((mb) => {
                              const isGold = mb.metalName.toLowerCase().includes('gold');
                              const isSilver = mb.metalName.toLowerCase().includes('silver');
                              return (
                                <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Net Weight`}>
                                  <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                    {mb.metalName}:
                                  </span>
                                  <span className="font-bold">{formatWeight(mb.netWeight, 3)}g</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    )}
                    {invoiceColumns.show_badla && (
                      <td className="text-right font-mono font-bold text-main whitespace-nowrap">
                        {calculations.metalBreakdowns.length === 0 ? (
                          <span>0.000g</span>
                        ) : (
                          <div className="metal-split-weights">
                            {calculations.metalBreakdowns.map((mb) => {
                              const isGold = mb.metalName.toLowerCase().includes('gold');
                              const isSilver = mb.metalName.toLowerCase().includes('silver');
                              return (
                                <div
                                  key={mb.metalName}
                                  className="metal-split-line"
                                  title={`${mb.metalName} Badla Weight: ${formatWeight(mb.badlaWeight, 3)}g (${formatCurrency(mb.badlaAmount)})`}
                                >
                                  <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                    {mb.metalName}:
                                  </span>
                                  <span className="font-bold">{formatWeight(mb.badlaWeight, 3)}g</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    )}
                    {invoiceColumns.show_wastage && (
                      <td className="text-right font-mono font-bold text-main whitespace-nowrap">
                        {calculations.metalBreakdowns.length === 0 ? (
                          <span>0.000g</span>
                        ) : (
                          <div className="metal-split-weights">
                            {calculations.metalBreakdowns.map((mb) => {
                              const isGold = mb.metalName.toLowerCase().includes('gold');
                              const isSilver = mb.metalName.toLowerCase().includes('silver');
                              return (
                                <div
                                  key={mb.metalName}
                                  className="metal-split-line"
                                  title={`${mb.metalName} Waste Weight: ${formatWeight(mb.wasteWeight, 3)}g (${formatCurrency(mb.wasteAmount)})`}
                                >
                                  <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                    {mb.metalName}:
                                  </span>
                                  <span className="font-bold">{formatWeight(mb.wasteWeight, 3)}g</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    )}
                    {invoiceColumns.show_making_charge && (
                      <td className="text-right font-mono text-xs text-muted whitespace-nowrap">
                        {calculations.metalBreakdowns.length === 0 ? (
                          <span>Labour: ₹0.00</span>
                        ) : (
                          <div className="metal-split-weights">
                            {calculations.metalBreakdowns.map((mb) => {
                              const isGold = mb.metalName.toLowerCase().includes('gold');
                              const isSilver = mb.metalName.toLowerCase().includes('silver');
                              return (
                                <div
                                  key={mb.metalName}
                                  className="metal-split-line"
                                  title={`${mb.metalName} Labour / Making Charge: ${formatCurrency(mb.makingCharges)}`}
                                >
                                  <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                    {mb.metalName}:
                                  </span>
                                  <span className="font-bold">{formatCurrency(mb.makingCharges)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    )}
                    {invoiceColumns.show_fine_weight && (
                      <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                        {calculations.metalBreakdowns.length === 0 ? (
                          <span>0.0000g</span>
                        ) : (
                          <div className="metal-split-weights">
                            {calculations.metalBreakdowns.map((mb) => {
                              const isGold = mb.metalName.toLowerCase().includes('gold');
                              const isSilver = mb.metalName.toLowerCase().includes('silver');
                              return (
                                <div
                                  key={mb.metalName}
                                  className="metal-split-line"
                                  title={`${mb.metalName} Pure Fine: ${formatFineWeight(mb.pureFineWeight, 4)}g | Billable Fine: ${formatFineWeight(mb.billableFineWeight, 4)}g`}
                                >
                                  <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                    {mb.metalName}:
                                  </span>
                                  <span className="font-bold">{formatFineWeight(mb.billableFineWeight, 4)}g</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    )}
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
                  <span>Add Old Metal Scrap / Exchange</span>
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="pos-grid-table uppercase">
                  <thead>
                    <tr>
                      <th className="col-idx">#</th>
                      {invoiceColumns.show_tag_no && <th className="col-tag">Tag No</th>}
                      <th className="col-desc">Item Description <span className="req-star">*</span></th>
                      <th className="col-metal">Metal <span className="req-star">*</span></th>
                      {invoiceColumns.show_tunch && <th className="col-purity text-right" title="Tunch% (Acts as Purity)">Tunch% <span className="req-star">*</span></th>}
                      <th className="col-gross text-right">Gross (g) <span className="req-star">*</span></th>
                      {invoiceColumns.show_less_weight && <th className="col-less text-right">Less (g) <span className="req-star">*</span></th>}
                      {invoiceColumns.show_net_weight && <th className="col-net text-right" title="Calculated: Gross - Less">Net (g)</th>}
                      {invoiceColumns.show_badla && <th className="col-badla text-right" title="Badla% (Added to/Subtracted from Fine Weight)">Badla%</th>}
                      {invoiceColumns.show_wastage && <th className="col-waste text-right" title="Waste% (Refining / Melting Loss)">Waste%</th>}
                      {invoiceColumns.show_making_charge && <th className="col-making text-center" title="Making / Melting / Deduction Charge">Making Charge</th>}
                      {invoiceColumns.show_fine_weight && <th className="col-fine text-right">Fine Wt</th>}
                      <th className="col-rate text-right" title="24K / Pure Metal Base Rate">Rate/g (24K ₹) <span className="req-star">*</span></th>
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
                        <tr key={ex.id} className="pos-grid-row uppercase">
                          <td className="text-center">
                            <div className="grid-index-cell font-mono text-muted text-xs">{idx + 1}</div>
                          </td>
                          {invoiceColumns.show_tag_no && (
                            <td>
                              <input
                                type="text"
                                className="grid-input font-mono text-xs uppercase"
                                value={ex.tag_no}
                                onChange={(e) => handleUpdateExchangeRow(ex.id, { tag_no: e.target.value })}
                                placeholder="EX-TAG"
                              />
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              className={`grid-input uppercase ${!ex.item_name?.trim() ? 'input-field-required' : ''}`}
                              value={ex.item_name}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { item_name: e.target.value })}
                              placeholder="ITEM DESCRIPTION *"
                            />
                          </td>
                          <td>
                            <select
                              className={`grid-select font-mono text-xs ${!ex.metal_id ? 'input-field-required' : ''}`}
                              value={ex.metal_id}
                              onChange={(e) => handleUpdateExchangeRow(ex.id, { metal_id: e.target.value })}
                            >
                              <option value="">SELECT METAL *</option>
                              {metals.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          {invoiceColumns.show_tunch && (
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`grid-input text-right font-mono text-xs ${!ex.tunch_percent || Number(ex.tunch_percent) <= 0 ? 'input-field-required' : ''}`}
                                value={ex.tunch_percent ?? ''}
                                onChange={(e) =>
                                  handleUpdateExchangeRow(ex.id, {
                                    tunch_percent: parseDecimalInput(e.target.value, 4),
                                  })
                                }
                                onFocus={(e) => e.target.select()}
                                placeholder="TUNCH% *"
                                title={ex.purity_name ? `${ex.purity_name} (Tunch: ${ex.tunch_percent}%)` : 'Tunch% * (Purity)'}
                              />
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`grid-input text-right font-mono text-main font-bold ${!ex.gross_weight || Number(ex.gross_weight) <= 0 ? 'input-field-required' : ''}`}
                              value={ex.gross_weight ?? ''}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, {
                                  gross_weight: parseDecimalInput(e.target.value, 4),
                                })
                              }
                              onFocus={(e) => e.target.select()}
                              placeholder="GROSS (g) *"
                            />
                          </td>
                          {invoiceColumns.show_less_weight && (
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`grid-input text-right font-mono text-muted ${ex.less_weight === '' || ex.less_weight === null || ex.less_weight === undefined ? 'input-field-required' : ''}`}
                                value={ex.less_weight ?? ''}
                                onChange={(e) =>
                                  handleUpdateExchangeRow(ex.id, {
                                    less_weight: parseDecimalInput(e.target.value, 4),
                                  })
                                }
                                onFocus={(e) => e.target.select()}
                                placeholder="LESS (g) *"
                              />
                            </td>
                          )}
                          {invoiceColumns.show_net_weight && (
                            <td className="text-right">
                              <div className="grid-readonly-cell net">
                                {gross.gt(0) && ex.less_weight !== '' && ex.less_weight !== null && ex.less_weight !== undefined ? formatWeight(net, 3) : '-'}
                              </div>
                            </td>
                          )}
                          {invoiceColumns.show_badla && (
                            <td>
                              <input
                                type="text"
                                inputMode="text"
                                className="grid-input text-right font-mono text-xs uppercase"
                                value={ex.badla_percent ?? ''}
                                onChange={(e) => handleUpdateExchangeRow(ex.id, { badla_percent: parseDecimalInput(e.target.value, 2, true) })}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                title={!badla.isZero() ? `Badla: ${badlaWeight.gt(0) ? '+' : ''}${formatFineWeight(badlaWeight.toNumber(), 4)}g (${formatCurrency(badlaWeight.times(rate).toNumber())})` : 'Badla % (Commercial margin/discount)'}
                              />
                            </td>
                          )}
                          {invoiceColumns.show_wastage && (
                            <td>
                              <input
                                type="text"
                                inputMode="text"
                                className="grid-input text-right font-mono text-xs uppercase"
                                value={ex.wastage_percent ?? ''}
                                onChange={(e) => handleUpdateExchangeRow(ex.id, { wastage_percent: parseDecimalInput(e.target.value, 2, true) })}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                title={!wastage.isZero() ? `Waste: +${formatFineWeight(wasteWeight.toNumber(), 4)}g (${formatCurrency(wasteWeight.times(rate).toNumber())})` : 'Waste % (Refining/melting loss)'}
                              />
                            </td>
                          )}
                          {invoiceColumns.show_making_charge && (
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
                                    title="Deduction / Charge Mode: /g (Per Gram), /pc (Per Piece), Fix (Fixed Lump Sum), or % (Percentage)"
                                  >
                                    <option value="PER_GRAM">/g</option>
                                    <option value="PER_PIECE">/pc</option>
                                    <option value="FIXED">Fix</option>
                                    <option value="PERCENTAGE">%</option>
                                  </select>
                                  {chargeType === 'PER_PIECE' && (
                                    <div className="making-pcs-box" title="Number of pieces">
                                      <input
                                        type="number"
                                        min={1}
                                        className="making-pcs-input font-mono"
                                        value={ex.pieces ?? 1}
                                        onChange={(e) => handleUpdateExchangeRow(ex.id, { pieces: parseInt(e.target.value) || 1 })}
                                        onFocus={(e) => e.target.select()}
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
                                      onFocus={(e) => e.target.select()}
                                      placeholder={
                                        chargeType === 'PER_PIECE'
                                          ? '₹/pc'
                                          : chargeType === 'FIXED'
                                          ? '₹ Fix'
                                          : chargeType === 'PERCENTAGE'
                                          ? '%'
                                          : 'DED'
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
                                    <span className="text-muted">-</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}
                          {invoiceColumns.show_fine_weight && (
                            <td className="text-right">
                              <div
                                className="grid-readonly-cell fine font-mono font-bold"
                                title={
                                  pureFine.gt(0) && !totalAdditionPercent.isZero()
                                    ? `Pure Fine Wt: ${formatFineWeight(pureFine, 4)}g | Billable Fine Wt: ${formatFineWeight(billableFine, 4)}g (Badla/Waste: ${totalAdditionPercent.gt(0) ? '+' : ''}${totalAdditionPercent.toFixed(2)}%)`
                                    : `Fine Weight: ${formatFineWeight(billableFine, 4)}g`
                                }
                              >
                                {pureFine.gt(0) ? formatFineWeight(billableFine, 4) : '-'}
                              </div>
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`grid-input text-right font-mono font-semibold ${!ex.exchange_rate || Number(ex.exchange_rate) <= 0 ? 'input-field-required' : ''}`}
                              value={ex.exchange_rate ?? ''}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, {
                                  exchange_rate: parseDecimalInput(e.target.value, 2),
                                })
                              }
                              onFocus={(e) => e.target.select()}
                              placeholder="24K RATE *"
                              title="24K / Pure Metal Base Rate (Amount calculates: Fine Weight × 24K Rate)"
                            />
                          </td>
                          <td className="text-right">
                            <div className="grid-readonly-cell exchange-amount font-mono font-bold">
                              {rowAmount.gt(0) ? formatCurrency(rowAmount.toNumber()) : '-'}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="grid-action-cell">
                              <button
                                type="button"
                                className="btn-copy-row"
                                onClick={() => handleCopyExchangeRow(ex.id)}
                                title="Duplicate line"
                              >
                                <Copy size={13} />
                              </button>
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
                    <tr className="pos-totals-row exchange-totals uppercase">
                      <td colSpan={purExchLeadColSpan} className="font-bold text-main text-xs uppercase tracking-wider whitespace-nowrap pos-totals-label-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="totals-tag font-bold text-emerald-400">EXCHANGE TOTALS:</span>
                          {calculations.exchangeMetalBreakdowns.map((mb) => (
                            <span
                              key={mb.metalName}
                              className={`badge-metal-summary ${mb.metalName.toLowerCase().includes('gold') ? 'gold' : 'silver'} whitespace-nowrap`}
                              title={`${mb.metalName} Exchange: Net Wt ${formatWeight(mb.netWeight, 3)}g | Fine Wt ${formatFineWeight(mb.billableFineWeight, 4)}g`}
                            >
                              ■ {mb.metalName}: Net {formatWeight(mb.netWeight, 3)}g • Fine {formatFineWeight(mb.billableFineWeight, 4)}g
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-right font-mono font-bold whitespace-nowrap">
                        {calculations.exchangeMetalBreakdowns.length > 1 ? (
                          <div className="metal-split-weights">
                            {calculations.exchangeMetalBreakdowns.map((mb) => (
                              <div key={mb.metalName} className="metal-split-line">
                                <span className="metal-tag-mini text-muted">{mb.metalName.slice(0, 3)}:</span>
                                <span>{formatWeight(mb.grossWeight, 3)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          formatWeight(calculations.totalExchangeGross, 3)
                        )}
                      </td>
                      {invoiceColumns.show_less_weight && (
                        <td className="text-right font-mono text-muted whitespace-nowrap">
                          {calculations.exchangeMetalBreakdowns.length > 1 ? (
                            <div className="metal-split-weights">
                              {calculations.exchangeMetalBreakdowns.map((mb) => (
                                <div key={mb.metalName} className="metal-split-line">
                                  <span className="metal-tag-mini">{mb.metalName.slice(0, 3)}:</span>
                                  <span>{formatWeight(mb.lessWeight, 3)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            formatWeight(calculations.totalExchangeLess, 3)
                          )}
                        </td>
                      )}
                      {invoiceColumns.show_net_weight && (
                        <td className="text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                          {calculations.exchangeMetalBreakdowns.length === 0 ? (
                            <span>0.000g</span>
                          ) : (
                            <div className="metal-split-weights">
                              {calculations.exchangeMetalBreakdowns.map((mb) => {
                                const isGold = mb.metalName.toLowerCase().includes('gold');
                                const isSilver = mb.metalName.toLowerCase().includes('silver');
                                return (
                                  <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Exchange Net Weight`}>
                                    <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                      {mb.metalName}:
                                    </span>
                                    <span className="font-bold">{formatWeight(mb.netWeight, 3)}g</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      )}
                      {/* Badla Weight / Amount Footer */}
                      {invoiceColumns.show_badla && (
                        <td className="text-right font-mono text-xs whitespace-nowrap">
                          {calculations.exchangeMetalBreakdowns.length === 0 ? (
                            <span className="text-muted">-</span>
                          ) : (
                            <div className="metal-split-weights">
                              {calculations.exchangeMetalBreakdowns.map((mb) => {
                                const isGold = mb.metalName.toLowerCase().includes('gold');
                                const isSilver = mb.metalName.toLowerCase().includes('silver');
                                return (
                                  <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Exchange Badla Weight`}>
                                    <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                      {mb.metalName.slice(0, 3)}:
                                    </span>
                                    <span className="font-bold">{formatWeight(mb.badlaWeight, 3)}g</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Wastage Weight / Amount Footer */}
                      {invoiceColumns.show_wastage && (
                        <td className="text-right font-mono text-xs whitespace-nowrap">
                          {calculations.exchangeMetalBreakdowns.length === 0 ? (
                            <span className="text-muted">-</span>
                          ) : (
                            <div className="metal-split-weights">
                              {calculations.exchangeMetalBreakdowns.map((mb) => {
                                const isGold = mb.metalName.toLowerCase().includes('gold');
                                const isSilver = mb.metalName.toLowerCase().includes('silver');
                                return (
                                  <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Exchange Wastage Weight`}>
                                    <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                      {mb.metalName.slice(0, 3)}:
                                    </span>
                                    <span className="font-bold">{formatWeight(mb.wasteWeight, 3)}g</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Deduction Total Footer */}
                      {invoiceColumns.show_making_charge && (
                        <td className="text-right font-mono text-xs whitespace-nowrap">
                          {calculations.exchangeMetalBreakdowns.length === 0 ? (
                            <span className="text-muted">−₹0.00</span>
                          ) : (
                            <div className="metal-split-weights">
                              {calculations.exchangeMetalBreakdowns.map((mb) => {
                                const isGold = mb.metalName.toLowerCase().includes('gold');
                                const isSilver = mb.metalName.toLowerCase().includes('silver');
                                return (
                                  <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Exchange Deduction`}>
                                    <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                      {mb.metalName.slice(0, 3)}:
                                    </span>
                                    <span className="font-bold">−{formatCurrency(mb.deductionAmount)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      )}
                      {invoiceColumns.show_fine_weight && (
                        <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                          {calculations.exchangeMetalBreakdowns.length === 0 ? (
                            <span>0.0000g</span>
                          ) : (
                            <div className="metal-split-weights">
                              {calculations.exchangeMetalBreakdowns.map((mb) => {
                                const isGold = mb.metalName.toLowerCase().includes('gold');
                                const isSilver = mb.metalName.toLowerCase().includes('silver');
                                return (
                                  <div
                                    key={mb.metalName}
                                    className="metal-split-line"
                                    title={`${mb.metalName} Exchange Fine: ${formatFineWeight(mb.billableFineWeight, 4)}g`}
                                  >
                                    <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                      {mb.metalName}:
                                    </span>
                                    <span className="font-bold">{formatFineWeight(mb.billableFineWeight, 4)}g</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      )}
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
                      className="btn btn-outline btn-xs text-emerald-400"
                      title="Add Cash Payment"
                      onClick={() => handleAddPaymentRowWithMode('CASH')}
                    >
                      <Plus size={12} />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs text-blue-400"
                      title="Add Bank Payment"
                      onClick={() => handleAddPaymentRowWithMode('BANK')}
                    >
                      <Plus size={12} />
                      <span>Bank</span>
                    </button>
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
                      <span>Add Tender</span>
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
                  <datalist id="indian-banks-list-pur">
                    {COMMON_INDIAN_BANKS.map((bank) => (
                      <option key={bank} value={bank} />
                    ))}
                  </datalist>

                  {payments.map((p) => {
                    const isMetal = ['GOLD', 'SILVER'].includes(p.payment_mode);
                    const isGold = p.payment_mode === 'GOLD';
                    const isSilver = p.payment_mode === 'SILVER';
                    const isBank = p.payment_mode === 'BANK';
                    const isCash = p.payment_mode === 'CASH';
                    const isCredit = p.payment_mode === 'CREDIT';

                    const isViaSelf = !p.payer_type || p.payer_type === 'SELF';
                    const isViaCr = p.payer_type === 'CR_PARTY' || p.payer_type === 'SUPPLIER';
                    const isViaDr = p.payer_type === 'DR_PARTY' || p.payer_type === 'CUSTOMER' || p.payer_type === 'ANOTHER_CUSTOMER';

                    const availablePurities = purities.filter((pur) => pur.metal_id === p.metal_id);
                    const selectedSupp = suppliers.find((s) => s.id === supplierId);
                    const currentSupplierName = selectedSupp ? selectedSupp.name : 'CASH SUPPLIER';

                    return (
                      <div key={p.id} className={`payment-card-box ${isMetal ? 'is-metal' : ''}`}>
                        {/* Top Segmented Controls Row: VIA & MODE */}
                        <div className="payment-top-bar">
                          {/* Via Selector: Cr Party / Dr Party / Self */}
                          <div className="payment-control-group">
                            <span className="control-label">Via:</span>
                            <div className="segmented-toggle">
                              <button
                                type="button"
                                className={`segment-btn ${isViaCr ? 'active' : ''}`}
                                onClick={() => handleSetPaymentVia(p.id, 'CR_PARTY')}
                                title="Paid via Creditor / Supplier / Karigar"
                              >
                                Cr Party
                              </button>
                              <button
                                type="button"
                                className={`segment-btn ${isViaDr ? 'active' : ''}`}
                                onClick={() => handleSetPaymentVia(p.id, 'DR_PARTY')}
                                title="Paid via Debtor / Customer"
                              >
                                Dr Party
                              </button>
                              <button
                                type="button"
                                className={`segment-btn ${isViaSelf ? 'active' : ''}`}
                                onClick={() => handleSetPaymentVia(p.id, 'SELF')}
                                title="Direct payment to supplier on the bill / Self payout"
                              >
                                Self
                              </button>
                            </div>
                          </div>

                          {/* Mode Selector: Bank / Cash / Gold / Silver / Khata */}
                          <div className="payment-control-group">
                            <span className="control-label">Mode:</span>
                            <div className="segmented-toggle">
                              <button
                                type="button"
                                className={`segment-btn ${isBank ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'BANK')}
                              >
                                Bank
                              </button>
                              <button
                                type="button"
                                className={`segment-btn ${isCash ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'CASH')}
                              >
                                Cash
                              </button>
                              <button
                                type="button"
                                className={`segment-btn metal-gold-btn ${isGold ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'GOLD')}
                              >
                                Gold
                              </button>
                              <button
                                type="button"
                                className={`segment-btn metal-silver-btn ${isSilver ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'SILVER')}
                              >
                                Silver
                              </button>
                              <button
                                type="button"
                                className={`segment-btn ${isCredit ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'CREDIT')}
                                title="Supplier Khata (Payable / Jama Ledger)"
                              >
                                Khata
                              </button>
                            </div>
                          </div>

                          {/* Delete Row button */}
                          {payments.length > 1 && (
                            <button
                              type="button"
                              className="btn-trash-row ml-auto"
                              onClick={() => handleRemovePaymentRow(p.id)}
                              title="Remove this payment entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Cr Party Selection Subrow */}
                        {isViaCr && (
                          <div className="party-selector-subrow">
                            <label className="subrow-label">Select Cr Party (Supplier / Karigar / Creditor) *</label>
                            <div className="flex gap-2">
                              <select
                                className="party-select font-mono"
                                value={p.payer_party_id || ''}
                                onChange={(e) => {
                                  const found = suppliers.find((s) => s.id === e.target.value);
                                  handleUpdatePaymentRow(p.id, {
                                    payer_party_id: e.target.value,
                                    payer_name: found ? found.name : '',
                                  });
                                }}
                              >
                                <option value="">-- Choose Supplier / Karigar --</option>
                                {suppliers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} {s.supplier_code ? `[${s.supplier_code}]` : ''} {s.phone ? `(${s.phone})` : ''}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="party-name-input"
                                placeholder="Or enter Cr Party Name"
                                value={p.payer_name || ''}
                                onChange={(e) => handleUpdatePaymentRow(p.id, { payer_name: e.target.value })}
                              />
                            </div>
                          </div>
                        )}

                        {/* Dr Party Selection Subrow */}
                        {isViaDr && (
                          <div className="party-selector-subrow">
                            <label className="subrow-label">Select Dr Party (Debtor / Customer) *</label>
                            <div className="flex gap-2">
                              <select
                                className="party-select font-mono"
                                value={p.payer_party_id || ''}
                                onChange={(e) => {
                                  const found = customers.find((c) => c.id === e.target.value);
                                  handleUpdatePaymentRow(p.id, {
                                    payer_party_id: e.target.value,
                                    payer_name: found ? found.name : '',
                                  });
                                }}
                              >
                                <option value="">-- Choose Customer --</option>
                                {customers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} {c.customer_code ? `[${c.customer_code}]` : ''} {c.phone ? `(${c.phone})` : ''}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="party-name-input"
                                placeholder="Or enter Dr Party Name"
                                value={p.payer_name || ''}
                                onChange={(e) => handleUpdatePaymentRow(p.id, { payer_name: e.target.value })}
                              />
                            </div>
                          </div>
                        )}

                        {/* Self Payer Notice */}
                        {isViaSelf && (
                          <div className="self-info-subrow">
                            <span className="self-tag">Payer / Receiver:</span>
                            <span className="self-name">{currentSupplierName} (Seller / Shop)</span>
                          </div>
                        )}

                        {/* Input Fields Row: Gold ____ / Silver ____ / Amount ___ / Bank ______ / Note ______ */}
                        <div className="payment-fields-row">
                          {/* GOLD Weight Input */}
                          {isGold && (
                            <div className="field-block gold-block">
                              <div className="field-header">
                                <label className="field-title">Gold (g) *</label>
                                <span className="auto-rate-pill gold-pill">
                                  @ {formatMetalRate(p.metal_rate, true)}/g (Today's Gold Rate)
                                </span>
                              </div>
                              <div className="input-group-styled">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="styled-input font-mono font-bold text-amber-400"
                                  value={p.metal_weight !== undefined ? p.metal_weight : ''}
                                  onChange={(e) => handleMetalWeightChange(p.id, e.target.value)}
                                  placeholder="0.000"
                                />
                                <span className="unit-label">g</span>
                              </div>
                              {availablePurities.length > 1 && (
                                <select
                                  className="purity-mini-select font-mono"
                                  value={p.purity_id || ''}
                                  onChange={(e) => handleUpdatePaymentRow(p.id, { purity_id: e.target.value })}
                                  title="Gold Purity (Auto-calculates rate from dashboard)"
                                >
                                  {availablePurities.map((pur) => (
                                    <option key={pur.id} value={pur.id}>
                                      {pur.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}

                          {/* SILVER Weight Input */}
                          {isSilver && (
                            <div className="field-block silver-block">
                              <div className="field-header">
                                <label className="field-title">Silver (g) *</label>
                                <span className="auto-rate-pill silver-pill">
                                  @ {formatMetalRate(p.metal_rate, true)}/g (Today's Silver Rate)
                                </span>
                              </div>
                              <div className="input-group-styled">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="styled-input font-mono font-bold text-slate-200"
                                  value={p.metal_weight !== undefined ? p.metal_weight : ''}
                                  onChange={(e) => handleMetalWeightChange(p.id, e.target.value)}
                                  placeholder="0.000"
                                />
                                <span className="unit-label">g</span>
                              </div>
                              {availablePurities.length > 1 && (
                                <select
                                  className="purity-mini-select font-mono"
                                  value={p.purity_id || ''}
                                  onChange={(e) => handleUpdatePaymentRow(p.id, { purity_id: e.target.value })}
                                  title="Silver Purity (Auto-calculates rate from dashboard)"
                                >
                                  {availablePurities.map((pur) => (
                                    <option key={pur.id} value={pur.id}>
                                      {pur.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}

                          {/* BANK Input */}
                          {isBank && (
                            <div className="field-block bank-block">
                              <label className="field-title">Bank *</label>
                              <div className="input-group-styled">
                                {receivingAccounts.filter((a) => a.is_active && (a.account_type === 'BANK' || a.account_type === 'UPI')).length > 0 ? (
                                  <select
                                    className="styled-input font-mono"
                                    value={p.received_in || ''}
                                    onChange={(e) =>
                                      handleUpdatePaymentRow(p.id, {
                                        received_in: e.target.value,
                                        payer_bank: e.target.value,
                                      })
                                    }
                                  >
                                    <option value="">-- Choose Account --</option>
                                    {receivingAccounts
                                      .filter((a) => a.is_active)
                                      .map((acc) => (
                                        <option key={acc.id} value={acc.account_name}>
                                          {acc.account_name} ({acc.account_type})
                                        </option>
                                      ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    list="indian-banks-list-pur"
                                    className="styled-input font-mono"
                                    placeholder="e.g. State Bank of India / HDFC"
                                    value={p.received_in || p.payer_bank || ''}
                                    onChange={(e) =>
                                      handleUpdatePaymentRow(p.id, {
                                        received_in: e.target.value,
                                        payer_bank: e.target.value,
                                      })
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          )}

                          {/* FINE WT (Shown for Gold & Silver) */}
                          {isMetal && (
                            <div className="field-block fine-block">
                              <div className="field-header">
                                <label className="field-title">Fine Wt (g)</label>
                                {Number(p.amount) > 0 && (
                                  <span className="auto-rate-pill fine-value-pill">
                                    = {formatCurrency(p.amount)} (in Summary)
                                  </span>
                                )}
                              </div>
                              <div className="input-group-styled">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className={`styled-input font-mono font-bold ${isGold ? 'text-amber-300' : 'text-slate-200'}`}
                                  value={p.fine_weight !== undefined ? p.fine_weight : ''}
                                  onChange={(e) => handleMetalFineWeightChange(p.id, e.target.value)}
                                  placeholder="0.000"
                                  title="Fine metal weight (auto-calculated from purity tunch or enter directly)"
                                />
                                <span className="unit-label">g</span>
                              </div>
                            </div>
                          )}

                          {/* AMOUNT Input (Shown for non-metal: Cash, Bank, Credit) */}
                          {!isMetal && (
                            <div className="field-block amount-block">
                              <label className="field-title">Amount *</label>
                              <div className="input-group-styled">
                                <span className="unit-label-prefix">₹</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="styled-input font-mono font-bold text-emerald-400"
                                  value={p.amount !== undefined ? p.amount : ''}
                                  onChange={(e) => handlePaymentAmountChange(p.id, e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          )}

                          {/* NOTE / REF Input */}
                          <div className="field-block note-block flex-grow">
                            <label className="field-title">Reference / Note</label>
                            <div className="input-group-styled">
                              <input
                                type="text"
                                className="styled-input"
                                value={p.reference_number || p.notes || ''}
                                onChange={(e) =>
                                  handleUpdatePaymentRow(p.id, {
                                    reference_number: e.target.value,
                                    notes: e.target.value,
                                  })
                                }
                                placeholder={
                                  isBank
                                    ? 'UTR / Cheque No'
                                    : isMetal
                                    ? 'Bullion Bar No / Delivery Memo'
                                    : isCredit
                                    ? 'Supplier Jama Khata Ledger Note'
                                    : 'Payment remarks / note'
                                }
                              />
                            </div>
                          </div>
                        </div>

                        {p.rate_error && (
                          <div className="payment-row-warning flex items-center gap-1 mt-1">
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

                {/* SEPARATE METAL WEIGHTS PANEL (NET & FINE PER METAL) */}
                <div className="summary-metal-weights-panel">
                  <div className="panel-sub-header">
                    <div className="flex items-center gap-1.5">
                      <Scale size={13} className="text-gold" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Inward Weights (Net & Fine)
                      </span>
                    </div>
                    <span className="text-3xs text-gold uppercase font-semibold">Separate by Metal</span>
                  </div>

                  <div className="metal-weights-grid">
                    {calculations.metalBreakdowns.length === 0 ? (
                      <div className="metal-weight-empty text-xs text-muted py-2 text-center w-full">
                        No purchase items added yet
                      </div>
                    ) : (
                      calculations.metalBreakdowns.map((mb) => {
                        const isGold = mb.metalName.toLowerCase().includes('gold');
                        const isSilver = mb.metalName.toLowerCase().includes('silver');
                        const theme = isGold ? 'metal-gold' : isSilver ? 'metal-silver' : 'metal-other';
                        return (
                          <div key={mb.metalName} className={`metal-weight-card ${theme}`}>
                            <div className="metal-card-header">
                              <span className="metal-name-badge">
                                {isGold ? '🟡' : isSilver ? '⚪' : '💎'} {mb.metalName}
                              </span>
                              <span className="metal-item-count">
                                {mb.itemCount} {mb.itemCount === 1 ? 'item' : 'items'}
                              </span>
                            </div>
                            <div className="metal-card-body">
                              <div className="weight-metric-row">
                                <span className="weight-metric-label">Net Wt:</span>
                                <span className="weight-metric-value font-mono font-bold">
                                  {formatWeight(mb.netWeight, 3)} g
                                </span>
                              </div>
                              <div className="weight-metric-row">
                                <span className="weight-metric-label">Fine Wt:</span>
                                <span className="weight-metric-value font-mono font-bold text-amber-300">
                                  {formatFineWeight(mb.billableFineWeight, 4)} g
                                </span>
                              </div>
                              {Math.abs(mb.billableFineWeight - mb.pureFineWeight) > 0.0001 && (
                                <div className="weight-metric-sub">
                                  <span>Pure Fine: {formatFineWeight(mb.pureFineWeight, 4)}g</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* If Exchange Return Metals Exist */}
                  {calculations.exchangeMetalBreakdowns.length > 0 && (
                    <div className="exchange-weights-section mt-2 pt-2 border-t border-dashed border-border/60">
                      <div className="panel-sub-header text-emerald-400 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Coins size={12} />
                          <span className="text-3xs font-bold uppercase tracking-wider">
                            Exchange Return Weights
                          </span>
                        </div>
                      </div>
                      <div className="metal-weights-grid">
                        {calculations.exchangeMetalBreakdowns.map((ex) => {
                          const isGold = ex.metalName.toLowerCase().includes('gold');
                          const isSilver = ex.metalName.toLowerCase().includes('silver');
                          const theme = isGold ? 'metal-gold' : isSilver ? 'metal-silver' : 'metal-other';
                          return (
                            <div key={ex.metalName} className={`metal-weight-card ${theme} exchange-card`}>
                              <div className="metal-card-header">
                                <span className="metal-name-badge">
                                  {isGold ? '🟡' : isSilver ? '⚪' : '💎'} {ex.metalName}
                                </span>
                                <span className="metal-item-count">{ex.itemCount} exch</span>
                              </div>
                              <div className="metal-card-body">
                                <div className="weight-metric-row">
                                  <span className="weight-metric-label">Exch Net:</span>
                                  <span className="weight-metric-value font-mono font-bold text-rose-300">
                                    −{formatWeight(ex.netWeight, 3)} g
                                  </span>
                                </div>
                                <div className="weight-metric-row">
                                  <span className="weight-metric-label">Exch Fine:</span>
                                  <span className="weight-metric-value font-mono font-bold text-rose-300">
                                    −{formatFineWeight(ex.billableFineWeight, 4)} g
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                  <div className={`summary-grand-total-box mt-2 ${calculations.netPayable < 0 ? 'payable-to-customer' : ''}`}>
                    <div className="flex flex-col">
                      <span className="grand-label">
                        {calculations.netPayable < 0 ? 'Net Payable (Receivable from Supplier)' : 'Net Payable'}
                      </span>
                      {calculations.netPayable < 0 && (
                        <span className="text-3xs text-amber-300 font-semibold tracking-wide uppercase mt-0.5">
                          ↳ Supplier owes shop (Return metal exceeds purchase)
                        </span>
                      )}
                    </div>
                    <span className={`grand-value font-mono ${calculations.netPayable < 0 ? 'text-amber-400' : ''}`}>
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

                  {calculations.netPayable < 0 ? (
                    <div className="summary-line">
                      <span className="summary-label font-bold text-amber-300">Receivable from Supplier</span>
                      <span className="summary-value font-mono font-bold text-base text-amber-400">
                        {formatCurrency(calculations.receivableFromSupplier)}
                      </span>
                    </div>
                  ) : (
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
                  )}

                  {calculations.excessPaid > 0 && !calculations.isReceivableFromSupplier && (
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
                    ) : calculations.netPayable < 0 ? (
                      <div className="pending-pill bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <AlertCircle size={14} />
                        <span>Receivable from Supplier: {formatCurrency(calculations.receivableFromSupplier)}</span>
                      </div>
                    ) : calculations.netPayable > 0 ? (
                      <div className="pending-pill">
                        <AlertCircle size={14} />
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
              <div className="purchase-metric-sub">Outstanding Supplier Jama / Credit (जमा)</div>
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
          <div className="modal-dialog customer-modal-dialog customer-modal-dialog-wide">
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
              <div className="customer-modal-body compact-body">
                {supplierFormError && (
                  <div className="customer-form-error-alert">
                    <AlertCircle size={16} />
                    <span>{supplierFormError}</span>
                  </div>
                )}

                <div className="customer-modal-grid-compact">
                  {/* Row 1: Company Name (2 cols), Code (1 col), Contact Person (1 col) */}
                  <div className="compact-field col-span-2">
                    <label className="compact-field-label">Supplier / Company Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="compact-field-input font-semibold"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      placeholder="e.g. Surat Bullion Refinery / Zaveri Gems Ltd"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Supplier Code (Optional)</label>
                    <input
                      type="text"
                      className="compact-field-input font-mono text-xs"
                      value={supplierForm.supplier_code}
                      onChange={(e) => setSupplierForm({ ...supplierForm, supplier_code: e.target.value })}
                      placeholder="Auto if blank"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Contact Person</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={supplierForm.contact_person}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                      placeholder="e.g. Rajesh Shah"
                    />
                  </div>

                  {/* Row 2: Mobile Phone (1 col), Alternate Phone (1 col), Email (1 col), GSTIN (1 col) */}
                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Mobile Phone</label>
                    <input
                      type="tel"
                      className="compact-field-input font-mono"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      placeholder="10-digit mobile"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Alternate / Landline</label>
                    <input
                      type="tel"
                      className="compact-field-input font-mono"
                      value={supplierForm.alternate_phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, alternate_phone: e.target.value })}
                      placeholder="Office landline"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Email Address</label>
                    <input
                      type="email"
                      className="compact-field-input"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      placeholder="accounts@supplier.com"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">GSTIN (Optional)</label>
                    <input
                      type="text"
                      className="compact-field-input font-mono uppercase"
                      value={supplierForm.gstin}
                      onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                      placeholder="15-digit GSTIN"
                    />
                  </div>

                  {/* Row 3: Address (2 cols), City (1 col), State (1 col) */}
                  <div className="compact-field col-span-2">
                    <label className="compact-field-label">Address / Refinery / Shop</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                      placeholder="Building, Street, Bazaar"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">City</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={supplierForm.city}
                      onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                      placeholder="Mumbai / Surat"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">State</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={supplierForm.state}
                      onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value })}
                      placeholder="Maharashtra"
                    />
                  </div>

                  {/* Row 4: Pincode (1 col), Internal Notes (3 cols) */}
                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Pincode</label>
                    <input
                      type="text"
                      className="compact-field-input font-mono"
                      value={supplierForm.pincode}
                      onChange={(e) => setSupplierForm({ ...supplierForm, pincode: e.target.value })}
                      placeholder="400002"
                    />
                  </div>

                  <div className="compact-field col-span-3">
                    <label className="compact-field-label">Internal Notes / Terms</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={supplierForm.notes}
                      onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                      placeholder="Bullion purity terms, RTGS payment details, bank coords..."
                    />
                  </div>

                  {/* OPENING BALANCES & METAL KHATA ("OP") SECTION - FULL LENGTH */}
                  <div className="col-span-4 pt-1 mt-1 border-t border-[var(--border-subtle)]">
                    <div className="opening-section-compact-bar">
                      <div className="opening-section-title-wrap">
                        <Coins size={15} className="text-gold" />
                        <span className="opening-section-title">
                          Opening Khata & Metal Balances (At Registration)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Primary Direction Toggle */}
                        <div className="opening-direction-toggle">
                          <button
                            type="button"
                            className={`opening-dir-btn ${supplierPrimaryDirection === 'CREDIT' ? 'active' : ''}`}
                            onClick={() => handleSupplierPrimaryDirectionChange('CREDIT')}
                          >
                            Shop Owes Supplier / Jama (Cr - जमा)
                          </button>
                          <button
                            type="button"
                            className={`opening-dir-btn ${supplierPrimaryDirection === 'DEBIT' ? 'active' : ''}`}
                            onClick={() => handleSupplierPrimaryDirectionChange('DEBIT')}
                          >
                            Supplier Owes Shop / Baaki (Dr - बाकी)
                          </button>
                        </div>

                        {/* Opening Date */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted whitespace-nowrap">Date:</span>
                          <input
                            type="date"
                            className="compact-field-input font-mono !h-[28px] !w-[130px] !py-0 !px-1.5 text-xs"
                            value={supplierForm.opening_balance_date}
                            onChange={(e) =>
                              setSupplierForm({ ...supplierForm, opening_balance_date: e.target.value })
                            }
                          />
                        </div>

                        {/* Ref Voucher */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted whitespace-nowrap">Ref / Voucher:</span>
                          <input
                            type="text"
                            className="compact-field-input font-mono uppercase !h-[28px] !w-[135px] !py-0 !px-1.5 text-xs"
                            placeholder="SUP-KHATA-2024"
                            value={supplierForm.opening_balance_ref}
                            onChange={(e) =>
                              setSupplierForm({ ...supplierForm, opening_balance_ref: e.target.value.toUpperCase() })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4 Cards in 2x2 Grid: Row 1 = Cash & Bank, Row 2 = Gold & Silver (Metal Weight in Grams Only) */}
                    <div className="opening-cards-grid">
                      {/* Cash Card */}
                      <div className="opening-card-compact card-cash">
                        <div className="card-heading">
                          <span className="opening-card-heading-title text-emerald-500">
                            <Banknote size={14} />
                            Cash Opening (₹)
                          </span>
                          <select
                            className="opening-type-select font-mono"
                            value={supplierForm.opening_cash_type}
                            onChange={(e) =>
                              setSupplierForm({
                                ...supplierForm,
                                opening_cash_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="CREDIT">Jama / Cr (Shop owes Supplier - जमा)</option>
                            <option value="DEBIT">Baaki / Dr (Advance to Supplier - बाकी)</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="compact-field-input font-mono text-sm font-bold"
                          placeholder="0.00"
                          value={supplierForm.opening_cash_balance || ''}
                          onChange={(e) =>
                            setSupplierForm({
                              ...supplierForm,
                              opening_cash_balance: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>

                      {/* Bank Card */}
                      <div className="opening-card-compact card-bank">
                        <div className="card-heading">
                          <span className="opening-card-heading-title text-blue-400">
                            <CreditCard size={14} />
                            Bank / RTGS Opening (₹)
                          </span>
                          <select
                            className="opening-type-select font-mono"
                            value={supplierForm.opening_bank_type}
                            onChange={(e) =>
                              setSupplierForm({
                                ...supplierForm,
                                opening_bank_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="CREDIT">Jama / Cr (Shop owes Supplier - जमा)</option>
                            <option value="DEBIT">Baaki / Dr (Advance to Supplier - बाकी)</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="compact-field-input font-mono text-sm font-bold"
                          placeholder="0.00"
                          value={supplierForm.opening_bank_balance || ''}
                          onChange={(e) =>
                            setSupplierForm({
                              ...supplierForm,
                              opening_bank_balance: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>

                      {/* Gold Card: Weight (g) & Karat/Purity Only */}
                      <div className="opening-card-compact card-gold">
                        <div className="card-heading">
                          <span className="opening-card-heading-title text-amber-400">
                            <Coins size={14} />
                            Gold Opening (grams)
                          </span>
                          <select
                            className="opening-type-select font-mono"
                            value={supplierForm.opening_gold_type}
                            onChange={(e) =>
                              setSupplierForm({
                                ...supplierForm,
                                opening_gold_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="CREDIT">Jama / Cr (Payable to Supplier - जमा)</option>
                            <option value="DEBIT">Baaki / Dr (Deposit with Supplier - बाकी)</option>
                          </select>
                        </div>
                        <div className="opening-metal-inputs-grid">
                          <div>
                            <span className="compact-field-label">Weight (g) *</span>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              className="compact-field-input font-mono text-xs font-bold"
                              placeholder="0.000 g"
                              value={supplierForm.opening_gold_weight || ''}
                              onChange={(e) =>
                                setSupplierForm({
                                  ...supplierForm,
                                  opening_gold_weight: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>

                          <div>
                            <span className="compact-field-label">Select Karat/Purity</span>
                            <select
                              className="compact-field-select text-xs font-mono uppercase"
                              value={supplierForm.opening_gold_purity_id}
                              onChange={(e) =>
                                setSupplierForm({
                                  ...supplierForm,
                                  opening_gold_purity_id: e.target.value,
                                })
                              }
                            >
                              <option value="">Select Karat/Purity</option>
                              {supplierGoldPurities.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Silver Card: Weight (g) & Purity Only */}
                      <div className="opening-card-compact card-silver">
                        <div className="card-heading">
                          <span className="opening-card-heading-title text-slate-300">
                            <Scale size={14} />
                            Silver Opening (grams)
                          </span>
                          <select
                            className="opening-type-select font-mono"
                            value={supplierForm.opening_silver_type}
                            onChange={(e) =>
                              setSupplierForm({
                                ...supplierForm,
                                opening_silver_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="CREDIT">Jama / Cr (Payable to Supplier - जमा)</option>
                            <option value="DEBIT">Baaki / Dr (Deposit with Supplier - बाकी)</option>
                          </select>
                        </div>
                        <div className="opening-metal-inputs-grid">
                          <div>
                            <span className="compact-field-label">Weight (g) *</span>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              className="compact-field-input font-mono text-xs font-bold"
                              placeholder="0.000 g"
                              value={supplierForm.opening_silver_weight || ''}
                              onChange={(e) =>
                                setSupplierForm({
                                  ...supplierForm,
                                  opening_silver_weight: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>

                          <div>
                            <span className="compact-field-label">Select Purity</span>
                            <select
                              className="compact-field-select text-xs font-mono uppercase"
                              value={supplierForm.opening_silver_purity_id}
                              onChange={(e) =>
                                setSupplierForm({
                                  ...supplierForm,
                                  opening_silver_purity_id: e.target.value,
                                })
                              }
                            >
                              <option value="">Select Purity</option>
                              {supplierSilverPurities.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
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
                {(() => {
                  const hasRealTags = (printBill.items || []).some(
                    (it) => it.tag_no && it.tag_no.trim() !== '' && !/^PUR-[A-Z0-9]+-\d+$/i.test(it.tag_no.trim())
                  );
                  const showPrintTagCol = invoiceColumns.show_tag_no && hasRealTags;

                  return (
                    <table className="tax-invoice-table">
                      <thead>
                        <tr>
                          <th className="text-center">#</th>
                          {showPrintTagCol && <th>Tag No</th>}
                          <th>Product / Description</th>
                          <th>Metal & Purity</th>
                          <th className="text-right">Gross (g)</th>
                          {invoiceColumns.show_less_weight && <th className="text-right">Less (g)</th>}
                          {invoiceColumns.show_net_weight && <th className="text-right">Net (g)</th>}
                          {invoiceColumns.show_tunch && <th className="text-right">Tunch%</th>}
                          {invoiceColumns.show_fine_weight && <th className="text-right">Fine Wt</th>}
                          <th className="text-right">Rate/g (₹)</th>
                          {invoiceColumns.show_making_charge && <th className="text-right">Making (₹)</th>}
                          <th className="text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printBill.items.map((item, idx) => (
                          <tr key={item.id}>
                            <td className="text-center font-mono text-xs">{idx + 1}</td>
                            {showPrintTagCol && <td className="font-mono text-xs font-bold text-gold">{item.tag_no}</td>}
                            <td className="font-semibold">{item.item_name || item.product_name}</td>
                            <td className="text-xs">{item.metal_name} {item.purity_name}</td>
                            <td className="text-right font-mono">{formatWeight(item.gross_weight, 3)}</td>
                            {invoiceColumns.show_less_weight && <td className="text-right font-mono">{formatWeight(item.less_weight, 3)}</td>}
                            {invoiceColumns.show_net_weight && <td className="text-right font-mono font-bold">{formatWeight(item.net_weight, 3)}</td>}
                            {invoiceColumns.show_tunch && <td className="text-right font-mono">{item.tunch_percent}%</td>}
                            {invoiceColumns.show_fine_weight && <td className="text-right font-mono font-bold">{formatFineWeight(item.fine_weight, 4)}</td>}
                            <td className="text-right font-mono">₹{item.rate_per_gram.toLocaleString('en-IN')}</td>
                            {invoiceColumns.show_making_charge && <td className="text-right font-mono">₹{item.making_charge.toLocaleString('en-IN')}</td>}
                            <td className="text-right font-mono font-bold">
                              ₹{item.item_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Totals & Settlement */}
              <div className="tax-invoice-bottom-grid">
                <div className="tax-invoice-payments-box">
                  <div className="invoice-meta-header mb-2">PAYMENTS RECORDED</div>
                  {printBill.payments.length === 0 ? (
                    <p className="text-xs text-muted">No payments recorded. Balance outstanding on supplier Jama / Credit ledger (जमा).</p>
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
