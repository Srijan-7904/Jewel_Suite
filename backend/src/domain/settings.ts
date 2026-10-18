// backend/src/domain/settings.ts
// Domain models and interfaces for Jewel Suite Part 11: Settings, AMC, Profile, Users

export type UserRole = 'ADMIN' | 'STAFF';

export type TaxMode = 'INCLUSIVE' | 'EXCLUSIVE' | 'NO_TAX';

export type PageSize = 'A4' | 'A5' | 'THERMAL';

export type AMCStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'GRACE_PERIOD' | 'SUSPENDED';

export type DocumentType =
  | 'INVOICE'
  | 'PURCHASE'
  | 'REPAIR'
  | 'EXCHANGE'
  | 'WORKSHOP_JOB'
  | 'GIRVI_LOAN'
  | 'SAVING_SCHEME';

export const STAFF_PERMISSIONS = [
  'VIEW_SALES',
  'CREATE_SALES',
  'EDIT_SALES',
  'CANCEL_SALES',
  'VIEW_PURCHASE',
  'CREATE_PURCHASE',
  'VIEW_STOCK',
  'CREATE_STOCK',
  'ADJUST_STOCK',
  'VIEW_CUSTOMERS',
  'MANAGE_CUSTOMERS',
  'VIEW_FINANCE',
  'CREATE_PAYMENT',
  'VIEW_WORKSHOP',
  'MANAGE_WORKSHOP',
  'VIEW_GIRVI',
  'MANAGE_GIRVI',
  'VIEW_SAVING_SCHEMES',
  'MANAGE_SAVING_SCHEMES',
  'VIEW_REPORTS',
  'EXPORT_REPORTS',
  'MANAGE_METAL_RATES',
  'MANAGE_SETTINGS',
  'MANAGE_USERS',
] as const;

export type StaffPermission = typeof STAFF_PERMISSIONS[number];

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
  doc_type: DocumentType;
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
