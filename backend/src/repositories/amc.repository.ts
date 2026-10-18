// backend/src/repositories/amc.repository.ts
import { getDb } from '../database/connection/db.js';
import { AMCLicenseInfo, AMCStatus } from '../domain/settings.js';

interface AMCLicenseRow {
  id: string;
  license_key: string;
  shop_id: string;
  device_id: string;
  plan: string;
  issued_date: string;
  expiry_date: string;
  grace_period_days: number;
  signature: string;
  status: string;
  last_verified_at: string;
}

export class AMCRepository {
  getLicense(): AMCLicenseInfo | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM amc_license ORDER BY created_at DESC LIMIT 1').get() as AMCLicenseRow | undefined;
    if (!row) return null;

    const now = new Date();
    const expiry = new Date(row.expiry_date + 'T23:59:59Z');
    const diffTime = expiry.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let calculatedStatus: AMCStatus = 'ACTIVE';
    let warningMessage: string | undefined;

    if (daysRemaining < -row.grace_period_days) {
      calculatedStatus = 'EXPIRED';
      warningMessage = 'AMC license has expired. Please contact Jewel Suite support to renew your contract. All existing data is safe and accessible.';
    } else if (daysRemaining < 0) {
      calculatedStatus = 'GRACE_PERIOD';
      const graceDaysLeft = row.grace_period_days + daysRemaining;
      warningMessage = `AMC is in grace period (${graceDaysLeft} day(s) remaining). Please renew your license soon.`;
    } else if (daysRemaining <= 30) {
      calculatedStatus = 'EXPIRING_SOON';
      warningMessage = `AMC license expires in ${daysRemaining} day(s). Renew today to continue receiving priority updates.`;
    }

    return {
      id: row.id,
      license_key: row.license_key,
      shop_id: row.shop_id,
      device_id: row.device_id,
      plan: row.plan,
      issued_date: row.issued_date,
      expiry_date: row.expiry_date,
      grace_period_days: row.grace_period_days,
      signature: row.signature,
      status: calculatedStatus,
      days_remaining: daysRemaining,
      last_verified_at: row.last_verified_at,
      is_valid: calculatedStatus === 'ACTIVE' || calculatedStatus === 'EXPIRING_SOON' || calculatedStatus === 'GRACE_PERIOD',
      warning_message: warningMessage,
    };
  }

  updateVerificationTimestamp(): void {
    const db = getDb();
    db.prepare("UPDATE amc_license SET last_verified_at = datetime('now') WHERE id = (SELECT id FROM amc_license ORDER BY created_at DESC LIMIT 1)").run();
  }
}

export const amcRepository = new AMCRepository();
