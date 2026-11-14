import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Decimal from 'decimal.js';
import { salesApi, SalesInvoiceDetails } from '../../services/sales';
import { customerApi, rateApi, supplierApi } from '../../services/masters';
import { inventoryApi } from '../../services/inventory';
import {
  settingsApi,
  ShopProfile,
  ShopReceivingAccount,
  InvoiceColumnSettings,
  DEFAULT_INVOICE_COLUMN_SETTINGS,
  ModuleSettings,
  DEFAULT_MODULE_SETTINGS,
} from '../../services/settings';
import { Customer, CurrentRate, Metal, MetalPurity, Supplier, StockItem } from '../../types';
import {
  toDecimal,
  formatWeight,
  formatFineWeight,
  formatMetalRate,
  formatCurrency,
  parseDecimalInput,
} from '../../utils/precision';
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
  Coins,
  UserPlus,
  Sparkles,
  Calculator,
  CreditCard,
  Check,
  Banknote,
  Scale,
  Eye,
  AlertTriangle,
  Phone,
  MapPin,
} from 'lucide-react';
import { LessWeightCalculatorModal, LessBreakdownEntry } from '../../components/LessWeightCalculatorModal';
import { CustomerSearchSelect } from '../../components/CustomerSearchSelect';
import { CustomerDetailsModal } from '../../components/CustomerDetailsModal';
import { handleTallyKeyDown } from '../../utils/tallyNavigation';
import '../../styles/masters.css';
import './CreateInvoicePage.css';

export const COMMON_INDIAN_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'IndusInd Bank',
  'Yes Bank',
  'Federal Bank',
  'IDBI Bank',
  'Indian Bank',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  'South Indian Bank',
  'Bandhan Bank',
  'RBL Bank',
  'IDFC First Bank',
  'AU Small Finance Bank',
];

interface SaleItemRow {
  id: string;
  stock_item_id?: string;
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
  last_edited?: 'weight' | 'fine' | 'amount';
  is_auto?: boolean;
}

export const CreateInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editDraftId = searchParams.get('id') || searchParams.get('edit');

  // Reference Masters
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receivingAccounts, setReceivingAccounts] = useState<ShopReceivingAccount[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [modules, setModules] = useState<ModuleSettings>(DEFAULT_MODULE_SETTINGS);

  // Bill Header Meta
  const [billType, setBillType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const isWholesale = billType === 'WHOLESALE';
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber] = useState(() => `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
  const [gstRate, setGstRate] = useState<number>(3.0);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // In-Stock Inventory Tracking & Item Name Autocomplete Selection
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [activeItemDropdownRowId, setActiveItemDropdownRowId] = useState<string | null>(null);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState<number>(0);
  const [itemDropdownCoords, setItemDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const itemDropdownRef = useRef<HTMLDivElement | null>(null);

  const updateItemDropdownCoords = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setItemDropdownCoords({
      top: rect.bottom + 4,
      left: Math.max(10, rect.left),
      width: Math.max(rect.width, 390),
    });
  };

  const fetchInStockItems = useCallback(async () => {
    try {
      const res = await inventoryApi.list({ status: 'IN_STOCK', pageSize: 200 });
      setStockItems(res.items || []);
    } catch (err) {
      console.warn('Failed to load in-stock items', err);
    }
  }, []);

  useEffect(() => {
    fetchInStockItems();
  }, [fetchInStockItems]);

  // Keep floating portal flyout aligned on scroll or resize
  useEffect(() => {
    if (!activeItemDropdownRowId) return;
    const handleScrollOrResize = () => {
      const activeInput = document.querySelector<HTMLInputElement>(`input[data-row-id="${activeItemDropdownRowId}"]`);
      if (activeInput) {
        const rect = activeInput.getBoundingClientRect();
        setItemDropdownCoords({
          top: rect.bottom + 4,
          left: Math.max(10, rect.left),
          width: Math.max(rect.width, 390),
        });
      } else {
        setActiveItemDropdownRowId(null);
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeItemDropdownRowId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.item-name-cell') &&
        !target.closest('.tag-input-cell') &&
        !target.closest('.item-flyout-portal')
      ) {
        setActiveItemDropdownRowId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print/View Modal for saved invoice
  const [createdInvoice, setCreatedInvoice] = useState<SalesInvoiceDetails | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Customer Khata & Balance Details Modal
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);

  // Less Weight Calculator Modal State
  const [activeLessCalc, setActiveLessCalc] = useState<{
    itemId: string;
    itemName: string;
    currentLess: number | string;
    breakdown?: LessBreakdownEntry[];
    target: 'SALE' | 'EXCHANGE';
  } | null>(null);

  const handleOpenSaleLessCalculator = (item: SaleItemRow) => {
    setActiveLessCalc({
      itemId: item.id,
      itemName: item.item_name || 'Jewellery Item',
      currentLess: item.less_weight,
      breakdown: item.less_breakdown,
      target: 'SALE',
    });
  };

  const handleOpenExchangeLessCalculator = (ex: ExchangeItemRow) => {
    setActiveLessCalc({
      itemId: ex.id,
      itemName: ex.item_name || 'Customer Scrap / Old Gold',
      currentLess: ex.less_weight,
      breakdown: ex.less_breakdown,
      target: 'EXCHANGE',
    });
  };

  const handleApplyLessTotal = (totalWeight: number, breakdown: LessBreakdownEntry[]) => {
    if (!activeLessCalc) return;
    if (activeLessCalc.target === 'SALE') {
      handleUpdateSaleRow(activeLessCalc.itemId, {
        less_weight: totalWeight,
        less_breakdown: breakdown,
      });
    } else {
      handleUpdateExchangeRow(activeLessCalc.itemId, {
        less_weight: totalWeight,
        less_breakdown: breakdown,
      });
    }
    setActiveLessCalc(null);
  };

  // Sale Items State - initialized with 1 row, default 0 for weights/charges, rates from dashboard
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([
    {
      id: 'item-initial-1',
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
      pieces: 1,
      rate_per_gram: '',
    },
  ]);

  // Invoice Column Visibility Settings
  const [invoiceColumns, setInvoiceColumns] = useState<InvoiceColumnSettings>(DEFAULT_INVOICE_COLUMN_SETTINGS);

  // Exchange Items State
  const [exchangeItems, setExchangeItems] = useState<ExchangeItemRow[]>([]);

  // Payment Received State
  const [payments, setPayments] = useState<PaymentRow[]>([
    {
      id: 'pay-init',
      payment_mode: 'CASH',
      amount: 0,
      reference_number: '',
      payer_type: 'CUSTOMER',
      received_in: 'Cash Counter',
    },
  ]);

  // Load Masters
  useEffect(() => {
    Promise.all([
      customerApi.list({ pageSize: 500 }).catch(() => ({ items: [] })),
      supplierApi.list({ pageSize: 100 }).catch(() => ({ items: [] })),
      settingsApi.getReceivingAccounts().catch(() => []),
      rateApi.getCurrentRates().catch(() => []),
      rateApi.getMetals().catch(() => []),
      rateApi.getAllPurities().catch(() => []),
      settingsApi.getShopProfile().catch(() => null),
      settingsApi.getInvoiceColumns().catch(() => DEFAULT_INVOICE_COLUMN_SETTINGS),
      settingsApi.getGST().catch(() => null),
      settingsApi.getModules().catch(() => DEFAULT_MODULE_SETTINGS),
    ])
      .then(([custRes, supRes, recvRes, ratesRes, metalsRes, puritiesRes, profileRes, invoiceColsRes, gstRes, modulesRes]) => {
        if (invoiceColsRes) {
          setInvoiceColumns(invoiceColsRes);
        }
        if (modulesRes) {
          setModules(modulesRes);
          if (!modulesRes.retail_enabled && modulesRes.wholesale_enabled) {
            setBillType('WHOLESALE');
          } else if (!modulesRes.wholesale_enabled && modulesRes.retail_enabled) {
            setBillType('RETAIL');
          }
        }
        if (gstRes && !editDraftId) {
          if (!gstRes.gst_enabled || gstRes.tax_mode === 'NO_TAX') {
            setGstRate(0.0);
          } else if (typeof gstRes.default_gst_rate === 'number') {
            setGstRate(gstRes.default_gst_rate);
          }
        }
        const custList = (custRes as any)?.items || [];
        setCustomers(custList);
        if (custList.length > 0 && !editDraftId) {
          setCustomerId(custList[0].id);
        }

        const supList = (supRes as any)?.items || [];
        setSuppliers(supList);

        const activeRecv = Array.isArray(recvRes) ? recvRes : [];
        setReceivingAccounts(activeRecv);

        const currentRates = ratesRes || [];
        setRates(currentRates);
        setMetals(metalsRes || []);
        setPurities(puritiesRes || []);
        setShopProfile(profileRes);

        // Seed first default sale row with today's active metal rate
        if (!editDraftId) {
          const defGoldMetal = (metalsRes || []).find(
            (m: any) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold')
          ) || metalsRes?.[0];
          const defGoldPurity = (puritiesRes || []).find(
            (p: any) =>
              p.metal_id === defGoldMetal?.id &&
              (p.code?.toUpperCase() === '24K' || p.name?.toLowerCase().includes('24k') || p.code === '999')
          ) || (puritiesRes || []).find((p: any) => p.metal_id === defGoldMetal?.id);
          const defRateObj = currentRates.find((r: any) => r.purity_id === defGoldPurity?.id);
          const defRate = defRateObj?.rate ? defRateObj.rate : '';

          setSaleItems((prev) => {
            if (prev.length > 0) {
              return prev.map((item) => {
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
                    pieces: item.pieces ?? 1,
                    rate_per_gram: defRate,
                  };
                }
                return item;
              });
            }
            return [
              {
                id: `item-${Date.now()}-1`,
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
                rate_per_gram: defRate,
              },
            ];
          });
        }
      });
  }, [editDraftId]);

  // Reopen and populate draft invoice if editDraftId is present
  useEffect(() => {
    if (!editDraftId) return;
    salesApi.getDetails(editDraftId)
      .then((inv) => {
        if (!inv) return;
        if (inv.customer_id) {
          setCustomerId(inv.customer_id);
        }
        if ((inv as any).bill_type) {
          setBillType((inv as any).bill_type as any);
        }
        if (inv.discount_amount !== undefined && inv.discount_amount !== null) {
          setDiscountAmount(Number(inv.discount_amount));
        }
        if (inv.notes) {
          setNotes(inv.notes);
        }
        if (inv.items && inv.items.length > 0) {
          setSaleItems(
            inv.items.map((it, idx) => ({
              id: it.id || `item-draft-${idx}`,
              stock_item_id: (it as any).stock_item_id || undefined,
              tag_no: it.tag_no || '',
              item_name: it.item_name,
              metal_id: it.metal_id || '',
              metal_name: it.metal_name || 'Gold',
              purity_id: it.purity_id || '',
              purity_name: it.purity_name || '',
              gross_weight: it.gross_weight,
              less_weight: it.less_weight,
              tunch_percent: it.tunch_percent,
              badla_percent: it.badla_percent || 0,
              wastage_percent: it.wastage_percent || 0,
              making_rate: it.making_rate || 0,
              making_charge_type: it.making_charge_type || 'PER_GRAM',
              rate_per_gram: it.metal_rate || it.rate_per_gram || 0,
              huid: it.huid,
              pieces: it.pieces,
              notes: (it as any).notes || undefined,
            }))
          );
        }
        if (inv.exchange && inv.exchange.items && inv.exchange.items.length > 0) {
          setExchangeItems(
            inv.exchange.items.map((ex: any, idx: number) => ({
              id: ex.id || `ex-draft-${idx}`,
              tag_no: ex.tag_no || '',
              item_name: ex.item_name || 'Customer Scrap',
              metal_id: ex.metal_id || '',
              metal_name: ex.metal_name || 'Gold',
              purity_id: ex.purity_id || '',
              purity_name: ex.purity_name || '',
              gross_weight: ex.gross_weight,
              less_weight: ex.less_weight,
              tunch_percent: ex.tunch_percent,
              badla_percent: ex.badla_percent || 0,
              wastage_percent: ex.wastage_percent || 0,
              making_rate: ex.making_rate || 0,
              making_charge_type: ex.making_charge_type || 'PERCENTAGE',
              pieces: ex.pieces || 1,
              exchange_rate: ex.exchange_rate,
              deduction_percent: ex.deduction_percent || 0,
            }))
          );
        }
        if (inv.payments && inv.payments.length > 0) {
          setPayments(
            inv.payments.map((p, idx) => ({
              id: p.id || `pay-draft-${idx}`,
              payment_mode: p.payment_mode,
              amount: p.amount,
              metal_weight: p.metal_weight ?? undefined,
              metal_rate: p.metal_rate ?? undefined,
              reference_number: p.reference_number || '',
              notes: p.notes || '',
              payer_type: (p.payer_type as any) || 'CUSTOMER',
              payer_name: p.payer_name || '',
              payer_bank: p.payer_bank || '',
              received_in: p.received_in || '',
              payer_party_id: p.payer_party_id || '',
            }))
          );
        }
        showToast('success', `Draft Invoice ${inv.invoice_number} loaded for editing`);
      })
      .catch((e) => {
        console.error('Failed to load draft invoice:', e);
        showToast('error', 'Failed to load draft invoice');
      });
  }, [editDraftId]);

  // Customer Creation Modal in Master
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSubmitting, setCustomerSubmitting] = useState(false);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const [customerPrimaryDirection, setCustomerPrimaryDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [customerMetals, setCustomerMetals] = useState<Metal[]>([]);
  const [customerPurities, setCustomerPurities] = useState<MetalPurity[]>([]);

  useEffect(() => {
    if (showCustomerModal && customerPurities.length === 0) {
      rateApi.getMetals().then(setCustomerMetals).catch(console.error);
      rateApi.getAllPurities().then(setCustomerPurities).catch(console.error);
    }
  }, [showCustomerModal, customerPurities.length]);

  const customerGoldPurities = useMemo(() => {
    const goldMetal = customerMetals.find((m) => m.code.toUpperCase() === 'GOLD' || m.name.toLowerCase().includes('gold'));
    if (goldMetal) {
      return customerPurities.filter((p) => p.metal_id === goldMetal.id);
    }
    return customerPurities.filter((p) => p.name.toLowerCase().includes('22k') || p.name.toLowerCase().includes('24k') || p.name.toLowerCase().includes('18k') || p.code.includes('K'));
  }, [customerMetals, customerPurities]);

  const customerSilverPurities = useMemo(() => {
    const silverMetal = customerMetals.find((m) => m.code.toUpperCase() === 'SILVER' || m.name.toLowerCase().includes('silver'));
    if (silverMetal) {
      return customerPurities.filter((p) => p.metal_id === silverMetal.id);
    }
    return customerPurities.filter((p) => p.name.toLowerCase().includes('925') || p.name.toLowerCase().includes('silver') || p.code.includes('925') || (p.tunch_percent !== null && p.tunch_percent >= 90));
  }, [customerMetals, customerPurities]);

  // =========================================================================
  // TALLY SOFTWARE KEYBOARD NAVIGATION:
  // - Enter: Move FORWARD to next input/select field (auto-selects text/number)
  // - Esc: Move BACKWARD to previous field (or close active popup / modal)
  // =========================================================================
  useEffect(() => {
    const handleGlobalTallyNav = (e: KeyboardEvent) => {
      // 1. If quick customer registration modal is open:
      if (showCustomerModal) {
        handleTallyKeyDown(e, {
          onModalClose: () => setShowCustomerModal(false),
          isDropdownOpen: Boolean(activeItemDropdownRowId),
          onCloseDropdown: () => setActiveItemDropdownRowId(null),
        });
        return;
      }

      // 2. If customer details modal is open:
      if (showCustomerDetailsModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowCustomerDetailsModal(false);
        }
        return;
      }

      // 3. If item suggestions flyout is open:
      if (activeItemDropdownRowId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setActiveItemDropdownRowId(null);
          return;
        }

        const activeRow = saleItems.find((s) => s.id === activeItemDropdownRowId);
        const q = (activeRow?.item_name || '').trim().toUpperCase();
        const matched = stockItems.filter((s) => {
          if (!q) return true;
          return (
            (s.product_name && s.product_name.toUpperCase().includes(q)) ||
            (s.tag_no && s.tag_no.toUpperCase().includes(q)) ||
            (s.metal_name && s.metal_name.toUpperCase().includes(q)) ||
            (s.notes && s.notes.toUpperCase().includes(q))
          );
        }).slice(0, 10);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (matched.length > 0) {
            setHighlightedItemIndex((prev) => (prev + 1) % matched.length);
          }
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          if (matched.length > 0) {
            setHighlightedItemIndex((prev) => (prev - 1 + matched.length) % matched.length);
          }
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const targetRowId = activeItemDropdownRowId;
          const pickedStock = matched[highlightedItemIndex] || matched[0];
          if (pickedStock && activeRow) {
            handleSelectStockItem(targetRowId, pickedStock);
          }
          setActiveItemDropdownRowId(null);

          // Focus next editable field in row in Tally style
          setTimeout(() => {
            const row = document.querySelector(`[data-row-id="${targetRowId}"]`)?.closest('tr');
            if (row) {
              const inputs = Array.from(
                row.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
                  'input:not([disabled]):not([readonly]), select:not([disabled])'
                )
              );
              const target = inputs.find(
                (inp) =>
                  inp.getAttribute('placeholder')?.includes('RATE') ||
                  inp.getAttribute('placeholder')?.includes('MC') ||
                  inp.getAttribute('placeholder')?.includes('RATE/G') ||
                  inp.getAttribute('placeholder')?.includes('GROSS') ||
                  inp.tagName === 'SELECT'
              );
              if (target) {
                target.focus();
                if ('select' in target) (target as HTMLInputElement).select();
              }
            }
          }, 50);
          return;
        }

        if (e.key === 'Tab') {
          setActiveItemDropdownRowId(null);
        }
      }

      // 4. Default Tally Navigation across all invoice inputs
      handleTallyKeyDown(e, {
        isDropdownOpen: Boolean(activeItemDropdownRowId),
        onCloseDropdown: () => setActiveItemDropdownRowId(null),
        onEnterAtEnd: () => {
          const saveBtn = document.querySelector<HTMLButtonElement>('.pos-save-btn, button[type="submit"]');
          saveBtn?.focus();
        },
      });
    };

    window.addEventListener('keydown', handleGlobalTallyNav, true);
    return () => window.removeEventListener('keydown', handleGlobalTallyNav, true);
  }, [showCustomerModal, showCustomerDetailsModal, activeItemDropdownRowId, highlightedItemIndex, saleItems, stockItems]);

  const [customerForm, setCustomerForm] = useState({
    name: '',
    customer_code: '',
    phone: '',
    alternate_phone: '',
    email: '',
    customer_type: 'RETAIL' as 'RETAIL' | 'WHOLESALE' | 'GIRVI_CLIENT',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    opening_balance_date: new Date().toISOString().split('T')[0],
    opening_balance_ref: '',
    opening_balance_notes: '',
    opening_cash_balance: 0,
    opening_cash_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_bank_balance: 0,
    opening_bank_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_gold_weight: 0,
    opening_gold_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_gold_purity_id: '',
    opening_gold_rate: 0,
    opening_gold_value: 0,
    opening_silver_weight: 0,
    opening_silver_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_silver_purity_id: '',
    opening_silver_rate: 0,
    opening_silver_value: 0,
    notes: '',
  });

  const handleOpenCustomerModal = (initialQuery?: string) => {
    setCustomerFormError(null);
    const today = new Date().toISOString().split('T')[0];
    setCustomerPrimaryDirection('DEBIT');

    let prefillName = '';
    let prefillPhone = '';
    if (initialQuery && typeof initialQuery === 'string') {
      const q = initialQuery.trim();
      if (/^[0-9+\s()-]+$/.test(q)) {
        prefillPhone = q;
      } else {
        prefillName = q;
      }
    }

    setCustomerForm({
      name: prefillName,
      customer_code: '',
      phone: prefillPhone,
      alternate_phone: '',
      email: '',
      customer_type: billType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      address: '',
      city: shopProfile?.city || '',
      state: shopProfile?.state || 'Maharashtra',
      pincode: shopProfile?.pincode || '',
      gstin: '',
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
      notes: '',
    });
    setShowCustomerModal(true);
  };

  const handleCustomerPrimaryDirectionChange = (dir: 'DEBIT' | 'CREDIT') => {
    setCustomerPrimaryDirection(dir);
    setCustomerForm((prev) => ({
      ...prev,
      opening_cash_type: dir,
      opening_bank_type: dir,
      opening_gold_type: dir,
      opening_silver_type: dir,
    }));
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      setCustomerFormError('Customer full name is required');
      return;
    }

    setCustomerSubmitting(true);
    setCustomerFormError(null);

    try {
      const created = await customerApi.create({
        name: customerForm.name.trim().toUpperCase(),
        customer_code: customerForm.customer_code.trim() ? customerForm.customer_code.trim().toUpperCase() : undefined,
        phone: customerForm.phone.trim() || null,
        alternate_phone: customerForm.alternate_phone.trim() || null,
        email: customerForm.email.trim() || null,
        customer_type: customerForm.customer_type,
        address: customerForm.address.trim() ? customerForm.address.trim().toUpperCase() : null,
        city: customerForm.city.trim() ? customerForm.city.trim().toUpperCase() : null,
        state: customerForm.state.trim() ? customerForm.state.trim().toUpperCase() : null,
        pincode: customerForm.pincode.trim() || null,
        gstin: customerForm.gstin.trim() ? customerForm.gstin.trim().toUpperCase() : null,
        opening_balance_date: customerForm.opening_balance_date || undefined,
        opening_balance_ref: customerForm.opening_balance_ref.trim() || undefined,
        opening_balance_notes: customerForm.opening_balance_notes.trim() || undefined,
        opening_cash_balance: Number(customerForm.opening_cash_balance) || 0,
        opening_cash_type: customerForm.opening_cash_type,
        opening_bank_balance: Number(customerForm.opening_bank_balance) || 0,
        opening_bank_type: customerForm.opening_bank_type,
        opening_gold_weight: Number(customerForm.opening_gold_weight) || 0,
        opening_gold_type: customerForm.opening_gold_type,
        opening_gold_purity_id: customerForm.opening_gold_purity_id || undefined,
        opening_gold_rate: Number(customerForm.opening_gold_rate) || 0,
        opening_gold_value: Number(customerForm.opening_gold_value) || 0,
        opening_silver_weight: Number(customerForm.opening_silver_weight) || 0,
        opening_silver_type: customerForm.opening_silver_type,
        opening_silver_purity_id: customerForm.opening_silver_purity_id || undefined,
        opening_silver_rate: Number(customerForm.opening_silver_rate) || 0,
        opening_silver_value: Number(customerForm.opening_silver_value) || 0,
        notes: customerForm.notes.trim() || null,
      });

      // Add newly created customer to master list in state
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      // Automatically select this customer for the current invoice
      setCustomerId(created.id);

      showToast('success', `Customer "${created.name}" created in Master & selected!`);
      setShowCustomerModal(false);
    } catch (err: any) {
      setCustomerFormError(err.message || 'Failed to create customer in Master');
    } finally {
      setCustomerSubmitting(false);
    }
  };

  // Quick Walk-in Customer (Cash Sale — No Khata Record)
  const handleQuickWalkin = async () => {
    try {
      // 1. Look for existing Cash or Walk-in customer to avoid duplicates
      const existingWalkin = customers.find((c) => {
        const n = (c.name || '').toUpperCase();
        const code = (c.customer_code || '').toUpperCase();
        const phone = c.phone || '';
        return (
          n.includes('CASH') ||
          n.includes('WALK-IN') ||
          n.includes('WALKIN') ||
          code === 'CASH' ||
          phone === '9999999999' ||
          phone === '9800000000' ||
          phone === 'COUNTER'
        );
      });

      if (existingWalkin) {
        setCustomerId(existingWalkin.id);
        showToast('success', `Selected ${existingWalkin.name} (Cash Customer • No Khata)`);
        return;
      }

      // 2. Create single standard Cash Customer master
      const walkin = await customerApi.create({
        name: 'CASH CUSTOMER',
        customer_code: 'CASH',
        phone: '9999999999',
        customer_type: 'RETAIL',
        address: 'COUNTER CASH SALE',
        city: (shopProfile?.city || 'LOCAL').toUpperCase(),
        state: (shopProfile?.state || '').toUpperCase(),
      });
      setCustomers((prev) => [walkin, ...prev]);
      setCustomerId(walkin.id);
      showToast('success', 'Selected Cash Customer (Counter Sale • No Khata Record)');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to select cash customer');
    }
  };

  // Helper to add sale row - defaults to today's active board rate
  const handleAddSaleRow = () => {
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

    const newRow: SaleItemRow = {
      id: `item-${Date.now()}-${saleItems.length + 1}`,
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
      rate_per_gram: defRate,
    };
    setSaleItems((prev) => [...prev, newRow]);
  };

  const handleCopySaleRow = (id: string) => {
    const itemToCopy = saleItems.find((item) => item.id === id);
    if (!itemToCopy) return;
    const targetIdx = saleItems.findIndex((item) => item.id === id);
    const clonedRow: SaleItemRow = {
      ...itemToCopy,
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tag_no: itemToCopy.tag_no ? `${itemToCopy.tag_no}-COPY` : '',
    };
    setSaleItems((prev) => [
      ...prev.slice(0, targetIdx + 1),
      clonedRow,
      ...prev.slice(targetIdx + 1),
    ]);
    showToast('success', 'Sale item line duplicated');
  };

  const handleRemoveSaleRow = (id: string) => {
    setSaleItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateSaleRow = (id: string, updates: Partial<SaleItemRow>) => {
    setSaleItems((prev) =>
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

        // If purity changed directly, update purity & tunch%, while rate remains the 24K / Pure benchmark rate
        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((pur) => pur.id === updates.purity_id);
          updated.purity_name = p ? p.name : '';
          if (p && p.tunch_percent) updated.tunch_percent = p.tunch_percent;

          // Display rate remains strictly the 24K (or 999 Silver) benchmark rate
          if (baseBenchmark && baseBenchmark.rate > 0) {
            updated.rate_per_gram = baseBenchmark.rate;
          } else if (!updated.rate_per_gram) {
            const matchingRate = rates.find((r) => r.purity_id === updates.purity_id);
            if (matchingRate && matchingRate.rate) {
              updated.rate_per_gram = matchingRate.rate;
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

            // Sync closest purity name for label
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

  // Select In-Stock inventory item and populate all fields
  const handleSelectStockItem = (rowId: string, stock: StockItem) => {
    const metal = metals.find((m) => m.id === stock.metal_id || m.code?.toUpperCase() === stock.metal_code?.toUpperCase());
    const purity = purities.find((p) => p.id === stock.purity_id || p.code?.toUpperCase() === stock.purity_code?.toUpperCase());

    const isGold = (stock.metal_code || metal?.code || '').toUpperCase().includes('GOLD');
    const baseBenchmark = isGold
      ? rates.find((r) => r.metal_code?.toUpperCase() === 'GOLD' && (r.purity_code?.toUpperCase() === '24K' || r.purity_name?.includes('24K') || r.purity_name?.includes('999')))
      : rates.find((r) => r.metal_code?.toUpperCase() === 'SILVER' && (r.purity_code === '999' || r.purity_name?.includes('999')));

    const rateVal = baseBenchmark && baseBenchmark.rate > 0
      ? baseBenchmark.rate
      : (rates.find((r) => r.purity_id === stock.purity_id)?.rate || stock.rate_per_gram || '');

    handleUpdateSaleRow(rowId, {
      stock_item_id: stock.id,
      tag_no: stock.tag_no,
      item_name: stock.product_name || stock.notes || stock.tag_no,
      metal_id: metal?.id || stock.metal_id,
      metal_name: metal?.name || stock.metal_name || 'Gold',
      purity_id: purity?.id || stock.purity_id,
      purity_name: purity?.name || stock.purity_name || '',
      tunch_percent: stock.tunch_percent || purity?.tunch_percent || 91.6,
      gross_weight: stock.gross_weight,
      less_weight: stock.less_weight || 0,
      wastage_percent: stock.wastage_percent || 0,
      making_rate: stock.making_charge || 0,
      rate_per_gram: billType === 'WHOLESALE' ? 0 : rateVal,
      huid: stock.huid || '',
      notes: stock.notes || undefined,
    });

    setActiveItemDropdownRowId(null);
    showToast('success', `Tag ${stock.tag_no} selected from Stock Inventory!`);

    // In Tally style: automatically move focus to next editable field in row
    setTimeout(() => {
      const row = document.querySelector(`[data-row-id="${rowId}"]`)?.closest('tr');
      if (row) {
        const inputs = Array.from(row.querySelectorAll<HTMLInputElement>('input:not([disabled]):not([readonly])'));
        const nextTarget = inputs.find(
          (inp) =>
            inp.placeholder.includes('RATE') ||
            inp.placeholder.includes('MC') ||
            inp.placeholder.includes('RATE/G') ||
            inp.placeholder.includes('GROSS')
        );
        if (nextTarget) {
          nextTarget.focus();
          nextTarget.select();
        } else {
          const activeInput = document.querySelector<HTMLInputElement>(`input[data-row-id="${rowId}"]`);
          activeInput?.blur();
        }
      }
    }, 60);
  };

  // Lookup tag on blur / barcode scan
  const handleTagInputBlur = async (rowId: string, typedTag: string) => {
    const trimmed = (typedTag || '').trim().toUpperCase();
    if (!trimmed) {
      handleUpdateSaleRow(rowId, { stock_item_id: undefined });
      return;
    }

    // 1. Check local loaded in-stock cache
    const localMatch = stockItems.find((s) => s.tag_no.toUpperCase() === trimmed);
    if (localMatch) {
      handleSelectStockItem(rowId, localMatch);
      return;
    }

    // 2. Query remote API
    try {
      const remoteStock = await inventoryApi.getByTag(trimmed);
      if (remoteStock) {
        if (remoteStock.status === 'IN_STOCK') {
          handleSelectStockItem(rowId, remoteStock);
        } else if (remoteStock.status === 'SOLD') {
          showToast('error', `⚠️ Warning: Tag ${trimmed} is already marked as SOLD in inventory!`);
        } else {
          showToast('warning', `Tag ${trimmed} has status: ${remoteStock.status}`);
          handleSelectStockItem(rowId, remoteStock);
        }
      }
    } catch {
      // Custom counter tag
    }
  };

  const handleUnlinkStock = (rowId: string) => {
    handleUpdateSaleRow(rowId, { stock_item_id: undefined });
    showToast('info', 'Unlinked from stock item. Line item is now an unlinked custom item.');
  };

  // Helper to add exchange row - defaults to today's active 24K board rate, all weights & charges default to 0
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
      id: `ex-${Date.now()}-${exchangeItems.length + 1}`,
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
      id: `ex-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tag_no: itemToCopy.tag_no ? `${itemToCopy.tag_no}-COPY` : '',
    };
    setExchangeItems((prev) => [
      ...prev.slice(0, targetIdx + 1),
      clonedRow,
      ...prev.slice(targetIdx + 1),
    ]);
    showToast('success', 'Exchange item line duplicated');
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

        // If tunch_percent (Purity / Badla) was edited, rate STAYS the 24K benchmark rate
        if (updates.tunch_percent !== undefined) {
          const tVal = Number(updates.tunch_percent);
          if (!isNaN(tVal) && tVal > 0) {
            if (baseBenchmark && baseBenchmark.rate > 0) {
              updated.exchange_rate = baseBenchmark.rate;
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

  const getDefaultReceivingAccount = (mode: string): string => {
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

  // Helper to add standard payment row
  const handleAddPaymentRow = () => {
    const currentCust = customers.find((c) => c.id === customerId);
    const currentCustomerName = currentCust ? currentCust.name : 'CASH CUSTOMER';
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: 'CASH',
      amount: '',
      reference_number: '',
      payer_type: 'CUSTOMER',
      payer_name: currentCustomerName,
      payer_party_id: customerId,
      received_in: getDefaultReceivingAccount('CASH'),
    };
    setPayments((prev) => [...prev, newPay]);
  };

  // Helper to add payment row with specific mode
  const handleAddPaymentRowWithMode = (mode: 'CASH' | 'BANK' | 'GOLD' | 'SILVER' | 'CREDIT') => {
    if (mode === 'GOLD' || mode === 'SILVER') {
      handleAddMetalPaymentRow(mode);
      return;
    }
    const currentCust = customers.find((c) => c.id === customerId);
    const currentCustomerName = currentCust ? currentCust.name : 'CASH CUSTOMER';
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: mode,
      amount: '',
      reference_number: '',
      payer_type: 'CUSTOMER',
      payer_name: currentCustomerName,
      payer_party_id: customerId,
      received_in: mode === 'CREDIT' ? '' : getDefaultReceivingAccount(mode),
    };
    setPayments((prev) => [...prev, newPay]);
  };

  // Helper to add metal payment row (Gold or Silver) with dashboard rate auto-applied
  const handleAddMetalPaymentRow = (metalType: 'GOLD' | 'SILVER') => {
    const info = findMetalAndPurity(metalType);
    const currentCust = customers.find((c) => c.id === customerId);
    const currentCustomerName = currentCust ? currentCust.name : 'CASH CUSTOMER';
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: metalType,
      amount: '',
      reference_number: '',
      payer_type: 'CUSTOMER',
      payer_name: currentCustomerName,
      payer_party_id: customerId,
      received_in: '',
      metal_id: info.metalId,
      metal_name: info.metalName,
      purity_id: info.purityId,
      purity_name: info.purityName,
      tunch_percent: info.tunchPercent,
      metal_weight: '',
      fine_weight: '',
      metal_rate: info.applicableRate > 0 ? info.applicableRate : '',
      rate_error: info.applicableRate <= 0 ? 'Today\'s benchmark rate not set in dashboard' : undefined,
      last_edited: 'weight',
    };
    setPayments((prev) => [...prev, newPay]);
  };

  const handleRemovePaymentRow = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  // Toggle Via: Self / Cr Party / Dr Party
  const handleSetPaymentVia = (id: string, via: 'SELF' | 'CR_PARTY' | 'DR_PARTY') => {
    const currentCust = customers.find((c) => c.id === customerId);
    const currentCustomerName = currentCust ? currentCust.name : 'CASH CUSTOMER';
    if (via === 'SELF') {
      handleUpdatePaymentRow(id, {
        payer_type: 'CUSTOMER',
        payer_name: currentCustomerName,
        payer_party_id: customerId,
      });
    } else if (via === 'CR_PARTY') {
      const firstSup = suppliers[0];
      handleUpdatePaymentRow(id, {
        payer_type: 'SUPPLIER',
        payer_name: firstSup ? firstSup.name : '',
        payer_party_id: firstSup ? firstSup.id : '',
      });
    } else if (via === 'DR_PARTY') {
      const firstCust = customers.find((c) => c.id !== customerId) || customers[0];
      handleUpdatePaymentRow(id, {
        payer_type: 'ANOTHER_CUSTOMER',
        payer_name: firstCust ? firstCust.name : '',
        payer_party_id: firstCust ? firstCust.id : '',
      });
    }
  };

  // Switch Mode: Cash / Bank / Gold / Silver / Credit
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
            rate_error: rate <= 0 ? 'Today\'s benchmark rate not set in dashboard' : undefined,
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

        // If mode switched, set smart default receiving account if not customized
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

        // If purity changed for metal payment
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

  // Auto-sync active dashboard rates into existing metal payment rows
  useEffect(() => {
    if (rates.length > 0) {
      setPayments((prev) =>
        prev.map((p) => {
          if (p.payment_mode === 'GOLD' || p.payment_mode === 'SILVER') {
            const info = findMetalAndPurity(p.payment_mode, p.purity_id);
            if (info.applicableRate > 0) {
              const tunch = p.tunch_percent ? Number(p.tunch_percent) : info.tunchPercent;
              const w = toDecimal(p.metal_weight || 0);
              let fine = toDecimal(p.fine_weight || 0);
              if (w.gt(0) && fine.isZero()) {
                fine = w.times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
              }
              const amt = w.gt(0)
                ? w.times(info.applicableRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
                : (fine.gt(0) && info.baseRate > 0
                    ? fine.times(info.baseRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
                    : p.amount);

              return {
                ...p,
                metal_id: p.metal_id || info.metalId,
                metal_name: p.metal_name || info.metalName,
                purity_id: p.purity_id || info.purityId,
                purity_name: p.purity_name || info.purityName,
                tunch_percent: tunch,
                metal_rate: info.applicableRate,
                rate_error: undefined,
                fine_weight: fine.gt(0) ? fine.toNumber() : p.fine_weight,
                amount: amt || '',
              };
            }
          }
          return p;
        })
      );
    }
  }, [rates, metals, purities]);

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

  const handlePaymentAmountChange = (id: string, value: string) => {
    const sanitized = parseDecimalInput(value, 2);
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          amount: sanitized,
          is_auto: false,
        };
      })
    );
  };

  const handleMetalRateChange = (id: string, value: string) => {
    const sanitized = parseDecimalInput(value, 2);
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const r = toDecimal(sanitized || 0);
        let newAmount = p.amount;
        if (p.metal_weight && Number(p.metal_weight) > 0 && r.gt(0)) {
          newAmount = toDecimal(p.metal_weight).times(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
        }
        return {
          ...p,
          metal_rate: sanitized,
          amount: newAmount,
          is_auto: false,
          rate_error: r.lte(0) ? 'Rate must be greater than zero' : undefined,
        };
      })
    );
  };

  const handlePaymentPurityChange = (id: string, newPurityId: string) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const isGold = p.payment_mode === 'GOLD';
        const info = findMetalAndPurity(isGold ? 'GOLD' : 'SILVER', newPurityId);
        const selectedPur = purities.find((pur) => pur.id === newPurityId);
        const newRate = info.applicableRate;
        const tunch = info.tunchPercent;

        let newFine = p.fine_weight;
        let newAmt = p.amount;

        if (p.metal_weight && Number(p.metal_weight) > 0) {
          const w = toDecimal(p.metal_weight);
          newFine = w.times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
          if (newRate > 0) {
            newAmt = w.times(newRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
          }
        }

        return {
          ...p,
          purity_id: newPurityId,
          purity_name: selectedPur ? selectedPur.name : info.purityName,
          metal_rate: newRate > 0 ? newRate : p.metal_rate,
          tunch_percent: tunch,
          fine_weight: newFine,
          amount: newAmt,
          rate_error: newRate <= 0 ? 'No active rate configured for this purity' : undefined,
        };
      })
    );
  };

  // Live Aggregate Computations
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
    let totalSaleAmount = new Decimal(0);

    let goldNetWeight = new Decimal(0);
    let goldFineWeight = new Decimal(0);
    let goldAdjustedFineWeight = new Decimal(0);
    let goldSaleAmount = new Decimal(0);

    let silverNetWeight = new Decimal(0);
    let silverFineWeight = new Decimal(0);
    let silverAdjustedFineWeight = new Decimal(0);
    let silverSaleAmount = new Decimal(0);

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
      saleAmount: Decimal;
      itemCount: number;
    }
    const saleMetalMap = new Map<string, MetalSummaryAcc>();

    saleItems.forEach((item) => {
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

      // Badla is calculated on pure fine weight (gold after purity):
      const badlaWeight = pureFine.times(badla).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const badlaAmount = badlaWeight.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Wastage is calculated on Net Weight (Tunch + Wastage % on net weight):
      const wasteOnlyWeight = net.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const wasteOnlyAmount = wasteOnlyWeight.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Total addition weight (Waste + Badla):
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
      totalSaleAmount = totalSaleAmount.plus(rowAmount);

      if (item.metal_id && (item.metal_name || '').trim()) {
        const rawMetalName = (item.metal_name || '').trim();
        const standardMetalKey = rawMetalName.toUpperCase();
        let metalAcc = saleMetalMap.get(standardMetalKey);
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
            saleAmount: new Decimal(0),
            itemCount: 0,
          };
          saleMetalMap.set(standardMetalKey, metalAcc);
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
        metalAcc.saleAmount = metalAcc.saleAmount.plus(rowAmount);
        metalAcc.itemCount += 1;

        const metalName = rawMetalName.toUpperCase();
        const isSilver = metalName.includes('SILVER');
        const isDiamond = metalName.includes('DIAMOND');
        const isPlatinum = metalName.includes('PLATINUM');
        if (isSilver) {
          silverNetWeight = silverNetWeight.plus(net);
          silverFineWeight = silverFineWeight.plus(pureFine);
          silverAdjustedFineWeight = silverAdjustedFineWeight.plus(billableFine);
          silverSaleAmount = silverSaleAmount.plus(rowAmount);
        } else if (!isDiamond && !isPlatinum) {
          goldNetWeight = goldNetWeight.plus(net);
          goldFineWeight = goldFineWeight.plus(pureFine);
          goldAdjustedFineWeight = goldAdjustedFineWeight.plus(billableFine);
          goldSaleAmount = goldSaleAmount.plus(rowAmount);
        }
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

    let goldExchangeNetWeight = new Decimal(0);
    let goldExchangeFineWeight = new Decimal(0);
    let goldExchangeAmount = new Decimal(0);
    let silverExchangeNetWeight = new Decimal(0);
    let silverExchangeFineWeight = new Decimal(0);
    let silverExchangeAmount = new Decimal(0);

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
      const wasteWeight = net.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
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

      const rawExMetalName = (ex.metal_name || 'Gold').trim();
      const standardExMetalKey = rawExMetalName.toUpperCase();
      const isExSilver = standardExMetalKey.includes('SILVER');
      const isExDiamond = standardExMetalKey.includes('DIAMOND');
      const isExPlatinum = standardExMetalKey.includes('PLATINUM');
      if (isExSilver) {
        silverExchangeNetWeight = silverExchangeNetWeight.plus(net);
        silverExchangeFineWeight = silverExchangeFineWeight.plus(pureFine);
        silverExchangeAmount = silverExchangeAmount.plus(exVal);
      } else if (!isExDiamond && !isExPlatinum) {
        goldExchangeNetWeight = goldExchangeNetWeight.plus(net);
        goldExchangeFineWeight = goldExchangeFineWeight.plus(pureFine);
        goldExchangeAmount = goldExchangeAmount.plus(exVal);
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
      exAcc.badlaAmount = exAcc.badlaAmount.plus(badlaWeight.times(rate));
      exAcc.wasteWeight = exAcc.wasteWeight.plus(wasteWeight);
      exAcc.wasteAmount = exAcc.wasteAmount.plus(wasteWeight.times(rate));
      exAcc.deductionAmount = exAcc.deductionAmount.plus(deduction);
      exAcc.billableFineWeight = exAcc.billableFineWeight.plus(billableFine);
      exAcc.exchangeValue = exAcc.exchangeValue.plus(exVal);
      exAcc.itemCount += 1;
    });

    const shopState = (shopProfile?.state || '').trim().toLowerCase();
    const shopGstinCode = (shopProfile?.gstin || '').slice(0, 2);
    const activeCustomer = customers.find((c) => c.id === customerId);
    const customerState = (activeCustomer?.state || '').trim().toLowerCase();
    const customerGstinCode = (activeCustomer?.gstin || '').slice(0, 2);

    const isInterState = Boolean(
      (customerGstinCode && shopGstinCode && customerGstinCode !== shopGstinCode) ||
      (customerState && shopState && customerState !== shopState)
    );

    const discount = toDecimal(discountAmount || 0);
    const netTaxable = Decimal.max(0, totalSaleAmount.minus(discount));
    const gstRateDec = toDecimal(gstRate);
    const gstAmount = netTaxable.times(gstRateDec).dividedBy(100);
    const cgst = isInterState ? new Decimal(0) : gstAmount.dividedBy(2);
    const sgst = isInterState ? new Decimal(0) : gstAmount.dividedBy(2);
    const igst = isInterState ? gstAmount : new Decimal(0);
    const rawGrandTotal = netTaxable.plus(gstAmount);
    const grandTotal = rawGrandTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const roundOff = grandTotal.minus(rawGrandTotal);

    // netPayable = grandTotal - totalExchangeValue
    // When exchangeValue > grandTotal, netPayable is NEGATIVE (e.g. -₹75,000)
    // representing money owed/payable to customer (acts as purchase/inward)
    const netPayable = grandTotal.minus(totalExchangeValue);

    let cashAndOtherPayments = new Decimal(0);
    let goldPaymentValue = new Decimal(0);
    let goldPaymentGrams = new Decimal(0);
    let goldPaymentFineGrams = new Decimal(0);
    let silverPaymentValue = new Decimal(0);
    let silverPaymentGrams = new Decimal(0);
    let silverPaymentFineGrams = new Decimal(0);
    let totalReceived = new Decimal(0);

    payments.forEach((p) => {
      const amt = toDecimal(p.amount || 0);
      if (amt.gt(0)) {
        totalReceived = totalReceived.plus(amt);
        if (p.payment_mode === 'GOLD') {
          goldPaymentValue = goldPaymentValue.plus(amt);
          goldPaymentGrams = goldPaymentGrams.plus(toDecimal(p.metal_weight || 0));
          goldPaymentFineGrams = goldPaymentFineGrams.plus(toDecimal(p.fine_weight || p.metal_weight || 0));
        } else if (p.payment_mode === 'SILVER') {
          silverPaymentValue = silverPaymentValue.plus(amt);
          silverPaymentGrams = silverPaymentGrams.plus(toDecimal(p.metal_weight || 0));
          silverPaymentFineGrams = silverPaymentFineGrams.plus(toDecimal(p.fine_weight || p.metal_weight || 0));
        } else {
          cashAndOtherPayments = cashAndOtherPayments.plus(amt);
        }
      }
    });

    const isPayableToCustomer = netPayable.lt(0);
    const rawBalance = netPayable.minus(totalReceived);
    const balanceDue = isPayableToCustomer ? new Decimal(0) : Decimal.max(0, rawBalance);
    const payableToCustomer = isPayableToCustomer
      ? Decimal.max(0, netPayable.abs().minus(totalReceived))
      : new Decimal(0);
    const changeDue = !isPayableToCustomer
      ? Decimal.max(0, totalReceived.minus(netPayable))
      : Decimal.max(0, totalReceived.minus(netPayable.abs()));
    const isSettled = isPayableToCustomer
      ? totalReceived.gte(netPayable.abs())
      : netPayable.gt(0)
      ? totalReceived.gte(netPayable)
      : true;

    const goldWholesaleBal = Decimal.max(
      0,
      goldAdjustedFineWeight.minus(goldExchangeFineWeight).minus(goldPaymentFineGrams)
    ).toNumber();

    const silverWholesaleBal = Decimal.max(
      0,
      silverAdjustedFineWeight.minus(silverExchangeFineWeight).minus(silverPaymentFineGrams)
    ).toNumber();

    const wholesaleIsSettled =
      (goldAdjustedFineWeight.gt(0) || silverAdjustedFineWeight.gt(0)) &&
      goldWholesaleBal <= 0.0005 &&
      silverWholesaleBal <= 0.0005;

    const metalBreakdowns = Array.from(saleMetalMap.values()).map((m) => ({
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
      saleAmount: m.saleAmount.toNumber(),
      itemCount: m.itemCount,
    }));

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

    const goldBalFine = Decimal.max(0, goldFineWeight.minus(goldExchangeFineWeight));
    const goldBalAmount = Decimal.max(0, goldSaleAmount.minus(goldExchangeAmount));
    const silverBalFine = Decimal.max(0, silverFineWeight.minus(silverExchangeFineWeight));
    const silverBalAmount = Decimal.max(0, silverSaleAmount.minus(silverExchangeAmount));

    return {
      metalBreakdowns,
      exchangeMetalBreakdowns,
      hasMultipleMetals: metalBreakdowns.length > 1,
      goldSaleAmount: goldSaleAmount.toNumber(),
      goldExchangeAmount: goldExchangeAmount.toNumber(),
      goldBalFine: goldBalFine.toNumber(),
      goldBalAmount: goldBalAmount.toNumber(),
      silverSaleAmount: silverSaleAmount.toNumber(),
      silverExchangeAmount: silverExchangeAmount.toNumber(),
      silverBalFine: silverBalFine.toNumber(),
      silverBalAmount: silverBalAmount.toNumber(),
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
      totalSaleAmount: totalSaleAmount.toNumber(),
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
      igst: igst.toNumber(),
      isInterState,
      roundOff: roundOff.toNumber(),
      grandTotal: grandTotal.toNumber(),
      netPayable: netPayable.toNumber(),
      isPayableToCustomer,
      payableToCustomer: payableToCustomer.toNumber(),
      cashAndOtherPayments: cashAndOtherPayments.toNumber(),
      goldPaymentValue: goldPaymentValue.toNumber(),
      goldPaymentGrams: goldPaymentGrams.toNumber(),
      goldPaymentFineGrams: goldPaymentFineGrams.toNumber(),
      silverPaymentValue: silverPaymentValue.toNumber(),
      silverPaymentGrams: silverPaymentGrams.toNumber(),
      silverPaymentFineGrams: silverPaymentFineGrams.toNumber(),
      totalReceived: totalReceived.toNumber(),
      totalPaid: totalReceived.toNumber(), // backwards compatible alias
      balanceDue: balanceDue.toNumber(),
      changeDue: changeDue.toNumber(),
      isSettled,
      goldWholesaleBal,
      silverWholesaleBal,
      wholesaleIsSettled,
    };
  }, [saleItems, exchangeItems, discountAmount, gstRate, payments, customerId, customers, shopProfile]);

  // Quick Settle Full Payment / Payout
  const handleQuickSettle = (mode: 'CASH' | 'UPI' | 'BANK') => {
    const defaultAcc = getDefaultReceivingAccount(mode);
    const settleAmt = Math.abs(calculations.netPayable);
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payment_mode: mode,
        amount: settleAmt,
        payer_type: 'CUSTOMER',
        received_in: defaultAcc,
        reference_number: mode !== 'CASH' ? 'POS-TRANS' : '',
      },
    ]);
  };

  const handleClearPayments = () => {
    const defaultAcc = getDefaultReceivingAccount('CASH');
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payment_mode: 'CASH',
        amount: '',
        payer_type: 'CUSTOMER',
        received_in: defaultAcc,
        reference_number: '',
      },
    ]);
  };

  // Helper to calculate exact Auto Mode weights and amounts for Gold and Silver
  const getAutoMetalTarget = (
    metalType: 'GOLD' | 'SILVER',
    currentPurityId?: string,
    currentRate?: number | string,
    currentTunch?: number | string
  ) => {
    const isGold = metalType === 'GOLD';
    const info = findMetalAndPurity(metalType, currentPurityId);
    const rate = Number(currentRate || info.applicableRate || 0);
    const tunch = Number(currentTunch || info.tunchPercent || (isGold ? 91.6 : 99.9));

    // Wholesale Fine-to-Fine balance check
    if (isWholesale) {
      const wholesaleBal = isGold ? calculations.goldWholesaleBal : calculations.silverWholesaleBal;
      const targetWeight = wholesaleBal > 0 ? wholesaleBal : 0;
      return {
        metalWeight: targetWeight > 0 ? targetWeight : '',
        fineWeight: targetWeight > 0 ? targetWeight : '',
        amount: '',
      };
    }

    // Retail Mode:
    // 1. If this specific metal has a direct net fine balance from sale - exchange
    const balFine = isGold ? calculations.goldBalFine : calculations.silverBalFine;
    const balAmt = isGold ? calculations.goldBalAmount : calculations.silverBalAmount;

    if (balFine > 0) {
      const calcWeight = tunch > 0
        ? new Decimal(balFine).times(100).dividedBy(tunch).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber()
        : balFine;
      const calcAmt = balAmt > 0
        ? balAmt
        : (rate > 0 ? Decimal.max(0, new Decimal(calcWeight).times(rate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0);

      return {
        metalWeight: calcWeight > 0 ? calcWeight : '',
        fineWeight: balFine > 0 ? balFine : '',
        amount: calcAmt > 0 ? calcAmt : '',
      };
    }

    // 2. If specific metal fine is 0, but invoice has an outstanding currency balance due (e.g. paying Gold bill in Silver)
    if (calculations.balanceDue > 0 && rate > 0) {
      const dueAmt = calculations.balanceDue;
      const calcWeight = new Decimal(dueAmt).dividedBy(rate).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
      const calcFine = tunch > 0
        ? new Decimal(calcWeight).times(tunch).dividedBy(100).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber()
        : calcWeight;

      return {
        metalWeight: calcWeight > 0 ? calcWeight : '',
        fineWeight: calcFine > 0 ? calcFine : '',
        amount: dueAmt,
      };
    }

    return {
      metalWeight: '',
      fineWeight: '',
      amount: '',
    };
  };

  const handleToggleAutoMode = (paymentId: string, metalType: 'GOLD' | 'SILVER') => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== paymentId) return p;
        const willBeAuto = !p.is_auto;
        const autoTarget = getAutoMetalTarget(metalType, p.purity_id, p.metal_rate, p.tunch_percent);

        return {
          ...p,
          is_auto: willBeAuto,
          metal_weight: willBeAuto ? autoTarget.metalWeight : p.metal_weight,
          fine_weight: willBeAuto ? autoTarget.fineWeight : p.fine_weight,
          amount: willBeAuto ? autoTarget.amount : p.amount,
          last_edited: 'weight',
        };
      })
    );
  };

  const handleApplyAutoFromSummary = (metalType: 'GOLD' | 'SILVER') => {
    const isGold = metalType === 'GOLD';
    const existingIndex = payments.findIndex((p) => p.payment_mode === metalType);

    if (existingIndex >= 0) {
      const existing = payments[existingIndex];
      const willBeAuto = !existing.is_auto;
      const autoTarget = getAutoMetalTarget(metalType, existing.purity_id, existing.metal_rate, existing.tunch_percent);

      setPayments((prev) =>
        prev.map((p, idx) => {
          if (idx !== existingIndex) return p;
          return {
            ...p,
            is_auto: willBeAuto,
            metal_weight: willBeAuto ? autoTarget.metalWeight : p.metal_weight,
            fine_weight: willBeAuto ? autoTarget.fineWeight : p.fine_weight,
            amount: willBeAuto ? autoTarget.amount : p.amount,
            last_edited: 'weight',
          };
        })
      );
      showToast('info', `${isGold ? 'Gold' : 'Silver'} Auto mode ${existing.is_auto ? 'disabled' : 'selected & synced'}`);
    } else {
      const info = findMetalAndPurity(metalType);
      const currentCust = customers.find((c) => c.id === customerId);
      const autoTarget = getAutoMetalTarget(metalType, info.purityId, info.applicableRate, info.tunchPercent);

      const newPay: PaymentRow = {
        id: `pay-${Date.now()}-${payments.length + 1}`,
        payment_mode: metalType,
        amount: autoTarget.amount,
        reference_number: '',
        payer_type: 'CUSTOMER',
        payer_name: currentCust ? currentCust.name : 'CASH CUSTOMER',
        payer_party_id: customerId,
        received_in: '',
        metal_id: info.metalId,
        metal_name: info.metalName,
        purity_id: info.purityId,
        purity_name: info.purityName,
        tunch_percent: info.tunchPercent,
        metal_weight: autoTarget.metalWeight,
        fine_weight: autoTarget.fineWeight,
        metal_rate: info.applicableRate > 0 ? info.applicableRate : '',
        rate_error: info.applicableRate <= 0 ? "Today's benchmark rate not set in dashboard" : undefined,
        last_edited: 'weight',
        is_auto: true,
      };
      setPayments((prev) => [...prev, newPay]);
      showToast('success', `${isGold ? 'Gold' : 'Silver'} Auto mode payment row added`);
    }
  };

  // Keep Auto mode payment rows synced with latest Net Metal & Return Balance
  useEffect(() => {
    setPayments((prev) => {
      let hasChanges = false;
      const updated = prev.map((p) => {
        if (!p.is_auto) return p;
        const isGold = p.payment_mode === 'GOLD';
        const isSilver = p.payment_mode === 'SILVER';
        if (!isGold && !isSilver) return p;

        const autoTarget = getAutoMetalTarget(isGold ? 'GOLD' : 'SILVER', p.purity_id, p.metal_rate, p.tunch_percent);

        if (
          p.metal_weight !== autoTarget.metalWeight ||
          p.fine_weight !== autoTarget.fineWeight ||
          p.amount !== autoTarget.amount
        ) {
          hasChanges = true;
          return {
            ...p,
            metal_weight: autoTarget.metalWeight,
            fine_weight: autoTarget.fineWeight,
            amount: autoTarget.amount,
          };
        }
        return p;
      });
      return hasChanges ? updated : prev;
    });
  }, [
    calculations.goldBalFine,
    calculations.goldBalAmount,
    calculations.silverBalFine,
    calculations.silverBalAmount,
    calculations.goldWholesaleBal,
    calculations.silverWholesaleBal,
    calculations.balanceDue,
    isWholesale,
  ]);

  // Submit / Create Invoice
  const handleSaveInvoice = async (finalize = false) => {
    if (!customerId) {
      showToast('error', 'Please select or create a customer');
      return;
    }

    if (saleItems.length === 0 && exchangeItems.length === 0) {
      showToast('error', 'Please add at least one sale item or exchange item');
      return;
    }

    // Validate payment rows: payer_name is required when payer is not the customer
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      const hasAmt = toDecimal(p.amount).gt(0);
      if (hasAmt && p.payer_type && p.payer_type !== 'CUSTOMER') {
        if (!p.payer_name || !p.payer_name.trim()) {
          showToast('error', `Payment row #${i + 1}: Payer name is required when payer differs from customer`);
          return;
        }
      }
    }

    // Validate all mandatory fields for each sale item
    for (let i = 0; i < saleItems.length; i++) {
      const item = saleItems[i];
      const rowNum = i + 1;

      // 1. Tag No
      if (invoiceColumns.show_tag_no) {
        if (!item.tag_no || !item.tag_no.trim()) {
          showToast('error', `Row #${rowNum}: Tag No is mandatory. You must enter a Tag No.`);
          return;
        }
      }

      // 2. Item Name
      if (!item.item_name || !item.item_name.trim()) {
        showToast('error', `Row #${rowNum}: Item Name is mandatory. You must enter an Item Name.`);
        return;
      }

      // 3. Metal
      if (!item.metal_id) {
        showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Metal is mandatory. You must select a Metal.`);
        return;
      }

      // 4. Tunch% (Purity)
      if (invoiceColumns.show_tunch) {
        if (item.tunch_percent === '' || item.tunch_percent === null || item.tunch_percent === undefined) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Tunch% is mandatory. You must enter Tunch% (e.g. 91.67).`);
          return;
        }
        const tunch = toDecimal(item.tunch_percent);
        if (tunch.lte(0) || tunch.gt(100)) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Tunch% must be between 0.01% and 100%.`);
          return;
        }
      }

      // 5. Gross Weight
      if (item.gross_weight === '' || item.gross_weight === null || item.gross_weight === undefined) {
        showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Gross weight is mandatory. You must enter Gross weight.`);
        return;
      }
      const gross = toDecimal(item.gross_weight);
      if (gross.lte(0)) {
        showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Gross weight must be greater than zero.`);
        return;
      }

      // 6. Less Weight
      if (invoiceColumns.show_less_weight) {
        if (item.less_weight === '' || item.less_weight === null || item.less_weight === undefined) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Less weight is mandatory. You must enter Less weight (enter 0 if no stones/wax).`);
          return;
        }
        const less = toDecimal(item.less_weight);
        if (less.lt(0)) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Less weight cannot be negative.`);
          return;
        }
        if (less.gt(gross)) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Less weight (${less.toNumber()}g) cannot exceed gross weight (${gross.toNumber()}g).`);
          return;
        }
      }

      // 7. Badla%
      if (invoiceColumns.show_badla) {
        if (item.badla_percent === '' || item.badla_percent === null || item.badla_percent === undefined) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Badla% is mandatory. You must enter Badla% (enter 0 if none).`);
          return;
        }
      }

      // 8. Waste%
      if (invoiceColumns.show_wastage) {
        if (item.wastage_percent === '' || item.wastage_percent === null || item.wastage_percent === undefined) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Waste% is mandatory. You must enter Waste% (enter 0 if none).`);
          return;
        }
      }

      // 9. Making Charge
      if (invoiceColumns.show_making_charge) {
        if (item.making_rate === '' || item.making_rate === null || item.making_rate === undefined) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Making charge is mandatory. You must enter Making charge (enter 0 if free labour).`);
          return;
        }
        const makingRate = toDecimal(item.making_rate);
        if (makingRate.lt(0)) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Making charge cannot be negative.`);
          return;
        }
        if (item.making_charge_type === 'PER_PIECE') {
          const pcs = Number(item.pieces);
          if (!pcs || pcs < 1) {
            showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Number of pieces is mandatory and must be at least 1.`);
            return;
          }
        }
      }

      // 10. Rate per Gram (Mandatory for Retail; Wholesale is Fine-to-Fine / Pure Metal Weight settlement)
      if (billType !== 'WHOLESALE') {
        if (item.rate_per_gram === '' || item.rate_per_gram === null || item.rate_per_gram === undefined) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Rate/g is mandatory. You must enter metal rate per gram.`);
          return;
        }
        const rate = toDecimal(item.rate_per_gram);
        if (rate.lte(0)) {
          showToast('error', `Row #${rowNum} ("${item.item_name || 'Item'}"): Rate/g must be greater than zero.`);
          return;
        }
      }
    }

    // Validate all mandatory fields for each exchange item
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
      const payload = {
        customer_id: customerId,
        invoice_date: invoiceDate,
        gst_rate: toDecimal(gstRate).toNumber(),
        discount_amount: toDecimal(discountAmount).toNumber(),
        notes: notes.trim() || undefined,
        items: saleItems.map((item, idx) => {
          const gross = toDecimal(item.gross_weight);
          const less = toDecimal(item.less_weight);
          const net = Decimal.max(0, gross.minus(less));
          const tunch = toDecimal(item.tunch_percent);
          const fine = net.times(tunch).dividedBy(100);
          const wastage = toDecimal(item.wastage_percent);
          const badla = toDecimal(item.badla_percent || 0);
          const badlaWeight = fine.times(badla).dividedBy(100);
          const wasteWeight = net.times(wastage).dividedBy(100);
          const additionWeight = badlaWeight.plus(wasteWeight);
          const billableFine = !additionWeight.isZero() ? Decimal.max(0, fine.plus(additionWeight)) : fine;
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
            stock_item_id: item.stock_item_id || undefined,
            tag_no: invoiceColumns.show_tag_no
              ? (item.tag_no?.trim() || `TAG-${Date.now()}-${idx + 1}`)
              : (item.tag_no?.trim() || `TAG-${Date.now()}-${idx + 1}`),
            item_name: item.item_name.trim(),
            metal_id: item.metal_id,
            purity_id: item.purity_id,
            gross_weight: gross.toNumber(),
            less_weight: invoiceColumns.show_less_weight ? less.toNumber() : 0,
            tunch_percent: invoiceColumns.show_tunch ? tunch.toNumber() : (tunch.gt(0) ? tunch.toNumber() : 100),
            badla_percent: invoiceColumns.show_badla ? badla.toNumber() : 0,
            wastage_percent: invoiceColumns.show_wastage ? toDecimal(item.wastage_percent).toNumber() : 0,
            rate_per_gram: billType === 'WHOLESALE' ? 0 : rate.toNumber(),
            pieces: pcs.toNumber(),
            making_charge: invoiceColumns.show_making_charge ? making.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0,
            metal_rate: billType === 'WHOLESALE' ? 0 : rate.toNumber(),
            making_rate: invoiceColumns.show_making_charge ? makingRate.toNumber() : 0,
            making_charge_type: item.making_charge_type,
            notes: item.notes,
          };
        }),
        exchange_items:
          exchangeItems.length > 0
            ? exchangeItems.map((ex) => {
                const chargeType = ex.making_charge_type || 'PERCENTAGE';
                const makingRate = toDecimal(
                  ex.making_rate !== undefined && ex.making_rate !== ''
                    ? ex.making_rate
                    : (ex.deduction_percent !== undefined ? ex.deduction_percent : 0)
                ).toNumber();

                return {
                  source_type: 'CUSTOMER_JEWELLERY' as const,
                  metal_id: ex.metal_id,
                  purity_id: ex.purity_id,
                  item_name: ex.item_name.trim() || 'Old Metal Scrap',
                  tag_no: invoiceColumns.show_tag_no ? (ex.tag_no?.trim() || undefined) : undefined,
                  gross_weight: toDecimal(ex.gross_weight).toNumber(),
                  less_weight: invoiceColumns.show_less_weight ? toDecimal(ex.less_weight).toNumber() : 0,
                  tunch_percent: invoiceColumns.show_tunch ? toDecimal(ex.tunch_percent).toNumber() : (toDecimal(ex.tunch_percent).gt(0) ? toDecimal(ex.tunch_percent).toNumber() : 100),
                  badla_percent: invoiceColumns.show_badla ? toDecimal(ex.badla_percent || 0).toNumber() : 0,
                  wastage_percent: invoiceColumns.show_wastage ? toDecimal(ex.wastage_percent || 0).toNumber() : 0,
                  making_rate: invoiceColumns.show_making_charge ? makingRate : 0,
                  making_charge_type: chargeType,
                  pieces: toDecimal(ex.pieces || 1).toNumber(),
                  exchange_rate: toDecimal(ex.exchange_rate).toNumber(),
                  deduction_percent: invoiceColumns.show_making_charge ? (chargeType === 'PERCENTAGE' ? makingRate : toDecimal(ex.deduction_percent || 0).toNumber()) : 0,
                };
              })
            : undefined,
        payments:
          payments.filter((p) => toDecimal(p.amount).gt(0) || toDecimal(p.metal_weight).gt(0)).length > 0
            ? payments
                .filter((p) => toDecimal(p.amount).gt(0) || toDecimal(p.metal_weight).gt(0))
                .map((p) => ({
                  payment_mode: p.payment_mode,
                  amount: toDecimal(p.amount || 0).toNumber(),
                  metal_weight: p.metal_weight ? toDecimal(p.metal_weight).toNumber() : undefined,
                  metal_rate: p.metal_rate ? toDecimal(p.metal_rate).toNumber() : undefined,
                  metal_id: p.metal_id || undefined,
                  purity_id: p.purity_id || undefined,
                  reference_number: p.reference_number?.trim() || undefined,
                  notes: p.notes?.trim() || undefined,
                  payer_type: p.payer_type || 'CUSTOMER',
                  payer_name: p.payer_name?.trim() || undefined,
                  payer_bank: p.payer_bank?.trim() || undefined,
                  received_in: p.received_in?.trim() || undefined,
                  payer_party_id: p.payer_party_id || undefined,
                }))
            : undefined,
      };

      const created = await salesApi.createDraft(payload);

      if (finalize) {
        try {
          await salesApi.finalize(created.id);
          fetchInStockItems();
          const finalizedDetails = await salesApi.getDetails(created.id);
          showToast('success', `Invoice ${created.invoice_number} finalized and stock updated!`);
          setCreatedInvoice(finalizedDetails);
        } catch (fErr: any) {
          showToast('error', `Draft created, but finalize failed: ${fErr.message}`);
          setCreatedInvoice(created);
        }
      } else {
        showToast('success', `Invoice ${created.invoice_number} saved as DRAFT`);
        setCreatedInvoice(created);
      }

      setShowPrintModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create sales invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const isCashCustomer = useMemo(() => {
    if (!selectedCustomer) return false;
    const n = (selectedCustomer.name || '').toUpperCase();
    const code = (selectedCustomer.customer_code || '').toUpperCase();
    const phone = selectedCustomer.phone || '';
    return (
      n.includes('CASH') ||
      n.includes('WALK-IN') ||
      n.includes('WALKIN') ||
      code === 'CASH' ||
      phone === '9999999999' ||
      phone === '9800000000' ||
      phone === 'COUNTER'
    );
  }, [selectedCustomer]);

  // Dynamic Column Count & Spans based on Store Invoice Configuration
  const saleLeadColSpan = 1 + (invoiceColumns.show_tag_no ? 1 : 0) + 1 + 1 + (invoiceColumns.show_tunch ? 1 : 0);
  const totalVisibleSaleCols =
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
    (isWholesale || invoiceColumns.show_fine_weight ? 1 : 0) +
    (isWholesale ? 0 : 2) +
    1;

  const exchLeadColSpan = 1 + (invoiceColumns.show_tag_no ? 1 : 0) + 1 + 1 + (invoiceColumns.show_tunch ? 1 : 0);
  const totalVisibleExchCols = totalVisibleSaleCols;

  return (
    <div className="pos-page-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`pos-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP WORKSTATION HEADER */}
      <div className="pos-workstation-header">
        <div className="pos-header-left">
          <button
            type="button"
            className="btn btn-outline btn-sm back-nav-btn"
            onClick={() => navigate('/billing/invoices')}
            title="Return to Sales Invoices Register"
          >
            <ArrowLeft size={16} />
            <span>All Invoices</span>
          </button>
          <div className="header-title-wrapper">
            <h1 className="pos-main-title font-serif">
              {billType === 'RETAIL' ? 'Create Retail Sale' : 'Create Wholesale Invoice'}
            </h1>
            <div className="bill-tag-badge font-mono">
              <span>{invoiceNumber}</span>
              <span className="badge-draft">NEW</span>
            </div>
          </div>
        </div>

        <div className="pos-header-right">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => handleSaveInvoice(false)}
            disabled={isSubmitting}
          >
            <Save size={15} />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSaveInvoice(true)}
            disabled={isSubmitting}
          >
            <CheckCircle size={16} />
            <span>{isSubmitting ? 'Processing...' : 'Save & Finalize Bill'}</span>
          </button>
        </div>
      </div>

      {/* TRANSACTION TYPE NAVIGATION TABS */}
      <div className="pos-nav-tabs-bar">
        <div className="nav-tabs-group">
          {modules.retail_enabled && (
            <button
              type="button"
              className={`pos-tab-pill ${billType === 'RETAIL' ? 'active' : ''}`}
              onClick={() => setBillType('RETAIL')}
            >
              Retail Sale
            </button>
          )}
          {modules.wholesale_enabled && (
            <button
              type="button"
              className={`pos-tab-pill ${billType === 'WHOLESALE' ? 'active' : ''}`}
              onClick={() => setBillType('WHOLESALE')}
            >
              Wholesale
            </button>
          )}
          <button
            type="button"
            className="pos-tab-pill link-tab"
            onClick={() => navigate('/billing/purchases')}
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

      {/* CUSTOMER & INVOICE META CARD */}
      <div className="pos-meta-card">
        <div className="meta-grid">
          {/* Customer Selection */}
          <div className="meta-col customer-col">
            <div className="meta-header-row">
              <label className="meta-label">Customer Name *</label>
              <div className="customer-header-actions">
                <button
                  type="button"
                  className="quick-walkin-link"
                  onClick={handleQuickWalkin}
                  title="Select Cash Customer (Spot Counter Sale — No Khata Record)"
                >
                  <Banknote size={11} />
                  <span>+ Cash</span>
                </button>
                <button
                  type="button"
                  className="quick-add-customer-link"
                  onClick={() => handleOpenCustomerModal()}
                  title="Create new customer in Master directory & select for invoice"
                >
                  <UserPlus size={11} />
                  <span>+ Add</span>
                </button>
              </div>
            </div>
            <CustomerSearchSelect
              customers={customers}
              selectedCustomerId={customerId}
              onSelectCustomer={(c) => {
                setCustomerId(c.id);
                if (c.customer_type === 'WHOLESALE') {
                  setBillType('WHOLESALE');
                } else if (c.customer_type === 'RETAIL') {
                  setBillType('RETAIL');
                }
              }}
              onClearCustomer={() => setCustomerId('')}
              onAddNewCustomer={(query) => handleOpenCustomerModal(query)}
              onQuickWalkin={handleQuickWalkin}
              onCustomerDiscovered={(newCust) => {
                setCustomers((prev) => {
                  if (prev.some((c) => c.id === newCust.id)) return prev;
                  return [...prev, newCust];
                });
              }}
              placeholder="Search by name, phone (e.g. 9628), or address..."
            />
          </div>

          {/* Contact & Khata Info */}
          <div className="meta-col contact-col">
            <div className="meta-header-row">
              <label className="meta-label">Phone & Khata Balance</label>
              {selectedCustomer && !isCashCustomer && (
                <button
                  type="button"
                  className="view-cust-details-btn"
                  onClick={() => setShowCustomerDetailsModal(true)}
                  title="View detailed breakdown of customer debits, credits, and khata ledger"
                >
                  <Eye size={12} />
                  <span>View Details</span>
                </button>
              )}
            </div>
            <div className="customer-info-box font-mono text-xs">
              {isCashCustomer ? (
                <div className="cash-walkin-banner">
                  <div className="cash-title-row">
                    <Banknote size={14} className="text-emerald-500" />
                    <span>CASH CUSTOMER (COUNTER SALE)</span>
                  </div>
                  <div className="cash-subtext font-sans">
                    Spot cash payment at counter • No customer khata record maintained
                  </div>
                </div>
              ) : selectedCustomer ? (
                <>
                  <div className="customer-contact-line">
                    <span className="customer-contact-phone font-mono">
                      <Phone size={11} className="inline-icon text-gold" />
                      <span>{selectedCustomer.phone || 'No Phone'}</span>
                    </span>
                    <span className="customer-contact-bullet">•</span>
                    <span
                      className="customer-contact-address"
                      title={[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ') || 'Counter Cash Sale'}
                    >
                      <MapPin size={11} className="inline-icon text-muted" />
                      <span>{[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ') || 'Counter Cash Sale'}</span>
                    </span>
                  </div>
                  <div className="customer-khata-line">
                    {selectedCustomer.current_balance !== undefined && selectedCustomer.current_balance !== 0 ? (
                      <span className={`khata-pill ${selectedCustomer.current_balance > 0 ? 'is-due' : 'is-adv'}`}>
                        {selectedCustomer.current_balance > 0 ? (
                          <>
                            <AlertTriangle size={11} className="inline-icon" />
                            <span>Baaki (Dr): ₹{Number(selectedCustomer.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </>
                        ) : (
                          <>
                            <Check size={11} className="inline-icon" />
                            <span>Jama (Cr): ₹{Math.abs(Number(selectedCustomer.current_balance)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="khata-pill is-settled">
                        <span>Khata: ₹0.00 Settled</span>
                      </span>
                    )}
                    {selectedCustomer.gold_balance_grams !== undefined && selectedCustomer.gold_balance_grams !== 0 && (
                      <span className="khata-gold-pill">
                        <Coins size={11} className="inline-icon" />
                        <span>{selectedCustomer.gold_balance_grams > 0 ? `+${selectedCustomer.gold_balance_grams.toFixed(3)}g Baaki` : `${selectedCustomer.gold_balance_grams.toFixed(3)}g Jama`}</span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-muted text-xs italic py-1">
                  Select customer to view phone & khata balance
                </div>
              )}
            </div>
          </div>

          {/* Invoice Date */}
          <div className="meta-col date-col">
            <div className="meta-header-row">
              <label className="meta-label">Invoice Date *</label>
            </div>
            <input
              type="date"
              className="pos-input font-mono"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          {/* Place of Supply */}
          <div className="meta-col supply-col">
            <div className="meta-header-row">
              <label className="meta-label">Place of Supply</label>
            </div>
            <div className="pos-readonly-box font-mono" title={`State Code: ${shopProfile?.gstin?.slice(0, 2) || '27'}`}>
              <span className="text-muted text-xs font-sans">State:</span>
              <span className="text-gold font-bold text-xs">{(shopProfile?.gstin?.slice(0, 2) || '27')} • {shopProfile?.state || 'Maharashtra'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: SALE ITEMS TABLE */}
      <div className="pos-section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="gold" />
            <h2 className="section-title">Sale Items</h2>
            <span className="item-count-badge font-mono">{saleItems.length} item(s)</span>
            {(() => {
              const negCount = saleItems.filter((i) => !i.stock_item_id && Boolean(i.item_name?.trim())).length;
              if (negCount > 0) {
                return (
                  <span className="negative-stock-header-badge" title="Tally Negative Stock: Items not in stock inventory are tracked as Negative Stock">
                    ⚠️ {negCount} Negative Stock (-{negCount} Pc)
                  </span>
                );
              }
              return null;
            })()}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleAddSaleRow}
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
                {(isWholesale || invoiceColumns.show_fine_weight) && (
                  <th className="col-fine text-right font-bold text-gold" title="Calculated Pure Fine Weight">
                    Fine Wt (g)
                  </th>
                )}
                {!isWholesale && (
                  <th className="col-rate text-right" title="24K / Pure Metal Benchmark Rate (₹/g)">
                    Rate/g (24K ₹) <span className="req-star">*</span>
                  </th>
                )}
                {!isWholesale && (
                  <th className="col-amount text-right" title="Calculated Total Amount">
                    Amount (₹)
                  </th>
                )}
                <th className="col-action text-center">✕</th>
              </tr>
            </thead>
            <tbody>
              {saleItems.length === 0 ? (
                <tr>
                  <td colSpan={totalVisibleSaleCols} className="text-center py-4 text-muted">
                    <div className="empty-sale-items-msg">
                      <button
                        type="button"
                        className="btn btn-primary btn-xs uppercase"
                        onClick={handleAddSaleRow}
                      >
                        <Plus size={12} />
                        <span>Add Sale Item</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                saleItems.map((item, idx) => {
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
                  const wasteWeight = net.gt(0) ? net.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);
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
                    <tr key={item.id} className="pos-grid-row">
                      <td className="text-center">
                        <div className="grid-index-cell font-mono text-muted text-xs">{idx + 1}</div>
                      </td>
                      {invoiceColumns.show_tag_no && (
                        <td className="tag-input-cell">
                          <div className="tag-field-container">
                            <input
                              type="text"
                              className={`grid-input font-mono text-xs text-gold uppercase ${item.stock_item_id ? 'input-stock-linked' : ''}`}
                              value={item.tag_no ?? ''}
                              onChange={(e) => {
                                handleUpdateSaleRow(item.id, { tag_no: e.target.value });
                              }}
                              onBlur={(e) => {
                                const val = e.target.value;
                                setTimeout(() => {
                                  handleTagInputBlur(item.id, val);
                                }, 200);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleTagInputBlur(item.id, item.tag_no);
                                }
                              }}
                              placeholder="TAG NO"
                              title="Enter or scan barcode tag"
                            />
                            {item.stock_item_id ? (
                              <div
                                className="tag-stock-badge in-stock"
                                title="Linked to in-stock inventory. Stock will be marked SOLD on invoice finalization."
                              >
                                <span>✓ In-Stock</span>
                                <button
                                  type="button"
                                  className="tag-unlink-btn"
                                  title="Unlink from inventory item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnlinkStock(item.id);
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : item.tag_no?.trim() ? (
                              <div
                                className="tag-stock-badge negative-stock"
                                title="Tag not in inward stock. Billed as Negative Stock like in Tally (-1 Pc)."
                              >
                                <span>⚠️ Neg (-1 Pc)</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      )}
                      <td className="item-name-cell">
                        <div className="item-name-field-container">
                          <input
                            type="text"
                            data-row-id={item.id}
                            className={`grid-input font-semibold uppercase ${!item.item_name?.trim() ? 'input-field-required' : ''} ${item.stock_item_id ? 'input-stock-linked' : ''}`}
                            value={item.item_name ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateSaleRow(item.id, { item_name: val });
                              updateItemDropdownCoords(e.currentTarget);
                              setActiveItemDropdownRowId(item.id);
                              setHighlightedItemIndex(0);
                            }}
                            onFocus={(e) => {
                              updateItemDropdownCoords(e.currentTarget);
                              setActiveItemDropdownRowId(item.id);
                              setHighlightedItemIndex(0);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveItemDropdownRowId(null);
                              }, 180);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setActiveItemDropdownRowId(null);
                                return;
                              }

                              const q = (item.item_name || '').trim().toUpperCase();
                              const matched = stockItems.filter((s) => {
                                if (!q) return true;
                                return (
                                  (s.product_name && s.product_name.toUpperCase().includes(q)) ||
                                  (s.tag_no && s.tag_no.toUpperCase().includes(q)) ||
                                  (s.metal_name && s.metal_name.toUpperCase().includes(q)) ||
                                  (s.notes && s.notes.toUpperCase().includes(q))
                                );
                              }).slice(0, 10);

                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                if (matched.length > 0) {
                                  setHighlightedItemIndex((prev) => (prev + 1) % matched.length);
                                }
                                return;
                              }

                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (matched.length > 0) {
                                  setHighlightedItemIndex((prev) => (prev - 1 + matched.length) % matched.length);
                                }
                                return;
                              }

                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (matched.length > 0) {
                                  const selectedStock = matched[highlightedItemIndex] || matched[0];
                                  if (selectedStock) {
                                    handleSelectStockItem(item.id, selectedStock);
                                  }
                                }
                                setActiveItemDropdownRowId(null);

                                // Advance focus to next input in row
                                setTimeout(() => {
                                  const row = e.currentTarget.closest('tr');
                                  if (row) {
                                    const inputs = Array.from(
                                      row.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
                                        'input:not([disabled]):not([readonly]), select:not([disabled])'
                                      )
                                    );
                                    const next = inputs.find(
                                      (inp) =>
                                        inp !== e.currentTarget &&
                                        (inp.getAttribute('placeholder')?.includes('RATE') ||
                                          inp.getAttribute('placeholder')?.includes('MC') ||
                                          inp.getAttribute('placeholder')?.includes('RATE/G') ||
                                          inp.getAttribute('placeholder')?.includes('GROSS') ||
                                          inp.tagName === 'SELECT')
                                    );
                                    if (next) {
                                      next.focus();
                                      if ('select' in next) (next as HTMLInputElement).select();
                                    }
                                  }
                                }, 50);
                                return;
                              }

                              if (e.key === 'Tab') {
                                setActiveItemDropdownRowId(null);
                              }
                            }}
                            placeholder="ITEM NAME *"
                            title="Search & select in-stock jewellery item or enter custom name"
                            required
                          />
                          {item.stock_item_id ? (
                            <div
                              className="tag-stock-badge in-stock"
                              title="Linked to in-stock inventory item. Stock will be marked SOLD on invoice finalization."
                            >
                              <span>✓ In-Stock {item.tag_no ? `(${item.tag_no})` : ''}</span>
                              <button
                                type="button"
                                className="tag-unlink-btn"
                                title="Unlink from inventory item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlinkStock(item.id);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : item.item_name?.trim() ? (
                            <div
                              className="tag-stock-badge negative-stock"
                              title="Item is not in stock inventory. Billing as Negative Stock (-1 Pc) like in Tally."
                            >
                              <span>⚠️ Negative Stock (-1 Pc | -{Number(item.gross_weight || 0).toFixed(3)}g)</span>
                            </div>
                          ) : null}
                        </div>

                        {/* In-Stock Autocomplete Suggestions Flyout rendered as Portal so it floats outside any container boundaries */}
                        {activeItemDropdownRowId === item.id && itemDropdownCoords && createPortal(
                          <div
                            className="tag-suggestions-flyout item-flyout-portal"
                            ref={itemDropdownRef}
                            style={{
                              position: 'fixed',
                              top: `${itemDropdownCoords.top}px`,
                              left: `${itemDropdownCoords.left}px`,
                              width: `${itemDropdownCoords.width}px`,
                              zIndex: 99999,
                            }}
                          >
                            <div className="tag-flyout-header">
                              <span>📦 Available In-Stock ({stockItems.length})</span>
                              <button
                                type="button"
                                className="tag-flyout-close"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveItemDropdownRowId(null);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="tag-flyout-list">
                              {stockItems
                                .filter((s) => {
                                  const q = (item.item_name || '').trim().toUpperCase();
                                  if (!q) return true;
                                  return (
                                    (s.product_name && s.product_name.toUpperCase().includes(q)) ||
                                    (s.tag_no && s.tag_no.toUpperCase().includes(q)) ||
                                    (s.metal_name && s.metal_name.toUpperCase().includes(q)) ||
                                    (s.notes && s.notes.toUpperCase().includes(q))
                                  );
                                })
                                .slice(0, 10)
                                .map((stock, idx) => (
                                  <div
                                    key={stock.id}
                                    className={`tag-suggestion-item ${highlightedItemIndex === idx ? 'active' : ''}`}
                                    onMouseEnter={() => setHighlightedItemIndex(idx)}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectStockItem(item.id, stock);
                                      setActiveItemDropdownRowId(null);
                                    }}
                                  >
                                    <div className="stock-suggestion-info">
                                      <div className="stock-suggestion-header-line">
                                        <strong className="stock-suggestion-name">
                                          {stock.product_name || stock.notes || 'Jewellery Item'}
                                        </strong>
                                        <span className="stock-suggestion-tag font-mono">
                                          {stock.tag_no}
                                        </span>
                                      </div>
                                      <div className="stock-suggestion-details-line font-mono">
                                        <span className="stock-metal-tag font-sans font-semibold">
                                          {stock.metal_name?.toUpperCase().includes('SILVER') ? '⚪' : '🟡'} {stock.metal_name || 'Gold'} {stock.purity_name || (stock.tunch_percent ? `${stock.tunch_percent}%` : '')}
                                        </span>
                                        <span className="detail-separator">•</span>
                                        <span>Gross: <strong>{Number(stock.gross_weight).toFixed(3)}g</strong></span>
                                        <span className="detail-separator">•</span>
                                        <span className="text-emerald-600 font-bold">Net: <strong>{Number(stock.net_weight || stock.gross_weight).toFixed(3)}g</strong></span>
                                        {Boolean(stock.making_charge && stock.making_charge > 0) && (
                                          <>
                                            <span className="detail-separator">•</span>
                                            <span>MC: ₹{stock.making_charge}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <span className="stock-status-pill">
                                      ✓ IN STOCK
                                    </span>
                                  </div>
                                ))}
                              {stockItems.filter((s) => {
                                const q = (item.item_name || '').trim().toUpperCase();
                                if (!q) return true;
                                return (
                                  (s.product_name && s.product_name.toUpperCase().includes(q)) ||
                                  (s.tag_no && s.tag_no.toUpperCase().includes(q)) ||
                                  (s.metal_name && s.metal_name.toUpperCase().includes(q)) ||
                                  (s.notes && s.notes.toUpperCase().includes(q))
                                );
                              }).length === 0 && (
                                <div className="p-3 text-center text-xs text-muted">
                                  No matching in-stock items.
                                  <div className="text-[10px] mt-1 text-amber-400">
                                    Custom item will be billed as direct counter sale.
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>,
                          document.body
                        )}
                      </td>
                      <td>
                        <select
                          className={`grid-select font-mono text-xs ${!item.metal_id ? 'input-field-required' : ''}`}
                          value={item.metal_id ?? ''}
                          onChange={(e) => handleUpdateSaleRow(item.id, { metal_id: e.target.value })}
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
                            className={`grid-input text-right font-mono text-xs ${!item.tunch_percent || Number(item.tunch_percent) <= 0 ? 'input-field-required' : ''}`}
                            value={item.tunch_percent ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateSaleRow(item.id, { tunch_percent: parseDecimalInput(e.target.value, 4) })}
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
                          className={`grid-input text-right font-mono text-main font-bold ${!item.gross_weight || Number(item.gross_weight) <= 0 ? 'input-field-required' : ''}`}
                          value={item.gross_weight ?? ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateSaleRow(item.id, { gross_weight: parseDecimalInput(e.target.value, 4) })}
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
                              className={`grid-input text-right font-mono text-muted ${item.less_weight === '' || item.less_weight === null || item.less_weight === undefined ? 'input-field-required' : ''}`}
                              value={item.less_weight ?? ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleUpdateSaleRow(item.id, { less_weight: parseDecimalInput(e.target.value, 4) })}
                              placeholder="LESS (g) *"
                              title="Less Weight in grams (Stones, Wax, etc.) *"
                              required
                            />
                            <button
                              type="button"
                              className={`btn-less-calc ${item.less_breakdown && item.less_breakdown.length > 0 ? 'has-breakdown' : ''}`}
                              onClick={() => handleOpenSaleLessCalculator(item)}
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
                          <div className="grid-readonly-cell net">
                            {hasGross && item.less_weight !== '' && item.less_weight !== null && item.less_weight !== undefined ? formatWeight(net, 3) : '-'}
                          </div>
                        </td>
                      )}
                      {invoiceColumns.show_badla && (
                        <td>
                          <input
                            type="text"
                            inputMode="text"
                            className={`grid-input text-right font-mono text-xs ${item.badla_percent === '' || item.badla_percent === null || item.badla_percent === undefined ? 'input-field-required' : ''}`}
                            value={item.badla_percent ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateSaleRow(item.id, { badla_percent: parseDecimalInput(e.target.value, 2, true) })}
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
                            className={`grid-input text-right font-mono text-xs ${item.wastage_percent === '' || item.wastage_percent === null || item.wastage_percent === undefined ? 'input-field-required' : ''}`}
                            value={item.wastage_percent ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateSaleRow(item.id, { wastage_percent: parseDecimalInput(e.target.value, 2, true) })}
                            placeholder="WASTE% *"
                            title={!wastage.isZero() ? `Waste: +${formatFineWeight(wasteWeight.toNumber(), 4)}g (${formatCurrency(wasteWeight.times(rate).toNumber())})` : 'Waste % * (Manufacturing wastage)'}
                            required
                          />
                        </td>
                      )}
                      {invoiceColumns.show_making_charge && (
                        <td>
                          <div className="making-cell-wrap">
                            <div className="making-input-group">
                              <select
                                className="making-select font-mono"
                                value={item.making_charge_type}
                                onChange={(e) =>
                                  handleUpdateSaleRow(item.id, {
                                    making_charge_type: e.target.value as any,
                                  })
                                }
                                title="Making Charge Mode: /g (Per Gram), /pc (Per Piece), Fix (Fixed Lump Sum), or % (Percentage)"
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
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateSaleRow(item.id, { pieces: parseInt(e.target.value) || 1 })}
                                    placeholder="1"
                                  />
                                  <span className="making-pcs-unit">pc</span>
                                </div>
                              )}
                              <div className="making-rate-box">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className={`making-rate-input font-mono text-right ${item.making_rate === '' || item.making_rate === null || item.making_rate === undefined ? 'input-field-required' : ''}`}
                                  value={item.making_rate ?? ''}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdateSaleRow(item.id, { making_rate: parseDecimalInput(e.target.value, 2) })}
                                  placeholder={
                                    item.making_charge_type === 'PER_PIECE'
                                      ? '₹/PC *'
                                      : item.making_charge_type === 'FIXED'
                                      ? 'FIXED ₹ *'
                                      : item.making_charge_type === 'PERCENTAGE'
                                      ? '% *'
                                      : 'RATE/G *'
                                  }
                                  title={
                                    item.making_charge_type === 'PER_PIECE'
                                      ? 'Making charge rate per piece (₹/pc) *'
                                      : item.making_charge_type === 'FIXED'
                                      ? 'Fixed lump-sum making charge (₹) *'
                                      : item.making_charge_type === 'PERCENTAGE'
                                      ? 'Making charge percentage of metal value (%) *'
                                      : 'Making charge rate per gram (₹/g) *'
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
                      {(isWholesale || invoiceColumns.show_fine_weight) && (
                        <td className="text-right">
                          <div
                            className="grid-readonly-cell fine font-mono font-bold text-gold"
                            title={
                              billableFine.gt(0)
                                ? !totalAdditionPercent.isZero()
                                  ? `Pure Fine Wt: ${formatFineWeight(pureFine, 4)}g | Final Billable Wt: ${formatFineWeight(billableFine, 4)}g (Badla/Waste: ${totalAdditionPercent.gt(0) ? '+' : ''}${totalAdditionPercent.toFixed(2)}%)`
                                  : `Fine Weight: ${formatFineWeight(billableFine, 4)}g`
                                : 'Fine Weight: 0.0000g'
                            }
                          >
                            {pureFine.gt(0) ? `${formatFineWeight(billableFine, 4)}g` : '-'}
                          </div>
                        </td>
                      )}
                      {!isWholesale && (
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`grid-input text-right font-mono font-semibold text-main ${!item.rate_per_gram || Number(item.rate_per_gram) <= 0 ? 'input-field-required' : ''}`}
                            value={item.rate_per_gram ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateSaleRow(item.id, { rate_per_gram: parseDecimalInput(e.target.value, 2) })}
                            placeholder="24K RATE *"
                            title="24K / Pure Metal Base Rate (Amount calculates: Fine Weight × 24K Rate)"
                            required
                          />
                        </td>
                      )}
                      {!isWholesale && (
                        <td className="text-right">
                          <div className="grid-readonly-cell amount">
                            {rowAmount.gt(0) ? formatCurrency(rowAmount.toNumber()) : '-'}
                          </div>
                        </td>
                      )}
                      <td className="text-center">
                        <div className="grid-action-cell">
                          <button
                            type="button"
                            className="btn-copy-row"
                            onClick={() => handleCopySaleRow(item.id)}
                            title="Duplicate line"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-trash-row"
                            onClick={() => handleRemoveSaleRow(item.id)}
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
              <tr className="pos-totals-row">
                <td colSpan={saleLeadColSpan} className="font-bold text-main text-xs uppercase tracking-wider pos-totals-label-cell">
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
                {/* Badla Total Column */}
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

                {/* Waste Total Column */}
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
                {/* Labour / Making Charge Total Column */}
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
                {(isWholesale || invoiceColumns.show_fine_weight) && (
                  <td className="text-right font-mono font-bold text-gold whitespace-nowrap">
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
                {!isWholesale && <td></td>}
                {!isWholesale && (
                  <td className="text-right font-mono font-bold text-gold text-base whitespace-nowrap">
                    {formatCurrency(calculations.totalSaleAmount)}
                  </td>
                )}
                <td></td>
              </tr>
              {calculations.metalBreakdowns.length > 1 && (
                <tr className="pos-totals-multi-breakdown-row">
                  <td colSpan={totalVisibleSaleCols}>
                    <div className="multi-metal-footer-bar">
                      <span className="bar-title">Separate Metal Totals:</span>
                      {calculations.metalBreakdowns.map((mb) => {
                        const isGold = mb.metalName.toLowerCase().includes('gold');
                        const isSilver = mb.metalName.toLowerCase().includes('silver');
                        return (
                          <div
                            key={mb.metalName}
                            className={`metal-footer-chip ${isGold ? 'gold' : isSilver ? 'silver' : 'other'}`}
                          >
                            <span className="chip-metal-name">
                              {isGold ? '🟡' : isSilver ? '⚪' : '💎'} {mb.metalName} ({mb.itemCount} {mb.itemCount === 1 ? 'item' : 'items'}):
                            </span>
                            <span className="chip-metric">Gross: <strong>{formatWeight(mb.grossWeight, 3)}g</strong></span>
                            <span className="chip-metric">Less: <strong>{formatWeight(mb.lessWeight, 3)}g</strong></span>
                            <span className="chip-metric highlight-net">Net Wt: <strong>{formatWeight(mb.netWeight, 3)}g</strong></span>
                            {mb.badlaWeight !== 0 && (
                              <span className="chip-metric">Badla: <strong>{formatWeight(mb.badlaWeight, 3)}g</strong></span>
                            )}
                            {mb.wasteWeight !== 0 && (
                              <span className="chip-metric">Waste: <strong>{formatWeight(mb.wasteWeight, 3)}g</strong></span>
                            )}
                            <span className="chip-metric highlight-fine">Fine Wt: <strong>{formatFineWeight(mb.billableFineWeight, 4)}g</strong></span>
                            <span className="chip-metric highlight-amt">Amount: <strong>{formatCurrency(mb.saleAmount)}</strong></span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 2: EXCHANGE / OLD METAL RETURN */}
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
            <p className="no-exchange-title">No old metal exchange items linked to this invoice.</p>
            <p className="no-exchange-hint">Record customer scrap or old gold purity & valuation to deduct from invoice</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAddExchangeRow}
            >
              <Coins size={14} />
              <span>Add Customer Scrap / Old Gold</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="pos-grid-table">
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
                  {invoiceColumns.show_making_charge && <th className="col-making text-center" title="Making / Melting / Deduction Charge">Deduction</th>}
                  {invoiceColumns.show_fine_weight && <th className="col-fine text-right">Fine Wt</th>}
                  <th className="col-rate text-right" title="24K / Pure Metal Benchmark Rate (₹/g)">Rate/g (24K ₹) <span className="req-star">*</span></th>
                  <th className="col-amount text-right" title="Calculated Total Exchange Amount">Amount (₹)</th>
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
                  const wasteWeight = net.gt(0) ? net.times(wastage).dividedBy(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);
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
                      {invoiceColumns.show_tag_no && (
                        <td>
                          <input
                            type="text"
                            className="grid-input font-mono text-xs text-gold uppercase"
                            value={ex.tag_no}
                            onChange={(e) => handleUpdateExchangeRow(ex.id, { tag_no: e.target.value })}
                            placeholder="EX-TAG"
                          />
                        </td>
                      )}
                      <td>
                        <input
                          type="text"
                          className={`grid-input uppercase font-semibold ${!ex.item_name?.trim() ? 'input-field-required' : ''}`}
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
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              handleUpdateExchangeRow(ex.id, { tunch_percent: parseDecimalInput(e.target.value, 4) })
                            }
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
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            handleUpdateExchangeRow(ex.id, { gross_weight: parseDecimalInput(e.target.value, 4) })
                          }
                          placeholder="GROSS (g) *"
                        />
                      </td>
                      {invoiceColumns.show_less_weight && (
                        <td>
                          <div className="less-cell-wrap">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`grid-input text-right font-mono text-muted ${ex.less_weight === '' || ex.less_weight === null || ex.less_weight === undefined ? 'input-field-required' : ''}`}
                              value={ex.less_weight ?? ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleUpdateExchangeRow(ex.id, { less_weight: parseDecimalInput(e.target.value, 4) })
                              }
                              placeholder="LESS (g) *"
                              title="Less Weight in grams *"
                            />
                            <button
                              type="button"
                              className={`btn-less-calc ${ex.less_breakdown && ex.less_breakdown.length > 0 ? 'has-breakdown' : ''}`}
                              onClick={() => handleOpenExchangeLessCalculator(ex)}
                              title={
                                ex.less_breakdown && ex.less_breakdown.length > 0
                                  ? `Less Breakdown (${ex.less_breakdown.length} entries: ${formatWeight(ex.less_weight, 3)}g)`
                                  : 'Open Less Weight Breakdown Calculator'
                              }
                            >
                              <Calculator size={12} />
                            </button>
                          </div>
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
                            className="grid-input text-right font-mono text-xs"
                            value={ex.badla_percent ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateExchangeRow(ex.id, { badla_percent: parseDecimalInput(e.target.value, 2, true) })}
                            placeholder="BADLA% *"
                            title={!badla.isZero() ? `Badla: ${badlaWeight.gt(0) ? '+' : ''}${formatFineWeight(badlaWeight.toNumber(), 4)}g (${formatCurrency(badlaWeight.times(rate).toNumber())})` : 'Badla % (Commercial margin/discount)'}
                          />
                        </td>
                      )}
                      {invoiceColumns.show_wastage && (
                        <td>
                          <input
                            type="text"
                            inputMode="text"
                            className="grid-input text-right font-mono text-xs"
                            value={ex.wastage_percent ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleUpdateExchangeRow(ex.id, { wastage_percent: parseDecimalInput(e.target.value, 2, true) })}
                            placeholder="WASTE% *"
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
                                    onFocus={(e) => e.target.select()}
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
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseDecimalInput(e.target.value, 2);
                                    handleUpdateExchangeRow(ex.id, {
                                      making_rate: val,
                                      deduction_percent: chargeType === 'PERCENTAGE' ? val : ex.deduction_percent,
                                    });
                                  }}
                                  placeholder={
                                    chargeType === 'PER_PIECE'
                                      ? '₹/PC *'
                                      : chargeType === 'FIXED'
                                      ? 'FIXED ₹ *'
                                      : chargeType === 'PERCENTAGE'
                                      ? '% *'
                                      : 'RATE/G *'
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
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            handleUpdateExchangeRow(ex.id, { exchange_rate: parseDecimalInput(e.target.value, 2) })
                          }
                          placeholder="24K RATE *"
                          title="24K / Pure Metal Base Rate (Amount calculates: Fine Weight × 24K Rate)"
                          required
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
                <tr className="pos-totals-row exchange-totals">
                  <td colSpan={exchLeadColSpan} className="font-bold text-main text-xs uppercase tracking-wider whitespace-nowrap pos-totals-label-cell">
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
                  {/* Badla Total Column */}
                  {invoiceColumns.show_badla && (
                    <td className="text-right font-mono font-bold text-main whitespace-nowrap">
                      {calculations.exchangeMetalBreakdowns.length === 0 ? (
                        <span>0.000g</span>
                      ) : (
                        <div className="metal-split-weights">
                          {calculations.exchangeMetalBreakdowns.map((mb) => {
                            const isGold = mb.metalName.toLowerCase().includes('gold');
                            const isSilver = mb.metalName.toLowerCase().includes('silver');
                            return (
                              <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Badla: ${formatWeight(mb.badlaWeight, 3)}g (${formatCurrency(mb.badlaAmount)})`}>
                                <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                  {mb.metalName.slice(0, 3)}:
                                </span>
                                <span>{formatWeight(mb.badlaWeight, 3)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  )}
                  {/* Waste Total Column */}
                  {invoiceColumns.show_wastage && (
                    <td className="text-right font-mono font-bold text-main whitespace-nowrap">
                      {calculations.exchangeMetalBreakdowns.length === 0 ? (
                        <span>0.000g</span>
                      ) : (
                        <div className="metal-split-weights">
                          {calculations.exchangeMetalBreakdowns.map((mb) => {
                            const isGold = mb.metalName.toLowerCase().includes('gold');
                            const isSilver = mb.metalName.toLowerCase().includes('silver');
                            return (
                              <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Waste: ${formatWeight(mb.wasteWeight, 3)}g (${formatCurrency(mb.wasteAmount)})`}>
                                <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                  {mb.metalName.slice(0, 3)}:
                                </span>
                                <span>{formatWeight(mb.wasteWeight, 3)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  )}
                  {/* Deduction Column */}
                  {invoiceColumns.show_making_charge && (
                    <td className="text-right font-mono text-xs text-muted whitespace-nowrap">
                      {calculations.exchangeMetalBreakdowns.length === 0 ? (
                        <span>Deduct: ₹0.00</span>
                      ) : (
                        <div className="metal-split-weights">
                          {calculations.exchangeMetalBreakdowns.map((mb) => {
                            const isGold = mb.metalName.toLowerCase().includes('gold');
                            const isSilver = mb.metalName.toLowerCase().includes('silver');
                            return (
                              <div key={mb.metalName} className="metal-split-line" title={`${mb.metalName} Deduction: −${formatCurrency(mb.deductionAmount)}`}>
                                <span className={`metal-tag-mini ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : 'text-muted'}`}>
                                  {mb.metalName.slice(0, 3)}:
                                </span>
                                <span>−{formatCurrency(mb.deductionAmount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  )}
                  {/* Fine Wt Column */}
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
                {calculations.exchangeMetalBreakdowns.length > 1 && (
                  <tr className="pos-totals-multi-breakdown-row exchange-breakdown-row">
                    <td colSpan={totalVisibleExchCols}>
                      <div className="multi-metal-footer-bar">
                        <span className="bar-title text-emerald-400">Separate Exchange Metal Totals:</span>
                        {calculations.exchangeMetalBreakdowns.map((mb) => {
                          const isGold = mb.metalName.toLowerCase().includes('gold');
                          const isSilver = mb.metalName.toLowerCase().includes('silver');
                          return (
                            <div
                              key={mb.metalName}
                              className={`metal-footer-chip ${isGold ? 'gold' : isSilver ? 'silver' : 'other'}`}
                            >
                              <span className="chip-metal-name">
                                {isGold ? '🟡' : isSilver ? '⚪' : '💎'} {mb.metalName} ({mb.itemCount} {mb.itemCount === 1 ? 'item' : 'items'}):
                              </span>
                              <span className="chip-metric">Gross: <strong>{formatWeight(mb.grossWeight, 3)}g</strong></span>
                              <span className="chip-metric">Less: <strong>{formatWeight(mb.lessWeight, 3)}g</strong></span>
                              <span className="chip-metric highlight-net">Net Wt: <strong>{formatWeight(mb.netWeight, 3)}g</strong></span>
                              <span className="chip-metric highlight-fine">Fine Wt: <strong>{formatFineWeight(mb.billableFineWeight, 4)}g</strong></span>
                              <span className="chip-metric highlight-amt">Value: <strong>−{formatCurrency(mb.exchangeValue)}</strong></span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* LOWER SECTION: PAYMENT RECEIVED & SUMMARY BALANCE */}
      <div className="pos-lower-grid mt-4">
        {/* LEFT COLUMN: Payment Tender Breakdown */}
        <div className="pos-payment-column">
          <div className="pos-section-card h-full">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <CreditCard size={17} className="gold" />
                <h2 className="section-title">
                  {calculations.netPayable < 0 ? 'Payment Outward / Refund Payout' : 'Payment Mode'}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => handleAddPaymentRowWithMode('CASH')}
                  title="Add Cash Payment Row"
                >
                  <Plus size={12} />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => handleAddPaymentRowWithMode('BANK')}
                  title="Add Bank Payment Row"
                >
                  <Plus size={12} />
                  <span>Bank</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-xs text-gold"
                  title="Add Gold Payment Row"
                  onClick={() => handleAddMetalPaymentRow('GOLD')}
                >
                  <Plus size={12} />
                  <span>Gold</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-xs text-slate-300"
                  title="Add Silver Payment Row"
                  onClick={() => handleAddMetalPaymentRow('SILVER')}
                >
                  <Plus size={12} />
                  <span>Silver</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddPaymentRow}
                  title="Add Another Payment Row"
                >
                  <Plus size={13} />
                  <span>Add Tender</span>
                </button>
              </div>
            </div>

            <div className="quick-tender-bar">
              <span className="text-xs text-muted mr-1">
                {calculations.netPayable < 0 ? 'Quick Payout:' : 'Quick Settle:'}
              </span>
              <button
                type="button"
                className="btn-quick-tender cash"
                onClick={() => handleQuickSettle('CASH')}
              >
                {calculations.netPayable < 0
                  ? `Pay Cash (₹${Math.abs(calculations.netPayable).toLocaleString('en-IN')})`
                  : `Cash Full (₹${calculations.netPayable.toLocaleString('en-IN')})`}
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
                className="btn-quick-tender bank"
                onClick={() => handleQuickSettle('BANK')}
              >
                Bank Full
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
              <datalist id="indian-banks-list">
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

                const isViaSelf = !p.payer_type || p.payer_type === 'CUSTOMER' || p.payer_type === 'SELF';
                const isViaCr = p.payer_type === 'SUPPLIER' || p.payer_type === 'CR_PARTY';
                const isViaDr = p.payer_type === 'ANOTHER_CUSTOMER' || p.payer_type === 'EXISTING_PARTY' || p.payer_type === 'DR_PARTY';

                const availablePurities = purities.filter((pur) => pur.metal_id === p.metal_id);
                const selectedCust = customers.find((c) => c.id === customerId);
                const currentCustomerName = selectedCust ? selectedCust.name : 'CASH CUSTOMER';

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
                            title="Paid via Debtor / Another Customer"
                          >
                            Dr Party
                          </button>
                          <button
                            type="button"
                            className={`segment-btn ${isViaSelf ? 'active' : ''}`}
                            onClick={() => handleSetPaymentVia(p.id, 'SELF')}
                            title="Direct payment from customer on the bill"
                          >
                            Self
                          </button>
                        </div>
                      </div>

                      {/* Mode Selector: Cash / Bank / Gold / Silver */}
                      <div className="payment-control-group">
                        <span className="control-label">Mode:</span>
                        <div className="segmented-toggle">
                          <button
                            type="button"
                            className={`segment-btn ${isCash ? 'active' : ''}`}
                            onClick={() => handleSetPaymentMode(p.id, 'CASH')}
                          >
                            Cash
                          </button>
                          <button
                            type="button"
                            className={`segment-btn ${isBank ? 'active' : ''}`}
                            onClick={() => handleSetPaymentMode(p.id, 'BANK')}
                          >
                            Bank
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
                            title="Customer Udhaar / Baaki Ledger"
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
                        <label className="subrow-label">Select Dr Party (Debtor / Another Customer) *</label>
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
                        <span className="self-tag">Payer:</span>
                        <span className="self-name">{currentCustomerName} (Bill Customer)</span>
                      </div>
                    )}

                    {/* Input Fields Row */}
                    <div className={`payment-fields-row ${isMetal ? (isWholesale ? 'is-metal-fields is-wholesale-metal' : 'is-metal-fields') : ''}`}>
                      {isMetal ? (
                        <>
                          {/* 1. Metal: Gold / Silver */}
                          <div className="field-block metal-select-block">
                            <label className="field-title">Metal *</label>
                            <div className="segmented-toggle metal-type-segmented">
                              <button
                                type="button"
                                className={`segment-btn metal-gold-btn ${isGold ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'GOLD')}
                              >
                                🟡 Gold
                              </button>
                              <button
                                type="button"
                                className={`segment-btn metal-silver-btn ${isSilver ? 'active' : ''}`}
                                onClick={() => handleSetPaymentMode(p.id, 'SILVER')}
                              >
                                ⚪ Silver
                              </button>
                            </div>
                          </div>

                          {/* 2. Purity: Dropdown (Placed next to Metal in Wholesale) */}
                          {isWholesale && (
                            <div className="field-block purity-block">
                              <label className="field-title">Purity *</label>
                              <select
                                className="styled-input font-mono text-xs"
                                value={p.purity_id || ''}
                                onChange={(e) => handlePaymentPurityChange(p.id, e.target.value)}
                                title="Select Purity for Metal Rate"
                              >
                                {availablePurities.map((pur) => (
                                  <option key={pur.id} value={pur.id}>
                                    {pur.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Rate (₹/g) - Only for Retail */}
                          {!isWholesale && (
                            <div className="field-block rate-block">
                              <label className="field-title">Rate (₹/g)</label>
                              <div className="input-group-styled">
                                <span className="unit-label-prefix">₹</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="styled-input font-mono font-bold"
                                  value={p.metal_rate !== undefined ? p.metal_rate : ''}
                                  onChange={(e) => handleMetalRateChange(p.id, e.target.value)}
                                  placeholder="Rate/g"
                                />
                              </div>
                            </div>
                          )}

                          {/* 3. Weight: Weight (g) with Auto mode toggle underneath */}
                          <div className="field-block weight-block">
                            <div className="field-header">
                              <label className="field-title">{isWholesale ? 'Tender Wt (g) *' : 'Weight (g) *'}</label>
                              {p.fine_weight && Number(p.fine_weight) > 0 && (
                                <span className="weight-fine-badge font-mono" title="Calculated Fine Weight">
                                  Fine: {formatFineWeight(p.fine_weight, 4)}g
                                </span>
                              )}
                            </div>
                            <div className="input-group-styled">
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`styled-input font-mono font-bold ${isGold ? 'text-amber-400' : 'text-slate-200'}`}
                                value={p.metal_weight !== undefined ? p.metal_weight : ''}
                                onChange={(e) => {
                                  handleUpdatePaymentRow(p.id, { is_auto: false });
                                  handleMetalWeightChange(p.id, e.target.value);
                                }}
                                placeholder="0.000"
                              />
                              <span className="unit-label">g</span>
                            </div>

                            {/* Auto mode indicator & toggle directly below Weight */}
                            <div className="auto-mode-toggle-subrow mt-1">
                              <button
                                type="button"
                                className={`auto-mode-pill-btn ${isGold ? 'gold-auto' : 'silver-auto'} ${p.is_auto ? 'active' : ''}`}
                                onClick={() => handleToggleAutoMode(p.id, isGold ? 'GOLD' : 'SILVER')}
                                title="Click to toggle Auto mode linked to Balance Fine"
                              >
                                <span className="auto-dot-icon">{isGold ? '🟢' : '🔴'}</span>
                                <span className="auto-label-text">
                                  {p.is_auto ? 'Auto Selected' : 'Auto Mode'}
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* Amount (₹) - Only for Retail */}
                          {!isWholesale && (
                            <div className="field-block amount-block">
                              <label className="field-title">Amount (₹)</label>
                              <div className="input-group-styled">
                                <span className="unit-label-prefix">₹</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="styled-input font-mono font-bold text-emerald-400"
                                  value={p.amount !== undefined ? p.amount : ''}
                                  onChange={(e) => {
                                    handleUpdatePaymentRow(p.id, { is_auto: false });
                                    handlePaymentAmountChange(p.id, e.target.value);
                                  }}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          )}

                          {/* Purity: Dropdown - For Retail at the end */}
                          {!isWholesale && (
                            <div className="field-block purity-block">
                              <label className="field-title">Purity *</label>
                              <select
                                className="styled-input font-mono text-xs"
                                value={p.purity_id || ''}
                                onChange={(e) => handlePaymentPurityChange(p.id, e.target.value)}
                                title="Select Purity for Metal Rate"
                              >
                                {availablePurities.map((pur) => (
                                  <option key={pur.id} value={pur.id}>
                                    {pur.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* BANK Input (Shown if mode is BANK) */}
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
                                    <option value="">-- Choose Bank Account --</option>
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
                                    list="indian-banks-list"
                                    className="styled-input font-mono"
                                    placeholder="e.g. State Bank of India"
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

                          {/* AMOUNT Input (Shown for non-metal) */}
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

                          {/* NOTE Input */}
                          <div className="field-block note-block flex-grow">
                            <label className="field-title">Note</label>
                            <div className="input-group-styled">
                              <input
                                type="text"
                                className="styled-input"
                                value={p.notes || ''}
                                onChange={(e) => handleUpdatePaymentRow(p.id, { notes: e.target.value })}
                                placeholder={
                                  isBank
                                    ? 'UTR / Transfer Ref / Cheque No'
                                    : isCredit
                                    ? 'Customer running ledger balance baaki'
                                    : 'Payment note (optional)'
                                }
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 6. Note row for Metal payment (clean full-width underneath 5 metal columns) */}
                    {isMetal && (
                      <div className="payment-metal-note-row mt-2">
                        <div className="field-block note-block w-full">
                          <label className="field-title">Note / Bullion Memo</label>
                          <div className="input-group-styled">
                            <input
                              type="text"
                              className="styled-input font-mono text-xs"
                              value={p.notes || p.reference_number || ''}
                              onChange={(e) =>
                                handleUpdatePaymentRow(p.id, {
                                  notes: e.target.value,
                                  reference_number: e.target.value,
                                })
                              }
                              placeholder="Tender remarks / Bullion Bar No / Purity memo..."
                            />
                          </div>
                        </div>
                      </div>
                    )}

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

            {/* Notes Textarea */}
            <div className="invoice-notes-box mt-4">
              <label className="text-xs text-muted block mb-1">Invoice Notes / Terms</label>
              <textarea
                className="pos-textarea font-mono text-xs"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Subject to local jurisdiction. Hallmarked 916 gold sale..."
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Summary & Balance */}
        <div className="pos-summary-column">
          <div className="pos-section-card summary-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <Calculator size={17} className="gold" />
                <h2 className="section-title">Summary & Balance</h2>
              </div>
            </div>

            {/* NET METAL & RETURN BALANCE TALLY (FINE & VALUE BALANCE) */}
            <div className="summary-metal-tally-card">
              <div className="tally-card-header">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Scale size={13} className="text-gold shrink-0" />
                  <span className="tally-card-title text-xs font-bold uppercase tracking-wider text-muted truncate">
                    Net Metal & Return Balance
                  </span>
                </div>
                <span className="tally-card-badge text-3xs text-gold uppercase font-semibold shrink-0">
                  Fine & Value
                </span>
              </div>

              <div className="tally-cards-container">
                {/* 🟡 GOLD TALLY */}
                <div className="tally-metal-block gold-tally">
                  <div className="tally-header-row flex items-center justify-between">
                    <span className="tally-metal-title font-bold text-xs text-amber-300">
                      🟡 Gold Balance
                    </span>
                    <button
                      type="button"
                      className={`tally-auto-btn gold-auto-btn ${
                        payments.some((p) => p.payment_mode === 'GOLD' && p.is_auto) ? 'is-active' : ''
                      }`}
                      onClick={() => handleApplyAutoFromSummary('GOLD')}
                      title="Click to toggle Auto mode for Gold payment (auto-binds Bal Fine & Bal Amt)"
                    >
                      <span className="dot">🟢</span>
                      <span>
                        {payments.some((p) => p.payment_mode === 'GOLD' && p.is_auto)
                          ? 'Auto Selected'
                          : 'Auto'}
                      </span>
                      <span className="val-preview font-mono">{formatFineWeight(calculations.goldBalFine, 3)}g</span>
                    </button>
                  </div>

                  <div className="tally-equation-grid font-mono text-xs">
                    <div className="equation-line">
                      <span className="eq-label text-muted">Fine Wt:</span>
                      <span className="eq-formula">
                        <span className="val-sold" title="Fine Gold Sold">{formatFineWeight(calculations.goldFineWeight, 4)}g</span>
                        <span className="op">−</span>
                        <span className="val-ret text-rose-300" title="Return Exchange Fine Gold">{formatFineWeight(calculations.goldExchangeFineWeight, 4)}g</span>
                        <span className="op">=</span>
                        <strong className="val-bal text-amber-300" title="Balance Gold Fine">{formatFineWeight(calculations.goldBalFine, 4)}g</strong>
                      </span>
                    </div>
                    {!isWholesale && (
                      <div className="equation-line">
                        <span className="eq-label text-muted">Amount:</span>
                        <span className="eq-formula">
                          <span className="val-sold" title="Sale Gold Amount">{formatCurrency(calculations.goldSaleAmount)}</span>
                          <span className="op">−</span>
                          <span className="val-ret text-rose-300" title="Return Exchange Gold Amount">{formatCurrency(calculations.goldExchangeAmount)}</span>
                          <span className="op">=</span>
                          <strong className="val-bal text-emerald-400" title="Balance Gold Amount">{formatCurrency(calculations.goldBalAmount)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ⚪ SILVER TALLY */}
                <div className="tally-metal-block silver-tally mt-2">
                  <div className="tally-header-row flex items-center justify-between">
                    <span className="tally-metal-title font-bold text-xs text-slate-200">
                      ⚪ Silver Balance
                    </span>
                    <button
                      type="button"
                      className={`tally-auto-btn silver-auto-btn ${
                        payments.some((p) => p.payment_mode === 'SILVER' && p.is_auto) ? 'is-active' : ''
                      }`}
                      onClick={() => handleApplyAutoFromSummary('SILVER')}
                      title="Click to toggle Auto mode for Silver payment (auto-binds Bal Fine & Bal Amt)"
                    >
                      <span className="dot">🔴</span>
                      <span>
                        {payments.some((p) => p.payment_mode === 'SILVER' && p.is_auto)
                          ? 'Auto Selected'
                          : 'Auto'}
                      </span>
                      <span className="val-preview font-mono">{formatFineWeight(calculations.silverBalFine, 3)}g</span>
                    </button>
                  </div>

                  <div className="tally-equation-grid font-mono text-xs">
                    <div className="equation-line">
                      <span className="eq-label text-muted">Fine Wt:</span>
                      <span className="eq-formula">
                        <span className="val-sold" title="Fine Silver Sold">{formatFineWeight(calculations.silverFineWeight, 4)}g</span>
                        <span className="op">−</span>
                        <span className="val-ret text-rose-300" title="Return Exchange Fine Silver">{formatFineWeight(calculations.silverExchangeFineWeight, 4)}g</span>
                        <span className="op">=</span>
                        <strong className="val-bal text-slate-200" title="Balance Silver Fine">{formatFineWeight(calculations.silverBalFine, 4)}g</strong>
                      </span>
                    </div>
                    {!isWholesale && (
                      <div className="equation-line">
                        <span className="eq-label text-muted">Amount:</span>
                        <span className="eq-formula">
                          <span className="val-sold" title="Sale Silver Amount">{formatCurrency(calculations.silverSaleAmount)}</span>
                          <span className="op">−</span>
                          <span className="val-ret text-rose-300" title="Return Exchange Silver Amount">{formatCurrency(calculations.silverExchangeAmount)}</span>
                          <span className="op">=</span>
                          <strong className="val-bal text-emerald-400" title="Balance Silver Amount">{formatCurrency(calculations.silverBalAmount)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isWholesale ? (
              <div className="wholesale-summary-box p-3">
                <div className="wholesale-badge-banner mb-3 pb-2 border-b border-border/40">
                  <div className="flex items-center gap-1.5 text-gold font-bold text-xs uppercase tracking-wide">
                    <Sparkles size={14} />
                    <span>Wholesale Fine to Fine (सोन से सोना)</span>
                  </div>
                  <div className="text-3xs text-muted mt-0.5">
                    Pure fine metal weight settlement • No rate & currency amount
                  </div>
                </div>

                {/* Pure Gold Balance Section */}
                <div className="wholesale-metal-balance-card gold-card mb-3 p-2.5 rounded bg-surface/80 border border-gold/30">
                  <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-border/40">
                    <span className="font-bold text-xs text-gold">🟡 Pure Fine Gold (24K)</span>
                    <span className={`font-mono font-bold text-xs ${calculations.goldWholesaleBal <= 0.0005 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {calculations.goldWholesaleBal <= 0.0005 ? 'SETTLED ✓' : `${formatFineWeight(calculations.goldWholesaleBal, 4)}g BAAKI`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5 text-muted">
                    <span>Sale Billable Fine:</span>
                    <span className="font-mono font-bold text-gold">+{formatFineWeight(calculations.goldAdjustedFineWeight, 4)} g</span>
                  </div>
                  {calculations.goldExchangeFineWeight > 0 && (
                    <div className="flex justify-between text-xs py-0.5 text-rose-400">
                      <span>Inward Return Fine:</span>
                      <span className="font-mono">−{formatFineWeight(calculations.goldExchangeFineWeight, 4)} g</span>
                    </div>
                  )}
                  {calculations.goldPaymentFineGrams > 0 && (
                    <div className="flex justify-between text-xs py-0.5 text-emerald-400">
                      <span>Gold Tender Received:</span>
                      <span className="font-mono">−{formatFineWeight(calculations.goldPaymentFineGrams, 4)} g</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-dashed border-border/50">
                    <span className="font-bold text-xs">Remaining Gold Fine:</span>
                    <span className={`font-mono font-bold text-sm ${calculations.goldWholesaleBal <= 0.0005 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {calculations.goldWholesaleBal <= 0.0005 ? '0.0000 g' : `${formatFineWeight(calculations.goldWholesaleBal, 4)} g`}
                    </span>
                  </div>
                </div>

                {/* Pure Silver Balance Section */}
                <div className="wholesale-metal-balance-card silver-card mb-3 p-2.5 rounded bg-surface/80 border border-slate-400/30">
                  <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-border/40">
                    <span className="font-bold text-xs text-slate-300">⚪ Pure Fine Silver</span>
                    <span className={`font-mono font-bold text-xs ${calculations.silverWholesaleBal <= 0.0005 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {calculations.silverWholesaleBal <= 0.0005 ? 'SETTLED ✓' : `${formatFineWeight(calculations.silverWholesaleBal, 4)}g BAAKI`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5 text-muted">
                    <span>Sale Billable Fine:</span>
                    <span className="font-mono font-bold text-slate-200">+{formatFineWeight(calculations.silverAdjustedFineWeight, 4)} g</span>
                  </div>
                  {calculations.silverExchangeFineWeight > 0 && (
                    <div className="flex justify-between text-xs py-0.5 text-rose-400">
                      <span>Inward Return Fine:</span>
                      <span className="font-mono">−{formatFineWeight(calculations.silverExchangeFineWeight, 4)} g</span>
                    </div>
                  )}
                  {calculations.silverPaymentFineGrams > 0 && (
                    <div className="flex justify-between text-xs py-0.5 text-emerald-400">
                      <span>Silver Tender Received:</span>
                      <span className="font-mono">−{formatFineWeight(calculations.silverPaymentFineGrams, 4)} g</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-dashed border-border/50">
                    <span className="font-bold text-xs">Remaining Silver Fine:</span>
                    <span className={`font-mono font-bold text-sm ${calculations.silverWholesaleBal <= 0.0005 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {calculations.silverWholesaleBal <= 0.0005 ? '0.0000 g' : `${formatFineWeight(calculations.silverWholesaleBal, 4)} g`}
                    </span>
                  </div>
                </div>

                <div className="balance-status-badge mt-2">
                  {calculations.wholesaleIsSettled ? (
                    <div className="settled-pill">
                      <Check size={14} />
                      <span>Settled ✓ (Fine to Fine)</span>
                    </div>
                  ) : (
                    <div className="pending-pill">
                      <AlertCircle size={14} />
                      <span>Pending Metal {calculations.goldWholesaleBal > 0.0005 ? `${formatFineWeight(calculations.goldWholesaleBal, 3)}g Gold` : ''} Baaki</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (

            <div className="summary-breakdown-list">
              <div className="summary-line">
                <span className="summary-label">Sale Total</span>
                <span className="summary-value font-mono">
                  {formatCurrency(calculations.totalSaleAmount)}
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
                    {gstRate !== 3.0 && gstRate !== 0.0 && gstRate !== 5.0 && gstRate !== 18.0 && gstRate !== 12.0 && gstRate !== 28.0 && (
                      <option value={gstRate}>{gstRate.toFixed(1)}% (Configured)</option>
                    )}
                    <option value={3.0}>3.0% (Gold / Silver Jewellery)</option>
                    <option value={5.0}>5.0% (Making / Precious Stones)</option>
                    <option value={12.0}>12.0% (Articles / Bullion)</option>
                    <option value={18.0}>18.0% (Job Work / Standard Goods)</option>
                    <option value={28.0}>28.0% (High Tax / Luxury)</option>
                    <option value={0.0}>0% (Exempted / Non-GST)</option>
                  </select>
                </div>
                <span className="summary-value font-mono text-amber-300">
                  {formatCurrency(calculations.gstAmount)}
                </span>
              </div>

              {gstRate > 0 && (
                <div className="summary-line sub-gst text-xs text-muted">
                  {calculations.isInterState ? (
                    <>
                      <span>IGST ({gstRate.toFixed(1)}%) • Inter-State</span>
                      <span className="font-mono text-amber-300">
                        {formatCurrency(calculations.igst)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>CGST ({(gstRate / 2).toFixed(1)}%) + SGST ({(gstRate / 2).toFixed(1)}%)</span>
                      <span className="font-mono">
                        {formatCurrency(calculations.cgst)} + {formatCurrency(calculations.sgst)}
                      </span>
                    </>
                  )}
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
                    {calculations.netPayable < 0 ? 'Net Payable (To Customer • Purchase)' : 'Net Payable'}
                  </span>
                  {calculations.netPayable < 0 && (
                    <span className="text-3xs text-amber-300 font-semibold tracking-wide uppercase mt-0.5">
                      ↳ Shop owes customer (Old Metal Inward Purchase)
                    </span>
                  )}
                </div>
                <span className={`grand-value font-mono ${calculations.netPayable < 0 ? 'text-amber-400' : ''}`}>
                  {formatCurrency(calculations.netPayable)}
                </span>
              </div>

              {/* Breakdown of Payments Received / Outward */}
              <div className="summary-line mt-3">
                <span className="summary-label text-emerald-400 font-semibold">
                  {calculations.netPayable < 0 ? 'Total Paid to Customer' : 'Total Received'}
                </span>
                <span className="summary-value font-mono font-bold text-emerald-400">
                  {formatCurrency(calculations.totalReceived)}
                </span>
              </div>

              {calculations.goldPaymentValue > 0 && (
                <div className="summary-line sub-gst text-xs text-gold">
                  <span>
                    ↳ Gold Payment ({formatWeight(calculations.goldPaymentGrams, 3)}g
                    {calculations.goldPaymentFineGrams > 0 ? ` • Fine: ${formatWeight(calculations.goldPaymentFineGrams, 3)}g` : ''}):
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(calculations.goldPaymentValue)}</span>
                </div>
              )}

              {calculations.silverPaymentValue > 0 && (
                <div className="summary-line sub-gst text-xs text-slate-300">
                  <span>
                    ↳ Silver Payment ({formatWeight(calculations.silverPaymentGrams, 3)}g
                    {calculations.silverPaymentFineGrams > 0 ? ` • Fine: ${formatWeight(calculations.silverPaymentFineGrams, 3)}g` : ''}):
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(calculations.silverPaymentValue)}</span>
                </div>
              )}

              {calculations.cashAndOtherPayments > 0 && (calculations.goldPaymentValue > 0 || calculations.silverPaymentValue > 0) && (
                <div className="summary-line sub-gst text-xs text-muted">
                  <span>↳ Cash & Other Payments:</span>
                  <span className="font-mono">{formatCurrency(calculations.cashAndOtherPayments)}</span>
                </div>
              )}

              {calculations.netPayable < 0 ? (
                <div className="summary-line">
                  <span className="summary-label font-bold text-amber-300">Remaining Payable to Customer</span>
                  <span className="summary-value font-mono font-bold text-base text-amber-400">
                    {formatCurrency(calculations.payableToCustomer)}
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

              {calculations.changeDue > 0 && !calculations.isPayableToCustomer && (
                <div className="summary-line text-emerald-300 font-semibold">
                  <span className="summary-label">Change Due (Excess)</span>
                  <span className="summary-value font-mono font-bold">
                    {formatCurrency(calculations.changeDue)}
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
                    <span>Payable to Customer {formatCurrency(calculations.payableToCustomer)}</span>
                  </div>
                ) : calculations.netPayable > 0 ? (
                  <div className="pending-pill">
                    <AlertCircle size={14} />
                    <span>Pending {formatCurrency(calculations.balanceDue)}</span>
                  </div>
                ) : (
                  <div className="new-pill text-xs text-muted">
                    <span>New Bill</span>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Main Submit Button */}
            <div className="summary-actions mt-4">
              <button
                type="button"
                className="btn btn-primary w-full btn-lg font-bold"
                onClick={() => handleSaveInvoice(true)}
                disabled={isSubmitting}
              >
                <Save size={18} />
                <span>
                  {isSubmitting
                    ? 'Saving Bill...'
                    : isWholesale
                    ? 'Save & Finalize Wholesale Bill (Fine to Fine)'
                    : calculations.grandTotal > 0
                    ? `Save & Finalize Bill (${formatCurrency(calculations.grandTotal)})`
                    : calculations.totalExchangeValue > 0
                    ? `Save & Finalize Exchange Purchase (${formatCurrency(calculations.totalExchangeValue)})`
                    : 'Save & Finalize Bill'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK CREATE CUSTOMER MASTER MODAL */}
      {showCustomerModal && (
        <div className="modal-backdrop customer-modal-backdrop">
          <div className="modal-dialog customer-modal-dialog customer-modal-dialog-wide">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="modal-header-icon-box">
                  <UserPlus size={18} className="gold" />
                </div>
                <div>
                  <h3 className="modal-title font-serif">Add Customer (Master)</h3>
                  <p className="modal-subtitle">
                    Saves to Customer Directory and automatically selects for this invoice
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCustomerModal(false)}
                disabled={customerSubmitting}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit}>
              <div className="customer-modal-body compact-body">
                {customerFormError && (
                  <div className="customer-form-error-alert">
                    <AlertCircle size={16} />
                    <span>{customerFormError}</span>
                  </div>
                )}

                <div className="customer-modal-grid-compact">
                  {/* Row 1: Full Name (span 2), Customer Code (span 1), Customer Type (span 1) */}
                  <div className="compact-field col-span-2">
                    <label className="compact-field-label">Full Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="compact-field-input font-semibold"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      placeholder="e.g. Ramesh Chandra / Meena Jewellers"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Customer Code (Optional)</label>
                    <input
                      type="text"
                      className="compact-field-input font-mono text-xs"
                      value={customerForm.customer_code}
                      onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value })}
                      placeholder="Auto-generated if blank"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Customer Type</label>
                    <select
                      className="compact-field-select font-mono text-xs"
                      value={customerForm.customer_type}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          customer_type: e.target.value as any,
                        })
                      }
                    >
                      <option value="RETAIL">Retail Customer</option>
                      <option value="WHOLESALE">Wholesale Party</option>
                      <option value="GIRVI_CLIENT">Girvi Client</option>
                    </select>
                  </div>

                  {/* Row 2: Mobile Phone (span 1), Alternate Phone (span 1), Email (span 1), GSTIN (span 1) */}
                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Mobile Phone</label>
                    <input
                      type="tel"
                      className="compact-field-input font-mono"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      placeholder="10-digit mobile"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Alternate Phone</label>
                    <input
                      type="tel"
                      className="compact-field-input font-mono"
                      value={customerForm.alternate_phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, alternate_phone: e.target.value })}
                      placeholder="Landline / second"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Email Address (Optional)</label>
                    <input
                      type="email"
                      className="compact-field-input"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      placeholder="customer@domain.com"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">GSTIN (Optional)</label>
                    <input
                      type="text"
                      className="compact-field-input font-mono uppercase"
                      value={customerForm.gstin}
                      onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value })}
                      placeholder="15-digit GSTIN"
                    />
                  </div>

                  {/* Row 3: Address (span 2), City (span 1), State (span 1) */}
                  <div className="compact-field col-span-2">
                    <label className="compact-field-label">Address / Shop Address</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      placeholder="Door / Building / Street name"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">City / Town</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                      placeholder="City / Town"
                    />
                  </div>

                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">State</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={customerForm.state}
                      onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                      placeholder="Maharashtra"
                    />
                  </div>

                  {/* Row 4: Pincode (span 1), Internal Notes (span 3) */}
                  <div className="compact-field col-span-1">
                    <label className="compact-field-label">Pincode</label>
                    <input
                      type="text"
                      className="compact-field-input font-mono"
                      value={customerForm.pincode}
                      onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value })}
                      placeholder="400001"
                    />
                  </div>

                  <div className="compact-field col-span-3">
                    <label className="compact-field-label">Internal Notes (Optional)</label>
                    <input
                      type="text"
                      className="compact-field-input"
                      value={customerForm.notes}
                      onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                      placeholder="Customer preferences, referral, family details..."
                    />
                  </div>

                  {/* OPENING BALANCES & METAL KHATA ("OP") SECTION - FULL LENGTH */}
                  <div className="col-span-4 pt-1 mt-1 border-t border-[var(--border-subtle)]">
                    <div className="opening-section-compact-bar">
                      <div className="flex items-center gap-1.5">
                        <Coins size={14} className="text-[var(--gold-primary)]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold-primary)]">
                          Opening Khata & Metal Balances (At Registration)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Primary Direction Toggle */}
                        <div className="opening-direction-toggle">
                          <button
                            type="button"
                            className={`opening-dir-btn ${customerPrimaryDirection === 'DEBIT' ? 'active' : ''}`}
                            onClick={() => handleCustomerPrimaryDirectionChange('DEBIT')}
                          >
                            Customer Owes Us / Baaki (Dr - बाकी)
                          </button>
                          <button
                            type="button"
                            className={`opening-dir-btn ${customerPrimaryDirection === 'CREDIT' ? 'active' : ''}`}
                            onClick={() => handleCustomerPrimaryDirectionChange('CREDIT')}
                          >
                            We Owe Customer / Jama (Cr - जमा)
                          </button>
                        </div>

                        {/* Opening Date */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted whitespace-nowrap">Date:</span>
                          <input
                            type="date"
                            className="compact-field-input font-mono !h-[26px] !w-[125px] !py-0 !px-1 text-[11px]"
                            value={customerForm.opening_balance_date}
                            onChange={(e) =>
                              setCustomerForm({ ...customerForm, opening_balance_date: e.target.value })
                            }
                          />
                        </div>

                        {/* Ref Voucher */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted whitespace-nowrap">Ref / Voucher:</span>
                          <input
                            type="text"
                            className="compact-field-input font-mono uppercase !h-[26px] !w-[110px] !py-0 !px-1 text-[11px]"
                            placeholder="CUST-KHATA"
                            value={customerForm.opening_balance_ref}
                            onChange={(e) =>
                              setCustomerForm({ ...customerForm, opening_balance_ref: e.target.value.toUpperCase() })
                            }
                          />
                        </div>

                        {/* Opening Notes */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted whitespace-nowrap">Notes:</span>
                          <input
                            type="text"
                            className="compact-field-input !h-[26px] !w-[130px] !py-0 !px-1 text-[11px]"
                            placeholder="Old register note"
                            value={customerForm.opening_balance_notes}
                            onChange={(e) =>
                              setCustomerForm({ ...customerForm, opening_balance_notes: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4 Cards in 2x2 Grid: Row 1 = Cash & Bank, Row 2 = Gold & Silver */}
                    <div className="opening-cards-grid">
                      {/* Cash Card */}
                      <div className="opening-card-compact card-cash">
                        <div className="card-heading">
                          <span className="card-title-badge" style={{ color: '#10b981' }}>
                            <Banknote size={15} />
                            Cash Opening (₹)
                          </span>
                          <select
                            className="opening-type-select"
                            value={customerForm.opening_cash_type}
                            onChange={(e) =>
                              setCustomerForm({
                                ...customerForm,
                                opening_cash_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                            <option value="CREDIT">Jama / Cr (Advance - जमा)</option>
                          </select>
                        </div>
                        <div className="opening-currency-input-row">
                          <div className="opening-input-wrapper">
                            <span className="opening-input-prefix">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="opening-styled-input"
                              placeholder="0.00"
                              value={customerForm.opening_cash_balance || ''}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  opening_cash_balance: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <span className={`opening-status-chip ${customerForm.opening_cash_type === 'DEBIT' ? 'is-debit' : 'is-credit'}`}>
                            {customerForm.opening_cash_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'}
                          </span>
                        </div>
                      </div>

                      {/* Bank Card */}
                      <div className="opening-card-compact card-bank">
                        <div className="card-heading">
                          <span className="card-title-badge" style={{ color: '#3b82f6' }}>
                            <CreditCard size={15} />
                            Bank / RTGS Opening (₹)
                          </span>
                          <select
                            className="opening-type-select"
                            value={customerForm.opening_bank_type}
                            onChange={(e) =>
                              setCustomerForm({
                                ...customerForm,
                                opening_bank_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                            <option value="CREDIT">Jama / Cr (Advance - जमा)</option>
                          </select>
                        </div>
                        <div className="opening-currency-input-row">
                          <div className="opening-input-wrapper">
                            <span className="opening-input-prefix">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="opening-styled-input"
                              placeholder="0.00"
                              value={customerForm.opening_bank_balance || ''}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  opening_bank_balance: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <span className={`opening-status-chip ${customerForm.opening_bank_type === 'DEBIT' ? 'is-debit' : 'is-credit'}`}>
                            {customerForm.opening_bank_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'}
                          </span>
                        </div>
                      </div>

                      {/* Gold Card: Weight (g), Karat/Purity, Rate & Valuation */}
                      <div className="opening-card-compact card-gold">
                        <div className="card-heading">
                          <span className="card-title-badge" style={{ color: '#b8860b' }}>
                            <Coins size={15} />
                            Gold Opening (grams)
                          </span>
                          <select
                            className="opening-type-select"
                            value={customerForm.opening_gold_type}
                            onChange={(e) =>
                              setCustomerForm({
                                ...customerForm,
                                opening_gold_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="DEBIT">Baaki / Dr (Owes Gold - बाकी)</option>
                            <option value="CREDIT">Jama / Cr (Deposited - जमा)</option>
                          </select>
                        </div>
                        <div className="opening-metal-inputs-grid">
                          <div className="compact-field-group">
                            <span className="compact-field-label">Weight (g) *</span>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              className="compact-field-input"
                              style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}
                              placeholder="0.000 g"
                              value={customerForm.opening_gold_weight || ''}
                              onChange={(e) => {
                                const wt = parseFloat(e.target.value) || 0;
                                const rate = customerForm.opening_gold_rate || 0;
                                setCustomerForm({
                                  ...customerForm,
                                  opening_gold_weight: wt,
                                  opening_gold_value: rate > 0 ? Number((wt * rate).toFixed(2)) : customerForm.opening_gold_value,
                                });
                              }}
                            />
                          </div>

                          <div className="compact-field-group">
                            <span className="compact-field-label">Select Karat/Purity</span>
                            <select
                              className="compact-field-select"
                              style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}
                              value={customerForm.opening_gold_purity_id}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  opening_gold_purity_id: e.target.value,
                                })
                              }
                            >
                              <option value="">Select Karat/Purity</option>
                              {customerGoldPurities.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="compact-field-group">
                            <span className="compact-field-label">Rate (₹/g)</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              className="compact-field-input"
                              style={{ fontFamily: 'var(--font-mono, monospace)' }}
                              placeholder="₹/g"
                              value={customerForm.opening_gold_rate || ''}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value) || 0;
                                const wt = customerForm.opening_gold_weight || 0;
                                setCustomerForm({
                                  ...customerForm,
                                  opening_gold_rate: rate,
                                  opening_gold_value: Number((wt * rate).toFixed(2)),
                                });
                              }}
                            />
                          </div>
                        </div>
                        {Boolean(customerForm.opening_gold_value && customerForm.opening_gold_value > 0) && (
                          <div className="opening-metal-valuation-strip gold-val">
                            <span>🪙 Gold Valuation:</span>
                            <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                              ₹{customerForm.opening_gold_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Silver Card: Weight (g), Purity, Rate & Valuation */}
                      <div className="opening-card-compact card-silver">
                        <div className="card-heading">
                          <span className="card-title-badge" style={{ color: '#64748b' }}>
                            <Scale size={15} />
                            Silver Opening (grams)
                          </span>
                          <select
                            className="opening-type-select"
                            value={customerForm.opening_silver_type}
                            onChange={(e) =>
                              setCustomerForm({
                                ...customerForm,
                                opening_silver_type: e.target.value as 'DEBIT' | 'CREDIT',
                              })
                            }
                          >
                            <option value="DEBIT">Baaki / Dr (Owes Silver - बाकी)</option>
                            <option value="CREDIT">Jama / Cr (Deposited - जमा)</option>
                          </select>
                        </div>
                        <div className="opening-metal-inputs-grid">
                          <div className="compact-field-group">
                            <span className="compact-field-label">Weight (g) *</span>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              className="compact-field-input"
                              style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}
                              placeholder="0.000 g"
                              value={customerForm.opening_silver_weight || ''}
                              onChange={(e) => {
                                const wt = parseFloat(e.target.value) || 0;
                                const rate = customerForm.opening_silver_rate || 0;
                                setCustomerForm({
                                  ...customerForm,
                                  opening_silver_weight: wt,
                                  opening_silver_value: rate > 0 ? Number((wt * rate).toFixed(2)) : customerForm.opening_silver_value,
                                });
                              }}
                            />
                          </div>

                          <div className="compact-field-group">
                            <span className="compact-field-label">Select Purity</span>
                            <select
                              className="compact-field-select"
                              style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}
                              value={customerForm.opening_silver_purity_id}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  opening_silver_purity_id: e.target.value,
                                })
                              }
                            >
                              <option value="">Select Purity</option>
                              {customerSilverPurities.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="compact-field-group">
                            <span className="compact-field-label">Rate (₹/g)</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              className="compact-field-input"
                              style={{ fontFamily: 'var(--font-mono, monospace)' }}
                              placeholder="₹/g"
                              value={customerForm.opening_silver_rate || ''}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value) || 0;
                                const wt = customerForm.opening_silver_weight || 0;
                                setCustomerForm({
                                  ...customerForm,
                                  opening_silver_rate: rate,
                                  opening_silver_value: Number((wt * rate).toFixed(2)),
                                });
                              }}
                            />
                          </div>
                        </div>
                        {Boolean(customerForm.opening_silver_value && customerForm.opening_silver_value > 0) && (
                          <div className="opening-metal-valuation-strip silver-val">
                            <span>⚪ Silver Valuation:</span>
                            <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                              ₹{customerForm.opening_silver_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Net Summary Bar - Clean Side-by-Side Luxury Badges */}
                    {(() => {
                      const netCur =
                        ((customerForm.opening_cash_type === 'DEBIT' ? 1 : -1) * (customerForm.opening_cash_balance || 0)) +
                        ((customerForm.opening_bank_type === 'DEBIT' ? 1 : -1) * (customerForm.opening_bank_balance || 0));
                      const isCurDebit = netCur > 0;
                      const isCurCredit = netCur < 0;
                      return (
                        <div className="opening-net-summary-strip">
                          <div className="opening-net-group">
                            <span className="opening-net-label">Net Currency:</span>
                            <span
                              className={`opening-net-badge ${
                                isCurDebit
                                  ? 'badge-currency-dr'
                                  : isCurCredit
                                  ? 'badge-currency-cr'
                                  : 'badge-currency-nil'
                              }`}
                            >
                              ₹{Math.abs(netCur).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              {isCurDebit
                                ? ' (Dr / Customer Owes Us)'
                                : isCurCredit
                                ? ' (Cr / We Owe Customer)'
                                : ' (₹0.00 Nil)'}
                            </span>
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                            {Boolean(customerForm.opening_gold_weight && customerForm.opening_gold_weight > 0) && (
                              <div className="opening-net-group">
                                <span className="opening-net-label">Gold:</span>
                                <span className="opening-net-badge badge-gold">
                                  🟡 {customerForm.opening_gold_weight}g ({customerForm.opening_gold_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'})
                                </span>
                              </div>
                            )}

                            {Boolean(customerForm.opening_silver_weight && customerForm.opening_silver_weight > 0) && (
                              <div className="opening-net-group">
                                <span className="opening-net-label">Silver:</span>
                                <span className="opening-net-badge badge-silver">
                                  ⚪ {customerForm.opening_silver_weight}g ({customerForm.opening_silver_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="customer-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCustomerModal(false)}
                  disabled={customerSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm font-bold"
                  disabled={customerSubmitting}
                >
                  <Save size={14} />
                  <span>{customerSubmitting ? 'Saving to Master...' : 'Save & Select for Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT / INVOICE PREVIEW MODAL */}
      {showPrintModal && createdInvoice && (
        <div className="modal-backdrop print-modal-backdrop">
          <div className="modal-dialog print-modal-dialog">
            <div className="modal-header no-print">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="gold" />
                <h3 className="modal-title font-serif">Tax Invoice: {createdInvoice.invoice_number}</h3>
                <span className={`status-pill ${createdInvoice.status.toLowerCase()}`}>
                  {createdInvoice.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Printer size={15} />
                  <span>Print Bill</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setShowPrintModal(false);
                    navigate('/billing/invoices');
                  }}
                >
                  Back to Register
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
              {/* Shop Header Letterhead */}
              <div className="tax-invoice-shop-header">
                <h1 className="tax-invoice-shop-title">
                  {shopProfile?.name || 'JEWEL SUITE DEMO STORE'}
                </h1>
                {shopProfile?.legal_name &&
                  shopProfile.legal_name.trim().toLowerCase() !== (shopProfile?.name || '').trim().toLowerCase() && (
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
                  {shopProfile?.pan && <span>PAN: <strong>{shopProfile.pan}</strong></span>}
                </div>
              </div>

              {/* Metadata Grid (Customer & Invoice Info) */}
              <div className="tax-invoice-meta-grid">
                {/* Left: Customer Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">BILLED TO (CUSTOMER DETAILS)</div>
                  <div className="meta-customer-name">
                    {createdInvoice.customer_name || 'CASH CUSTOMER'}
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Contact / Phone:</span>
                    <span className="meta-info-val font-mono">
                      {createdInvoice.customer_phone || 'Counter Cash Sale'}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Address:</span>
                    <span className="meta-info-val">
                      {createdInvoice.customer_address || 'Counter Sale / In-Store'}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Place of Supply:</span>
                    <span className="meta-info-val">
                      {shopProfile?.state || 'Maharashtra'} (State Code: 27)
                    </span>
                  </div>
                </div>

                {/* Right: Invoice Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">TAX INVOICE DETAILS</div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Invoice Number:</span>
                    <span className="invoice-number-highlight">
                      {createdInvoice.invoice_number}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Invoice Date:</span>
                    <span className="meta-info-val font-mono">
                      {createdInvoice.invoice_date}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Invoice Status:</span>
                    <span className={`invoice-status-tag ${createdInvoice.status.toLowerCase()}`}>
                      {createdInvoice.status}
                    </span>
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Payment Status:</span>
                    <span className="meta-info-val font-semibold">
                      {Number(createdInvoice.balance_amount || 0) <= 0 ? (
                        <span className="text-emerald-700">● PAID IN FULL</span>
                      ) : Number(createdInvoice.amount_paid || 0) > 0 ? (
                        <span className="text-amber-700">● PARTIALLY PAID</span>
                      ) : (
                        <span className="text-rose-700">● UNPAID / BALANCE DUE</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table with Dynamic Configured Columns */}
              {(() => {
                const hasRealTags = (createdInvoice.items || []).some(
                  (it) => it.tag_no && it.tag_no.trim() !== '' && !/^TAG-\d+-\d+$/i.test(it.tag_no.trim())
                );
                const showPrintTagCol = invoiceColumns.show_tag_no && hasRealTags;
                const hasBadlaWaste =
                  (invoiceColumns.show_badla || invoiceColumns.show_wastage) &&
                  (createdInvoice.items || []).some(
                    (it) => Number(it.badla_percent || 0) > 0 || Number(it.wastage_percent || 0) > 0
                  );
                const printLeadColSpan = 1 + (showPrintTagCol ? 1 : 0) + 1 + 1; // # + (Tag) + Desc + Purity

                return (
                  <div className="print-table-wrapper">
                    <table className="print-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28px', textAlign: 'center' }}>#</th>
                          {showPrintTagCol && <th>Tag #</th>}
                          <th>Item Description</th>
                          <th>Purity</th>
                          <th className="text-right">Gross (g)</th>
                          {invoiceColumns.show_less_weight && <th className="text-right">Less (g)</th>}
                          {invoiceColumns.show_net_weight && <th className="text-right">Net (g)</th>}
                          {invoiceColumns.show_tunch && <th className="text-right">Tunch %</th>}
                          {invoiceColumns.show_fine_weight && <th className="text-right">Fine Wt</th>}
                          {hasBadlaWaste && <th className="text-right">Badla/Waste</th>}
                          <th className="text-right">Rate (₹/g)</th>
                          {invoiceColumns.show_making_charge && <th className="text-right">Making (₹)</th>}
                          <th className="text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(createdInvoice.items || []).map((it, idx) => {
                          const gross = Number(it.gross_weight || 0);
                          const less = Number(it.less_weight || 0);
                          const net = Number(it.net_weight || Math.max(0, gross - less));
                          const tunch = Number(it.tunch_percent || 0);
                          const pureFine = Number(it.fine_weight || (net * tunch) / 100);
                          const metalRate = Number(it.rate_per_gram ?? it.metal_rate ?? 0);
                          const wastagePercent = Number(it.wastage_percent ?? 0);
                          const badlaPercent = Number(it.badla_percent ?? 0);
                          const badlaWeight = (pureFine * badlaPercent) / 100;
                          const wasteWeight = (net * wastagePercent) / 100;
                          const calculatedAddition = badlaWeight + wasteWeight;
                          const totalAdditionPercent = wastagePercent + badlaPercent;
                          const wastageWeight = Number(it.wastage_weight ?? (calculatedAddition !== 0 ? calculatedAddition : 0));
                          const billableFine = Number(it.billable_weight ?? (calculatedAddition !== 0 ? Math.max(0, pureFine + wastageWeight) : pureFine));
                          const makingCharge = Number(it.making_charge ?? it.making_charges ?? 0);
                          const metalValue = Number(it.metal_value ?? (billableFine * metalRate));
                          const itemTotal = Number(it.item_amount ?? it.item_total ?? (metalValue + makingCharge));

                          return (
                            <tr key={it.id || idx}>
                              <td style={{ textAlign: 'center' }} className="font-mono">{idx + 1}</td>
                              {showPrintTagCol && (
                                <td className="font-mono text-xs font-semibold whitespace-nowrap">{it.tag_no || '-'}</td>
                              )}
                              <td>
                                <div className="font-semibold leading-tight">{it.item_name || 'Jewellery Item'}</div>
                                {it.metal_name && (
                                  <div className="text-[10px] text-muted">{it.metal_name}</div>
                                )}
                              </td>
                              <td className="whitespace-nowrap">
                                <div>{it.purity_name || '22K (916)'}</div>
                                {it.huid && (
                                  <div className="text-[10px] text-muted font-mono">HUID: {it.huid}</div>
                                )}
                              </td>
                              <td className="text-right font-mono whitespace-nowrap">{formatWeight(gross, 3)}</td>
                              {invoiceColumns.show_less_weight && (
                                <td className="text-right font-mono text-muted whitespace-nowrap">{formatWeight(less, 3)}</td>
                              )}
                              {invoiceColumns.show_net_weight && (
                                <td className="text-right font-mono font-bold whitespace-nowrap">{formatWeight(net, 3)}</td>
                              )}
                              {invoiceColumns.show_tunch && (
                                <td className="text-right font-mono whitespace-nowrap">{tunch > 0 ? `${tunch.toFixed(2)}%` : '-'}</td>
                              )}
                              {invoiceColumns.show_fine_weight && (
                                <td className="text-right font-mono whitespace-nowrap">
                                  <div className="font-semibold">{billableFine > 0 ? formatFineWeight(billableFine, 4) : '-'}</div>
                                </td>
                              )}
                              {hasBadlaWaste && (
                                <td className="text-right font-mono text-xs whitespace-nowrap">
                                  {totalAdditionPercent !== 0 ? (
                                    <div>
                                      <div>{wastageWeight > 0 ? '+' : ''}{formatWeight(wastageWeight, 3)}g</div>
                                      <div className="text-[10px] text-muted">
                                        {badlaPercent !== 0 && <span>B:{badlaPercent > 0 ? '+' : ''}{badlaPercent}% </span>}
                                        {wastagePercent !== 0 && <span>W:{wastagePercent > 0 ? '+' : ''}{wastagePercent}%</span>}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                              )}
                              <td className="text-right font-mono whitespace-nowrap">{formatMetalRate(metalRate)}</td>
                              {invoiceColumns.show_making_charge && (
                                <td className="text-right font-mono whitespace-nowrap">
                                  <div className="font-semibold">{formatCurrency(makingCharge, false)}</div>
                                  {it.making_rate ? (
                                    <div className="text-[10px] text-muted">
                                      {it.making_charge_type === 'PER_PIECE'
                                        ? `(${it.pieces || 1} pc @ ₹${it.making_rate})`
                                        : it.making_charge_type === 'FIXED'
                                        ? '(Fix)'
                                        : it.making_charge_type === 'PERCENTAGE'
                                        ? `(${it.making_rate}%)`
                                        : `(@₹${it.making_rate}/g)`}
                                    </div>
                                  ) : null}
                                </td>
                              )}
                              <td className="text-right font-mono font-bold whitespace-nowrap">
                                {formatCurrency(itemTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="print-totals-row">
                          <td colSpan={printLeadColSpan} className="text-right font-bold uppercase whitespace-nowrap">
                            Totals ({createdInvoice.items?.length || 0} item{createdInvoice.items?.length === 1 ? '' : 's'}):
                          </td>
                          <td className="text-right font-mono font-bold whitespace-nowrap">
                            {formatWeight(
                              (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.gross_weight || 0), 0),
                              3
                            )}
                          </td>
                          {invoiceColumns.show_less_weight && (
                            <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                              {formatWeight(
                                (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.less_weight || 0), 0),
                                3
                              )}
                            </td>
                          )}
                          {invoiceColumns.show_net_weight && (
                            <td className="text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                              {formatWeight(
                                (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.net_weight || (Math.max(0, Number(it.gross_weight || 0) - Number(it.less_weight || 0)))), 0),
                                3
                              )}
                            </td>
                          )}
                          {invoiceColumns.show_tunch && <td></td>}
                          {invoiceColumns.show_fine_weight && (
                            <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                              <div>
                                {formatFineWeight(
                                  (createdInvoice.items || []).reduce((acc, it) => {
                                    const gross = Number(it.gross_weight || 0);
                                    const less = Number(it.less_weight || 0);
                                    const net = Number(it.net_weight || Math.max(0, gross - less));
                                    const tunch = Number(it.tunch_percent || 0);
                                    const pureFine = Number(it.fine_weight || (net * tunch) / 100);
                                    const badlaPercent = Number(it.badla_percent ?? 0);
                                    const wastagePercent = Number(it.wastage_percent ?? 0);
                                    const additionWeight = Number(it.wastage_weight ?? (((pureFine * badlaPercent) / 100) + ((net * wastagePercent) / 100)));
                                    return acc + Number(it.billable_weight ?? (additionWeight !== 0 ? Math.max(0, pureFine + additionWeight) : pureFine));
                                  }, 0),
                                  4
                                )}
                              </div>
                            </td>
                          )}
                          {hasBadlaWaste && <td></td>}
                          <td></td>
                          {invoiceColumns.show_making_charge && (
                            <td className="text-right font-mono font-bold whitespace-nowrap">
                              {formatCurrency(
                                (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.making_charge ?? it.making_charges ?? 0), 0)
                              )}
                            </td>
                          )}
                          <td className="text-right font-mono font-bold text-base text-amber-800 whitespace-nowrap">
                            {formatCurrency(
                              (createdInvoice.items || []).reduce((acc, it) => {
                                const metalRate = Number(it.rate_per_gram ?? it.metal_rate ?? 0);
                                const makingCharge = Number(it.making_charge ?? it.making_charges ?? 0);
                                const tunch = Number(it.tunch_percent || 0);
                                const net = Number(it.net_weight || 0);
                                const fine = Number(it.fine_weight || (net * tunch) / 100);
                                const metalValue = Number(it.metal_value ?? (fine * metalRate));
                                return acc + Number(it.item_amount ?? it.item_total ?? (metalValue + makingCharge));
                              }, 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* Customer Scrap / Old Metal Exchange Table (If any) */}
              {createdInvoice.exchange && createdInvoice.exchange.items && createdInvoice.exchange.items.length > 0 && (() => {
                const hasRealExchTags = (createdInvoice.exchange.items || []).some(
                  (exIt: any) => exIt.tag_no && exIt.tag_no.trim() !== '' && !/^TAG-\d+-\d+$/i.test(exIt.tag_no.trim())
                );
                const showPrintExchTagCol = invoiceColumns.show_tag_no && hasRealExchTags;
                const printExchLeadColSpan = 1 + (showPrintExchTagCol ? 1 : 0) + 1 + 1; // # + (Tag) + Name + Purity

                return (
                  <div className="tax-invoice-exchange-section">
                    <div className="exchange-section-title">
                      <span>Customer Old Scrap / Metal Exchange Return</span>
                      <span className="font-mono text-xs text-muted">
                        Exchange Ref: {createdInvoice.exchange.exchange_number}
                      </span>
                    </div>
                    <div className="print-table-wrapper">
                      <table className="print-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                            {showPrintExchTagCol && <th>Tag #</th>}
                            <th>Old Scrap Item</th>
                            <th>Metal & Purity</th>
                            <th className="text-right">Gross (g)</th>
                            {invoiceColumns.show_less_weight && <th className="text-right">Less (g)</th>}
                            {invoiceColumns.show_net_weight && <th className="text-right">Net (g)</th>}
                            {invoiceColumns.show_tunch && <th className="text-right">Tunch %</th>}
                            {invoiceColumns.show_fine_weight && <th className="text-right">Fine Wt</th>}
                            {invoiceColumns.show_making_charge && <th className="text-right">Deduct %</th>}
                            <th className="text-right">Ex. Rate</th>
                            <th className="text-right">Credit / Jama Value (₹ - जमा)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {createdInvoice.exchange.items.map((exIt: any, exIdx: number) => (
                            <tr key={exIt.id || exIdx}>
                              <td style={{ textAlign: 'center' }} className="font-mono">{exIdx + 1}</td>
                              {showPrintExchTagCol && <td className="font-mono text-xs">{exIt.tag_no || '-'}</td>}
                              <td className="font-semibold">{exIt.item_name || 'Customer Scrap'}</td>
                              <td>{exIt.metal_name || 'Gold'} {exIt.purity_name || ''}</td>
                              <td className="text-right font-mono">{formatWeight(exIt.gross_weight, 3)}</td>
                              {invoiceColumns.show_less_weight && (
                                <td className="text-right font-mono text-muted">{formatWeight(exIt.less_weight, 3)}</td>
                              )}
                              {invoiceColumns.show_net_weight && (
                                <td className="text-right font-mono font-bold">{formatWeight(exIt.net_weight, 3)}</td>
                              )}
                              {invoiceColumns.show_tunch && (
                                <td className="text-right font-mono">{Number(exIt.tunch_percent || 0).toFixed(2)}%</td>
                              )}
                              {invoiceColumns.show_fine_weight && (
                                <td className="text-right font-mono">{formatFineWeight(exIt.fine_weight, 4)}</td>
                              )}
                              {invoiceColumns.show_making_charge && (
                                <td className="text-right font-mono">{Number(exIt.deduction_percent || 0).toFixed(1)}%</td>
                              )}
                              <td className="text-right font-mono">{formatMetalRate(exIt.exchange_rate)}</td>
                              <td className="text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(exIt.exchange_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="print-totals-row">
                            <td colSpan={printExchLeadColSpan} className="text-right font-bold uppercase">Total Old Metal Deducted:</td>
                            <td className="text-right font-mono font-bold">{formatWeight(createdInvoice.exchange.total_gross_weight, 3)}</td>
                            {invoiceColumns.show_less_weight && (
                              <td className="text-right font-mono text-muted">{formatWeight(createdInvoice.exchange.total_less_weight, 3)}</td>
                            )}
                            {invoiceColumns.show_net_weight && (
                              <td className="text-right font-mono font-bold">{formatWeight(createdInvoice.exchange.total_net_weight, 3)}</td>
                            )}
                            {invoiceColumns.show_tunch && <td></td>}
                            {invoiceColumns.show_fine_weight && (
                              <td className="text-right font-mono font-bold">{formatFineWeight(createdInvoice.exchange.total_fine_weight, 4)}</td>
                            )}
                            {invoiceColumns.show_making_charge && <td></td>}
                            <td></td>
                            <td className="text-right font-mono font-bold text-emerald-700">
                              − {formatCurrency(createdInvoice.exchange.total_exchange_value)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Bottom Split Section: Payment Breakdown, Notes, Signatures & Ledger */}
              <div className="tax-invoice-bottom-grid">
                {/* Left: Payment Tendered Breakdown & Signatures */}
                <div className="print-payment-card">
                  <div className="print-card-header">PAYMENT MODES & TENDERED</div>
                  {createdInvoice.payments && createdInvoice.payments.length > 0 ? (
                    createdInvoice.payments.map((p) => {
                      const metalLabel =
                        p.payment_mode === 'GOLD'
                          ? 'Gold Payment'
                          : p.payment_mode === 'SILVER'
                          ? 'Silver Payment'
                          : p.payment_mode === 'BANK'
                          ? 'Bank Transfer'
                          : p.payment_mode;

                      const detailsParts: string[] = [];
                      if (p.metal_weight) {
                        detailsParts.push(`${formatWeight(p.metal_weight, 3)}g @ ₹${p.metal_rate || 0}/g`);
                      }
                      if (p.payer_name && p.payer_name !== createdInvoice.customer_name) {
                        detailsParts.push(`Paid by: ${p.payer_name}`);
                      }
                      if (p.payer_bank) {
                        detailsParts.push(`from ${p.payer_bank}`);
                      }
                      if (p.received_in) {
                        detailsParts.push(`into ${p.received_in}`);
                      }
                      if (p.reference_number) {
                        detailsParts.push(`Ref: ${p.reference_number}`);
                      }

                      return (
                        <div key={p.id} className="print-payment-row">
                          <span className="font-semibold text-slate-700">
                            {metalLabel}
                            {detailsParts.length > 0 ? ` (${detailsParts.join(' • ')})` : ''}:
                          </span>
                          <strong className="font-mono text-slate-900">
                            {formatCurrency(p.amount)}
                          </strong>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-muted italic py-1">
                      No advance payment recorded (Full balance due on account)
                    </div>
                  )}

                  {createdInvoice.notes && (
                    <div className="print-notes-box">
                      <strong>Invoice Notes:</strong> {createdInvoice.notes}
                    </div>
                  )}

                  {/* Signature Boxes */}
                  <div className="tax-invoice-sign-grid">
                    <div className="sign-box">
                      <span>Customer Signature</span>
                    </div>
                    <div className="sign-box">
                      <span>For {shopProfile?.name || 'JEWEL SUITE STORE'}</span>
                      <span className="text-[10px] text-muted">(Authorized Signatory)</span>
                    </div>
                  </div>
                </div>

                {/* Right: Authoritative Financial Calculation Ledger */}
                <div className="print-ledger-box">
                  <div className="ledger-row">
                    <span>Taxable Amount (Metal + Labour):</span>
                    <strong className="font-mono">{formatCurrency(createdInvoice.taxable_amount)}</strong>
                  </div>

                  {Number(createdInvoice.discount_amount || 0) > 0 && (
                    <div className="ledger-row text-rose-600">
                      <span>Discount Applied:</span>
                      <span className="font-mono">−{formatCurrency(createdInvoice.discount_amount)}</span>
                    </div>
                  )}

                  {Number(createdInvoice.gst_amount || 0) > 0 && (
                    <>
                      {calculations.isInterState ? (
                        <div className="ledger-row text-xs text-muted">
                          <span>IGST ({Number(createdInvoice.gst_rate || 3).toFixed(1)}%):</span>
                          <span className="font-mono text-amber-300">
                            {formatCurrency(Number(createdInvoice.gst_amount || 0))}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="ledger-row text-xs text-muted">
                            <span>CGST ({((createdInvoice.gst_rate || 3) / 2).toFixed(1)}%):</span>
                            <span className="font-mono">
                              {formatCurrency(Number(createdInvoice.gst_amount || 0) / 2)}
                            </span>
                          </div>
                          <div className="ledger-row text-xs text-muted">
                            <span>SGST ({((createdInvoice.gst_rate || 3) / 2).toFixed(1)}%):</span>
                            <span className="font-mono">
                              {formatCurrency(Number(createdInvoice.gst_amount || 0) / 2)}
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {Number(createdInvoice.exchange_amount || 0) > 0 && (
                    <div className="ledger-row highlight text-emerald-700">
                      <span>Old Metal Exchange Deduction:</span>
                      <span className="font-mono">−{formatCurrency(createdInvoice.exchange_amount)}</span>
                    </div>
                  )}

                  {Number(createdInvoice.round_off || 0) !== 0 && (
                    <div className="ledger-row text-xs text-muted">
                      <span>Round Off:</span>
                      <span className="font-mono">{formatCurrency(createdInvoice.round_off)}</span>
                    </div>
                  )}

                  <div className="ledger-row grand-total">
                    <span>Net Amount Payable:</span>
                    <span className="font-mono">{formatCurrency(createdInvoice.net_payable || createdInvoice.grand_total)}</span>
                  </div>

                  <div className="ledger-row highlight text-emerald-700">
                    <span>Total Amount Received:</span>
                    <span className="font-mono">{formatCurrency(createdInvoice.amount_paid)}</span>
                  </div>

                  <div className="ledger-row balance">
                    <span>Balance Remaining:</span>
                    <span
                      className={`font-mono ${
                        Number(createdInvoice.balance_amount || 0) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'
                      }`}
                    >
                      {Number(createdInvoice.balance_amount || 0) > 0
                        ? formatCurrency(createdInvoice.balance_amount)
                        : '₹0.00 (PAID)'}
                    </span>
                  </div>

                  {Number(createdInvoice.amount_paid || 0) > Number(createdInvoice.net_payable || createdInvoice.grand_total || 0) && (
                    <div className="ledger-row text-xs text-emerald-600 font-semibold pt-1 border-t">
                      <span>Change Returned to Customer:</span>
                      <span className="font-mono">
                        {formatCurrency(Number(createdInvoice.amount_paid) - Number(createdInvoice.net_payable || createdInvoice.grand_total))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Legal Terms & Hallmark Policy */}
              <div className="tax-invoice-terms">
                <p className="font-bold">
                  Subject to {shopProfile?.city || 'local'} jurisdiction. Goods once sold will be accepted for exchange/return within 7 days along with original tax bill.
                </p>
                <p>1. All gold jewellery tested for 916 / 750 hallmark purity as per BIS guidelines. 2. No warranty on stone breakage or mishandling.</p>
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
          onApply={handleApplyLessTotal}
          onClose={() => setActiveLessCalc(null)}
        />
      )}

      {/* CUSTOMER DETAILS & KHATA MODAL */}
      <CustomerDetailsModal
        isOpen={showCustomerDetailsModal}
        onClose={() => setShowCustomerDetailsModal(false)}
        customer={selectedCustomer || null}
      />
    </div>
  );
};
