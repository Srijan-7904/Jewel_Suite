// backend/src/services/settings.service.ts
import fs from 'fs';
import path from 'path';
import { getDb } from '../database/connection/db.js';
import { config } from '../config/env.js';
import { shopRepository } from '../repositories/shop.repository.js';
import { settingRepository } from '../repositories/setting.repository.js';
import { documentSequenceRepository } from '../repositories/documentSequence.repository.js';
import { paymentModeRepository } from '../repositories/paymentMode.repository.js';
import { amcRepository } from '../repositories/amc.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { metalRepository, MetalRecord } from '../repositories/metal.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  ShopProfile,
  GeneralSettings,
  FinancialYearSettings,
  BillingSettings,
  GSTSettings,
  PaymentModeConfig,
  ShopReceivingAccount,
  PrintSettings,
  AboutSystemInfo,
  TaxMode,
  PageSize,
  DocumentType,
  InvoiceColumnSettings,
  DEFAULT_INVOICE_COLUMN_SETTINGS,
  SecuritySettings,
  UpdateSecuritySettingsInput,
  ModuleSettings,
  DEFAULT_MODULE_SETTINGS,
} from '../domain/settings.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors.js';

// Basic GSTIN Regex: 2 digits state + 5 chars PAN + 4 digits PAN + 1 char entity + 1 char Z + 1 check digit
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SettingsService {
  /**
   * Shop Profile
   */
  getShopProfile(): ShopProfile {
    let profile = shopRepository.getProfile();
    if (!profile) {
      shopRepository.create({
        name: 'Jewel Suite Demo Store',
        legal_name: 'Jewel Suite Private Limited',
        owner_name: 'Shop Owner',
        address: '101, Zaveri Bazaar',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400002',
        country: 'India',
        phone: '+91 9876543210',
        email: 'store@jewelsuite.local',
        gstin: '27AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
      });
      profile = shopRepository.getProfile()!;
    }
    return profile;
  }

  updateShopProfile(data: Partial<ShopProfile>, userId?: string): ShopProfile {
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestError('Shop Name is required', 'VALIDATION_ERROR');
    }

    if (data.gstin && !GSTIN_REGEX.test(data.gstin.trim().toUpperCase())) {
      throw new BadRequestError('Invalid GSTIN format. Expected format: 27AAAAA0000A1Z5', 'VALIDATION_ERROR');
    }

    if (data.email && !EMAIL_REGEX.test(data.email.trim())) {
      throw new BadRequestError('Invalid email address format', 'VALIDATION_ERROR');
    }

    const updated = shopRepository.updateProfile({
      ...data,
      gstin: data.gstin ? data.gstin.trim().toUpperCase() : data.gstin,
      pan: data.pan ? data.pan.trim().toUpperCase() : data.pan,
    });

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'SHOP',
      entity_id: updated.id,
      metadata: { updated_fields: Object.keys(data) },
    });

    return updated;
  }

  /**
   * Shop Logo handling
   */
  saveShopLogo(base64Data: string, mimeType: string, userId?: string): { logo_path: string } {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      throw new BadRequestError('Invalid logo file format. Allowed formats: PNG, JPG, JPEG, WEBP', 'INVALID_FILE_TYPE');
    }

    // Strip header prefix if present (e.g. data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Validate size (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      throw new BadRequestError('Logo file size exceeds maximum limit of 2MB', 'FILE_TOO_LARGE');
    }

    // Store in %LOCALAPPDATA%\JewelSuite\shop\logo.png
    const logoFileName = 'logo.png';
    const destinationPath = path.join(config.shopDir, logoFileName);

    try {
      if (!fs.existsSync(config.shopDir)) {
        fs.mkdirSync(config.shopDir, { recursive: true });
      }
      fs.writeFileSync(destinationPath, buffer);
    } catch (err: any) {
      throw new BadRequestError(`Failed to save logo file: ${err.message}`, 'FILE_WRITE_ERROR');
    }

    shopRepository.updateProfile({ logo_path: logoFileName });

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'SHOP_LOGO',
      metadata: { file_size_bytes: buffer.length, mime_type: mimeType },
    });

    return { logo_path: logoFileName };
  }

  getShopLogoPath(): string | null {
    const logoFile = path.join(config.shopDir, 'logo.png');
    if (fs.existsSync(logoFile)) {
      return logoFile;
    }
    return null;
  }

  /**
   * General Settings
   */
  getGeneralSettings(): GeneralSettings {
    return {
      currency_symbol: settingRepository.get('general.currency_symbol') || '₹',
      currency_code: settingRepository.get('general.currency_code') || 'INR',
      date_format: settingRepository.get('general.date_format') || 'DD/MM/YYYY',
      time_format: settingRepository.get('general.time_format') || '12h',
      weight_decimals: settingRepository.getNumber('general.weight_decimals', 3),
      rate_decimals: settingRepository.getNumber('general.rate_decimals', 2),
      amount_decimals: settingRepository.getNumber('general.amount_decimals', 2),
      default_country: settingRepository.get('general.default_country') || 'India',
      default_state: settingRepository.get('general.default_state') || 'Maharashtra',
      default_city: settingRepository.get('general.default_city') || 'Mumbai',
    };
  }

  updateGeneralSettings(data: Partial<GeneralSettings>, userId?: string): GeneralSettings {
    if (data.currency_symbol !== undefined) settingRepository.set('general.currency_symbol', data.currency_symbol.trim());
    if (data.currency_code !== undefined) settingRepository.set('general.currency_code', data.currency_code.trim().toUpperCase());
    if (data.date_format !== undefined) settingRepository.set('general.date_format', data.date_format);
    if (data.time_format !== undefined) settingRepository.set('general.time_format', data.time_format);
    if (data.weight_decimals !== undefined) settingRepository.set('general.weight_decimals', Math.min(4, Math.max(1, data.weight_decimals)).toString());
    if (data.rate_decimals !== undefined) settingRepository.set('general.rate_decimals', Math.min(4, Math.max(0, data.rate_decimals)).toString());
    if (data.amount_decimals !== undefined) settingRepository.set('general.amount_decimals', Math.min(2, Math.max(0, data.amount_decimals)).toString());
    if (data.default_country !== undefined) settingRepository.set('general.default_country', data.default_country.trim());
    if (data.default_state !== undefined) settingRepository.set('general.default_state', data.default_state.trim());
    if (data.default_city !== undefined) settingRepository.set('general.default_city', data.default_city.trim());

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'GENERAL_SETTINGS',
      metadata: data,
    });

    return this.getGeneralSettings();
  }

  /**
   * Financial Year Settings
   */
  getFinancialYearSettings(): FinancialYearSettings {
    return {
      current_fy: settingRepository.get('fy.current') || '2026-27',
      start_date: settingRepository.get('fy.start_date') || '2026-04-01',
      end_date: settingRepository.get('fy.end_date') || '2027-03-31',
    };
  }

  updateFinancialYearSettings(data: Partial<FinancialYearSettings>, userId?: string): FinancialYearSettings {
    if (data.start_date && data.end_date) {
      if (new Date(data.start_date) >= new Date(data.end_date)) {
        throw new BadRequestError('Financial Year End Date must be after Start Date', 'VALIDATION_ERROR');
      }
    }

    if (data.current_fy !== undefined) settingRepository.set('fy.current', data.current_fy.trim());
    if (data.start_date !== undefined) settingRepository.set('fy.start_date', data.start_date);
    if (data.end_date !== undefined) settingRepository.set('fy.end_date', data.end_date);

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'FINANCIAL_YEAR',
      metadata: data,
    });

    return this.getFinancialYearSettings();
  }

  /**
   * Billing & Document Sequences
   */
  getBillingSettings(): BillingSettings {
    documentSequenceRepository.initDefaults();
    return {
      default_customer_type: settingRepository.get('billing.default_customer_type') || 'RETAIL',
      default_gst_rate: settingRepository.getNumber('billing.default_gst_rate', 3),
      default_payment_mode: settingRepository.get('billing.default_payment_mode') || 'CASH',
      default_invoice_notes: settingRepository.get('billing.default_invoice_notes') || 'Thank you for your business. Certified pure jewellery.',
      sequences: documentSequenceRepository.getAll(),
    };
  }

  updateBillingSettings(data: {
    default_customer_type?: string;
    default_gst_rate?: number;
    default_payment_mode?: string;
    default_invoice_notes?: string;
    sequences?: { doc_type: DocumentType; prefix?: string; starting_number?: number; padding?: number; financial_year_reset?: boolean }[];
  }, userId?: string): BillingSettings {
    if (data.default_customer_type !== undefined) settingRepository.set('billing.default_customer_type', data.default_customer_type);
    if (data.default_gst_rate !== undefined) {
      settingRepository.set('billing.default_gst_rate', data.default_gst_rate.toString());
      settingRepository.set('gst.default_rate', data.default_gst_rate.toString());
    }
    if (data.default_payment_mode !== undefined) settingRepository.set('billing.default_payment_mode', data.default_payment_mode);
    if (data.default_invoice_notes !== undefined) settingRepository.set('billing.default_invoice_notes', data.default_invoice_notes);

    if (data.sequences && Array.isArray(data.sequences)) {
      for (const seq of data.sequences) {
        documentSequenceRepository.updateConfig(seq.doc_type, {
          prefix: seq.prefix,
          starting_number: seq.starting_number,
          padding: seq.padding,
          financial_year_reset: seq.financial_year_reset,
        });

        auditRepository.log({
          user_id: userId,
          action: 'NUMBER_SEQUENCE_CHANGED',
          entity_type: 'DOCUMENT_SEQUENCE',
          entity_id: seq.doc_type,
          metadata: seq,
        });
      }
    }

    auditRepository.log({
      user_id: userId,
      action: 'BILLING_SETTINGS_UPDATED',
      entity_type: 'BILLING_SETTINGS',
      metadata: {
        default_customer_type: data.default_customer_type,
        default_gst_rate: data.default_gst_rate,
        default_payment_mode: data.default_payment_mode,
      },
    });

    return this.getBillingSettings();
  }

  /**
   * GST Settings
   */
  getGSTSettings(): GSTSettings {
    const shop = this.getShopProfile();
    return {
      gst_enabled: settingRepository.getBoolean('gst.enabled', true),
      gstin: shop.gstin || settingRepository.get('gst.gstin') || '27AAAAA0000A1Z5',
      legal_name: shop.legal_name || shop.name,
      default_gst_rate: settingRepository.getNumber('gst.default_rate', 3),
      tax_mode: (settingRepository.get('gst.tax_mode') || 'EXCLUSIVE') as TaxMode,
    };
  }

  updateGSTSettings(data: Partial<GSTSettings>, userId?: string): GSTSettings {
    if (data.gstin) {
      const cleanGSTIN = data.gstin.trim().toUpperCase();
      if (!GSTIN_REGEX.test(cleanGSTIN)) {
        throw new BadRequestError('Invalid GSTIN format. Expected 15-character format like 27AAAAA0000A1Z5', 'VALIDATION_ERROR');
      }
      shopRepository.updateProfile({ gstin: cleanGSTIN });
      settingRepository.set('gst.gstin', cleanGSTIN);
    }

    if (data.legal_name) {
      shopRepository.updateProfile({ legal_name: data.legal_name.trim() });
    }

    if (data.gst_enabled !== undefined) {
      settingRepository.set('gst.enabled', data.gst_enabled ? 'true' : 'false');
    }

    if (data.default_gst_rate !== undefined) {
      if (data.default_gst_rate < 0 || data.default_gst_rate > 28) {
        throw new BadRequestError('GST Rate must be between 0% and 28%', 'VALIDATION_ERROR');
      }
      settingRepository.set('gst.default_rate', data.default_gst_rate.toString());
      settingRepository.set('billing.default_gst_rate', data.default_gst_rate.toString());
    }

    if (data.tax_mode !== undefined) {
      if (!['INCLUSIVE', 'EXCLUSIVE', 'NO_TAX'].includes(data.tax_mode)) {
        throw new BadRequestError('Invalid tax mode. Allowed: INCLUSIVE, EXCLUSIVE, NO_TAX', 'VALIDATION_ERROR');
      }
      settingRepository.set('gst.tax_mode', data.tax_mode);
    }

    auditRepository.log({
      user_id: userId,
      action: 'GST_SETTINGS_UPDATED',
      entity_type: 'GST_SETTINGS',
      metadata: data,
    });

    return this.getGSTSettings();
  }

  /**
   * Payment Modes
   */
  getPaymentModes(activeOnly = false): PaymentModeConfig[] {
    return activeOnly ? paymentModeRepository.getActive() : paymentModeRepository.getAll();
  }

  togglePaymentMode(code: string, isActive: boolean, userId?: string): PaymentModeConfig {
    if (code.toUpperCase() === 'CASH' && !isActive) {
      throw new BadRequestError('Physical CASH payment mode cannot be deactivated as it tracks physical counter cash.', 'OPERATION_NOT_ALLOWED');
    }

    const updated = paymentModeRepository.toggleActive(code, isActive);
    if (!updated) {
      throw new BadRequestError(`Payment mode '${code}' not found`, 'NOT_FOUND');
    }

    auditRepository.log({
      user_id: userId,
      action: 'PAYMENT_MODE_UPDATED',
      entity_type: 'PAYMENT_MODE',
      entity_id: code,
      metadata: { code, is_active: isActive },
    });

    return updated;
  }

  /**
   * Store Dealing Metals Configuration (Gold, Silver, Diamond, Platinum)
   */
  getStoreMetals(activeOnly = false): MetalRecord[] {
    return metalRepository.getMetals(activeOnly);
  }

  toggleStoreMetal(code: string, isActive: boolean, userId?: string): MetalRecord {
    if (!isActive) {
      const activeCount = metalRepository.getActiveMetalsCount();
      if (activeCount <= 1) {
        throw new BadRequestError('At least one metal type (e.g. Gold) must remain active for the shop.', 'OPERATION_NOT_ALLOWED');
      }
    }

    const updated = metalRepository.toggleMetalActive(code, isActive);
    if (!updated) {
      throw new BadRequestError(`Metal '${code}' not found`, 'NOT_FOUND');
    }

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'STORE_METALS',
      entity_id: code,
      metadata: { code, is_active: isActive },
    });

    return updated;
  }

  updateActiveMetals(enabledCodes: string[], userId?: string): MetalRecord[] {
    if (!Array.isArray(enabledCodes) || enabledCodes.length === 0) {
      throw new BadRequestError('At least one metal type must be selected (e.g. GOLD).', 'VALIDATION_ERROR');
    }

    const upperCodes = enabledCodes.map((c) => c.toUpperCase());
    const allMetals = metalRepository.getMetals(false);

    for (const m of allMetals) {
      const shouldBeActive = upperCodes.includes(m.code.toUpperCase());
      metalRepository.toggleMetalActive(m.code, shouldBeActive);
    }

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'STORE_METALS',
      metadata: { enabled_metals: upperCodes },
    });

    return metalRepository.getMetals(false);
  }

  /**
   * Shop Receiving Accounts Configuration
   */
  getReceivingAccounts(): ShopReceivingAccount[] {
    const raw = settingRepository.getJson<ShopReceivingAccount[]>('shop.receiving_accounts', []);
    if (raw && raw.length > 0) {
      return raw;
    }

    // Seed defaults based on shop profile
    const shop = this.getShopProfile();
    const defaults: ShopReceivingAccount[] = [
      {
        id: 'acc-cash',
        account_name: 'Cash Counter',
        account_type: 'CASH',
        is_default: true,
        is_active: true,
      },
      {
        id: 'acc-bank-sbi',
        account_name: shop.bank_name ? `${shop.bank_name} Current Account` : 'SBI Current Account',
        account_type: 'BANK',
        bank_name: shop.bank_name || 'State Bank of India',
        account_number: shop.account_number || null,
        ifsc: shop.ifsc || null,
        is_default: true,
        is_active: true,
      },
      {
        id: 'acc-bank-hdfc',
        account_name: 'HDFC Current Account',
        account_type: 'BANK',
        bank_name: 'HDFC Bank',
        account_number: null,
        ifsc: null,
        is_default: false,
        is_active: true,
      },
      {
        id: 'acc-upi',
        account_name: 'Store Primary UPI / QR',
        account_type: 'UPI',
        upi_id: shop.upi_id || null,
        is_default: true,
        is_active: true,
      },
      {
        id: 'acc-pos',
        account_name: 'Card POS Terminal #1',
        account_type: 'CARD_POS',
        is_default: true,
        is_active: true,
      },
    ];

    settingRepository.setJson('shop.receiving_accounts', defaults);
    return defaults;
  }

  updateReceivingAccounts(accounts: ShopReceivingAccount[], userId?: string): ShopReceivingAccount[] {
    if (!Array.isArray(accounts)) {
      throw new BadRequestError('Accounts list must be an array', 'VALIDATION_ERROR');
    }

    const sanitized = accounts.map((acc, idx) => {
      if (!acc.account_name || !acc.account_name.trim()) {
        throw new BadRequestError(`Account at row ${idx + 1} must have an account name`, 'VALIDATION_ERROR');
      }
      return {
        id: acc.id || `acc-${Date.now()}-${idx + 1}`,
        account_name: acc.account_name.trim(),
        account_type: acc.account_type || 'BANK',
        bank_name: acc.bank_name ? acc.bank_name.trim() : null,
        account_number: acc.account_number ? acc.account_number.trim() : null,
        ifsc: acc.ifsc ? acc.ifsc.trim().toUpperCase() : null,
        upi_id: acc.upi_id ? acc.upi_id.trim() : null,
        is_default: Boolean(acc.is_default),
        is_active: acc.is_active !== undefined ? Boolean(acc.is_active) : true,
      };
    });

    settingRepository.setJson('shop.receiving_accounts', sanitized);

    auditRepository.log({
      user_id: userId,
      action: 'RECEIVING_ACCOUNTS_UPDATED',
      entity_type: 'SHOP_ACCOUNTS',
      metadata: { count: sanitized.length },
    });

    return sanitized;
  }

  /**
   * Printing Settings
   */
  getPrintSettings(): PrintSettings {
    return {
      show_logo: settingRepository.getBoolean('print.show_logo', true),
      show_shop_name: settingRepository.getBoolean('print.show_shop_name', true),
      show_address: settingRepository.getBoolean('print.show_address', true),
      show_phone: settingRepository.getBoolean('print.show_phone', true),
      show_gstin: settingRepository.getBoolean('print.show_gstin', true),
      show_pan: settingRepository.getBoolean('print.show_pan', true),
      invoice_footer: settingRepository.get('print.invoice_footer') || 'Subject to local jurisdiction. Goods once sold will not be taken back without original bill.',
      terms_and_conditions: settingRepository.get('print.terms_and_conditions') || '1. All jewellery tested for gold purity.\n2. Making charges are non-refundable.\n3. Return / Exchange within 7 days with original invoice.',
      customer_copy: settingRepository.getBoolean('print.customer_copy', true),
      shop_copy: settingRepository.getBoolean('print.shop_copy', true),
      page_size: (settingRepository.get('print.page_size') || 'A4') as PageSize,
    };
  }

  updatePrintSettings(data: Partial<PrintSettings>, userId?: string): PrintSettings {
    if (data.show_logo !== undefined) settingRepository.set('print.show_logo', data.show_logo ? 'true' : 'false');
    if (data.show_shop_name !== undefined) settingRepository.set('print.show_shop_name', data.show_shop_name ? 'true' : 'false');
    if (data.show_address !== undefined) settingRepository.set('print.show_address', data.show_address ? 'true' : 'false');
    if (data.show_phone !== undefined) settingRepository.set('print.show_phone', data.show_phone ? 'true' : 'false');
    if (data.show_gstin !== undefined) settingRepository.set('print.show_gstin', data.show_gstin ? 'true' : 'false');
    if (data.show_pan !== undefined) settingRepository.set('print.show_pan', data.show_pan ? 'true' : 'false');
    if (data.invoice_footer !== undefined) settingRepository.set('print.invoice_footer', data.invoice_footer);
    if (data.terms_and_conditions !== undefined) settingRepository.set('print.terms_and_conditions', data.terms_and_conditions);
    if (data.customer_copy !== undefined) settingRepository.set('print.customer_copy', data.customer_copy ? 'true' : 'false');
    if (data.shop_copy !== undefined) settingRepository.set('print.shop_copy', data.shop_copy ? 'true' : 'false');
    if (data.page_size !== undefined) {
      if (!['A4', 'A5', 'THERMAL'].includes(data.page_size)) {
        throw new BadRequestError('Invalid page size. Allowed: A4, A5, THERMAL', 'VALIDATION_ERROR');
      }
      settingRepository.set('print.page_size', data.page_size);
    }

    auditRepository.log({
      user_id: userId,
      action: 'PRINT_SETTINGS_UPDATED',
      entity_type: 'PRINT_SETTINGS',
      metadata: data,
    });

    return this.getPrintSettings();
  }

  /**
   * Invoice Columns & Optional Fields Configuration
   */
  getInvoiceColumnSettings(): InvoiceColumnSettings {
    return settingRepository.getJson<InvoiceColumnSettings>('invoice.columns', DEFAULT_INVOICE_COLUMN_SETTINGS);
  }

  updateInvoiceColumnSettings(data: Partial<InvoiceColumnSettings>, userId?: string): InvoiceColumnSettings {
    const current = this.getInvoiceColumnSettings();
    const updated: InvoiceColumnSettings = {
      show_tag_no: typeof data.show_tag_no === 'boolean' ? data.show_tag_no : current.show_tag_no,
      show_tunch: typeof data.show_tunch === 'boolean' ? data.show_tunch : current.show_tunch,
      show_less_weight: typeof data.show_less_weight === 'boolean' ? data.show_less_weight : current.show_less_weight,
      show_net_weight: typeof data.show_net_weight === 'boolean' ? data.show_net_weight : current.show_net_weight,
      show_badla: typeof data.show_badla === 'boolean' ? data.show_badla : current.show_badla,
      show_wastage: typeof data.show_wastage === 'boolean' ? data.show_wastage : current.show_wastage,
      show_making_charge: typeof data.show_making_charge === 'boolean' ? data.show_making_charge : current.show_making_charge,
      show_fine_weight: typeof data.show_fine_weight === 'boolean' ? data.show_fine_weight : current.show_fine_weight,
    };

    settingRepository.setJson('invoice.columns', updated);

    auditRepository.log({
      user_id: userId,
      action: 'SHOP_SETTINGS_UPDATED',
      entity_type: 'INVOICE_COLUMNS',
      metadata: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Database & System info
   */
  getDatabaseInfo(): {
    status: string;
    location: string;
    size_bytes: number;
    wal_mode: boolean;
    migrations_applied: number;
    last_migration?: string;
  } {
    const db = getDb();
    let sizeBytes = 0;
    try {
      if (fs.existsSync(config.dbPath)) {
        sizeBytes = fs.statSync(config.dbPath).size;
      }
    } catch {
      sizeBytes = 0;
    }

    const migrations = db.prepare('SELECT migration_name, applied_at FROM schema_migrations ORDER BY id DESC').all() as { migration_name: string; applied_at: string }[];

    return {
      status: 'ONLINE',
      location: config.dbPath,
      size_bytes: sizeBytes,
      wal_mode: true,
      migrations_applied: migrations.length,
      last_migration: migrations[0]?.migration_name,
    };
  }

  /**
   * About application info
   */
  getAboutInfo(): AboutSystemInfo {
    const dbInfo = this.getDatabaseInfo();
    const license = amcRepository.getLicense();
    const fy = this.getFinancialYearSettings();

    return {
      app_name: 'Jewel Suite Gold & Diamond ERP',
      app_version: '1.0.0',
      db_version: '1.0.0-schema-010',
      build_version: '2026.10-release-offline',
      installation_date: '2026-04-01',
      current_fy: fy.current_fy,
      license_status: license ? license.status : 'ACTIVE',
      amc_expiry: license ? license.expiry_date : '2027-03-31',
      db_path: dbInfo.location,
      db_size_bytes: dbInfo.size_bytes,
      applied_migrations_count: dbInfo.migrations_applied,
      support_phone: '+91 80000 12345',
      support_email: 'support@jewelsuite.local',
    };
  }

  /**
   * Security & Access Settings
   */
  getSecuritySettings(userId?: string): SecuritySettings {
    const displayModePin = settingRepository.get('security.display_mode_pin') || '1234';
    const storeConfigPass = settingRepository.get('security.store_config_password') || '1234';
    const storeConfigLockEnabled = settingRepository.getBoolean('security.store_config_lock_enabled', true);

    let currentUsername = 'admin';
    if (userId) {
      const u = userRepository.findById(userId);
      if (u) {
        currentUsername = u.username;
      }
    } else {
      const firstAdmin = userRepository.findByUsername('admin');
      if (firstAdmin) {
        currentUsername = firstAdmin.username;
      }
    }

    return {
      display_mode_pin: displayModePin,
      store_config_password_set: Boolean(settingRepository.get('security.store_config_password')),
      store_config_lock_enabled: storeConfigLockEnabled,
      store_config_password: storeConfigPass,
      current_username: currentUsername,
    };
  }

  verifyConfigPassword(password: string): boolean {
    const lockEnabled = settingRepository.getBoolean('security.store_config_lock_enabled', true);
    if (!lockEnabled) {
      return true;
    }
    const currentPass = settingRepository.get('security.store_config_password') || '1234';
    return (password || '').trim() === currentPass.trim();
  }

  verifyDisplayModePin(pin: string): boolean {
    const currentPin = settingRepository.get('security.display_mode_pin') || '1234';
    return (pin || '').trim() === currentPin.trim();
  }

  async updateSecuritySettings(input: UpdateSecuritySettingsInput, userId?: string): Promise<SecuritySettings> {
    // 1. Display Mode PIN (Live figures on dashboard)
    if (input.display_mode_pin !== undefined) {
      const pin = input.display_mode_pin.trim();
      if (pin.length < 4) {
        throw new BadRequestError('Display Mode PIN must be at least 4 digits/characters long', 'VALIDATION_ERROR');
      }
      settingRepository.set('security.display_mode_pin', pin);
    }

    // 2. Store Configuration Password
    if (input.store_config_password !== undefined) {
      const pass = input.store_config_password.trim();
      if (pass.length < 4) {
        throw new BadRequestError('Store Configuration Password must be at least 4 characters long', 'VALIDATION_ERROR');
      }
      settingRepository.set('security.store_config_password', pass);
    }

    // 3. Store Configuration Lock Enabled toggle
    if (input.store_config_lock_enabled !== undefined) {
      settingRepository.set('security.store_config_lock_enabled', input.store_config_lock_enabled ? 'true' : 'false');
    }

    // 4. Update Current User Login Credentials (Username / Password)
    const targetUserId = userId || userRepository.findByUsername('admin')?.id;
    if (targetUserId) {
      const existingUser = userRepository.findById(targetUserId);
      if (!existingUser) {
        throw new NotFoundError('User not found');
      }

      if (input.username !== undefined) {
        const newUsername = input.username.trim();
        if (newUsername.length < 3) {
          throw new BadRequestError('Username must be at least 3 characters long', 'VALIDATION_ERROR');
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
          throw new BadRequestError('Username can only contain letters, numbers, hyphens, and underscores', 'VALIDATION_ERROR');
        }
        const duplicate = userRepository.findByUsername(newUsername);
        if (duplicate && duplicate.id !== targetUserId) {
          throw new BadRequestError(`Username '${newUsername}' is already taken`, 'USER_EXISTS');
        }
        userRepository.updateUsername(targetUserId, newUsername);
      }

      if (input.new_password) {
        const newPass = input.new_password.trim();
        if (newPass.length < 6) {
          throw new BadRequestError('New login password must be at least 6 characters long', 'VALIDATION_ERROR');
        }

        if (input.current_password) {
          const match = await comparePassword(input.current_password, existingUser.password_hash);
          if (!match) {
            throw new UnauthorizedError('Current password is incorrect');
          }
        }

        const hashed = await hashPassword(newPass);
        userRepository.updatePassword(targetUserId, hashed);
      }
    }

    auditRepository.log({
      user_id: userId,
      action: 'SECURITY_SETTINGS_UPDATED',
      entity_type: 'SECURITY',
      entity_id: 'SYSTEM',
      metadata: {
        updated_fields: Object.keys(input),
      },
    });

    return this.getSecuritySettings(userId);
  }

  // --- Business Operations & Modules Configuration ---
  getModuleSettings(): ModuleSettings {
    return {
      retail_enabled: settingRepository.getBoolean('module.retail_enabled', true),
      wholesale_enabled: settingRepository.getBoolean('module.wholesale_enabled', true),
      girvi_enabled: settingRepository.getBoolean('module.girvi_enabled', true),
      schemes_enabled: settingRepository.getBoolean('module.schemes_enabled', true),
    };
  }

  updateModuleSettings(data: Partial<ModuleSettings>, userId?: string): ModuleSettings {
    if (data.retail_enabled !== undefined) {
      settingRepository.set('module.retail_enabled', data.retail_enabled ? 'true' : 'false');
    }
    if (data.wholesale_enabled !== undefined) {
      settingRepository.set('module.wholesale_enabled', data.wholesale_enabled ? 'true' : 'false');
    }
    if (data.girvi_enabled !== undefined) {
      settingRepository.set('module.girvi_enabled', data.girvi_enabled ? 'true' : 'false');
    }
    if (data.schemes_enabled !== undefined) {
      settingRepository.set('module.schemes_enabled', data.schemes_enabled ? 'true' : 'false');
    }

    auditRepository.log({
      user_id: userId,
      action: 'MODULE_SETTINGS_UPDATED',
      entity_type: 'MODULE_SETTINGS',
      metadata: data,
    });

    return this.getModuleSettings();
  }

  toggleModule(moduleName: string, isActive?: boolean, userId?: string): ModuleSettings {
    const current = this.getModuleSettings();
    const key = moduleName.toLowerCase().trim();
    let updatedVal: boolean;

    if (key === 'retail') {
      updatedVal = isActive !== undefined ? Boolean(isActive) : !current.retail_enabled;
      settingRepository.set('module.retail_enabled', updatedVal ? 'true' : 'false');
    } else if (key === 'wholesale') {
      updatedVal = isActive !== undefined ? Boolean(isActive) : !current.wholesale_enabled;
      settingRepository.set('module.wholesale_enabled', updatedVal ? 'true' : 'false');
    } else if (key === 'girvi') {
      updatedVal = isActive !== undefined ? Boolean(isActive) : !current.girvi_enabled;
      settingRepository.set('module.girvi_enabled', updatedVal ? 'true' : 'false');
    } else if (key === 'schemes' || key === 'saving_schemes') {
      updatedVal = isActive !== undefined ? Boolean(isActive) : !current.schemes_enabled;
      settingRepository.set('module.schemes_enabled', updatedVal ? 'true' : 'false');
    } else {
      throw new BadRequestError(`Unknown module '${moduleName}'. Allowed: retail, wholesale, girvi, schemes`, 'VALIDATION_ERROR');
    }

    auditRepository.log({
      user_id: userId,
      action: 'MODULE_TOGGLED',
      entity_type: 'MODULE_SETTINGS',
      metadata: { module: key, is_active: updatedVal },
    });

    return this.getModuleSettings();
  }
}

export const settingsService = new SettingsService();
