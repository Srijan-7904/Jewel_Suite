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
import {
  ShopProfile,
  GeneralSettings,
  FinancialYearSettings,
  BillingSettings,
  GSTSettings,
  PaymentModeConfig,
  PrintSettings,
  AboutSystemInfo,
  TaxMode,
  PageSize,
  DocumentType,
} from '../domain/settings.js';
import { BadRequestError } from '../utils/errors.js';

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
    if (data.default_gst_rate !== undefined) settingRepository.set('billing.default_gst_rate', data.default_gst_rate.toString());
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
}

export const settingsService = new SettingsService();
