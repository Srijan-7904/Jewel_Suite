// backend/src/controllers/settings.controller.ts
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { settingsService } from '../services/settings.service.js';
import { amcService } from '../services/amc.service.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export class SettingsController {
  // Shop Profile
  async getShopProfile(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = settingsService.getShopProfile();
      sendSuccess(res, profile, 'Shop profile retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateShopProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateShopProfile(req.body, userId);
      sendSuccess(res, updated, 'Shop profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Shop Logo
  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data || !mimeType) {
        throw new BadRequestError('Base64 image data and mimeType are required', 'MISSING_DATA');
      }
      const userId = req.user?.id;
      const result = settingsService.saveShopLogo(base64Data, mimeType, userId);
      sendSuccess(res, result, 'Shop logo uploaded successfully');
    } catch (err) {
      next(err);
    }
  }

  async getLogo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logoPath = settingsService.getShopLogoPath();
      if (!logoPath || !fs.existsSync(logoPath)) {
        throw new NotFoundError('Shop logo not found');
      }
      res.sendFile(logoPath);
    } catch (err) {
      next(err);
    }
  }

  // General Settings
  async getGeneralSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = settingsService.getGeneralSettings();
      sendSuccess(res, settings, 'General settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateGeneralSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateGeneralSettings(req.body, userId);
      sendSuccess(res, updated, 'General settings updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Financial Year Settings
  async getFinancialYear(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fy = settingsService.getFinancialYearSettings();
      sendSuccess(res, fy, 'Financial year settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateFinancialYear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateFinancialYearSettings(req.body, userId);
      sendSuccess(res, updated, 'Financial year updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Billing Settings
  async getBillingSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const billing = settingsService.getBillingSettings();
      sendSuccess(res, billing, 'Billing settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateBillingSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateBillingSettings(req.body, userId);
      sendSuccess(res, updated, 'Billing settings updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // GST Settings
  async getGSTSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const gst = settingsService.getGSTSettings();
      sendSuccess(res, gst, 'GST settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateGSTSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateGSTSettings(req.body, userId);
      sendSuccess(res, updated, 'GST settings updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Payment Modes
  async getPaymentModes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const modes = settingsService.getPaymentModes(activeOnly);
      sendSuccess(res, modes, 'Payment modes retrieved');
    } catch (err) {
      next(err);
    }
  }

  async togglePaymentMode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { is_active } = req.body;
      if (typeof is_active !== 'boolean') {
        throw new BadRequestError("'is_active' boolean is required in request body", 'VALIDATION_ERROR');
      }
      const userId = req.user?.id;
      const updated = settingsService.togglePaymentMode(code, is_active, userId);
      sendSuccess(res, updated, `Payment mode '${code}' status updated`);
    } catch (err) {
      next(err);
    }
  }

  // Store Dealing Metals Configuration
  async getMetals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const metals = settingsService.getStoreMetals(activeOnly);
      sendSuccess(res, metals, 'Store metals retrieved');
    } catch (err) {
      next(err);
    }
  }

  async toggleMetal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { is_active } = req.body;
      if (typeof is_active !== 'boolean') {
        throw new BadRequestError("'is_active' boolean is required in request body", 'VALIDATION_ERROR');
      }
      const userId = req.user?.id;
      const updated = settingsService.toggleStoreMetal(code, is_active, userId);
      sendSuccess(res, updated, `Metal '${code}' status updated to ${is_active ? 'active' : 'inactive'}`);
    } catch (err) {
      next(err);
    }
  }

  async updateActiveMetals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enabled_metals } = req.body;
      const userId = req.user?.id;
      const updated = settingsService.updateActiveMetals(enabled_metals, userId);
      sendSuccess(res, updated, 'Active metals configuration updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Shop Receiving Accounts
  async getReceivingAccounts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = settingsService.getReceivingAccounts();
      sendSuccess(res, accounts, 'Shop receiving accounts retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateReceivingAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateReceivingAccounts(req.body, userId);
      sendSuccess(res, updated, 'Shop receiving accounts updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Print Settings
  async getPrintSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const print = settingsService.getPrintSettings();
      sendSuccess(res, print, 'Print settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updatePrintSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updatePrintSettings(req.body, userId);
      sendSuccess(res, updated, 'Print settings updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // Invoice Columns & Optional Fields Configuration
  async getInvoiceColumns(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const columns = settingsService.getInvoiceColumnSettings();
      sendSuccess(res, columns, 'Invoice column settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async updateInvoiceColumns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updated = settingsService.updateInvoiceColumnSettings(req.body, userId);
      sendSuccess(res, updated, 'Invoice column configuration updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // AMC & License Information
  async getAMCStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const license = amcService.getLicenseStatus();
      sendSuccess(res, license, 'AMC license status retrieved');
    } catch (err) {
      next(err);
    }
  }

  // Database Info
  async getDatabaseInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbInfo = settingsService.getDatabaseInfo();
      sendSuccess(res, dbInfo, 'Database information retrieved');
    } catch (err) {
      next(err);
    }
  }

  // About Software Information
  async getAboutInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const about = settingsService.getAboutInfo();
      sendSuccess(res, about, 'About software info retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
