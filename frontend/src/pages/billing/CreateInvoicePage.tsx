import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { salesApi, SalesInvoiceDetails } from '../../services/sales';
import { customerApi, rateApi } from '../../services/masters';
import { settingsApi, ShopProfile } from '../../services/settings';
import { Customer, CurrentRate, Metal, MetalPurity } from '../../types';
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
  Save,
  CheckCircle,
  Printer,
  ArrowLeft,
  AlertCircle,
  Coins,
  UserCheck,
  UserPlus,
  Sparkles,
  Calculator,
  CreditCard,
  Check,
} from 'lucide-react';
import './CreateInvoicePage.css';

interface SaleItemRow {
  id: string;
  tag_no: string;
  item_name: string;
  metal_id: string;
  metal_name: string;
  purity_id: string;
  purity_name: string;
  gross_weight: number | string;
  less_weight: number | string;
  tunch_percent: number | string;
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
  tunch_percent: number | string;
  deduction_percent: number | string;
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

export const CreateInvoicePage: React.FC = () => {
  const navigate = useNavigate();

  // Reference Masters
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  // Bill Header Meta
  const [billType, setBillType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber] = useState(() => `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
  const [gstRate, setGstRate] = useState<number>(3.0);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print/View Modal for saved invoice
  const [createdInvoice, setCreatedInvoice] = useState<SalesInvoiceDetails | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Sale Items State
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([]);

  // Exchange Items State
  const [exchangeItems, setExchangeItems] = useState<ExchangeItemRow[]>([]);

  // Payment Received State
  const [payments, setPayments] = useState<PaymentRow[]>([
    {
      id: 'pay-init',
      payment_mode: 'CASH',
      amount: 0,
      reference_number: '',
    },
  ]);

  // Load Masters
  useEffect(() => {
    Promise.all([
      customerApi.list({ pageSize: 150 }).catch(() => ({ items: [] })),
      rateApi.getCurrentRates().catch(() => []),
      rateApi.getMetals().catch(() => []),
      rateApi.getAllPurities().catch(() => []),
      settingsApi.getShopProfile().catch(() => null),
    ])
      .then(([custRes, ratesRes, metalsRes, puritiesRes, profileRes]) => {
        const custList = (custRes as any)?.items || [];
        setCustomers(custList);
        if (custList.length > 0) {
          setCustomerId(custList[0].id);
        }

        const currentRates = ratesRes || [];
        setRates(currentRates);
        setMetals(metalsRes || []);
        setPurities(puritiesRes || []);
        setShopProfile(profileRes);

        // Find standard 22K 916 gold rate
        const goldRate =
          currentRates.find(
            (r) =>
              (r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') &&
              (r.purity_name?.includes('22') || r.purity_name?.includes('916'))
          ) ||
          currentRates.find((r) => r.metal_name?.toUpperCase().includes('GOLD') || r.metal_code === 'GOLD') ||
          currentRates[0];

        // Seed first default sale row
        const defaultMetalId = goldRate?.metal_id || metalsRes[0]?.id || '';
        const defaultPurityId = goldRate?.purity_id || puritiesRes[0]?.id || '';

        setSaleItems([
          {
            id: `item-${Date.now()}-1`,
            tag_no: `TAG-${Date.now().toString(36).toUpperCase()}-1`,
            item_name: 'Gold Ring',
            metal_id: defaultMetalId,
            metal_name: goldRate?.metal_name || 'Gold',
            purity_id: defaultPurityId,
            purity_name: goldRate?.purity_name || '22K (916)',
            gross_weight: 5.5,
            less_weight: 0.1,
            tunch_percent: goldRate?.tunch_percent || 91.6,
            wastage_percent: 0,
            making_rate: 450,
            making_charge_type: 'PER_GRAM',
            rate_per_gram: goldRate?.rate || 7200,
          },
        ]);
      });
  }, []);

  // Customer Creation Modal in Master
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSubmitting, setCustomerSubmitting] = useState(false);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);

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
    opening_balance: 0,
    opening_balance_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    notes: '',
  });

  const handleOpenCustomerModal = () => {
    setCustomerFormError(null);
    setCustomerForm({
      name: '',
      customer_code: '',
      phone: '',
      alternate_phone: '',
      email: '',
      customer_type: billType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      address: '',
      city: shopProfile?.city || '',
      state: shopProfile?.state || 'Maharashtra',
      pincode: shopProfile?.pincode || '',
      gstin: '',
      opening_balance: 0,
      opening_balance_type: 'DEBIT',
      notes: '',
    });
    setShowCustomerModal(true);
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
        name: customerForm.name.trim(),
        customer_code: customerForm.customer_code.trim() || undefined,
        phone: customerForm.phone.trim() || null,
        alternate_phone: customerForm.alternate_phone.trim() || null,
        email: customerForm.email.trim() || null,
        customer_type: customerForm.customer_type,
        address: customerForm.address.trim() || null,
        city: customerForm.city.trim() || null,
        state: customerForm.state.trim() || null,
        pincode: customerForm.pincode.trim() || null,
        gstin: customerForm.gstin.trim() ? customerForm.gstin.trim().toUpperCase() : null,
        opening_balance: Number(customerForm.opening_balance) || 0,
        opening_balance_type: customerForm.opening_balance_type,
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

  // Quick Walk-in Customer
  const handleQuickWalkin = async () => {
    try {
      // Check if walk-in customer already exists in list to avoid duplicates
      const existingWalkin = customers.find(
        (c) => c.phone === '9800000000' || c.name.toLowerCase().includes('walk-in')
      );
      if (existingWalkin) {
        setCustomerId(existingWalkin.id);
        showToast('success', `Selected ${existingWalkin.name}`);
        return;
      }

      const walkin = await customerApi.create({
        name: 'Walk-in Retail Customer',
        phone: '9800000000',
        customer_type: 'RETAIL',
        address: 'Counter Sale',
        city: shopProfile?.city || 'Mumbai',
        state: shopProfile?.state || 'Maharashtra',
      });
      setCustomers((prev) => [walkin, ...prev]);
      setCustomerId(walkin.id);
      showToast('success', 'Selected Walk-in Retail Customer');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create walk-in customer');
    }
  };

  // Helper to add sale row
  const handleAddSaleRow = () => {
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

    const newRow: SaleItemRow = {
      id: `item-${Date.now()}-${saleItems.length + 1}`,
      tag_no: `TAG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
      item_name: 'Jewellery Item',
      metal_id: defaultMetalId,
      metal_name: goldRate?.metal_name || 'Gold',
      purity_id: defaultPurityId,
      purity_name: goldRate?.purity_name || '22K (916)',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: goldRate?.tunch_percent || 91.6,
      wastage_percent: 0,
      making_rate: 450,
      making_charge_type: 'PER_GRAM',
      rate_per_gram: goldRate?.rate || 7200,
    };
    setSaleItems((prev) => [...prev, newRow]);
  };

  const handleRemoveSaleRow = (id: string) => {
    if (saleItems.length <= 1) {
      showToast('error', 'Sale must have at least one line item');
      return;
    }
    setSaleItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateSaleRow = (id: string, updates: Partial<SaleItemRow>) => {
    setSaleItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };

        // If metal changed, update purity & rate
        if (updates.metal_id && updates.metal_id !== item.metal_id) {
          const m = metals.find((m) => m.id === updates.metal_id);
          updated.metal_name = m ? m.name : '';
          const matchingRate = rates.find((r) => r.metal_id === updates.metal_id);
          if (matchingRate) {
            updated.purity_id = matchingRate.purity_id;
            updated.purity_name = matchingRate.purity_name || '';
            updated.rate_per_gram = matchingRate.rate || updated.rate_per_gram;
            updated.tunch_percent = matchingRate.tunch_percent || 91.6;
          }
        }

        // If purity changed, update rate and tunch
        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((p) => p.id === updates.purity_id);
          updated.purity_name = p ? p.name : '';
          if (p && p.tunch_percent) updated.tunch_percent = p.tunch_percent;
          const matchingRate = rates.find((r) => r.purity_id === updates.purity_id);
          if (matchingRate && matchingRate.rate) {
            updated.rate_per_gram = matchingRate.rate;
          }
        }

        return updated;
      })
    );
  };

  // Helper to add exchange row
  const handleAddExchangeRow = () => {
    const goldMetal = metals.find((m) => m.name.toUpperCase().includes('GOLD')) || metals[0];
    const goldPurity = purities.find((p) => p.name.includes('22') || p.name.includes('916')) || purities[0];
    const currentRate = rates.find((r) => r.purity_id === goldPurity?.id) || rates[0];

    const newExRow: ExchangeItemRow = {
      id: `ex-${Date.now()}-${exchangeItems.length + 1}`,
      tag_no: `EX-G-${Math.floor(Math.random() * 900 + 100)}`,
      item_name: 'Old Gold Scrap',
      metal_id: goldMetal?.id || '',
      metal_name: goldMetal?.name || 'Gold',
      purity_id: goldPurity?.id || '',
      purity_name: goldPurity?.name || '22K (916)',
      gross_weight: 0,
      less_weight: 0,
      tunch_percent: goldPurity?.tunch_percent || 85,
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
        }

        if (updates.purity_id && updates.purity_id !== item.purity_id) {
          const p = purities.find((p) => p.id === updates.purity_id);
          updated.purity_name = p ? p.name : '';
          if (p && p.tunch_percent) updated.tunch_percent = p.tunch_percent;
        }

        return updated;
      })
    );
  };

  // Helper to find metal & default purity with rate
  const findMetalAndPurity = (metalType: 'GOLD' | 'SILVER') => {
    const isGold = metalType === 'GOLD';
    const metal = metals.find(
      (m) => (isGold ? m.code === 'GOLD' || m.name.toUpperCase().includes('GOLD') : m.code === 'SILVER' || m.name.toUpperCase().includes('SILVER'))
    ) || metals[0];

    const metalPurities = purities.filter((p) => p.metal_id === metal?.id);
    const defaultPurity = metalPurities.find(
      (p) => (isGold ? p.name.includes('22') || p.name.includes('916') : p.name.includes('999') || p.name.includes('925'))
    ) || metalPurities[0];

    const matchingRate = rates.find((r) => r.purity_id === defaultPurity?.id && r.metal_id === metal?.id)
      || rates.find((r) => r.purity_id === defaultPurity?.id)
      || rates.find((r) => r.metal_id === metal?.id);

    const applicableRate = matchingRate && matchingRate.rate > 0 ? matchingRate.rate : 0;

    return {
      metalId: metal?.id || '',
      metalName: metal?.name || (isGold ? 'Gold' : 'Silver'),
      purityId: defaultPurity?.id || '',
      purityName: defaultPurity?.name || '',
      applicableRate,
    };
  };

  // Helper to add standard payment row
  const handleAddPaymentRow = () => {
    const newPay: PaymentRow = {
      id: `pay-${Date.now()}-${payments.length + 1}`,
      payment_mode: 'CASH',
      amount: '',
      reference_number: '',
    };
    setPayments((prev) => [...prev, newPay]);
  };

  // Helper to add metal payment row (Gold or Silver)
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
          const matchingRate = rates.find((r) => r.purity_id === updates.purity_id && r.metal_id === updated.metal_id)
            || rates.find((r) => r.purity_id === updates.purity_id);
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
        const amount = sanitized && !w.isZero()
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
        if (!isMetal) {
          return {
            ...p,
            amount: sanitized,
          };
        }

        const rate = toDecimal(p.metal_rate || 0);
        if (rate.lte(0)) {
          return {
            ...p,
            amount: sanitized,
            metal_weight: '',
            last_edited: 'amount',
            rate_error: 'Valid applicable rate is required to calculate metal weight',
          };
        }

        const a = toDecimal(sanitized || 0);
        const weight = sanitized && !a.isZero()
          ? a.dividedBy(rate).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber()
          : '';
        return {
          ...p,
          amount: sanitized,
          metal_weight: weight,
          last_edited: 'amount',
          rate_error: undefined,
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
    let totalWastageWeight = new Decimal(0);
    let totalWastageAmount = new Decimal(0);
    let totalMakingCharges = new Decimal(0);
    let totalSaleAmount = new Decimal(0);

    let goldNetWeight = new Decimal(0);
    let goldFineWeight = new Decimal(0);
    let silverNetWeight = new Decimal(0);
    let silverFineWeight = new Decimal(0);

    saleItems.forEach((item) => {
      const gross = toDecimal(item.gross_weight);
      const less = toDecimal(item.less_weight);
      const net = Decimal.max(0, gross.minus(less));
      const tunch = toDecimal(item.tunch_percent);
      // Raw fine weight unrounded before business calculation
      const fine = net.times(tunch).dividedBy(100);
      const rate = toDecimal(item.rate_per_gram);
      const metalVal = fine.times(rate);

      const wastage = toDecimal(item.wastage_percent);
      const wastageWeight = net.times(wastage).dividedBy(100);
      const wastageAmount = wastageWeight.times(rate);

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

      const rowAmount = metalVal.plus(wastageAmount).plus(making);

      totalGrossWeight = totalGrossWeight.plus(gross);
      totalLessWeight = totalLessWeight.plus(less);
      totalNetWeight = totalNetWeight.plus(net);
      totalFineWeight = totalFineWeight.plus(fine);
      totalWastageWeight = totalWastageWeight.plus(wastageWeight);
      totalWastageAmount = totalWastageAmount.plus(wastageAmount);
      totalMakingCharges = totalMakingCharges.plus(making);
      totalSaleAmount = totalSaleAmount.plus(rowAmount);

      const isSilver = (item.metal_name || '').toUpperCase().includes('SILVER');
      if (isSilver) {
        silverNetWeight = silverNetWeight.plus(net);
        silverFineWeight = silverFineWeight.plus(fine);
      } else {
        goldNetWeight = goldNetWeight.plus(net);
        goldFineWeight = goldFineWeight.plus(fine);
      }
    });

    // Exchange calculations
    let totalExchangeGross = new Decimal(0);
    let totalExchangeNet = new Decimal(0);
    let totalExchangeFine = new Decimal(0);
    let totalExchangeValue = new Decimal(0);

    exchangeItems.forEach((ex) => {
      const gross = toDecimal(ex.gross_weight);
      const less = toDecimal(ex.less_weight);
      const net = Decimal.max(0, gross.minus(less));
      const tunch = toDecimal(ex.tunch_percent);
      const fine = net.times(tunch).dividedBy(100);
      const rate = toDecimal(ex.exchange_rate);
      const metalVal = fine.times(rate);
      const dedPercent = toDecimal(ex.deduction_percent);
      const deduction = metalVal.times(dedPercent).dividedBy(100);
      const exVal = Decimal.max(0, metalVal.minus(deduction));

      totalExchangeGross = totalExchangeGross.plus(gross);
      totalExchangeNet = totalExchangeNet.plus(net);
      totalExchangeFine = totalExchangeFine.plus(fine);
      totalExchangeValue = totalExchangeValue.plus(exVal);
    });

    const discount = toDecimal(discountAmount || 0);
    const netTaxable = Decimal.max(0, totalSaleAmount.minus(discount));
    const gstRateDec = toDecimal(gstRate);
    const gstAmount = netTaxable.times(gstRateDec).dividedBy(100);
    const cgst = gstAmount.dividedBy(2);
    const sgst = gstAmount.dividedBy(2);
    const rawGrandTotal = netTaxable.plus(gstAmount);
    const grandTotal = rawGrandTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const roundOff = grandTotal.minus(rawGrandTotal);

    // netPayable = grandTotal - totalExchangeValue
    // i.e., saleTotal - discount + applicableGST - exchangeValue
    const netPayable = Decimal.max(0, grandTotal.minus(totalExchangeValue));

    let cashAndOtherPayments = new Decimal(0);
    let goldPaymentValue = new Decimal(0);
    let goldPaymentGrams = new Decimal(0);
    let silverPaymentValue = new Decimal(0);
    let silverPaymentGrams = new Decimal(0);
    let totalReceived = new Decimal(0);

    payments.forEach((p) => {
      const amt = toDecimal(p.amount || 0);
      if (amt.gt(0)) {
        totalReceived = totalReceived.plus(amt);
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

    const rawBalance = netPayable.minus(totalReceived);
    const balanceDue = Decimal.max(0, rawBalance);
    const changeDue = Decimal.max(0, totalReceived.minus(netPayable));
    const isSettled = netPayable.gt(0) ? totalReceived.gte(netPayable) : false;

    return {
      totalGrossWeight: totalGrossWeight.toNumber(),
      totalLessWeight: totalLessWeight.toNumber(),
      totalNetWeight: totalNetWeight.toNumber(),
      totalFineWeight: totalFineWeight.toNumber(),
      totalWastageWeight: totalWastageWeight.toNumber(),
      totalWastageAmount: totalWastageAmount.toNumber(),
      totalMakingCharges: totalMakingCharges.toNumber(),
      totalSaleAmount: totalSaleAmount.toNumber(),
      goldNetWeight: goldNetWeight.toNumber(),
      goldFineWeight: goldFineWeight.toNumber(),
      silverNetWeight: silverNetWeight.toNumber(),
      silverFineWeight: silverFineWeight.toNumber(),
      totalExchangeGross: totalExchangeGross.toNumber(),
      totalExchangeNet: totalExchangeNet.toNumber(),
      totalExchangeFine: totalExchangeFine.toNumber(),
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
      totalReceived: totalReceived.toNumber(),
      totalPaid: totalReceived.toNumber(), // backwards compatible alias
      balanceDue: balanceDue.toNumber(),
      changeDue: changeDue.toNumber(),
      isSettled,
    };
  }, [saleItems, exchangeItems, discountAmount, gstRate, payments]);

  // Quick Settle Full Payment
  const handleQuickSettle = (mode: 'CASH' | 'UPI' | 'BANK') => {
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payment_mode: mode,
        amount: calculations.netPayable,
        reference_number: mode !== 'CASH' ? 'POS-TRANS' : '',
      },
    ]);
  };

  const handleClearPayments = () => {
    setPayments([
      {
        id: `pay-${Date.now()}`,
        payment_mode: 'CASH',
        amount: '',
        reference_number: '',
      },
    ]);
  };

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

    // Validate weights before submission
    for (const item of saleItems) {
      const gross = toDecimal(item.gross_weight);
      const less = toDecimal(item.less_weight);
      if (gross.lte(0)) {
        showToast('error', `Gross weight must be greater than zero for "${item.item_name || 'item'}"`);
        return;
      }
      if (less.gt(gross)) {
        showToast('error', `Less weight cannot exceed gross weight for "${item.item_name || 'item'}"`);
        return;
      }
    }

    for (const ex of exchangeItems) {
      const gross = toDecimal(ex.gross_weight);
      const less = toDecimal(ex.less_weight);
      if (gross.lte(0)) {
        showToast('error', `Gross weight must be greater than zero for exchange item "${ex.item_name || 'scrap'}"`);
        return;
      }
      if (less.gt(gross)) {
        showToast('error', `Less weight cannot exceed gross weight for exchange item "${ex.item_name || 'scrap'}"`);
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
        items: saleItems.map((item) => {
          const gross = toDecimal(item.gross_weight);
          const less = toDecimal(item.less_weight);
          const net = Decimal.max(0, gross.minus(less));
          const tunch = toDecimal(item.tunch_percent);
          const fine = net.times(tunch).dividedBy(100);
          const rate = toDecimal(item.rate_per_gram);
          const metalVal = fine.times(rate);

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
            tag_no: item.tag_no.trim() || `TAG-${Date.now().toString(36).toUpperCase()}`,
            item_name: item.item_name.trim() || 'Jewellery Item',
            metal_id: item.metal_id,
            purity_id: item.purity_id,
            gross_weight: gross.toNumber(),
            less_weight: less.toNumber(),
            tunch_percent: tunch.toNumber(),
            wastage_percent: toDecimal(item.wastage_percent).toNumber(),
            rate_per_gram: rate.toNumber(),
            pieces: pcs.toNumber(),
            making_charge: making.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
            metal_rate: rate.toNumber(),
            making_rate: makingRate.toNumber(),
            making_charge_type: item.making_charge_type,
            notes: item.notes,
          };
        }),
        exchange_items:
          exchangeItems.length > 0
            ? exchangeItems.map((ex) => ({
                source_type: 'CUSTOMER_JEWELLERY' as const,
                metal_id: ex.metal_id,
                purity_id: ex.purity_id,
                item_name: ex.item_name.trim() || 'Old Metal Scrap',
                tag_no: ex.tag_no.trim() || undefined,
                gross_weight: toDecimal(ex.gross_weight).toNumber(),
                less_weight: toDecimal(ex.less_weight).toNumber(),
                tunch_percent: toDecimal(ex.tunch_percent).toNumber(),
                exchange_rate: toDecimal(ex.exchange_rate).toNumber(),
                deduction_percent: toDecimal(ex.deduction_percent).toNumber(),
              }))
            : undefined,
        payments:
          payments.filter((p) => toDecimal(p.amount).gt(0)).length > 0
            ? payments
                .filter((p) => toDecimal(p.amount).gt(0))
                .map((p) => ({
                  payment_mode: p.payment_mode,
                  amount: toDecimal(p.amount).toNumber(),
                  metal_weight: p.metal_weight ? toDecimal(p.metal_weight).toNumber() : undefined,
                  metal_rate: p.metal_rate ? toDecimal(p.metal_rate).toNumber() : undefined,
                  metal_id: p.metal_id || undefined,
                  purity_id: p.purity_id || undefined,
                  reference_number: p.reference_number || undefined,
                  notes: p.notes || undefined,
                }))
            : undefined,
      };

      const created = await salesApi.createDraft(payload);

      if (finalize) {
        try {
          await salesApi.finalize(created.id);
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
          <button
            type="button"
            className={`pos-tab-pill ${billType === 'RETAIL' ? 'active' : ''}`}
            onClick={() => setBillType('RETAIL')}
          >
            Retail Sale
          </button>
          <button
            type="button"
            className={`pos-tab-pill ${billType === 'WHOLESALE' ? 'active' : ''}`}
            onClick={() => setBillType('WHOLESALE')}
          >
            Wholesale
          </button>
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
            <div className="flex items-center justify-between mb-1">
              <label className="meta-label">Customer Name *</label>
              <div className="customer-header-actions">
                <button
                  type="button"
                  className="quick-walkin-link"
                  onClick={handleQuickWalkin}
                  title="Select or create Walk-in Retail Customer"
                >
                  <UserCheck size={12} />
                  <span>+ Quick Walk-in</span>
                </button>
                <button
                  type="button"
                  className="quick-add-customer-link"
                  onClick={handleOpenCustomerModal}
                  title="Create new customer in Master directory & select for invoice"
                >
                  <UserPlus size={12} />
                  <span>+ Add Customer</span>
                </button>
              </div>
            </div>
            <select
              className="pos-input customer-select font-mono"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.length === 0 ? (
                <option value="">No customers found — Click + Quick Walk-in</option>
              ) : (
                customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || 'No phone'}) — {c.customer_type || 'RETAIL'}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Contact & Type Info */}
          <div className="meta-col contact-col">
            <label className="meta-label">Phone & Address</label>
            <div className="customer-info-box font-mono text-xs">
              <span className="text-main font-semibold">{selectedCustomer?.phone || 'No Phone'}</span>
              <span className="text-muted ml-2">{selectedCustomer?.address || 'Counter Walk-in'}</span>
            </div>
          </div>

          {/* Invoice Date */}
          <div className="meta-col date-col">
            <label className="meta-label">Invoice Date *</label>
            <input
              type="date"
              className="pos-input font-mono"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          {/* Place of Supply */}
          <div className="meta-col supply-col">
            <label className="meta-label">Place of Supply</label>
            <div className="pos-readonly-box font-mono text-xs text-gold">
              {shopProfile?.state || 'Maharashtra'} (State Code: 27)
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
                <th className="col-tag">Tag No</th>
                <th className="col-desc">Item Name ▾</th>
                <th className="col-metal">Metal</th>
                <th className="col-purity">Purity</th>
                <th className="col-gross text-right">Gross (g)</th>
                <th className="col-less text-right">Less (g)</th>
                <th className="col-net text-right">Net (g)</th>
                <th className="col-tunch text-right">Tunch%</th>
                <th className="col-waste text-right">Waste%</th>
                <th className="col-making text-center">Making Charge</th>
                <th className="col-fine text-right">Fine Wt</th>
                <th className="col-rate text-right">Rate/g (₹)</th>
                <th className="col-amount text-right">Amount (₹)</th>
                <th className="col-action text-center">✕</th>
              </tr>
            </thead>
            <tbody>
              {saleItems.map((item, idx) => {
                const gross = toDecimal(item.gross_weight);
                const less = toDecimal(item.less_weight);
                const net = Decimal.max(0, gross.minus(less));
                const tunch = toDecimal(item.tunch_percent);
                const fine = net.times(tunch).dividedBy(100);
                const rate = toDecimal(item.rate_per_gram);
                const metalVal = fine.times(rate);
                const wastage = toDecimal(item.wastage_percent);
                const wastageWeight = net.times(wastage).dividedBy(100);
                const wastageAmount = wastageWeight.times(rate);
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
                const rowAmount = metalVal.plus(wastageAmount).plus(making);

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
                        onChange={(e) => handleUpdateSaleRow(item.id, { tag_no: e.target.value })}
                        placeholder="TAG-NO"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="grid-input font-semibold"
                        value={item.item_name}
                        onChange={(e) => handleUpdateSaleRow(item.id, { item_name: e.target.value })}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <select
                        className="grid-select font-mono text-xs"
                        value={item.metal_id}
                        onChange={(e) => handleUpdateSaleRow(item.id, { metal_id: e.target.value })}
                      >
                        {metals.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="grid-select font-mono text-xs"
                        value={item.purity_id}
                        onChange={(e) => handleUpdateSaleRow(item.id, { purity_id: e.target.value })}
                      >
                        {purities.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="grid-input text-right font-mono text-main font-bold"
                        value={item.gross_weight ?? ''}
                        onChange={(e) => handleUpdateSaleRow(item.id, { gross_weight: parseDecimalInput(e.target.value, 4) })}
                        placeholder="0.000"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="grid-input text-right font-mono text-muted"
                        value={item.less_weight ?? ''}
                        onChange={(e) => handleUpdateSaleRow(item.id, { less_weight: parseDecimalInput(e.target.value, 4) })}
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
                        inputMode="decimal"
                        className="grid-input text-right font-mono text-xs"
                        value={item.tunch_percent ?? ''}
                        onChange={(e) => handleUpdateSaleRow(item.id, { tunch_percent: parseDecimalInput(e.target.value, 4) })}
                        placeholder="91.67"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="grid-input text-right font-mono text-xs"
                        value={item.wastage_percent ?? ''}
                        onChange={(e) => handleUpdateSaleRow(item.id, { wastage_percent: parseDecimalInput(e.target.value, 2) })}
                        placeholder="0"
                      />
                    </td>
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
                              className="making-rate-input font-mono text-right"
                              value={item.making_rate ?? ''}
                              onChange={(e) => handleUpdateSaleRow(item.id, { making_rate: parseDecimalInput(e.target.value, 2) })}
                              placeholder={
                                item.making_charge_type === 'PER_PIECE'
                                  ? '₹/pc'
                                  : item.making_charge_type === 'FIXED'
                                  ? '₹ Fix'
                                  : item.making_charge_type === 'PERCENTAGE'
                                  ? '%'
                                  : '450'
                              }
                              title={
                                item.making_charge_type === 'PER_PIECE'
                                  ? 'Making charge rate per piece (₹/pc)'
                                  : item.making_charge_type === 'FIXED'
                                  ? 'Fixed lump-sum making charge (₹)'
                                  : item.making_charge_type === 'PERCENTAGE'
                                  ? 'Making charge percentage of metal value (%)'
                                  : 'Making charge rate per gram (₹/g)'
                              }
                            />
                          </div>
                        </div>
                        <div className="making-sub-label font-mono">
                          {item.making_charge_type === 'PER_PIECE'
                            ? `₹${making.toFixed(2)} (${item.pieces || 1} pc @ ₹${item.making_rate || 0})`
                            : item.making_charge_type === 'FIXED'
                            ? `₹${making.toFixed(2)} (Fixed)`
                            : item.making_charge_type === 'PERCENTAGE'
                            ? `₹${making.toFixed(2)} (${item.making_rate || 0}%)`
                            : `₹${making.toFixed(2)} (@₹${item.making_rate || 0}/g)`}
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="grid-readonly-cell fine">
                        {formatFineWeight(fine, 4)}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="grid-input text-right font-mono font-semibold text-main"
                        value={item.rate_per_gram ?? ''}
                        onChange={(e) => handleUpdateSaleRow(item.id, { rate_per_gram: parseDecimalInput(e.target.value, 2) })}
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
                          onClick={() => handleRemoveSaleRow(item.id)}
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
                    <span className="badge-metal-summary whitespace-nowrap">■ Gold: {formatWeight(calculations.goldNetWeight, 3)}g</span>
                    {calculations.silverNetWeight > 0 && (
                      <span className="badge-metal-summary silver whitespace-nowrap">■ Silv: {formatWeight(calculations.silverNetWeight, 3)}g</span>
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
                <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                  {formatFineWeight(calculations.totalFineWeight, 4)}
                </td>
                <td></td>
                <td className="text-right font-mono font-bold text-gold text-base whitespace-nowrap">
                  {formatCurrency(calculations.totalSaleAmount)}
                </td>
                <td></td>
              </tr>
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
              <span>+ Add Customer Scrap / Old Gold</span>
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
                  <th className="col-purity">Purity</th>
                  <th className="col-gross text-right">Gross (g)</th>
                  <th className="col-less text-right">Less (g)</th>
                  <th className="col-net text-right">Net (g)</th>
                  <th className="col-tunch text-right">Tunch%</th>
                  <th className="col-deduct text-right">Deduction%</th>
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
                  const fine = net.times(tunch).dividedBy(100);
                  const rate = toDecimal(ex.exchange_rate);
                  const metalVal = fine.times(rate);
                  const dedPercent = toDecimal(ex.deduction_percent);
                  const deduction = metalVal.times(dedPercent).dividedBy(100);
                  const exVal = Decimal.max(0, metalVal.minus(deduction));

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
                        <select
                          className="grid-select font-mono text-xs"
                          value={ex.purity_id}
                          onChange={(e) => handleUpdateExchangeRow(ex.id, { purity_id: e.target.value })}
                        >
                          {purities.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="grid-input text-right font-mono text-main font-bold"
                          value={ex.gross_weight ?? ''}
                          onChange={(e) =>
                            handleUpdateExchangeRow(ex.id, { gross_weight: parseDecimalInput(e.target.value, 4) })
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
                            handleUpdateExchangeRow(ex.id, { less_weight: parseDecimalInput(e.target.value, 4) })
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
                          inputMode="decimal"
                          className="grid-input text-right font-mono text-xs"
                          value={ex.tunch_percent ?? ''}
                          onChange={(e) =>
                            handleUpdateExchangeRow(ex.id, { tunch_percent: parseDecimalInput(e.target.value, 4) })
                          }
                          placeholder="85"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="grid-input text-right font-mono text-xs"
                          value={ex.deduction_percent ?? ''}
                          onChange={(e) =>
                            handleUpdateExchangeRow(ex.id, { deduction_percent: parseDecimalInput(e.target.value, 2) })
                          }
                          placeholder="2.0"
                        />
                      </td>
                      <td className="text-right">
                        <div className="grid-readonly-cell fine">
                          {formatFineWeight(fine, 4)}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="grid-input text-right font-mono font-semibold"
                          value={ex.exchange_rate ?? ''}
                          onChange={(e) =>
                            handleUpdateExchangeRow(ex.id, { exchange_rate: parseDecimalInput(e.target.value, 2) })
                          }
                          placeholder="6800"
                        />
                      </td>
                      <td className="text-right">
                        <div className="grid-readonly-cell exchange-amount">
                          {formatCurrency(exVal.toNumber())}
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
                    TOTAL EXCHANGE RETURN
                  </td>
                  <td className="text-right font-mono font-bold whitespace-nowrap">
                    {formatWeight(calculations.totalExchangeGross, 3)}
                  </td>
                  <td></td>
                  <td className="text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                    {formatWeight(calculations.totalExchangeNet, 3)}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="text-right font-mono text-muted whitespace-nowrap">
                    {formatFineWeight(calculations.totalExchangeFine, 4)}
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

      {/* LOWER SECTION: PAYMENT RECEIVED & SUMMARY BALANCE */}
      <div className="pos-lower-grid mt-4">
        {/* LEFT COLUMN: Payment Tender Breakdown */}
        <div className="pos-payment-column">
          <div className="pos-section-card h-full">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <CreditCard size={17} className="gold" />
                <h2 className="section-title">Payment Received</h2>
              </div>
              <div className="flex items-center gap-1.5">
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
                className="btn-quick-tender cash"
                onClick={() => handleQuickSettle('CASH')}
              >
                Cash Full (₹{calculations.netPayable.toLocaleString('en-IN')})
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
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="BANK">Bank Transfer / NEFT</option>
                      <option value="CREDIT">Customer Credit Ledger</option>
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
                              handleUpdatePaymentRow(p.id, { metal_rate: parseDecimalInput(e.target.value, 2) })
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

                    <div className="payment-amount-input-box" title={isMetal ? 'Metal Payment Rupee Value (₹)' : 'Received Amount (₹)'}>
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
                      placeholder={isMetal ? 'Notes / Scrap details' : 'Ref / UTR / Auth No'}
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
                    <option value={3.0}>3.0% (Jewellery Tax)</option>
                    <option value={0.0}>0% (Exempted / Export)</option>
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

              {/* Breakdown of Payments Received */}
              <div className="summary-line mt-3">
                <span className="summary-label text-emerald-400 font-semibold">Total Received</span>
                <span className="summary-value font-mono font-bold text-emerald-400">
                  {formatCurrency(calculations.totalReceived)}
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

              {calculations.cashAndOtherPayments > 0 && (calculations.goldPaymentValue > 0 || calculations.silverPaymentValue > 0) && (
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

              {calculations.changeDue > 0 && (
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

              {/* Fine Metal Reconciliation */}
              <div className="metal-fine-reconciliation mt-3 pt-3 border-t">
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-muted">Fine Gold Net Sold:</span>
                  <strong className="font-mono text-gold">{formatFineWeight(calculations.goldFineWeight, 4)} g</strong>
                </div>
                {calculations.totalExchangeFine > 0 && (
                  <div className="flex justify-between text-xs py-0.5 text-amber-400">
                    <span>Fine Gold Inward Exchange:</span>
                    <strong className="font-mono">+{formatFineWeight(calculations.totalExchangeFine, 4)} g</strong>
                  </div>
                )}
                {calculations.silverFineWeight > 0 && (
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-muted">Fine Silver Net Sold:</span>
                    <strong className="font-mono">{formatFineWeight(calculations.silverFineWeight, 4)} g</strong>
                  </div>
                )}
              </div>

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
                      : `Save & Finalize Bill (${formatCurrency(calculations.grandTotal)})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK CREATE CUSTOMER MASTER MODAL */}
      {showCustomerModal && (
        <div className="modal-backdrop customer-modal-backdrop">
          <div className="modal-dialog customer-modal-dialog">
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
              <div className="customer-modal-body">
                {customerFormError && (
                  <div className="customer-form-error-alert">
                    <AlertCircle size={16} />
                    <span>{customerFormError}</span>
                  </div>
                )}

                <div className="customer-modal-grid">
                  {/* Full Name */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Full Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="customer-field-input font-semibold"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      placeholder="e.g. Ramesh Chandra / Meena Jewellers"
                    />
                  </div>

                  {/* Customer Type */}
                  <div className="customer-field">
                    <label className="customer-field-label">Customer Type</label>
                    <select
                      className="customer-field-select font-mono text-xs"
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

                  {/* Customer Code (Optional) */}
                  <div className="customer-field">
                    <label className="customer-field-label">Customer Code (Optional)</label>
                    <input
                      type="text"
                      className="customer-field-input font-mono text-xs"
                      value={customerForm.customer_code}
                      onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value })}
                      placeholder="Auto-generated if blank"
                    />
                  </div>

                  {/* Mobile Phone */}
                  <div className="customer-field">
                    <label className="customer-field-label">Mobile Phone</label>
                    <input
                      type="tel"
                      className="customer-field-input font-mono"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                    />
                  </div>

                  {/* Alternate Phone */}
                  <div className="customer-field">
                    <label className="customer-field-label">Alternate Phone</label>
                    <input
                      type="tel"
                      className="customer-field-input font-mono"
                      value={customerForm.alternate_phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, alternate_phone: e.target.value })}
                      placeholder="Landline / second number"
                    />
                  </div>

                  {/* Email */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Email Address (Optional)</label>
                    <input
                      type="email"
                      className="customer-field-input"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      placeholder="customer@domain.com"
                    />
                  </div>

                  {/* Address */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Address / Shop Address</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      placeholder="Door / Building / Street name"
                    />
                  </div>

                  {/* City */}
                  <div className="customer-field">
                    <label className="customer-field-label">City / Town</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                      placeholder="City / Town"
                    />
                  </div>

                  {/* State */}
                  <div className="customer-field">
                    <label className="customer-field-label">State</label>
                    <input
                      type="text"
                      className="customer-field-input"
                      value={customerForm.state}
                      onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                      placeholder="Maharashtra"
                    />
                  </div>

                  {/* Pincode */}
                  <div className="customer-field">
                    <label className="customer-field-label">Pincode</label>
                    <input
                      type="text"
                      className="customer-field-input font-mono"
                      value={customerForm.pincode}
                      onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value })}
                      placeholder="400001"
                    />
                  </div>

                  {/* GSTIN */}
                  <div className="customer-field">
                    <label className="customer-field-label">GSTIN (Optional)</label>
                    <input
                      type="text"
                      className="customer-field-input font-mono uppercase"
                      value={customerForm.gstin}
                      onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value })}
                      placeholder="15-character GSTIN"
                    />
                  </div>

                  {/* Opening Balance */}
                  <div className="customer-field">
                    <label className="customer-field-label">Opening Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="customer-field-input font-mono"
                      value={customerForm.opening_balance || 0}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
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
                      value={customerForm.opening_balance_type}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          opening_balance_type: e.target.value as any,
                        })
                      }
                    >
                      <option value="DEBIT">Debit (Customer owes shop)</option>
                      <option value="CREDIT">Credit (Shop owes customer)</option>
                    </select>
                  </div>

                  {/* Internal Notes */}
                  <div className="customer-field col-span-2">
                    <label className="customer-field-label">Internal Notes</label>
                    <textarea
                      rows={2}
                      className="customer-field-textarea"
                      value={customerForm.notes}
                      onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                      placeholder="Customer preferences, referral, family details..."
                    />
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
                  {shopProfile?.pan && <span>PAN: <strong>{shopProfile.pan}</strong></span>}
                </div>
              </div>

              {/* Metadata Grid (Customer & Invoice Info) */}
              <div className="tax-invoice-meta-grid">
                {/* Left: Customer Info */}
                <div className="invoice-meta-card">
                  <div className="invoice-meta-header">BILLED TO (CUSTOMER DETAILS)</div>
                  <div className="meta-customer-name">
                    {createdInvoice.customer_name || 'Walk-in Retail Customer'}
                  </div>
                  <div className="meta-info-row">
                    <span className="meta-info-label">Contact / Phone:</span>
                    <span className="meta-info-val font-mono">
                      {createdInvoice.customer_phone || 'Counter Walk-in'}
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

              {/* Items Table with ALL Input Fields */}
              <div className="print-table-wrapper">
                <table className="print-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28px', textAlign: 'center' }}>#</th>
                      <th>Tag #</th>
                      <th>Item Description</th>
                      <th>Purity</th>
                      <th className="text-right">Gross (g)</th>
                      <th className="text-right">Less (g)</th>
                      <th className="text-right">Net (g)</th>
                      <th className="text-right">Tunch %</th>
                      <th className="text-right">Fine Wt</th>
                      <th className="text-right">Wastage</th>
                      <th className="text-right">Rate (₹/g)</th>
                      <th className="text-right">Making (₹)</th>
                      <th className="text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(createdInvoice.items || []).map((it, idx) => {
                      const gross = Number(it.gross_weight || 0);
                      const less = Number(it.less_weight || 0);
                      const net = Number(it.net_weight || Math.max(0, gross - less));
                      const tunch = Number(it.tunch_percent || 0);
                      const fine = Number(it.fine_weight || (net * tunch) / 100);
                      const metalRate = Number(it.rate_per_gram ?? it.metal_rate ?? 0);
                      const wastagePercent = Number(it.wastage_percent ?? 0);
                      const wastageWeight = Number(it.wastage_weight ?? (wastagePercent > 0 ? (net * wastagePercent) / 100 : 0));
                      const wastageAmount = Number(it.wastage_amount ?? (wastageWeight * metalRate));
                      const makingCharge = Number(it.making_charge ?? it.making_charges ?? 0);
                      const metalValue = Number(it.metal_value ?? (fine * metalRate));
                      const itemTotal = Number(it.item_amount ?? it.item_total ?? (metalValue + wastageAmount + makingCharge));

                      return (
                        <tr key={it.id || idx}>
                          <td style={{ textAlign: 'center' }} className="font-mono">{idx + 1}</td>
                          <td className="font-mono text-xs font-semibold whitespace-nowrap">{it.tag_no || '-'}</td>
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
                          <td className="text-right font-mono text-muted whitespace-nowrap">{formatWeight(less, 3)}</td>
                          <td className="text-right font-mono font-bold whitespace-nowrap">{formatWeight(net, 3)}</td>
                          <td className="text-right font-mono whitespace-nowrap">{tunch > 0 ? `${tunch.toFixed(2)}%` : '-'}</td>
                          <td className="text-right font-mono text-muted whitespace-nowrap">{fine > 0 ? formatFineWeight(fine, 4) : '-'}</td>
                          <td className="text-right font-mono text-xs whitespace-nowrap">
                            {wastagePercent > 0 ? (
                              <div>
                                <div>{formatWeight(wastageWeight, 3)}g</div>
                                <div className="text-[10px] text-muted">({wastagePercent}%)</div>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="text-right font-mono whitespace-nowrap">{formatMetalRate(metalRate)}</td>
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
                          <td className="text-right font-mono font-bold whitespace-nowrap">
                            {formatCurrency(itemTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="print-totals-row">
                      <td colSpan={4} className="text-right font-bold uppercase whitespace-nowrap">
                        Totals ({createdInvoice.items?.length || 0} item{createdInvoice.items?.length === 1 ? '' : 's'}):
                      </td>
                      <td className="text-right font-mono font-bold whitespace-nowrap">
                        {formatWeight(
                          (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.gross_weight || 0), 0),
                          3
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                        {formatWeight(
                          (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.less_weight || 0), 0),
                          3
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                        {formatWeight(
                          (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.net_weight || 0), 0),
                          3
                        )}
                      </td>
                      <td></td>
                      <td className="text-right font-mono font-bold text-muted whitespace-nowrap">
                        {formatFineWeight(
                          (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.fine_weight || 0), 0),
                          4
                        )}
                      </td>
                      <td></td>
                      <td></td>
                      <td className="text-right font-mono font-bold whitespace-nowrap">
                        {formatCurrency(
                          (createdInvoice.items || []).reduce((acc, it) => acc + Number(it.making_charge ?? it.making_charges ?? 0), 0)
                        )}
                      </td>
                      <td className="text-right font-mono font-bold text-base text-amber-800 whitespace-nowrap">
                        {formatCurrency(
                          (createdInvoice.items || []).reduce((acc, it) => {
                            const metalRate = Number(it.rate_per_gram ?? it.metal_rate ?? 0);
                            const makingCharge = Number(it.making_charge ?? it.making_charges ?? 0);
                            const wastagePercent = Number(it.wastage_percent ?? 0);
                            const net = Number(it.net_weight || 0);
                            const wastageWeight = Number(it.wastage_weight ?? (wastagePercent > 0 ? (net * wastagePercent) / 100 : 0));
                            const wastageAmount = Number(it.wastage_amount ?? (wastageWeight * metalRate));
                            const tunch = Number(it.tunch_percent || 0);
                            const fine = Number(it.fine_weight || (net * tunch) / 100);
                            const metalValue = Number(it.metal_value ?? (fine * metalRate));
                            return acc + Number(it.item_amount ?? it.item_total ?? (metalValue + wastageAmount + makingCharge));
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Customer Scrap / Old Metal Exchange Table (If any) */}
              {createdInvoice.exchange && createdInvoice.exchange.items && createdInvoice.exchange.items.length > 0 && (
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
                          <th>Tag #</th>
                          <th>Old Scrap Item</th>
                          <th>Metal & Purity</th>
                          <th className="text-right">Gross (g)</th>
                          <th className="text-right">Less (g)</th>
                          <th className="text-right">Net (g)</th>
                          <th className="text-right">Tunch %</th>
                          <th className="text-right">Fine Wt</th>
                          <th className="text-right">Deduct %</th>
                          <th className="text-right">Ex. Rate</th>
                          <th className="text-right">Credit Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdInvoice.exchange.items.map((exIt: any, exIdx: number) => (
                          <tr key={exIt.id || exIdx}>
                            <td style={{ textAlign: 'center' }} className="font-mono">{exIdx + 1}</td>
                            <td className="font-mono text-xs">{exIt.tag_no || '-'}</td>
                            <td className="font-semibold">{exIt.item_name || 'Customer Scrap'}</td>
                            <td>{exIt.metal_name || 'Gold'} {exIt.purity_name || ''}</td>
                            <td className="text-right font-mono">{formatWeight(exIt.gross_weight, 3)}</td>
                            <td className="text-right font-mono text-muted">{formatWeight(exIt.less_weight, 3)}</td>
                            <td className="text-right font-mono font-bold">{formatWeight(exIt.net_weight, 3)}</td>
                            <td className="text-right font-mono">{Number(exIt.tunch_percent || 0).toFixed(2)}%</td>
                            <td className="text-right font-mono">{formatFineWeight(exIt.fine_weight, 4)}</td>
                            <td className="text-right font-mono">{Number(exIt.deduction_percent || 0).toFixed(1)}%</td>
                            <td className="text-right font-mono">{formatMetalRate(exIt.exchange_rate)}</td>
                            <td className="text-right font-mono font-bold text-emerald-700">
                              {formatCurrency(exIt.exchange_value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="print-totals-row">
                          <td colSpan={4} className="text-right font-bold uppercase">Total Old Metal Deducted:</td>
                          <td className="text-right font-mono font-bold">{formatWeight(createdInvoice.exchange.total_gross_weight, 3)}</td>
                          <td className="text-right font-mono text-muted">{formatWeight(createdInvoice.exchange.total_less_weight, 3)}</td>
                          <td className="text-right font-mono font-bold">{formatWeight(createdInvoice.exchange.total_net_weight, 3)}</td>
                          <td></td>
                          <td className="text-right font-mono font-bold">{formatFineWeight(createdInvoice.exchange.total_fine_weight, 4)}</td>
                          <td></td>
                          <td></td>
                          <td className="text-right font-mono font-bold text-emerald-700">
                            − {formatCurrency(createdInvoice.exchange.total_exchange_value)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

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
                          : p.payment_mode;
                      return (
                        <div key={p.id} className="print-payment-row">
                          <span className="font-semibold text-slate-700">
                            {metalLabel}
                            {p.metal_weight ? ` (${formatWeight(p.metal_weight, 3)}g @ ₹${p.metal_rate || 0}/g)` : ''}
                            {p.reference_number ? ` • Ref: ${p.reference_number}` : ''}:
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
    </div>
  );
};
