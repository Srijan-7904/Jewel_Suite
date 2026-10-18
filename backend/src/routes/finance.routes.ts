// backend/src/routes/finance.routes.ts
// Jewel Suite: Finance, Cr/Dr Ledger & Payment Routes

import { Router } from 'express';
import { financeController } from '../controllers/finance.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const financeRoutes = Router();

financeRoutes.use(requireAuth);

// Finance Overview & Metrics
financeRoutes.get('/summary', financeController.getSummary);

// Cash Book
financeRoutes.get('/cash-book', financeController.getCashBook);

// General & Party Ledgers
financeRoutes.get('/ledger', financeController.getLedgerEntries);
financeRoutes.get('/ledger/customer/:id', financeController.getCustomerLedger);
financeRoutes.get('/ledger/supplier/:id', financeController.getSupplierLedger);
financeRoutes.get('/ledger/karigar/:id', financeController.getKarigarLedger);

// Payments & Receipts
financeRoutes.get('/payments', financeController.getPayments);
financeRoutes.get('/payments/:id', financeController.getPaymentById);
financeRoutes.post('/payments', financeController.createPayment);

// Controlled Adjustments
financeRoutes.post('/adjustments', financeController.createAdjustment);
