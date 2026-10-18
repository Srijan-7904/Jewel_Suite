// backend/src/routes/settings.routes.ts
import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

export const settingsRoutes = Router();

// All settings routes require authentication
settingsRoutes.use(requireAuth);

// Shop Profile
settingsRoutes.get('/shop', (req, res, next) => settingsController.getShopProfile(req, res, next));
settingsRoutes.put('/shop', requireRole('ADMIN'), (req, res, next) => settingsController.updateShopProfile(req, res, next));

// Shop Logo
settingsRoutes.post('/shop/logo', requireRole('ADMIN'), (req, res, next) => settingsController.uploadLogo(req, res, next));
settingsRoutes.get('/shop/logo', (req, res, next) => settingsController.getLogo(req, res, next));

// General Settings
settingsRoutes.get('/general', (req, res, next) => settingsController.getGeneralSettings(req, res, next));
settingsRoutes.put('/general', requireRole('ADMIN'), (req, res, next) => settingsController.updateGeneralSettings(req, res, next));

// Financial Year
settingsRoutes.get('/financial-year', (req, res, next) => settingsController.getFinancialYear(req, res, next));
settingsRoutes.put('/financial-year', requireRole('ADMIN'), (req, res, next) => settingsController.updateFinancialYear(req, res, next));

// Billing & Sequences
settingsRoutes.get('/billing', (req, res, next) => settingsController.getBillingSettings(req, res, next));
settingsRoutes.put('/billing', requireRole('ADMIN'), (req, res, next) => settingsController.updateBillingSettings(req, res, next));

// GST Settings
settingsRoutes.get('/gst', (req, res, next) => settingsController.getGSTSettings(req, res, next));
settingsRoutes.put('/gst', requireRole('ADMIN'), (req, res, next) => settingsController.updateGSTSettings(req, res, next));

// Payment Modes
settingsRoutes.get('/payment-modes', (req, res, next) => settingsController.getPaymentModes(req, res, next));
settingsRoutes.put('/payment-modes/:code/toggle', requireRole('ADMIN'), (req, res, next) => settingsController.togglePaymentMode(req, res, next));

// Printing Settings
settingsRoutes.get('/printing', (req, res, next) => settingsController.getPrintSettings(req, res, next));
settingsRoutes.put('/printing', requireRole('ADMIN'), (req, res, next) => settingsController.updatePrintSettings(req, res, next));

// AMC & License Status
settingsRoutes.get('/amc', (req, res, next) => settingsController.getAMCStatus(req, res, next));

// Database Info
settingsRoutes.get('/database', requireRole('ADMIN'), (req, res, next) => settingsController.getDatabaseInfo(req, res, next));

// About Application Info
settingsRoutes.get('/about', (req, res, next) => settingsController.getAboutInfo(req, res, next));
