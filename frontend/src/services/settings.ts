// frontend/src/services/settings.ts
import { request, getApiUrl } from './api';
import { Metal } from '../types';

export type UserRole = 'ADMIN' | 'STAFF';
export type TaxMode = 'INCLUSIVE' | 'EXCLUSIVE' | 'NO_TAX';
export type PageSize = 'A4' | 'A5' | 'THERMAL';
export type AMCStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'GRACE_PERIOD' | 'SUSPENDED';

export interface InvoiceColumnSettings {
  show_tag_no: boolean;
  show_tunch: boolean;
  show_less_weight: boolean;
  show_net_weight: boolean;
  show_badla: boolean;
  show_wastage: boolean;
  show_making_charge: boolean;
  show_fine_weight: boolean;
}

export const DEFAULT_INVOICE_COLUMN_SETTINGS: InvoiceColumnSettings = {
  show_tag_no: true,
  show_tunch: true,
  show_less_weight: true,
  show_net_weight: true,
  show_badla: true,
  show_wastage: true,
  show_making_charge: true,
  show_fine_weight: true,
};

export interface ModuleSettings {
  retail_enabled: boolean;
  wholesale_enabled: boolean;
  girvi_enabled: boolean;
  schemes_enabled: boolean;
}

export const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
  retail_enabled: true,
  wholesale_enabled: true,
  girvi_enabled: true,
  schemes_enabled: true,
};

export interface SecuritySettings {
  display_mode_pin: string;
  store_config_password_set: boolean;
  store_config_lock_enabled: boolean;
  store_config_password?: string;
  current_username?: string;
}

export interface UpdateSecuritySettingsInput {
  username?: string;
  current_password?: string;
  new_password?: string;
  display_mode_pin?: string;
  store_config_password?: string;
  store_config_lock_enabled?: boolean;
}

export interface ShopProfile {
  id: string;
  name: string;
  legal_name: string | null;
  owner_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  upi_id: string | null;
  logo_path: string | null;
  updated_at: string;
}

export interface GeneralSettings {
  currency_symbol: string;
  currency_code: string;
  date_format: string;
  time_format: string;
  weight_decimals: number;
  rate_decimals: number;
  amount_decimals: number;
  default_country: string;
  default_state: string;
  default_city: string;
}

export interface FinancialYearSettings {
  current_fy: string;
  start_date: string;
  end_date: string;
}

export interface DocumentSequenceConfig {
  doc_type: string;
  prefix: string;
  starting_number: number;
  current_value: number;
  padding: number;
  financial_year_reset: boolean;
  financial_year: string | null;
  updated_at?: string;
}

export interface BillingSettings {
  default_customer_type: string;
  default_gst_rate: number;
  default_payment_mode: string;
  default_invoice_notes: string;
  sequences: DocumentSequenceConfig[];
}

export interface GSTSettings {
  gst_enabled: boolean;
  gstin: string;
  legal_name: string;
  default_gst_rate: number;
  tax_mode: TaxMode;
}

export interface PaymentModeConfig {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
}

export interface ShopReceivingAccount {
  id: string;
  account_name: string;
  account_type: 'BANK' | 'UPI' | 'CASH' | 'CARD_POS' | 'OTHER';
  bank_name?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  upi_id?: string | null;
  is_default?: boolean;
  is_active: boolean;
  display_order?: number;
}

export interface PrintSettings {
  show_logo: boolean;
  show_shop_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_gstin: boolean;
  show_pan: boolean;
  invoice_footer: string;
  terms_and_conditions: string;
  customer_copy: boolean;
  shop_copy: boolean;
  page_size: PageSize;
}

export interface UserDetail {
  id: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  permissions: string[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AMCLicenseInfo {
  id: string;
  license_key: string;
  shop_id: string;
  device_id: string;
  plan: string;
  issued_date: string;
  expiry_date: string;
  grace_period_days: number;
  signature: string;
  status: AMCStatus;
  days_remaining: number;
  last_verified_at: string;
  is_valid: boolean;
  warning_message?: string;
}

export interface DatabaseInfo {
  status: string;
  location: string;
  size_bytes: number;
  wal_mode: boolean;
  migrations_applied: number;
  last_migration?: string;
}

export interface AboutSystemInfo {
  app_name: string;
  app_version: string;
  db_version: string;
  build_version: string;
  installation_date: string;
  current_fy: string;
  license_status: AMCStatus;
  amc_expiry: string;
  db_path: string;
  db_size_bytes: number;
  applied_migrations_count: number;
  support_phone: string;
  support_email: string;
}

export const settingsApi = {
  // Shop Profile
  getShopProfile(): Promise<ShopProfile> {
    return request<ShopProfile>('/api/settings/shop');
  },

  updateShopProfile(data: Partial<ShopProfile>): Promise<ShopProfile> {
    return request<ShopProfile>('/api/settings/shop', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  uploadLogo(base64Data: string, mimeType: string): Promise<{ logo_path: string }> {
    return request<{ logo_path: string }>('/api/settings/shop/logo', {
      method: 'POST',
      body: JSON.stringify({ base64Data, mimeType }),
    });
  },

  getLogoUrl(): string {
    return getApiUrl('/api/settings/shop/logo');
  },

  // General Settings
  getGeneral(): Promise<GeneralSettings> {
    return request<GeneralSettings>('/api/settings/general');
  },

  updateGeneral(data: Partial<GeneralSettings>): Promise<GeneralSettings> {
    return request<GeneralSettings>('/api/settings/general', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Financial Year
  getFinancialYear(): Promise<FinancialYearSettings> {
    return request<FinancialYearSettings>('/api/settings/financial-year');
  },

  updateFinancialYear(data: Partial<FinancialYearSettings>): Promise<FinancialYearSettings> {
    return request<FinancialYearSettings>('/api/settings/financial-year', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Billing Settings & Sequences
  getBilling(): Promise<BillingSettings> {
    return request<BillingSettings>('/api/settings/billing');
  },

  updateBilling(data: {
    default_customer_type?: string;
    default_gst_rate?: number;
    default_payment_mode?: string;
    default_invoice_notes?: string;
    sequences?: { doc_type: string; prefix?: string; starting_number?: number; padding?: number; financial_year_reset?: boolean }[];
  }): Promise<BillingSettings> {
    return request<BillingSettings>('/api/settings/billing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // GST Settings
  getGST(): Promise<GSTSettings> {
    return request<GSTSettings>('/api/settings/gst');
  },

  updateGST(data: Partial<GSTSettings>): Promise<GSTSettings> {
    return request<GSTSettings>('/api/settings/gst', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Payment Modes
  getPaymentModes(activeOnly = false): Promise<PaymentModeConfig[]> {
    return request<PaymentModeConfig[]>(`/api/settings/payment-modes${activeOnly ? '?activeOnly=true' : ''}`);
  },

  togglePaymentMode(code: string, is_active: boolean): Promise<PaymentModeConfig> {
    return request<PaymentModeConfig>(`/api/settings/payment-modes/${code}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ is_active }),
    });
  },

  // Store Dealing Metals Configuration (Gold, Silver, Diamond, Platinum)
  getMetals(activeOnly = false): Promise<Metal[]> {
    return request<Metal[]>(`/api/settings/metals${activeOnly ? '?activeOnly=true' : ''}`);
  },

  toggleMetal(code: string, is_active: boolean): Promise<Metal> {
    return request<Metal>(`/api/settings/metals/${code}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ is_active }),
    });
  },

  updateActiveMetals(enabled_metals: string[]): Promise<Metal[]> {
    return request<Metal[]>('/api/settings/metals', {
      method: 'PUT',
      body: JSON.stringify({ enabled_metals }),
    });
  },

  // Shop Receiving Accounts
  getReceivingAccounts(): Promise<ShopReceivingAccount[]> {
    return request<ShopReceivingAccount[]>('/api/settings/receiving-accounts');
  },

  updateReceivingAccounts(accounts: ShopReceivingAccount[]): Promise<ShopReceivingAccount[]> {
    return request<ShopReceivingAccount[]>('/api/settings/receiving-accounts', {
      method: 'PUT',
      body: JSON.stringify(accounts),
    });
  },

  // Printing Settings
  getPrinting(): Promise<PrintSettings> {
    return request<PrintSettings>('/api/settings/printing');
  },

  updatePrinting(data: Partial<PrintSettings>): Promise<PrintSettings> {
    return request<PrintSettings>('/api/settings/printing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Invoice Columns & Optional Fields Configuration
  getInvoiceColumns(): Promise<InvoiceColumnSettings> {
    return request<InvoiceColumnSettings>('/api/settings/invoice-columns');
  },

  updateInvoiceColumns(data: Partial<InvoiceColumnSettings>): Promise<InvoiceColumnSettings> {
    return request<InvoiceColumnSettings>('/api/settings/invoice-columns', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // AMC & License
  getAMC(): Promise<AMCLicenseInfo> {
    return request<AMCLicenseInfo>('/api/settings/amc');
  },

  // Database Info
  getDatabaseInfo(): Promise<DatabaseInfo> {
    return request<DatabaseInfo>('/api/settings/database');
  },

  // About Info
  getAbout(): Promise<AboutSystemInfo> {
    return request<AboutSystemInfo>('/api/settings/about');
  },

  // Users Management
  getUsers(): Promise<UserDetail[]> {
    return request<UserDetail[]>('/api/users');
  },

  getUserById(id: string): Promise<UserDetail> {
    return request<UserDetail>(`/api/users/${id}`);
  },

  createUser(data: {
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
    email?: string;
    role?: UserRole;
    permissions?: string[];
  }): Promise<UserDetail> {
    return request<UserDetail>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateUser(id: string, data: {
    full_name?: string;
    phone?: string;
    email?: string;
    role?: UserRole;
    is_active?: boolean;
    permissions?: string[];
  }): Promise<UserDetail> {
    return request<UserDetail>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  resetPassword(id: string, password: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  deactivateUser(id: string): Promise<UserDetail> {
    return request<UserDetail>(`/api/users/${id}/deactivate`, {
      method: 'POST',
    });
  },

  // Security & Passwords
  getSecurity(): Promise<SecuritySettings> {
    return request<SecuritySettings>('/api/settings/security');
  },

  updateSecurity(data: UpdateSecuritySettingsInput): Promise<SecuritySettings> {
    return request<SecuritySettings>('/api/settings/security', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  verifyConfigPassword(password: string): Promise<{ valid: boolean }> {
    return request<{ valid: boolean }>('/api/settings/security/verify-config', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  verifyDisplayModePin(pin: string): Promise<{ valid: boolean }> {
    return request<{ valid: boolean }>('/api/settings/security/verify-display-mode', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  // Business Operations & Modules (Retail, Wholesale, Girvi, Saving Schemes)
  getModules(): Promise<ModuleSettings> {
    return request<ModuleSettings>('/api/settings/modules');
  },

  updateModules(data: Partial<ModuleSettings>): Promise<ModuleSettings> {
    return request<ModuleSettings>('/api/settings/modules', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleModule(moduleName: string, is_active?: boolean): Promise<ModuleSettings> {
    return request<ModuleSettings>(`/api/settings/modules/${moduleName}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ is_active }),
    });
  },
};
