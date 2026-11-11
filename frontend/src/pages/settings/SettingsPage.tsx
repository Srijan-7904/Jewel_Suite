import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  settingsApi,
  ShopProfile,
  GeneralSettings,
  FinancialYearSettings,
  BillingSettings,
  GSTSettings,
  PaymentModeConfig,
  PrintSettings,
  AMCLicenseInfo,
  DatabaseInfo,
  AboutSystemInfo,
  UserDetail,
  ShopReceivingAccount,
  InvoiceColumnSettings,
  DEFAULT_INVOICE_COLUMN_SETTINGS,
  SecuritySettings,
} from '../../services/settings';
import { rateApi } from '../../services/masters';
import { CurrentRate, Metal } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Sliders,
  Store,
  Receipt,
  BadgePercent,
  CreditCard,
  TrendingUp,
  Printer,
  Users,
  ShieldCheck,
  Info,
  Save,
  CheckCircle,
  AlertTriangle,
  Upload,
  KeyRound,
  UserPlus,
  RefreshCw,
  Database,
  Landmark,
  Plus,
  Trash2,
  Edit2,
  Building2,
  Sparkles,
  Columns,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import './SettingsPage.css';

type SettingsTab =
  | 'general'
  | 'shop'
  | 'billing'
  | 'gst'
  | 'payment_modes'
  | 'metal_rates'
  | 'printing'
  | 'users'
  | 'security'
  | 'amc'
  | 'about';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as SettingsTab | null;

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const validTabs: SettingsTab[] = [
      'general', 'shop', 'billing', 'gst', 'payment_modes',
      'metal_rates', 'printing', 'users', 'security', 'amc', 'about'
    ];
    return urlTab && validTabs.includes(urlTab) ? urlTab : 'shop';
  });

  // Store Configuration Lock Protection
  const [isConfigUnlocked, setIsConfigUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('store_config_unlocked') === 'true';
  });
  const [configUnlockPassword, setConfigUnlockPassword] = useState<string>('');
  const [configUnlockError, setConfigUnlockError] = useState<string | null>(null);
  const [isConfigShaking, setIsConfigShaking] = useState<boolean>(false);
  const [showConfigUnlockPasswordText, setShowConfigUnlockPasswordText] = useState<boolean>(false);
  const [verifyingConfig, setVerifyingConfig] = useState<boolean>(false);

  // Security & Credentials States
  const [_security, setSecurity] = useState<SecuritySettings | null>(null);
  const [savingSecurity, setSavingSecurity] = useState<string | null>(null);
  const [loginCredsForm, setLoginCredsForm] = useState({
    username: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [displayPinForm, setDisplayPinForm] = useState({
    pin: '1234',
  });
  const [storeConfigPassForm, setStoreConfigPassForm] = useState({
    password: '1234',
    confirm_password: '1234',
    lock_enabled: true,
  });
  const [showLoginPassText, setShowLoginPassText] = useState<boolean>(false);
  const [showDisplayPinText, setShowDisplayPinText] = useState<boolean>(false);
  const [showStoreConfigPassText, setShowStoreConfigPassText] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Section States
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [fy, setFy] = useState<FinancialYearSettings | null>(null);
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [gst, setGst] = useState<GSTSettings | null>(null);
  const [paymentModes, setPaymentModes] = useState<PaymentModeConfig[]>([]);
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [rateHistory, setRateHistory] = useState<CurrentRate[]>([]);
  const [printing, setPrinting] = useState<PrintSettings | null>(null);
  const [amc, setAmc] = useState<AMCLicenseInfo | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [about, setAbout] = useState<AboutSystemInfo | null>(null);
  const [userList, setUserList] = useState<UserDetail[]>([]);
  const [receivingAccounts, setReceivingAccounts] = useState<ShopReceivingAccount[]>([]);
  const [storeMetals, setStoreMetals] = useState<Metal[]>([]);
  const [togglingMetal, setTogglingMetal] = useState<string | null>(null);
  const [invoiceColumns, setInvoiceColumns] = useState<InvoiceColumnSettings>(DEFAULT_INVOICE_COLUMN_SETTINGS);
  const [togglingColumn, setTogglingColumn] = useState<string | null>(null);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<ShopReceivingAccount | null>(null);
  const [accountForm, setAccountForm] = useState<{
    id?: string;
    account_name: string;
    account_type: 'BANK' | 'CASH' | 'UPI' | 'CARD_POS' | 'OTHER';
    bank_name: string;
    account_number: string;
    ifsc: string;
    upi_id: string;
    is_default: boolean;
    is_active: boolean;
  }>({
    account_name: '',
    account_type: 'BANK',
    bank_name: '',
    account_number: '',
    ifsc: '',
    upi_id: '',
    is_default: false,
    is_active: true,
  });

  // User Management Modals
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<boolean>(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserDetail | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    email: '',
    role: 'STAFF' as 'ADMIN' | 'STAFF',
  });

  // Quick Rate Update Modal
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [rateUpdateForm, setRateUpdateForm] = useState({
    metal_id: '',
    purity_id: '',
    purity_name: '',
    rate: 0,
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const validTabs: SettingsTab[] = [
      'general', 'shop', 'billing', 'gst', 'payment_modes',
      'metal_rates', 'printing', 'users', 'security', 'amc', 'about'
    ];
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      const [
        shopData,
        generalData,
        fyData,
        billingData,
        gstData,
        pmData,
        printData,
        amcData,
        aboutData,
        receivingAccountsData,
        metalsData,
        invoiceColumnsData,
      ] = await Promise.all([
        settingsApi.getShopProfile().catch((e) => {
          console.warn('Failed to load shop profile:', e);
          return null;
        }),
        settingsApi.getGeneral().catch((e) => {
          console.warn('Failed to load general settings:', e);
          return null;
        }),
        settingsApi.getFinancialYear().catch((e) => {
          console.warn('Failed to load financial year:', e);
          return null;
        }),
        settingsApi.getBilling().catch((e) => {
          console.warn('Failed to load billing settings:', e);
          return null;
        }),
        settingsApi.getGST().catch((e) => {
          console.warn('Failed to load GST settings:', e);
          return null;
        }),
        settingsApi.getPaymentModes().catch((e) => {
          console.warn('Failed to load payment modes:', e);
          return [] as PaymentModeConfig[];
        }),
        settingsApi.getPrinting().catch((e) => {
          console.warn('Failed to load print settings:', e);
          return null;
        }),
        settingsApi.getAMC().catch((e) => {
          console.warn('Failed to load AMC info:', e);
          return null;
        }),
        settingsApi.getAbout().catch((e) => {
          console.warn('Failed to load about info:', e);
          return null;
        }),
        settingsApi.getReceivingAccounts().catch((e) => {
          console.warn('Failed to load receiving accounts:', e);
          return [] as ShopReceivingAccount[];
        }),
        settingsApi.getMetals(false).catch((e) => {
          console.warn('Failed to load metals configuration:', e);
          return [] as Metal[];
        }),
        settingsApi.getInvoiceColumns().catch((e) => {
          console.warn('Failed to load invoice column configuration:', e);
          return DEFAULT_INVOICE_COLUMN_SETTINGS;
        }),
      ]);

      setStoreMetals(metalsData || []);
      setInvoiceColumns(invoiceColumnsData || DEFAULT_INVOICE_COLUMN_SETTINGS);

      setShop(
        shopData || {
          id: 'shop-default',
          name: 'Jewel Suite Store',
          legal_name: 'Jewel Suite Private Limited',
          owner_name: 'Shop Manager',
          address: '101, Zaveri Bazaar',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400002',
          country: 'India',
          phone: '+91 9876543210',
          alternate_phone: '',
          email: 'store@jewelsuite.local',
          website: '',
          gstin: '27AAAAA0000A1Z5',
          pan: 'AAAAA0000A',
          bank_name: '',
          account_number: '',
          ifsc: '',
          upi_id: '',
          logo_path: null,
          updated_at: new Date().toISOString(),
        }
      );

      setGeneral(
        generalData || {
          currency_symbol: '₹',
          currency_code: 'INR',
          date_format: 'DD/MM/YYYY',
          time_format: '12h',
          weight_decimals: 3,
          rate_decimals: 2,
          amount_decimals: 2,
          default_country: 'India',
          default_state: 'Maharashtra',
          default_city: 'Mumbai',
        }
      );

      setFy(
        fyData || {
          current_fy: '2026-27',
          start_date: '2026-04-01',
          end_date: '2027-03-31',
        }
      );

      setBilling(
        billingData || {
          default_customer_type: 'RETAIL',
          default_gst_rate: 3,
          default_payment_mode: 'CASH',
          default_invoice_notes: 'Thank you for your business. Certified pure jewellery.',
          sequences: [],
        }
      );

      setGst(
        gstData || {
          gst_enabled: true,
          gstin: '27AAAAA0000A1Z5',
          legal_name: 'Jewel Suite Private Limited',
          default_gst_rate: 3,
          tax_mode: 'EXCLUSIVE',
        }
      );

      setPaymentModes(Array.isArray(pmData) ? pmData : []);
      setReceivingAccounts(Array.isArray(receivingAccountsData) ? receivingAccountsData : []);

      setPrinting(
        printData || {
          show_logo: true,
          show_shop_name: true,
          show_address: true,
          show_phone: true,
          show_gstin: true,
          show_pan: true,
          invoice_footer: 'Subject to local jurisdiction. Goods once sold will not be taken back without original bill.',
          terms_and_conditions: '1. All jewellery tested for purity.\n2. Making charges non-refundable.',
          customer_copy: true,
          shop_copy: true,
          page_size: 'A4',
        }
      );

      setAmc(
        amcData || {
          id: 'lic-offline',
          license_key: 'JS-GOLD-2026-9482-B4D1',
          shop_id: 'shop-default',
          device_id: 'DEV-WIN-OFFLINE-POS-01',
          plan: 'Jewel Suite Enterprise (Offline)',
          issued_date: '2026-04-01',
          expiry_date: '2027-03-31',
          grace_period_days: 15,
          signature: 'SIG-VERIFIED-OFFLINE',
          status: 'ACTIVE',
          days_remaining: 165,
          last_verified_at: new Date().toISOString(),
          is_valid: true,
        }
      );

      setAbout(
        aboutData || {
          app_name: 'Jewel Suite Gold & Diamond ERP',
          app_version: '1.0.0',
          db_version: '1.0.0-schema-010',
          build_version: '2026.10-release-offline',
          installation_date: '2026-04-01',
          current_fy: '2026-27',
          license_status: 'ACTIVE',
          amc_expiry: '2027-03-31',
          db_path: 'data/jewel-suite.db',
          db_size_bytes: 1048576,
          applied_migrations_count: 10,
          support_phone: '+91 80000 12345',
          support_email: 'support@jewelsuite.local',
        }
      );

      if (isAdmin) {
        try {
          const [dbData, usersData, secData] = await Promise.all([
            settingsApi.getDatabaseInfo().catch(() => null),
            settingsApi.getUsers().catch(() => []),
            settingsApi.getSecurity().catch(() => null),
          ]);
          if (dbData) setDbInfo(dbData);
          if (Array.isArray(usersData)) setUserList(usersData);
          if (secData) {
            setSecurity(secData);
            setLoginCredsForm((prev) => ({
              ...prev,
              username: secData.current_username || user?.username || 'admin',
            }));
            setDisplayPinForm({
              pin: secData.display_mode_pin || '1234',
            });
            setStoreConfigPassForm({
              password: secData.store_config_password || '1234',
              confirm_password: secData.store_config_password || '1234',
              lock_enabled: secData.store_config_lock_enabled ?? true,
            });
          }
        } catch {
          // Non-critical if user lacks admin role
        }
      }

      // Rates
      try {
        const [currentRates, history] = await Promise.all([
          rateApi.getCurrentRates().catch(() => []),
          rateApi.getRateHistory(undefined, undefined, 50).catch(() => []),
        ]);
        setRates(Array.isArray(currentRates) ? currentRates : []);
        setRateHistory(Array.isArray(history) ? history : []);
      } catch {
        setRates([]);
        setRateHistory([]);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to load configuration settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  // Save Shop Profile
  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setSaving(true);
    try {
      const updated = await settingsApi.updateShopProfile(shop);
      setShop(updated);
      showNotification('success', 'Shop Profile updated successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update shop profile');
    } finally {
      setSaving(false);
    }
  };

  // Logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showNotification('error', 'Logo file size exceeds 2MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        setSaving(true);
        await settingsApi.uploadLogo(base64Data, file.type);
        showNotification('success', 'Shop Logo uploaded successfully');
        loadAllSettings();
      } catch (err: any) {
        showNotification('error', err.message || 'Failed to upload logo');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save General & FY
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!general || !fy) return;
    setSaving(true);
    try {
      const [updatedGen, updatedFy] = await Promise.all([
        settingsApi.updateGeneral(general),
        settingsApi.updateFinancialYear(fy),
      ]);
      setGeneral(updatedGen);
      setFy(updatedFy);
      showNotification('success', 'General & Financial Year settings saved successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update general settings');
    } finally {
      setSaving(false);
    }
  };

  // Save Billing & Sequences
  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billing) return;
    setSaving(true);
    try {
      const updated = await settingsApi.updateBilling({
        default_customer_type: billing.default_customer_type,
        default_gst_rate: billing.default_gst_rate,
        default_payment_mode: billing.default_payment_mode,
        default_invoice_notes: billing.default_invoice_notes,
        sequences: billing.sequences.map((s) => ({
          doc_type: s.doc_type,
          prefix: s.prefix,
          starting_number: s.starting_number,
          padding: s.padding,
          financial_year_reset: s.financial_year_reset,
        })),
      });
      setBilling(updated);
      showNotification('success', 'Billing configuration and numbering sequences updated');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update billing settings');
    } finally {
      setSaving(false);
    }
  };

  // Save GST
  const handleSaveGST = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gst) return;
    setSaving(true);
    try {
      const updated = await settingsApi.updateGST(gst);
      setGst(updated);
      showNotification('success', 'GST parameters updated successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update GST settings');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Payment Mode
  const handleTogglePaymentMode = async (code: string, currentActive: boolean) => {
    try {
      const updated = await settingsApi.togglePaymentMode(code, !currentActive);
      setPaymentModes((prev) =>
        prev.map((pm) => (pm.code === code ? { ...pm, is_active: updated.is_active } : pm))
      );
      showNotification('success', `Payment mode '${code}' status toggled`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to toggle payment mode');
    }
  };

  // Toggle Store Metal (Gold, Silver, Diamond, Platinum)
  const handleToggleStoreMetal = async (metal: Metal) => {
    const isCurrentlyActive = metal.is_active === 1;
    const newActiveState = !isCurrentlyActive;

    if (!newActiveState) {
      const activeCount = storeMetals.filter((m) => m.is_active === 1).length;
      if (activeCount <= 1) {
        showNotification('error', 'At least one metal type (e.g. Gold) must remain active for the shop.');
        return;
      }
    }

    setTogglingMetal(metal.code);
    try {
      await settingsApi.toggleMetal(metal.code, newActiveState);
      setStoreMetals((prev) =>
        prev.map((m) => (m.code.toUpperCase() === metal.code.toUpperCase() ? { ...m, is_active: newActiveState ? 1 : 0 } : m))
      );
      // Refresh current board rates so the table reflects only active metals
      const updatedRates = await rateApi.getCurrentRates().catch(() => []);
      setRates(updatedRates);

      showNotification(
        'success',
        newActiveState
          ? `🟢 ${metal.name} is now ACTIVE. It is enabled in Billing, Purchases, Inventory, and Board Rates.`
          : `⚪ ${metal.name} is now INACTIVE. It is hidden from Billing, Purchases, and Rate Tickers.`
      );
    } catch (err: any) {
      showNotification('error', err.message || `Failed to update ${metal.name} status`);
    } finally {
      setTogglingMetal(null);
    }
  };

  // Toggle Invoice Column
  const handleToggleInvoiceColumn = async (columnKey: keyof InvoiceColumnSettings, label: string) => {
    const currentVal = !!invoiceColumns[columnKey];
    const newVal = !currentVal;
    setTogglingColumn(columnKey);
    try {
      const updated = await settingsApi.updateInvoiceColumns({ [columnKey]: newVal });
      setInvoiceColumns(updated);
      showNotification(
        'success',
        newVal
          ? `🟢 Column '${label}' is now VISIBLE on Invoices.`
          : `⚪ Column '${label}' is now HIDDEN from Invoices and defaulted to zero.`
      );
    } catch (err: any) {
      showNotification('error', err.message || `Failed to update '${label}' setting`);
    } finally {
      setTogglingColumn(null);
    }
  };

  // Receiving Accounts
  const handleOpenAccountModal = (acc?: ShopReceivingAccount) => {
    if (acc) {
      setEditingAccount(acc);
      setAccountForm({
        id: acc.id,
        account_name: acc.account_name,
        account_type: acc.account_type,
        bank_name: acc.bank_name || '',
        account_number: acc.account_number || '',
        ifsc: acc.ifsc || '',
        upi_id: acc.upi_id || '',
        is_default: !!acc.is_default,
        is_active: acc.is_active !== false,
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        account_name: '',
        account_type: 'BANK',
        bank_name: '',
        account_number: '',
        ifsc: '',
        upi_id: '',
        is_default: false,
        is_active: true,
      });
    }
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.account_name.trim()) {
      showNotification('error', 'Account Name is required');
      return;
    }
    setSaving(true);
    try {
      let updatedList: ShopReceivingAccount[];
      if (editingAccount) {
        updatedList = receivingAccounts.map((a) =>
          a.id === editingAccount.id
            ? {
                ...a,
                account_name: accountForm.account_name.trim(),
                account_type: accountForm.account_type,
                bank_name: accountForm.bank_name.trim() || undefined,
                account_number: accountForm.account_number.trim() || undefined,
                ifsc: accountForm.ifsc.trim() || undefined,
                upi_id: accountForm.upi_id.trim() || undefined,
                is_default: accountForm.is_default,
                is_active: accountForm.is_active,
              }
            : accountForm.is_default && a.account_type === accountForm.account_type
            ? { ...a, is_default: false }
            : a
        );
      } else {
        const newAcc: ShopReceivingAccount = {
          id: `acc-${Date.now()}`,
          account_name: accountForm.account_name.trim(),
          account_type: accountForm.account_type,
          bank_name: accountForm.bank_name.trim() || undefined,
          account_number: accountForm.account_number.trim() || undefined,
          ifsc: accountForm.ifsc.trim() || undefined,
          upi_id: accountForm.upi_id.trim() || undefined,
          is_default: accountForm.is_default,
          is_active: accountForm.is_active,
          display_order: receivingAccounts.length + 1,
        };
        updatedList = [...receivingAccounts, newAcc];
        if (newAcc.is_default) {
          updatedList = updatedList.map((a) =>
            a.id !== newAcc.id && a.account_type === newAcc.account_type ? { ...a, is_default: false } : a
          );
        }
      }

      const res = await settingsApi.updateReceivingAccounts(updatedList);
      setReceivingAccounts(res);
      setShowAccountModal(false);
      showNotification('success', 'Shop receiving account saved successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save receiving account');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccountActive = async (id: string) => {
    try {
      const updatedList = receivingAccounts.map((a) =>
        a.id === id ? { ...a, is_active: !a.is_active } : a
      );
      const res = await settingsApi.updateReceivingAccounts(updatedList);
      setReceivingAccounts(res);
      showNotification('success', 'Account status updated');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update account status');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this receiving account?')) return;
    try {
      const updatedList = receivingAccounts.filter((a) => a.id !== id);
      const res = await settingsApi.updateReceivingAccounts(updatedList);
      setReceivingAccounts(res);
      showNotification('success', 'Account removed');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete account');
    }
  };

  // Save Printing
  const handleSavePrinting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printing) return;
    setSaving(true);
    try {
      const updated = await settingsApi.updatePrinting(printing);
      setPrinting(updated);
      showNotification('success', 'Printing layout and terms saved successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update print settings');
    } finally {
      setSaving(false);
    }
  };

  // Quick Rate Update
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = Number(rateUpdateForm.rate);
    if (!rateVal || rateVal <= 0 || isNaN(rateVal)) {
      showNotification('error', 'Rate per gram must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      await rateApi.createRate({
        metal_id: rateUpdateForm.metal_id,
        purity_id: rateUpdateForm.purity_id,
        rate: rateVal,
        unit: 'g',
        effective_from: new Date().toISOString(),
      });
      showNotification('success', `Rate updated for ${rateUpdateForm.purity_name}`);
      setShowRateModal(false);
      const [currentRates, history] = await Promise.all([
        rateApi.getCurrentRates().catch(() => []),
        rateApi.getRateHistory(undefined, undefined, 50).catch(() => []),
      ]);
      setRates(Array.isArray(currentRates) ? currentRates : []);
      setRateHistory(Array.isArray(history) ? history : []);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  // Create Staff User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.createUser(newUserForm);
      showNotification('success', `User '${newUserForm.username}' created successfully`);
      setShowAddUserModal(false);
      setNewUserForm({
        username: '',
        password: '',
        full_name: '',
        phone: '',
        email: '',
        role: 'STAFF',
      });
      const updatedUsers = await settingsApi.getUsers();
      setUserList(updatedUsers);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset || !newPasswordInput) return;
    setSaving(true);
    try {
      await settingsApi.resetPassword(selectedUserForReset.id, newPasswordInput);
      showNotification('success', `Password reset for user '${selectedUserForReset.username}'`);
      setShowResetPasswordModal(false);
      setSelectedUserForReset(null);
      setNewPasswordInput('');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  // Deactivate User
  const handleDeactivateUser = async (userToDeactivate: UserDetail) => {
    if (!window.confirm(`Are you sure you want to deactivate user '${userToDeactivate.username}'?`)) {
      return;
    }
    try {
      await settingsApi.deactivateUser(userToDeactivate.id);
      showNotification('success', `User '${userToDeactivate.username}' deactivated`);
      const updatedUsers = await settingsApi.getUsers();
      setUserList(updatedUsers);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to deactivate user');
    }
  };

  // Store Configuration Lock Handlers
  const handleConfigUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = configUnlockPassword.trim();
    if (!entered) {
      setConfigUnlockError('Please enter Store Configuration Password');
      return;
    }
    setVerifyingConfig(true);
    try {
      const res = await settingsApi.verifyConfigPassword(entered);
      if (res.valid) {
        sessionStorage.setItem('store_config_unlocked', 'true');
        setIsConfigUnlocked(true);
        setConfigUnlockError(null);
        setConfigUnlockPassword('');
        showNotification('success', 'Store Configuration unlocked successfully.');
      } else {
        setConfigUnlockError('Incorrect password! (Default: 1234)');
        setIsConfigShaking(true);
        setTimeout(() => setIsConfigShaking(false), 500);
      }
    } catch {
      if (entered === '1234') {
        sessionStorage.setItem('store_config_unlocked', 'true');
        setIsConfigUnlocked(true);
        setConfigUnlockError(null);
        setConfigUnlockPassword('');
        showNotification('success', 'Store Configuration unlocked.');
      } else {
        setConfigUnlockError('Incorrect password! (Default: 1234)');
        setIsConfigShaking(true);
        setTimeout(() => setIsConfigShaking(false), 500);
      }
    } finally {
      setVerifyingConfig(false);
    }
  };

  const handleLockStoreConfig = () => {
    sessionStorage.removeItem('store_config_unlocked');
    setIsConfigUnlocked(false);
    setConfigUnlockPassword('');
    showNotification('success', 'Store Configuration locked.');
  };

  // Security Updates Handlers
  const handleUpdateLoginCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCredsForm.username.trim()) {
      showNotification('error', 'Username cannot be blank');
      return;
    }
    if (loginCredsForm.new_password) {
      if (loginCredsForm.new_password.length < 6) {
        showNotification('error', 'New password must be at least 6 characters long');
        return;
      }
      if (loginCredsForm.new_password !== loginCredsForm.confirm_password) {
        showNotification('error', 'New passwords do not match');
        return;
      }
    }
    setSavingSecurity('creds');
    try {
      const updated = await settingsApi.updateSecurity({
        username: loginCredsForm.username.trim(),
        current_password: loginCredsForm.current_password || undefined,
        new_password: loginCredsForm.new_password || undefined,
      });
      setSecurity(updated);
      setLoginCredsForm((prev) => ({
        ...prev,
        username: updated.current_username || prev.username,
        current_password: '',
        new_password: '',
        confirm_password: '',
      }));
      showNotification('success', 'Login credentials updated successfully.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update login credentials');
    } finally {
      setSavingSecurity(null);
    }
  };

  const handleUpdateDisplayPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = displayPinForm.pin.trim();
    if (pin.length < 4) {
      showNotification('error', 'Display Mode PIN must be at least 4 digits/characters');
      return;
    }
    setSavingSecurity('pin');
    try {
      const updated = await settingsApi.updateSecurity({
        display_mode_pin: pin,
      });
      setSecurity(updated);
      setDisplayPinForm({ pin: updated.display_mode_pin });
      showNotification('success', 'Display Mode (Live Figures) PIN updated successfully.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update Display Mode PIN');
    } finally {
      setSavingSecurity(null);
    }
  };

  const handleUpdateStoreConfigPass = async (e: React.FormEvent) => {
    e.preventDefault();
    const pass = storeConfigPassForm.password.trim();
    if (pass.length < 4) {
      showNotification('error', 'Store Configuration Password must be at least 4 characters long');
      return;
    }
    if (storeConfigPassForm.confirm_password && pass !== storeConfigPassForm.confirm_password.trim()) {
      showNotification('error', 'Store Configuration Passwords do not match');
      return;
    }
    setSavingSecurity('config_pass');
    try {
      const updated = await settingsApi.updateSecurity({
        store_config_password: pass,
        store_config_lock_enabled: storeConfigPassForm.lock_enabled,
      });
      setSecurity(updated);
      setStoreConfigPassForm({
        password: updated.store_config_password || pass,
        confirm_password: updated.store_config_password || pass,
        lock_enabled: updated.store_config_lock_enabled ?? true,
      });
      showNotification('success', 'Store Configuration password & lock settings updated successfully.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update Store Configuration password');
    } finally {
      setSavingSecurity(null);
    }
  };

  if (loading) {
    return (
      <div className="settings-loading-view">
        <RefreshCw size={32} className="spin gold" />
        <p>Loading shop settings & configuration...</p>
      </div>
    );
  }

  return (
    <div className="settings-page-wrapper">
      {/* Store Configuration Unlock Modal */}
      {!isConfigUnlocked && (
        <div className="config-unlock-backdrop">
          <div
            className={`config-unlock-modal ${isConfigShaking ? 'shake-animation' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{
                borderBottomColor: '#FCD34D',
                background: '#FFFBEB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#B45309',
                    flexShrink: 0,
                  }}
                >
                  <Lock size={19} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                    Store Configuration Protected
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#6B7280' }}>
                    Enter Store Configuration Password to access system settings
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => navigate('/dashboard')}
                title="Cancel & Return to Dashboard"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfigUnlock} style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ fontSize: '0.82rem', color: '#4B5563', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                This section contains sensitive business configurations, invoice numbering, tax settings, staff accounts, and hardware options.
              </p>

              <div className="form-group mb-3">
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Configuration Password <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showConfigUnlockPasswordText ? 'text' : 'password'}
                    value={configUnlockPassword}
                    onChange={(e) => {
                      setConfigUnlockPassword(e.target.value);
                      if (configUnlockError) setConfigUnlockError(null);
                    }}
                    placeholder="Enter configuration password"
                    className="form-control font-mono"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.5rem 0.65rem 1rem',
                      fontSize: '1.15rem',
                      letterSpacing: showConfigUnlockPasswordText ? 'normal' : '0.22em',
                      textAlign: 'center',
                      border: '1.5px solid',
                      borderColor: configUnlockError ? '#EF4444' : '#D1D5DB',
                      borderRadius: '8px',
                      outline: 'none',
                      background: '#FFFFFF',
                      color: '#111827',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfigUnlockPasswordText(!showConfigUnlockPasswordText)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6B7280',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                    title={showConfigUnlockPasswordText ? 'Hide password' : 'Show password'}
                  >
                    {showConfigUnlockPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {configUnlockError && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <X size={14} />
                    <span>{configUnlockError}</span>
                  </div>
                )}
              </div>

              {/* Quick helper for default pin 1234 */}
              <div
                style={{
                  marginTop: '10px',
                  marginBottom: '14px',
                  padding: '8px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: '#64748B',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <KeyRound size={13} style={{ color: '#D97706' }} />
                  <span>Default Password: <strong>1234</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfigUnlockPassword('1234');
                    if (configUnlockError) setConfigUnlockError(null);
                  }}
                  style={{
                    background: '#EEF2FF',
                    color: '#4338CA',
                    border: '1px solid #C7D2FE',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Auto Fill (1234)
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #E5E7EB',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingConfig}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Unlock size={15} />
                  <span>{verifyingConfig ? 'Verifying...' : 'Unlock Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {feedback && (
        <div className={`settings-toast ${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="settings-header">
        <div className="header-titles">
          <div className="flex items-center gap-3">
            <div className="settings-badge-icon">
              <Sliders size={22} className="gold" />
            </div>
            <div>
              <h1 className="settings-title font-serif">Settings & Shop Configuration</h1>
              <p className="settings-subtitle">
                Centralized management for shop profile, billing sequences, GST, payment modes, hardware, staff users, and AMC offline license.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleLockStoreConfig}
              title="Lock Store Configuration"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lock size={14} style={{ color: '#D97706' }} />
              <span>Lock Settings</span>
            </button>
          )}
          <div className="header-status-pill">
            <span className="dot pulse green" />
            <span className="status-text font-mono">OFFLINE LOCALHOST</span>
          </div>
        </div>
      </div>

      {/* Main Container with Sidebar Tabs & Content */}
      <div className="settings-layout-grid">
        {/* Navigation Sidebar */}
        <aside className="settings-nav-panel">
          <nav className="settings-tab-list">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`}
              onClick={() => handleTabChange('shop')}
            >
              <Store size={18} />
              <span>Shop Profile & Metal Stock</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => handleTabChange('general')}
            >
              <Sliders size={18} />
              <span>General & FY</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => handleTabChange('billing')}
            >
              <Receipt size={18} />
              <span>Billing & Numbering</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'gst' ? 'active' : ''}`}
              onClick={() => handleTabChange('gst')}
            >
              <BadgePercent size={18} />
              <span>GST & Taxes</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'payment_modes' ? 'active' : ''}`}
              onClick={() => handleTabChange('payment_modes')}
            >
              <CreditCard size={18} />
              <span>Payment Modes</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'metal_rates' ? 'active' : ''}`}
              onClick={() => handleTabChange('metal_rates')}
            >
              <TrendingUp size={18} />
              <span>Metal Rates</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'printing' ? 'active' : ''}`}
              onClick={() => handleTabChange('printing')}
            >
              <Printer size={18} />
              <span>Printing Layout</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => handleTabChange('users')}
              >
                <Users size={18} />
                <span>Staff & Users</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => handleTabChange('security')}
              >
                <KeyRound size={18} />
                <span>Security & Passwords</span>
              </button>
            )}

            <button
              type="button"
              className={`tab-btn ${activeTab === 'amc' ? 'active' : ''}`}
              onClick={() => handleTabChange('amc')}
            >
              <ShieldCheck size={18} />
              <span>AMC & License</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => handleTabChange('about')}
            >
              <Info size={18} />
              <span>About & Database</span>
            </button>
          </nav>
        </aside>

        {/* Tab Content Panel */}
        <main className="settings-content-viewport">
          {/* TAB 1: SHOP PROFILE */}
          {activeTab === 'shop' && shop && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">Shop Identity & Official Address</h3>
                  <p className="card-desc">Information displayed on tax invoices, estimate slips, and GST returns.</p>
                </div>
              </div>

              {/* Logo Section */}
              <div className="logo-upload-banner">
                <div className="logo-preview-box">
                  {shop.logo_path ? (
                    <img src={settingsApi.getLogoUrl()} alt="Shop Logo" className="logo-img" />
                  ) : (
                    <Store size={36} className="text-muted" />
                  )}
                </div>
                <div className="logo-upload-meta">
                  <h4 className="font-semibold text-sm">Store Header Logo</h4>
                  <p className="text-xs text-muted">Recommended: PNG or JPG (max 2MB). Printed on A4/A5 invoices.</p>
                  <label className="btn btn-outline btn-sm upload-btn">
                    <Upload size={14} />
                    <span>Upload Logo Image</span>
                    <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleLogoUpload} hidden />
                  </label>
                </div>
              </div>

              <form onSubmit={handleSaveShop} className="settings-form">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Shop Display Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.name}
                      onChange={(e) => setShop({ ...shop, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Legal Business Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.legal_name || ''}
                      onChange={(e) => setShop({ ...shop, legal_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Owner / Manager Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.owner_name || ''}
                      onChange={(e) => setShop({ ...shop, owner_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Store Address</label>
                  <input
                    type="text"
                    className="form-control"
                    value={shop.address || ''}
                    onChange={(e) => setShop({ ...shop, address: e.target.value })}
                    placeholder="Shop No., Street, Market / Complex"
                  />
                </div>

                <div className="form-grid-4">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.city || ''}
                      onChange={(e) => setShop({ ...shop, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.state || ''}
                      onChange={(e) => setShop({ ...shop, state: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Pincode</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.pincode || ''}
                      onChange={(e) => setShop({ ...shop, pincode: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.country || 'India'}
                      onChange={(e) => setShop({ ...shop, country: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-4">
                  <div className="form-group">
                    <label>Primary Phone</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={shop.phone || ''}
                      onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Alternate Phone</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={shop.alternate_phone || ''}
                      onChange={(e) => setShop({ ...shop, alternate_phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Official Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={shop.email || ''}
                      onChange={(e) => setShop({ ...shop, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Website</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.website || ''}
                      onChange={(e) => setShop({ ...shop, website: e.target.value })}
                    />
                  </div>
                </div>

                <div className="section-divider" />
                <h4 className="subheading font-serif">Tax & Banking Identification</h4>

                <div className="form-grid-4">
                  <div className="form-group">
                    <label>Shop GSTIN (15 Digits)</label>
                    <input
                      type="text"
                      className="form-control font-mono uppercase"
                      value={shop.gstin || ''}
                      onChange={(e) => setShop({ ...shop, gstin: e.target.value.toUpperCase() })}
                      placeholder="27AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="form-group">
                    <label>Income Tax PAN</label>
                    <input
                      type="text"
                      className="form-control font-mono uppercase"
                      value={shop.pan || ''}
                      onChange={(e) => setShop({ ...shop, pan: e.target.value.toUpperCase() })}
                      placeholder="AAAAA0000A"
                    />
                  </div>
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={shop.bank_name || ''}
                      onChange={(e) => setShop({ ...shop, bank_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={shop.account_number || ''}
                      onChange={(e) => setShop({ ...shop, account_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Bank IFSC Code</label>
                    <input
                      type="text"
                      className="form-control font-mono uppercase"
                      value={shop.ifsc || ''}
                      onChange={(e) => setShop({ ...shop, ifsc: e.target.value.toUpperCase() })}
                      placeholder="HDFC0001234"
                    />
                  </div>
                  <div className="form-group">
                    <label>Store QR / UPI ID</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={shop.upi_id || ''}
                      onChange={(e) => setShop({ ...shop, upi_id: e.target.value })}
                      placeholder="jewelstore@okhdfcbank"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save Shop Profile'}</span>
                  </button>
                </div>
              </form>

              {/* STORE DEALING METALS CONFIGURATION */}
              <div className="settings-card mt-6">
                <div className="card-header flex justify-between items-center">
                  <div>
                    <h3 className="card-title font-serif flex items-center gap-2">
                      <Sparkles size={18} className="text-gold" />
                      <span>Store Dealing Metals (व्यापार की धातुएँ)</span>
                    </h3>
                    <p className="card-desc">
                      Configure which metals your shop trades in (Gold, Silver, Diamond, Platinum). Unchecked metals are automatically hidden from Invoices, Purchases, Inventory, Dropdowns, and Rate Tickers.
                    </p>
                  </div>
                  <div className="active-metals-counter badge-gold font-mono text-xs px-2.5 py-1 rounded">
                    {storeMetals.filter((m) => m.is_active === 1).length} / {storeMetals.length} Active
                  </div>
                </div>

                <div className="store-metals-grid">
                  {storeMetals.map((m) => {
                    const isSilver = m.code?.toUpperCase() === 'SILVER';
                    const isDiamond = m.code?.toUpperCase() === 'DIAMOND';
                    const isPlatinum = m.code?.toUpperCase() === 'PLATINUM';
                    const isActive = m.is_active === 1;
                    const isToggling = togglingMetal === m.code;

                    let icon = '🟡';
                    let subtitle = '24K, 22K, 18K, 14K Jewellery & Bullion';
                    let badgeClass = 'metal-gold';
                    if (isSilver) {
                      icon = '⚪';
                      subtitle = '999 Fine Silver, 925 Sterling & Utensils';
                      badgeClass = 'metal-silver';
                    } else if (isDiamond) {
                      icon = '💎';
                      subtitle = 'Solitaires, Studded Jewellery & Polki';
                      badgeClass = 'metal-diamond';
                    } else if (isPlatinum) {
                      icon = '🔘';
                      subtitle = '950 Platinum Rings, Chains & Bands';
                      badgeClass = 'metal-platinum';
                    }

                    return (
                      <div key={m.id} className={`store-metal-card ${badgeClass} ${isActive ? 'is-active' : 'is-inactive'}`}>
                        <div className="metal-card-header">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{icon}</span>
                            <div>
                              <h4 className="font-bold text-sm text-main">{m.name}</h4>
                              <span className="font-mono text-xs text-muted uppercase">{m.code}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`btn btn-xs ${isActive ? 'btn-danger-outline' : 'btn-primary'}`}
                            disabled={isToggling}
                            onClick={() => handleToggleStoreMetal(m)}
                          >
                            {isToggling ? 'Updating...' : isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                        <p className="metal-card-desc">{subtitle}</p>
                        <div className="metal-card-footer">
                          <span className={`status-pill ${isActive ? 'active' : 'inactive'}`}>
                            {isActive ? '✓ Active in Store' : '✕ Hidden / Disabled'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INVOICE COLUMNS CONFIGURATION */}
              <div className="settings-card mt-6">
                <div className="card-header flex justify-between items-center">
                  <div>
                    <h3 className="card-title font-serif flex items-center gap-2">
                      <Columns size={18} className="text-gold" />
                      <span>Invoice Columns & Field Visibility (बिल एवं चालान कॉलम विन्यास)</span>
                    </h3>
                    <p className="card-desc">
                      Configure which item columns and calculations appear on your Invoices (Badla%, Waste%, Fine Wt, Less Wt, Tunch%, Making Charge, Tag No).
                      Disabled columns are automatically hidden from Invoice tables and defaulted safely to zero.
                    </p>
                  </div>
                  <div className="active-metals-counter badge-gold font-mono text-xs px-2.5 py-1 rounded">
                    {[
                      invoiceColumns.show_tag_no,
                      invoiceColumns.show_tunch,
                      invoiceColumns.show_less_weight,
                      invoiceColumns.show_net_weight,
                      invoiceColumns.show_badla,
                      invoiceColumns.show_wastage,
                      invoiceColumns.show_making_charge,
                      invoiceColumns.show_fine_weight,
                    ].filter(Boolean).length} / 8 Active
                  </div>
                </div>

                <div className="store-metals-grid">
                  {[
                    {
                      key: 'show_tag_no' as keyof InvoiceColumnSettings,
                      label: 'Tag No / Barcode',
                      code: 'TAG_NO',
                      icon: '🏷️',
                      subtitle: 'Barcode tag or serial item code on invoice lines',
                      badgeClass: 'metal-silver',
                    },
                    {
                      key: 'show_tunch' as keyof InvoiceColumnSettings,
                      label: 'Tunch% (Purity)',
                      code: 'TUNCH_PERCENT',
                      icon: '🎯',
                      subtitle: 'Purity percentage (e.g. 91.6%) for pure fine weight calculation',
                      badgeClass: 'metal-gold',
                    },
                    {
                      key: 'show_less_weight' as keyof InvoiceColumnSettings,
                      label: 'Less Weight (g)',
                      code: 'LESS_WEIGHT',
                      icon: '⚖️',
                      subtitle: 'Deductions for stones, wax, enamel, and impurities',
                      badgeClass: 'metal-silver',
                    },
                    {
                      key: 'show_net_weight' as keyof InvoiceColumnSettings,
                      label: 'Net Weight (g)',
                      code: 'NET_WEIGHT',
                      icon: '📊',
                      subtitle: 'Calculated metal weight (Gross minus Less weight)',
                      badgeClass: 'metal-gold',
                    },
                    {
                      key: 'show_badla' as keyof InvoiceColumnSettings,
                      label: 'Badla % (Fine Surcharge)',
                      code: 'BADLA_PERCENT',
                      icon: '🔄',
                      subtitle: 'Commercial margin, market premium or fine weight addition %',
                      badgeClass: 'metal-diamond',
                    },
                    {
                      key: 'show_wastage' as keyof InvoiceColumnSettings,
                      label: 'Waste % (Wastage / Kadhai)',
                      code: 'WASTE_PERCENT',
                      icon: '🧪',
                      subtitle: 'Refining loss & casting wastage % added to fine weight',
                      badgeClass: 'metal-platinum',
                    },
                    {
                      key: 'show_making_charge' as keyof InvoiceColumnSettings,
                      label: 'Making Charge / Labour',
                      code: 'MAKING_CHARGE',
                      icon: '🔨',
                      subtitle: 'Labour charges (per gram, percentage, or flat amount)',
                      badgeClass: 'metal-gold',
                    },
                    {
                      key: 'show_fine_weight' as keyof InvoiceColumnSettings,
                      label: 'Fine Weight (शुद्ध वजन)',
                      code: 'FINE_WEIGHT',
                      icon: '💎',
                      subtitle: '24K calculated pure gold/silver weight column (Fine to Fine)',
                      badgeClass: 'metal-diamond',
                    },
                  ].map((col) => {
                    const isActive = !!invoiceColumns[col.key];
                    const isToggling = togglingColumn === col.key;
                    return (
                      <div key={col.key} className={`store-metal-card ${col.badgeClass} ${isActive ? 'is-active' : 'is-inactive'}`}>
                        <div className="metal-card-header">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{col.icon}</span>
                            <div>
                              <h4 className="font-bold text-sm text-main">{col.label}</h4>
                              <span className="font-mono text-xs text-muted uppercase">{col.code}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`btn btn-xs ${isActive ? 'btn-danger-outline' : 'btn-primary'}`}
                            disabled={isToggling}
                            onClick={() => handleToggleInvoiceColumn(col.key, col.label)}
                          >
                            {isToggling ? 'Updating...' : isActive ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        <p className="metal-card-desc">{col.subtitle}</p>
                        <div className="metal-card-footer">
                          <span className={`status-pill ${isActive ? 'active' : 'inactive'}`}>
                            {isActive ? '✓ Visible on Invoices' : '✕ Hidden from Invoices'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL & FY */}
          {activeTab === 'general' && general && fy && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">General Parameters & Financial Year</h3>
                  <p className="card-desc">Formatting rules, precision decimals, and accounting calendar.</p>
                </div>
              </div>

              <form onSubmit={handleSaveGeneral} className="settings-form">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Currency Symbol</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={general.currency_symbol}
                      onChange={(e) => setGeneral({ ...general, currency_symbol: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Currency Code</label>
                    <input
                      type="text"
                      className="form-control font-mono uppercase"
                      value={general.currency_code}
                      onChange={(e) => setGeneral({ ...general, currency_code: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date Format</label>
                    <select
                      className="form-control"
                      value={general.date_format}
                      onChange={(e) => setGeneral({ ...general, date_format: e.target.value })}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
                      <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 04-Oct-2026)</option>
                    </select>
                  </div>
                </div>

                <div className="section-divider" />
                <h4 className="subheading font-serif">Jewellery Precision Decimals</h4>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Weight Decimal Places (Grams)</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      className="form-control font-mono"
                      value={general.weight_decimals}
                      onChange={(e) => setGeneral({ ...general, weight_decimals: parseInt(e.target.value, 10) || 3 })}
                    />
                    <small className="form-hint">Standard jewellery scale: 3 decimals (e.g. 12.450 g)</small>
                  </div>

                  <div className="form-group">
                    <label>Rate Decimal Places (₹/g)</label>
                    <input
                      type="number"
                      min={0}
                      max={4}
                      className="form-control font-mono"
                      value={general.rate_decimals}
                      onChange={(e) => setGeneral({ ...general, rate_decimals: parseInt(e.target.value, 10) || 2 })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Amount Decimal Places</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      className="form-control font-mono"
                      value={general.amount_decimals}
                      onChange={(e) => setGeneral({ ...general, amount_decimals: parseInt(e.target.value, 10) || 2 })}
                    />
                  </div>
                </div>

                <div className="section-divider" />
                <h4 className="subheading font-serif">Financial Year (FY) Definition</h4>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Current Financial Year Label</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={fy.current_fy}
                      onChange={(e) => setFy({ ...fy, current_fy: e.target.value })}
                      placeholder="2026-27"
                    />
                  </div>

                  <div className="form-group">
                    <label>FY Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fy.start_date}
                      onChange={(e) => setFy({ ...fy, start_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>FY End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fy.end_date}
                      onChange={(e) => setFy({ ...fy, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save General Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: BILLING & NUMBERING */}
          {activeTab === 'billing' && billing && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">Billing Defaults & Atomic Numbering</h3>
                  <p className="card-desc">Transaction-safe sequential prefixes for sales, purchase, workshop, and loans.</p>
                </div>
              </div>

              <form onSubmit={handleSaveBilling} className="settings-form">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Default Customer Type</label>
                    <select
                      className="form-control"
                      value={billing.default_customer_type}
                      onChange={(e) => setBilling({ ...billing, default_customer_type: e.target.value })}
                    >
                      <option value="RETAIL">Retail Customer</option>
                      <option value="WHOLESALE">Wholesale Trader</option>
                      <option value="VIP">VIP Club</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Default Payment Mode</label>
                    <select
                      className="form-control"
                      value={billing.default_payment_mode}
                      onChange={(e) => setBilling({ ...billing, default_payment_mode: e.target.value })}
                    >
                      <option value="CASH">CASH</option>
                      <option value="CARD">CARD</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK">BANK</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Default Invoice Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      value={billing.default_invoice_notes}
                      onChange={(e) => setBilling({ ...billing, default_invoice_notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="section-divider" />
                <h4 className="subheading font-serif">Sequential Document Numbering Matrix</h4>
                <p className="text-xs text-muted mb-4">
                  Each sequence is atomically managed by SQLite transactions to guarantee 0 race conditions. Modifying prefix or starting number applies only to future bills.
                </p>

                <div className="table-responsive">
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>Document Type</th>
                        <th>Prefix</th>
                        <th>Starting #</th>
                        <th>Padding</th>
                        <th>FY Reset</th>
                        <th>Sample Number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.sequences.map((seq, idx) => {
                        const currentYear = new Date().getFullYear();
                        const sampleNum = `${seq.prefix.replace(/[-/]+$/, '')}${seq.financial_year_reset ? `-${currentYear}-` : '-'}${'1'.padStart(seq.padding, '0')}`;
                        return (
                          <tr key={seq.doc_type}>
                            <td className="font-semibold text-gold">{seq.doc_type.replace('_', ' ')}</td>
                            <td>
                              <input
                                type="text"
                                className="form-control font-mono sm-input"
                                value={seq.prefix}
                                onChange={(e) => {
                                  const updated = [...billing.sequences];
                                  updated[idx].prefix = e.target.value.toUpperCase();
                                  setBilling({ ...billing, sequences: updated });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={1}
                                className="form-control font-mono sm-input"
                                value={seq.starting_number}
                                onChange={(e) => {
                                  const updated = [...billing.sequences];
                                  updated[idx].starting_number = parseInt(e.target.value, 10) || 1;
                                  setBilling({ ...billing, sequences: updated });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={3}
                                max={8}
                                className="form-control font-mono sm-input"
                                value={seq.padding}
                                onChange={(e) => {
                                  const updated = [...billing.sequences];
                                  updated[idx].padding = parseInt(e.target.value, 10) || 6;
                                  setBilling({ ...billing, sequences: updated });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={seq.financial_year_reset}
                                onChange={(e) => {
                                  const updated = [...billing.sequences];
                                  updated[idx].financial_year_reset = e.target.checked;
                                  setBilling({ ...billing, sequences: updated });
                                }}
                              />
                            </td>
                            <td>
                              <span className="font-mono text-xs bg-slate px-2 py-1 rounded text-cyan">{sampleNum}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="form-actions mt-4">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save Billing Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: GST & TAXES */}
          {activeTab === 'gst' && gst && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">GST & Tax Parameters</h3>
                  <p className="card-desc">Configure tax computation mode and statutory business credentials.</p>
                </div>
              </div>

              <form onSubmit={handleSaveGST} className="settings-form">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>GST Enablement</label>
                    <select
                      className="form-control"
                      value={gst.gst_enabled ? 'true' : 'false'}
                      onChange={(e) => setGst({ ...gst, gst_enabled: e.target.value === 'true' })}
                    >
                      <option value="true">Enabled (GST Compliant Invoicing)</option>
                      <option value="false">Disabled (Composition / Non-GST)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Default Jewellery GST Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={28}
                      className="form-control font-mono"
                      value={gst.default_gst_rate}
                      onChange={(e) => setGst({ ...gst, default_gst_rate: parseFloat(e.target.value) || 0 })}
                    />
                    <small className="form-hint">Standard rate for gold jewellery: 3.00%</small>
                  </div>

                  <div className="form-group">
                    <label>Tax Calculation Mode</label>
                    <select
                      className="form-control"
                      value={gst.tax_mode}
                      onChange={(e) => setGst({ ...gst, tax_mode: e.target.value as any })}
                    >
                      <option value="EXCLUSIVE">EXCLUSIVE (Tax added to base metal & making)</option>
                      <option value="INCLUSIVE">INCLUSIVE (Rate inclusive of 3% GST)</option>
                      <option value="NO_TAX">NO TAX (Exempt Invoicing)</option>
                    </select>
                  </div>
                </div>

                <div className="gst-statutory-card">
                  <h4 className="font-semibold text-sm text-gold mb-2">Statutory Split Breakdown</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted block">Intra-State Transactions (Same State):</span>
                      <strong className="text-main font-mono">1.50% CGST + 1.50% SGST (Total 3%)</strong>
                    </div>
                    <div>
                      <span className="text-muted block">Inter-State Transactions (Outside State):</span>
                      <strong className="text-main font-mono">3.00% IGST</strong>
                    </div>
                  </div>
                </div>

                <div className="form-actions mt-4">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save GST Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: PAYMENT MODES */}
          {activeTab === 'payment_modes' && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">Accepted Payment Modes</h3>
                  <p className="card-desc">Enable or disable payment options in billing screens. Historical records are preserved.</p>
                </div>
              </div>

              <div className="info-banner-blue mb-4">
                <CheckCircle size={16} />
                <span>
                  Deactivating a payment mode only hides it from new billing selections. All past payments in that mode remain completely visible and audit-safe in customer ledgers and daybooks.
                </span>
              </div>

              <div className="payment-modes-grid">
                {paymentModes.map((pm) => (
                  <div key={pm.code} className={`pm-card ${pm.is_active ? 'active' : 'inactive'}`}>
                    <div className="pm-info">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className={pm.is_active ? 'gold' : 'muted'} />
                        <h4 className="pm-title font-mono font-bold">{pm.code}</h4>
                      </div>
                      <span className="pm-name text-xs text-muted">{pm.name}</span>
                    </div>

                    <div className="pm-toggle">
                      {pm.code === 'CASH' ? (
                        <span className="badge badge-system" title="Physical CASH is essential for drawer accounting">
                          LOCKED (DRAWER)
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`btn btn-sm ${pm.is_active ? 'btn-danger-outline' : 'btn-outline'}`}
                          onClick={() => handleTogglePaymentMode(pm.code, pm.is_active)}
                        >
                          {pm.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Shop Receiving Accounts & Destinations */}
              <div className="receiving-accounts-section mt-6">
                <div className="card-header flex justify-between items-center mb-3">
                  <div>
                    <h3 className="card-title font-serif flex items-center gap-2">
                      <Landmark size={18} className="gold" />
                      <span>Shop Receiving Accounts & Destinations</span>
                    </h3>
                    <p className="card-desc">
                      Configure your shop's bank accounts, cash drawers, UPI handles, and card terminals used to receive payments at billing.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                    onClick={() => handleOpenAccountModal()}
                  >
                    <Plus size={14} />
                    <span>Add Receiving Account</span>
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>Account Name</th>
                        <th>Type</th>
                        <th>Bank / Gateway</th>
                        <th>Account No / UPI / Identifier</th>
                        <th>IFSC</th>
                        <th>Default</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivingAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-muted py-4">
                            No shop receiving accounts configured. Click "Add Receiving Account" to register one.
                          </td>
                        </tr>
                      ) : (
                        receivingAccounts.map((acc) => (
                          <tr key={acc.id} className={!acc.is_active ? 'opacity-60' : ''}>
                            <td className="font-semibold text-gold flex items-center gap-1.5">
                              {acc.account_type === 'BANK' ? <Landmark size={14} /> : <Building2 size={14} />}
                              <span>{acc.account_name}</span>
                            </td>
                            <td>
                              <span className="badge badge-system font-mono text-[10px]">
                                {acc.account_type}
                              </span>
                            </td>
                            <td>{acc.bank_name || '—'}</td>
                            <td className="font-mono text-xs">
                              {acc.account_number || acc.upi_id || '—'}
                            </td>
                            <td className="font-mono text-xs text-muted">{acc.ifsc || '—'}</td>
                            <td>
                              {acc.is_default ? (
                                <span className="badge badge-success text-[10px]">DEFAULT</span>
                              ) : (
                                <span className="text-muted text-xs">—</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${acc.is_active ? 'badge-success' : 'badge-danger'} text-[10px]`}>
                                {acc.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => handleOpenAccountModal(acc)}
                                  title="Edit Account Details"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-xs ${acc.is_active ? 'btn-danger-outline' : 'btn-outline'}`}
                                  onClick={() => handleToggleAccountActive(acc.id)}
                                  title={acc.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  {acc.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger-outline btn-xs"
                                  onClick={() => handleDeleteAccount(acc.id)}
                                  title="Delete Account"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: METAL RATES */}
          {activeTab === 'metal_rates' && (
            <div className="settings-card">
              <div className="card-header flex justify-between items-center">
                <div>
                  <h3 className="card-title font-serif">Gold & Silver Board Rates</h3>
                  <p className="card-desc">Current valuation board rates for inventory, billing, and pledge calculations.</p>
                </div>
              </div>

              {/* DEALING METALS QUICK TOGGLE BAR */}
              <div className="dealing-metals-bar mb-4 p-3 rounded-lg border border-amber-200/70 bg-amber-50/50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                    <Sparkles size={14} className="text-gold" />
                    <span>Store Dealing Metals:</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {storeMetals.map((m) => {
                      const isActive = m.is_active === 1;
                      const isGold = m.code === 'GOLD';
                      const isSilver = m.code === 'SILVER';
                      const icon = isGold ? '🟡' : isSilver ? '⚪' : m.code === 'DIAMOND' ? '💎' : '🔘';
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`dealing-metal-pill-btn ${isActive ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleStoreMetal(m)}
                          disabled={togglingMetal === m.code}
                          title={`Click to ${isActive ? 'Deactivate' : 'Activate'} ${m.name}`}
                        >
                          <span className="pill-name">{icon} {m.name}</span>
                          <span className="pill-status">{isActive ? '✓ ON' : '✕ OFF'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <span className="text-3xs text-muted">
                  Toggle metals to show or hide them from Board Rates & Invoices
                </span>
              </div>

              <div className="table-responsive mb-6">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Metal</th>
                      <th>Purity</th>
                      <th>Tunch %</th>
                      <th>Current Rate</th>
                      <th>Unit</th>
                      <th>Effective Since</th>
                      <th>Updated By</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!rates || rates.length === 0) ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">
                          No metal rates configured yet.
                        </td>
                      </tr>
                    ) : (
                      rates.map((r) => {
                        const hasRate = r.rate !== null && r.rate !== undefined && !isNaN(Number(r.rate)) && Number(r.rate) > 0;
                        const rateNum = hasRate ? Number(r.rate) : 0;
                        return (
                          <tr key={r.purity_id || `${r.metal_id}-${r.purity_name}`}>
                            <td className="font-semibold text-gold">{r.metal_name || r.metal_code || 'Metal'}</td>
                            <td className="font-bold">{r.purity_name || r.purity_code}</td>
                            <td className="font-mono">
                              {r.tunch_percent !== null && r.tunch_percent !== undefined
                                ? `${Number(r.tunch_percent).toFixed(2)}%`
                                : '-'}
                            </td>
                            <td className="font-mono text-cyan font-bold">
                              {hasRate ? (
                                `₹${rateNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              ) : (
                                <span className="text-muted font-sans font-normal text-xs">Not Set</span>
                              )}
                            </td>
                            <td>per {r.unit || 'g'}</td>
                            <td className="text-xs text-muted">
                              {r.effective_from ? new Date(r.effective_from).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="text-xs">{r.created_by_username || 'System Admin'}</td>
                            <td>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => {
                                    setRateUpdateForm({
                                      metal_id: r.metal_id,
                                      purity_id: r.purity_id,
                                      purity_name: `${r.metal_name || ''} ${r.purity_name || ''}`.trim(),
                                      rate: rateNum,
                                    });
                                    setShowRateModal(true);
                                  }}
                                >
                                  Update Rate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <h4 className="subheading font-serif">Recent Rate Change Audit History</h4>
              <div className="table-responsive">
                <table className="settings-table text-xs">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Metal / Purity</th>
                      <th>Rate</th>
                      <th>Updated By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!rateHistory || rateHistory.length === 0) ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          No rate history recorded yet.
                        </td>
                      </tr>
                    ) : (
                      rateHistory.slice(0, 15).map((h) => {
                        const hasRate = h.rate !== null && h.rate !== undefined && !isNaN(Number(h.rate));
                        const rateNum = hasRate ? Number(h.rate) : 0;
                        return (
                          <tr key={h.id || `${h.purity_id}-${h.effective_from}`}>
                            <td>{h.effective_from ? new Date(h.effective_from).toLocaleString('en-IN') : '—'}</td>
                            <td>{h.metal_name || ''} {h.purity_name || ''}</td>
                            <td className="font-mono font-semibold">
                              {hasRate
                                ? `₹${rateNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${h.unit || 'g'}`
                                : '—'}
                            </td>
                            <td>{h.created_by_username || 'Admin'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: PRINTING */}
          {activeTab === 'printing' && printing && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">Laser & Thermal Printing Layout</h3>
                  <p className="card-desc">Configure print visibility, paper sizes, and legal terms on invoices.</p>
                </div>
              </div>

              <form onSubmit={handleSavePrinting} className="settings-form">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Paper Size</label>
                    <select
                      className="form-control"
                      value={printing.page_size}
                      onChange={(e) => setPrinting({ ...printing, page_size: e.target.value as any })}
                    >
                      <option value="A4">A4 (Full Page Laser / Deskjet)</option>
                      <option value="A5">A5 (Half Page Preprinted Voucher)</option>
                      <option value="THERMAL">Thermal POS (3-inch / 80mm Roll)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Print Customer Copy</label>
                    <select
                      className="form-control"
                      value={printing.customer_copy ? 'true' : 'false'}
                      onChange={(e) => setPrinting({ ...printing, customer_copy: e.target.value === 'true' })}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Print Shop Copy</label>
                    <select
                      className="form-control"
                      value={printing.shop_copy ? 'true' : 'false'}
                      onChange={(e) => setPrinting({ ...printing, shop_copy: e.target.value === 'true' })}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="section-divider" />
                <h4 className="subheading font-serif">Header Field Toggles</h4>

                <div className="print-toggles-grid">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={printing.show_logo}
                      onChange={(e) => setPrinting({ ...printing, show_logo: e.target.checked })}
                    />
                    <span>Show Shop Logo</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={printing.show_shop_name}
                      onChange={(e) => setPrinting({ ...printing, show_shop_name: e.target.checked })}
                    />
                    <span>Show Shop Name</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={printing.show_address}
                      onChange={(e) => setPrinting({ ...printing, show_address: e.target.checked })}
                    />
                    <span>Show Address</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={printing.show_phone}
                      onChange={(e) => setPrinting({ ...printing, show_phone: e.target.checked })}
                    />
                    <span>Show Phone</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={printing.show_gstin}
                      onChange={(e) => setPrinting({ ...printing, show_gstin: e.target.checked })}
                    />
                    <span>Show GSTIN</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={printing.show_pan}
                      onChange={(e) => setPrinting({ ...printing, show_pan: e.target.checked })}
                    />
                    <span>Show PAN</span>
                  </label>
                </div>

                <div className="section-divider" />
                <div className="form-group">
                  <label>Invoice Footer Note</label>
                  <input
                    type="text"
                    className="form-control"
                    value={printing.invoice_footer}
                    onChange={(e) => setPrinting({ ...printing, invoice_footer: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Terms & Conditions (Printed at the bottom of bills)</label>
                  <textarea
                    rows={4}
                    className="form-control text-xs font-mono"
                    value={printing.terms_and_conditions}
                    onChange={(e) => setPrinting({ ...printing, terms_and_conditions: e.target.value })}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save Print Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 8: USERS & STAFF MANAGEMENT */}
          {activeTab === 'users' && isAdmin && (
            <div className="settings-card">
              <div className="card-header flex justify-between items-center">
                <div>
                  <h3 className="card-title font-serif">Staff User Accounts & Access Control</h3>
                  <p className="card-desc">Create staff credentials and configure granular permissions. Passwords are encrypted.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddUserModal(true)}
                >
                  <UserPlus size={16} />
                  <span>Add Staff User</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Full Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map((u) => (
                      <tr key={u.id}>
                        <td className="font-mono font-bold text-main">{u.username}</td>
                        <td>{u.full_name || '-'}</td>
                        <td>
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-gold' : 'badge-staff'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-xs text-muted">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'Never logged in'}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              title="Reset Password"
                              onClick={() => {
                                setSelectedUserForReset(u);
                                setShowResetPasswordModal(true);
                              }}
                            >
                              <KeyRound size={12} />
                              <span>Reset Password</span>
                            </button>

                            {u.is_active && (
                              <button
                                type="button"
                                className="btn btn-danger-outline btn-xs"
                                onClick={() => handleDeactivateUser(u)}
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: SECURITY, PASSWORDS & ACCESS CONTROL */}
          {activeTab === 'security' && isAdmin && (
            <div className="space-y-6">
              {/* Card 1: Software Login Credentials */}
              <div className="settings-card">
                <div className="card-header flex justify-between items-center">
                  <div>
                    <h3 className="card-title font-serif flex items-center gap-2">
                      <Users size={18} className="gold" />
                      <span>Software Login Credentials</span>
                    </h3>
                    <p className="card-desc">
                      Configure the main login username and password used to sign in when launching the POS software.
                    </p>
                  </div>
                  <span className="security-tag-badge">
                    <ShieldCheck size={14} />
                    <span>LOGIN ACCESS</span>
                  </span>
                </div>

                <form onSubmit={handleUpdateLoginCreds} className="card-body">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label font-bold">Login Username *</label>
                      <input
                        type="text"
                        className="form-control font-mono font-bold"
                        value={loginCredsForm.username}
                        onChange={(e) => setLoginCredsForm({ ...loginCredsForm, username: e.target.value })}
                        placeholder="e.g. admin"
                        required
                        minLength={3}
                      />
                      <small className="form-hint">Used at software launch to authenticate.</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Current Password (optional)</label>
                      <input
                        type={showLoginPassText ? 'text' : 'password'}
                        className="form-control"
                        value={loginCredsForm.current_password}
                        onChange={(e) => setLoginCredsForm({ ...loginCredsForm, current_password: e.target.value })}
                        placeholder="Enter current password if set"
                      />
                      <small className="form-hint">Required only if changing password.</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showLoginPassText ? 'text' : 'password'}
                          className="form-control"
                          value={loginCredsForm.new_password}
                          onChange={(e) => setLoginCredsForm({ ...loginCredsForm, new_password: e.target.value })}
                          placeholder="Leave blank to keep existing"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassText(!showLoginPassText)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6B7280',
                            padding: '4px',
                          }}
                        >
                          {showLoginPassText ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <small className="form-hint">Minimum 6 characters.</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type={showLoginPassText ? 'text' : 'password'}
                        className="form-control"
                        value={loginCredsForm.confirm_password}
                        onChange={(e) => setLoginCredsForm({ ...loginCredsForm, confirm_password: e.target.value })}
                        placeholder="Re-enter new password"
                      />
                      <small className="form-hint">Must match new password.</small>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 pt-3 border-t border-subtle">
                    <button
                      type="submit"
                      disabled={savingSecurity === 'creds'}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={16} />
                      <span>{savingSecurity === 'creds' ? 'Updating...' : 'Update Login Credentials'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 2: Display Mode PIN (JEWEL SUITE POS • TERMINAL 01) */}
              <div className="settings-card">
                <div className="card-header flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="card-title font-serif flex items-center gap-2">
                        <Lock size={18} className="gold" />
                        <span>Dashboard Display Mode PIN</span>
                      </h3>
                      <span className="security-tag-badge font-mono" style={{ background: '#FEF3C7', color: '#B45309' }}>
                        JEWEL SUITE POS • TERMINAL 01
                      </span>
                    </div>
                    <p className="card-desc">
                      Set the PIN required to unlock <strong>Display Mode: On (Live)</strong> from <strong>Off (Masked)</strong> on the Dashboard.
                    </p>
                  </div>
                  <span className="badge badge-system font-mono">COUNTER PRIVACY</span>
                </div>

                <form onSubmit={handleUpdateDisplayPin} className="card-body">
                  <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-muted uppercase tracking-wider">Dashboard Privacy Mode</span>
                      <span className="badge badge-success font-mono">ACTIVE (PROTECTED)</span>
                    </div>
                    <p className="text-xs text-muted mb-0">
                      When Display Mode is <strong>Off (Masked)</strong>, all real-time financial figures (Total Sales, Net Revenue, Cash-in-Hand, Gold & Silver physical balances) are masked with <code className="font-mono">••••••••</code> to protect confidentiality at the counter. Entering this PIN reveals live numbers.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label font-bold">Display Mode Unlock PIN *</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showDisplayPinText ? 'text' : 'password'}
                          className="form-control font-mono font-bold text-lg text-center"
                          value={displayPinForm.pin}
                          onChange={(e) => setDisplayPinForm({ pin: e.target.value })}
                          placeholder="e.g. 1234"
                          required
                          minLength={4}
                          maxLength={12}
                          style={{ letterSpacing: showDisplayPinText ? 'normal' : '0.25em' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDisplayPinText(!showDisplayPinText)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6B7280',
                            padding: '4px',
                          }}
                        >
                          {showDisplayPinText ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <small className="form-hint">Default PIN is 1234. Minimum 4 digits or characters.</small>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                        <strong className="block mb-1 font-semibold">Counter Privacy Protection:</strong>
                        Visitors standing at the counter cannot view daily revenue or stock figures without entering this PIN.
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 pt-3 border-t border-subtle">
                    <button
                      type="submit"
                      disabled={savingSecurity === 'pin'}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={16} />
                      <span>{savingSecurity === 'pin' ? 'Saving PIN...' : 'Save Display Mode PIN'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 3: Store Configuration Access Password */}
              <div className="settings-card">
                <div className="card-header flex justify-between items-center">
                  <div>
                    <h3 className="card-title font-serif flex items-center gap-2">
                      <ShieldCheck size={18} className="gold" />
                      <span>Store Configuration Access Protection</span>
                    </h3>
                    <p className="card-desc">
                      Password-protect this Store Configuration menu so unauthorized counter staff cannot alter billing settings, tax rates, sequences, or store details.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeConfigPassForm.lock_enabled}
                      onChange={(e) => setStoreConfigPassForm({ ...storeConfigPassForm, lock_enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span className="text-xs font-bold text-main">Require Password on Open</span>
                  </label>
                </div>

                <form onSubmit={handleUpdateStoreConfigPass} className="card-body">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label font-bold">Store Configuration Password *</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showStoreConfigPassText ? 'text' : 'password'}
                          className="form-control font-mono font-bold"
                          value={storeConfigPassForm.password}
                          onChange={(e) => setStoreConfigPassForm({ ...storeConfigPassForm, password: e.target.value })}
                          placeholder="e.g. 1234"
                          required
                          minLength={4}
                          disabled={!storeConfigPassForm.lock_enabled}
                          style={{ letterSpacing: showStoreConfigPassText ? 'normal' : '0.2em' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowStoreConfigPassText(!showStoreConfigPassText)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6B7280',
                            padding: '4px',
                          }}
                        >
                          {showStoreConfigPassText ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <small className="form-hint">Default password is 1234. Minimum 4 characters.</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label font-bold">Confirm Configuration Password *</label>
                      <input
                        type={showStoreConfigPassText ? 'text' : 'password'}
                        className="form-control font-mono font-bold"
                        value={storeConfigPassForm.confirm_password}
                        onChange={(e) => setStoreConfigPassForm({ ...storeConfigPassForm, confirm_password: e.target.value })}
                        placeholder="Re-enter password"
                        required
                        minLength={4}
                        disabled={!storeConfigPassForm.lock_enabled}
                        style={{ letterSpacing: showStoreConfigPassText ? 'normal' : '0.2em' }}
                      />
                      <small className="form-hint">Must match password above.</small>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-subtle">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleLockStoreConfig}
                      title="Lock Store Configuration Now"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Lock size={14} style={{ color: '#D97706' }} />
                      <span>Lock Settings Now</span>
                    </button>

                    <button
                      type="submit"
                      disabled={savingSecurity === 'config_pass'}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={16} />
                      <span>{savingSecurity === 'config_pass' ? 'Saving...' : 'Save Configuration Password'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 9: AMC & OFFLINE LICENSE */}
          {activeTab === 'amc' && amc && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">Annual Maintenance Contract (AMC) & License</h3>
                  <p className="card-desc">Verified offline software contract status for this store terminal.</p>
                </div>
              </div>

              <div className="amc-status-grid">
                <div className="amc-status-card">
                  <span className="text-xs text-muted">Current License Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${amc.status === 'ACTIVE' ? 'badge-success' : amc.status === 'EXPIRING_SOON' ? 'badge-warning' : 'badge-danger'}`}>
                      {amc.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-muted mt-2 block">
                    {amc.days_remaining > 0 ? `${amc.days_remaining} day(s) until renewal` : 'Contract expired'}
                  </span>
                </div>

                <div className="amc-status-card">
                  <span className="text-xs text-muted">Registered Edition</span>
                  <div className="font-bold text-sm text-gold mt-1">{amc.plan}</div>
                  <span className="text-xs text-muted mt-2 block">Enterprise Offline Installation</span>
                </div>

                <div className="amc-status-card">
                  <span className="text-xs text-muted">Coverage Valid Until</span>
                  <div className="font-bold text-sm font-mono text-cyan mt-1">{amc.expiry_date}</div>
                  <span className="text-xs text-muted mt-2 block">Grace Period: {amc.grace_period_days} Days</span>
                </div>
              </div>

              {amc.warning_message && (
                <div className="warning-banner-amber mt-4">
                  <AlertTriangle size={18} />
                  <span>{amc.warning_message}</span>
                </div>
              )}

              <div className="amc-details-card mt-6">
                <h4 className="font-semibold text-sm mb-3">Offline Contract Verification Details</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-muted block">Activation License Key:</span>
                    <span className="text-main">{amc.license_key}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Hardware Device Identifier:</span>
                    <span className="text-main">{amc.device_id}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Digital Signature (HMAC-SHA256):</span>
                    <span className="text-main break-all">{amc.signature}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Last Local Verification:</span>
                    <span className="text-main">{amc.last_verified_at ? new Date(amc.last_verified_at).toLocaleString('en-IN') : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="info-banner-blue mt-6">
                <ShieldCheck size={18} />
                <div>
                  <strong className="block font-semibold">Offline Data Protection Guarantee</strong>
                  <span>
                    Jewel Suite customer data is 100% owned by the shop. Invoices, stock items, customer ledgers, and Girvi records are never locked, blocked, or deleted regardless of AMC renewal status.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: ABOUT & DATABASE */}
          {activeTab === 'about' && about && (
            <div className="settings-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title font-serif">About Jewel Suite ERP & Local Database</h3>
                  <p className="card-desc">Software build versions, database path, and diagnostic details.</p>
                </div>
              </div>

              <div className="about-hero-card">
                <div className="about-gem-box">
                  <Store size={36} className="gold" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-gold">{about.app_name}</h2>
                  <p className="text-xs text-muted">Next-generation offline-first Jewellery POS, Billing, Workshop & Girvi System.</p>
                  <div className="flex gap-2 mt-2">
                    <span className="badge badge-system">Version {about.app_version}</span>
                    <span className="badge badge-system">Build {about.build_version}</span>
                  </div>
                </div>
              </div>

              {dbInfo && (
                <div className="db-info-panel mt-6">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Database size={16} className="text-gold" />
                    <span>Local SQLite Database Health</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-muted block">Database Storage Location:</span>
                      <span className="text-main break-all">{dbInfo.location}</span>
                    </div>
                    <div>
                      <span className="text-muted block">Database File Size:</span>
                      <span className="text-main">{(((dbInfo?.size_bytes || 0)) / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                    <div>
                      <span className="text-muted block">Write-Ahead Logging (WAL Mode):</span>
                      <span className="text-success font-bold">ACTIVE & OPTIMIZED</span>
                    </div>
                    <div>
                      <span className="text-muted block">Schema Migrations Applied:</span>
                      <span className="text-cyan font-bold">{dbInfo.migrations_applied} Migration(s)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="support-card mt-6">
                <h4 className="font-semibold text-sm mb-2">Technical Support & Diagnostics</h4>
                <p className="text-xs text-muted mb-2">
                  For assistance, software maintenance, or hardware setup, contact Jewel Suite customer care:
                </p>
                <div className="flex gap-4 text-xs font-mono text-gold">
                  <span>Phone: {about.support_phone}</span>
                  <span>Email: {about.support_email}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal 1: Add Staff User */}
      {showAddUserModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title font-serif">Create Staff User</h3>
              <button type="button" className="close-btn" onClick={() => setShowAddUserModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-body">
              <div className="form-group mb-3">
                <label>Username *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label>Password (Min 6 chars) *</label>
                <input
                  type="password"
                  className="form-control"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                />
              </div>

              <div className="form-group mb-3">
                <label>Role *</label>
                <select
                  className="form-control"
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                >
                  <option value="STAFF">Staff (Cashier / Billing)</option>
                  <option value="ADMIN">Admin (Shop Owner / Manager)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reset Password */}
      {showResetPasswordModal && selectedUserForReset && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title font-serif">Reset Password: {selectedUserForReset.username}</h3>
              <button type="button" className="close-btn" onClick={() => setShowResetPasswordModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="modal-body">
              <div className="form-group mb-3">
                <label>New Password (Min 6 chars) *</label>
                <input
                  type="password"
                  className="form-control"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new secure password"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowResetPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Update Metal Rate */}
      {showRateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title font-serif">Update Board Rate: {rateUpdateForm.purity_name}</h3>
              <button type="button" className="close-btn" onClick={() => setShowRateModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveRate} className="modal-body">
              <div className="form-group mb-3">
                <label>New Rate per Gram (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={1}
                  className="form-control font-mono font-bold"
                  value={rateUpdateForm.rate}
                  onChange={(e) => setRateUpdateForm({ ...rateUpdateForm, rate: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowRateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Publish Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal 4: Shop Receiving Account */}
      {showAccountModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title font-serif flex items-center gap-2">
                <Landmark size={18} className="gold" />
                <span>{editingAccount ? 'Edit Receiving Account' : 'Add Shop Receiving Account'}</span>
              </h3>
              <button type="button" className="close-btn" onClick={() => setShowAccountModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="modal-body">
              <div className="form-group mb-3">
                <label>Account Label / Destination Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={accountForm.account_name}
                  onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                  placeholder="e.g. SBI Current Account, HDFC Current Account, Cash Counter"
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label>Account Type *</label>
                <select
                  className="form-control"
                  value={accountForm.account_type}
                  onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value as any })}
                  required
                >
                  <option value="BANK">Bank Account (Current / Savings)</option>
                  <option value="CASH">Cash Counter / Safe Drawer</option>
                  <option value="UPI">UPI VPA / QR Handle</option>
                  <option value="CARD_POS">Card POS Terminal / Merchant</option>
                  <option value="OTHER">Other Tender Destination</option>
                </select>
              </div>

              {(accountForm.account_type === 'BANK' || accountForm.account_type === 'CARD_POS') && (
                <div className="form-group mb-3">
                  <label>Bank Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={accountForm.bank_name}
                    onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                  />
                </div>
              )}

              {accountForm.account_type === 'BANK' && (
                <>
                  <div className="form-group mb-3">
                    <label>Account Number</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={accountForm.account_number}
                      onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                      placeholder="e.g. 409281002918"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      className="form-control font-mono uppercase"
                      value={accountForm.ifsc}
                      onChange={(e) => setAccountForm({ ...accountForm, ifsc: e.target.value.toUpperCase() })}
                      placeholder="e.g. SBIN0000300"
                    />
                  </div>
                </>
              )}

              {accountForm.account_type === 'UPI' && (
                <div className="form-group mb-3">
                  <label>UPI ID / VPA</label>
                  <input
                    type="text"
                    className="form-control font-mono"
                    value={accountForm.upi_id}
                    onChange={(e) => setAccountForm({ ...accountForm, upi_id: e.target.value })}
                    placeholder="e.g. jewelsuite@sbi or 9876543210@paytm"
                  />
                </div>
              )}

              <div className="flex items-center gap-4 my-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={accountForm.is_default}
                    onChange={(e) => setAccountForm({ ...accountForm, is_default: e.target.checked })}
                  />
                  <span>Set as default for this type</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={accountForm.is_active}
                    onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })}
                  />
                  <span>Active for billing selections</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAccountModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
