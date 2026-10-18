// backend/src/routes/reports.routes.ts
// Jewel Suite Part 10: Reports API Routes

import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const reportsRoutes = Router();

// Enforce authentication across all reporting endpoints
reportsRoutes.use(requireAuth);

// Sales Reports
reportsRoutes.get('/sales-summary', (req, res) => reportsController.getSalesSummary(req, res));
reportsRoutes.get('/sales-register', (req, res) => reportsController.getSalesRegister(req, res));
reportsRoutes.get('/customer-sales', (req, res) => reportsController.getCustomerSales(req, res));
reportsRoutes.get('/product-sales', (req, res) => reportsController.getProductSales(req, res));
reportsRoutes.get('/metal-sales', (req, res) => reportsController.getMetalSales(req, res));

// Purchase Reports
reportsRoutes.get('/purchase-summary', (req, res) => reportsController.getPurchaseSummary(req, res));
reportsRoutes.get('/purchase-register', (req, res) => reportsController.getPurchaseRegister(req, res));
reportsRoutes.get('/supplier-purchases', (req, res) => reportsController.getSupplierPurchases(req, res));

// Inventory Reports
reportsRoutes.get('/current-stock', (req, res) => reportsController.getCurrentStock(req, res));
reportsRoutes.get('/stock-valuation', (req, res) => reportsController.getStockValuation(req, res));
reportsRoutes.get('/stock-movements', (req, res) => reportsController.getStockMovements(req, res));

// Finance Reports
reportsRoutes.get('/receivables', (req, res) => reportsController.getReceivables(req, res));
reportsRoutes.get('/payables', (req, res) => reportsController.getPayables(req, res));
reportsRoutes.get('/cash-book', (req, res) => reportsController.getCashBook(req, res));
reportsRoutes.get('/payments', (req, res) => reportsController.getPaymentCollections(req, res));
reportsRoutes.get('/ledger', (req, res) => reportsController.getLedger(req, res));

// Workshop & Repairs
reportsRoutes.get('/karigar-jobs', (req, res) => reportsController.getKarigarJobs(req, res));
reportsRoutes.get('/karigar-labour', (req, res) => reportsController.getKarigarLabour(req, res));
reportsRoutes.get('/repairs', (req, res) => reportsController.getRepairs(req, res));

// Girvi Loans
reportsRoutes.get('/girvi-loans', (req, res) => reportsController.getGirviLoans(req, res));

// Saving Schemes
reportsRoutes.get('/saving-schemes', (req, res) => reportsController.getSavingSchemes(req, res));
reportsRoutes.get('/saving-installments', (req, res) => reportsController.getSavingInstallments(req, res));

// GST Reports
reportsRoutes.get('/gst-sales', (req, res) => reportsController.getGstSales(req, res));
reportsRoutes.get('/gst-purchases', (req, res) => reportsController.getGstPurchases(req, res));
reportsRoutes.get('/hsn-summary', (req, res) => reportsController.getHsnSummary(req, res));
reportsRoutes.get('/gst-invoice-register', (req, res) => reportsController.getGstInvoiceRegister(req, res));

// Header & Dashboard
reportsRoutes.get('/shop-header', (req, res) => reportsController.getShopHeader(req, res));
reportsRoutes.get('/dashboard-metrics', (req, res) => reportsController.getDashboardMetrics(req, res));

// CSV Export
reportsRoutes.get('/export/:reportType', (req, res) => reportsController.exportCsv(req, res));
