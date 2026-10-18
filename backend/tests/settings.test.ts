// backend/tests/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { settingsService } from '../src/services/settings.service.js';
import { auditRepository } from '../src/repositories/audit.repository.js';

describe('Jewel Suite Part 11: Settings Service & Domain Tests', () => {
  beforeEach(() => {
    const db = getDb();
    runMigrations(db);
    db.prepare('DELETE FROM settings').run();
  });

  describe('Shop Profile', () => {
    it('should retrieve default or existing shop profile', () => {
      const profile = settingsService.getShopProfile();
      expect(profile).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(profile.country).toBe('India');
    });

    it('should update shop profile with valid data and record audit log', () => {
      const updated = settingsService.updateShopProfile({
        name: 'Royal Heritage Jewellers',
        legal_name: 'Royal Heritage Jewellers LLP',
        owner_name: 'Rajesh Mehta',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        phone: '+91 9829012345',
        gstin: '08AAAAA1234A1Z5',
        pan: 'AAAAA1234A',
        bank_name: 'HDFC Bank',
        account_number: '50200012345678',
        ifsc: 'HDFC0001234',
        upi_id: 'royalheritage@okhdfcbank',
      }, 'test-user-id');

      expect(updated.name).toBe('Royal Heritage Jewellers');
      expect(updated.legal_name).toBe('Royal Heritage Jewellers LLP');
      expect(updated.city).toBe('Jaipur');
      expect(updated.gstin).toBe('08AAAAA1234A1Z5');
      expect(updated.bank_name).toBe('HDFC Bank');

      const logs = auditRepository.getRecent(5);
      const shopLog = logs.find((l) => l.action === 'SHOP_SETTINGS_UPDATED');
      expect(shopLog).toBeDefined();
    });

    it('should reject invalid GSTIN format', () => {
      expect(() => {
        settingsService.updateShopProfile({ gstin: 'INVALID-GST' });
      }).toThrow('Invalid GSTIN format');
    });

    it('should reject invalid email format', () => {
      expect(() => {
        settingsService.updateShopProfile({ email: 'not-an-email' });
      }).toThrow('Invalid email address format');
    });
  });

  describe('General & Financial Year Settings', () => {
    it('should retrieve and update general settings', () => {
      const initial = settingsService.getGeneralSettings();
      expect(initial.currency_symbol).toBe('₹');
      expect(initial.weight_decimals).toBe(3);

      const updated = settingsService.updateGeneralSettings({
        currency_symbol: '₹',
        weight_decimals: 4,
        default_city: 'Surat',
        default_state: 'Gujarat',
      }, 'test-admin');

      expect(updated.weight_decimals).toBe(4);
      expect(updated.default_city).toBe('Surat');
      expect(updated.default_state).toBe('Gujarat');
    });

    it('should retrieve and update financial year settings', () => {
      const fy = settingsService.getFinancialYearSettings();
      expect(fy.current_fy).toBeDefined();

      const updated = settingsService.updateFinancialYearSettings({
        current_fy: '2026-27',
        start_date: '2026-04-01',
        end_date: '2027-03-31',
      }, 'test-admin');

      expect(updated.current_fy).toBe('2026-27');
      expect(updated.start_date).toBe('2026-04-01');
      expect(updated.end_date).toBe('2027-03-31');
    });

    it('should reject invalid financial year dates where end is before start', () => {
      expect(() => {
        settingsService.updateFinancialYearSettings({
          start_date: '2027-04-01',
          end_date: '2026-03-31',
        });
      }).toThrow('Financial Year End Date must be after Start Date');
    });
  });

  describe('Billing & Document Numbering Configuration', () => {
    it('should retrieve billing settings and sequences', () => {
      const billing = settingsService.getBillingSettings();
      expect(billing.default_customer_type).toBe('RETAIL');
      expect(billing.default_gst_rate).toBe(3);
      expect(billing.sequences.length).toBeGreaterThanOrEqual(7);

      const invSeq = billing.sequences.find((s) => s.doc_type === 'INVOICE');
      expect(invSeq).toBeDefined();
      expect(invSeq?.prefix).toBe('INV');
    });

    it('should update billing configuration and sequence prefixes without altering history', () => {
      const updated = settingsService.updateBillingSettings({
        default_customer_type: 'WHOLESALE',
        default_invoice_notes: 'Custom bill notes',
        sequences: [
          { doc_type: 'INVOICE', prefix: 'BILL', padding: 5, financial_year_reset: true },
        ],
      }, 'test-admin');

      expect(updated.default_customer_type).toBe('WHOLESALE');
      expect(updated.default_invoice_notes).toBe('Custom bill notes');

      const invSeq = updated.sequences.find((s) => s.doc_type === 'INVOICE');
      expect(invSeq?.prefix).toBe('BILL');
      expect(invSeq?.padding).toBe(5);

      // Revert prefix to INV for subsequent tests
      settingsService.updateBillingSettings({
        sequences: [{ doc_type: 'INVOICE', prefix: 'INV', padding: 6, financial_year_reset: true }],
      });
    });
  });

  describe('GST Settings', () => {
    it('should retrieve and update GST settings', () => {
      const gst = settingsService.getGSTSettings();
      expect(gst.default_gst_rate).toBe(3);
      expect(gst.tax_mode).toBe('EXCLUSIVE');

      const updated = settingsService.updateGSTSettings({
        gst_enabled: true,
        default_gst_rate: 3,
        tax_mode: 'INCLUSIVE',
      }, 'test-admin');

      expect(updated.tax_mode).toBe('INCLUSIVE');
    });

    it('should reject invalid GST rate outside 0-28%', () => {
      expect(() => {
        settingsService.updateGSTSettings({ default_gst_rate: 50 });
      }).toThrow('GST Rate must be between 0% and 28%');
    });
  });

  describe('Payment Modes', () => {
    it('should list all payment modes including cash, card, upi, bank', () => {
      const modes = settingsService.getPaymentModes();
      expect(modes.length).toBeGreaterThanOrEqual(8);
      const cash = modes.find((m) => m.code === 'CASH');
      expect(cash).toBeDefined();
      expect(cash?.is_active).toBe(true);
    });

    it('should toggle an optional payment mode active/inactive', () => {
      const deactivated = settingsService.togglePaymentMode('CARD', false, 'test-admin');
      expect(deactivated.is_active).toBe(false);

      const activeOnly = settingsService.getPaymentModes(true);
      expect(activeOnly.some((m) => m.code === 'CARD')).toBe(false);

      // Reactivate
      const reactivated = settingsService.togglePaymentMode('CARD', true, 'test-admin');
      expect(reactivated.is_active).toBe(true);
    });

    it('should prevent deactivation of physical CASH mode to protect drawer accounting', () => {
      expect(() => {
        settingsService.togglePaymentMode('CASH', false, 'test-admin');
      }).toThrow('Physical CASH payment mode cannot be deactivated');
    });
  });

  describe('Printing Settings', () => {
    it('should retrieve and update print configuration', () => {
      const print = settingsService.getPrintSettings();
      expect(print.show_logo).toBe(true);
      expect(print.page_size).toBe('A4');

      const updated = settingsService.updatePrintSettings({
        page_size: 'THERMAL',
        show_pan: false,
        invoice_footer: 'Custom Footer Text',
      }, 'test-admin');

      expect(updated.page_size).toBe('THERMAL');
      expect(updated.show_pan).toBe(false);
      expect(updated.invoice_footer).toBe('Custom Footer Text');
    });

    it('should reject unsupported page size', () => {
      expect(() => {
        settingsService.updatePrintSettings({ page_size: 'LETTER' as any });
      }).toThrow('Invalid page size');
    });
  });

  describe('Database and About Information', () => {
    it('should return valid offline database metadata', () => {
      const dbInfo = settingsService.getDatabaseInfo();
      expect(dbInfo.status).toBe('ONLINE');
      expect(dbInfo.wal_mode).toBe(true);
      expect(dbInfo.migrations_applied).toBeGreaterThanOrEqual(10);
      expect(dbInfo.location).toBeDefined();
    });

    it('should return about application info without hardcoded shop data', () => {
      const about = settingsService.getAboutInfo();
      expect(about.app_name).toContain('Jewel Suite');
      expect(about.app_version).toBe('1.0.0');
      expect(about.license_status).toBeDefined();
      expect(about.current_fy).toBeDefined();
    });
  });
});
