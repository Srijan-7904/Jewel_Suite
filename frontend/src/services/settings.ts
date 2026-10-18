// frontend/src/services/settings.ts
import { request, getApiUrl } from './api';

export type UserRole = 'ADMIN' | 'STAFF';
export type TaxMode = 'INCLUSIVE' | 'EXCLUSIVE' | 'NO_TAX';
export type PageSize = 'A4' | 'A5' | 'THERMAL';
export type AMCStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'GRACE_PERIOD' | 'SUSPENDED';

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
};
