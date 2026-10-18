// backend/src/controllers/reports.controller.ts
// Jewel Suite Part 10: Reports HTTP Controller

import { Request, Response } from 'express';
import { reportsService } from '../services/reports.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class ReportsController {
  // Sales
  async getSalesSummary(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, customerId, status, metalId, purityId, paymentStatus } = req.query;
      const data = reportsService.getSalesSummary({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        customerId: customerId as string,
        status: status as string,
        metalId: metalId as string,
        purityId: purityId as string,
        paymentStatus: paymentStatus as string,
      });
      return sendSuccess(res, data, 'Sales summary retrieved');
    } catch (err: any) {
      return sendError(res, 'SALES_SUMMARY_ERROR', err.message);
    }
  }

  async getSalesRegister(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, customerId, status, search, page, pageSize } = req.query;
      const data = reportsService.getSalesRegister({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        customerId: customerId as string,
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Sales register retrieved');
    } catch (err: any) {
      return sendError(res, 'SALES_REGISTER_ERROR', err.message);
    }
  }

  async getCustomerSales(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, search, page, pageSize } = req.query;
      const data = reportsService.getCustomerSalesReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Customer sales report retrieved');
    } catch (err: any) {
      return sendError(res, 'CUSTOMER_SALES_ERROR', err.message);
    }
  }

  async getProductSales(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, search, page, pageSize } = req.query;
      const data = reportsService.getProductSalesReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Product sales report retrieved');
    } catch (err: any) {
      return sendError(res, 'PRODUCT_SALES_ERROR', err.message);
    }
  }

  async getMetalSales(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate } = req.query;
      const data = reportsService.getMetalSalesReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, data, 'Metal sales report retrieved');
    } catch (err: any) {
      return sendError(res, 'METAL_SALES_ERROR', err.message);
    }
  }

  // Purchases
  async getPurchaseSummary(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, supplierId, status } = req.query;
      const data = reportsService.getPurchaseSummary({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        supplierId: supplierId as string,
        status: status as string,
      });
      return sendSuccess(res, data, 'Purchase summary retrieved');
    } catch (err: any) {
      return sendError(res, 'PURCHASE_SUMMARY_ERROR', err.message);
    }
  }

  async getPurchaseRegister(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, supplierId, status, search, page, pageSize } = req.query;
      const data = reportsService.getPurchaseRegister({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        supplierId: supplierId as string,
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Purchase register retrieved');
    } catch (err: any) {
      return sendError(res, 'PURCHASE_REGISTER_ERROR', err.message);
    }
  }

  async getSupplierPurchases(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, search, page, pageSize } = req.query;
      const data = reportsService.getSupplierPurchaseReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Supplier purchases report retrieved');
    } catch (err: any) {
      return sendError(res, 'SUPPLIER_PURCHASE_ERROR', err.message);
    }
  }

  // Inventory
  async getCurrentStock(req: Request, res: Response): Promise<Response> {
    try {
      const { metalId, purityId, categoryId, status, search, page, pageSize } = req.query;
      const data = reportsService.getCurrentStockReport({
        metalId: metalId as string,
        purityId: purityId as string,
        categoryId: categoryId as string,
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Current stock report retrieved');
    } catch (err: any) {
      return sendError(res, 'CURRENT_STOCK_ERROR', err.message);
    }
  }

  async getStockValuation(_req: Request, res: Response): Promise<Response> {
    try {
      const data = reportsService.getStockValuationReport();
      return sendSuccess(res, data, 'Stock valuation report retrieved');
    } catch (err: any) {
      return sendError(res, 'STOCK_VALUATION_ERROR', err.message);
    }
  }

  async getStockMovements(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, movementType, tagNo, page, pageSize } = req.query;
      const data = reportsService.getStockMovementReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        movementType: movementType as string,
        tagNo: tagNo as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Stock movements report retrieved');
    } catch (err: any) {
      return sendError(res, 'STOCK_MOVEMENTS_ERROR', err.message);
    }
  }

  // Finance
  async getReceivables(req: Request, res: Response): Promise<Response> {
    try {
      const { search, page, pageSize } = req.query;
      const data = reportsService.getReceivablesReport({
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Receivables report retrieved');
    } catch (err: any) {
      return sendError(res, 'RECEIVABLES_ERROR', err.message);
    }
  }

  async getPayables(req: Request, res: Response): Promise<Response> {
    try {
      const { search, page, pageSize } = req.query;
      const data = reportsService.getPayablesReport({
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Payables report retrieved');
    } catch (err: any) {
      return sendError(res, 'PAYABLES_ERROR', err.message);
    }
  }

  async getCashBook(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate } = req.query;
      const data = reportsService.getCashBookReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, data, 'Cash book report retrieved');
    } catch (err: any) {
      return sendError(res, 'CASH_BOOK_ERROR', err.message);
    }
  }

  async getPaymentCollections(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, paymentMode, partyType, page, pageSize } = req.query;
      const data = reportsService.getPaymentCollectionReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        paymentMode: paymentMode as string,
        partyType: partyType as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Payment collections report retrieved');
    } catch (err: any) {
      return sendError(res, 'PAYMENT_COLLECTIONS_ERROR', err.message);
    }
  }

  async getLedger(req: Request, res: Response): Promise<Response> {
    try {
      const { partyType, partyId, preset, fromDate, toDate, page, pageSize } = req.query;
      if (!partyType || !partyId) {
        return sendError(res, 'MISSING_PARAMS', 'partyType and partyId are required for ledger report', 400);
      }
      const data = reportsService.getLedgerReport(partyType as string, partyId as string, {
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Ledger report retrieved');
    } catch (err: any) {
      return sendError(res, 'LEDGER_REPORT_ERROR', err.message);
    }
  }

  // Workshop
  async getKarigarJobs(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, karigarId, status, search, page, pageSize } = req.query;
      const data = reportsService.getKarigarJobReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        karigarId: karigarId as string,
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Karigar jobs report retrieved');
    } catch (err: any) {
      return sendError(res, 'KARIGAR_JOBS_ERROR', err.message);
    }
  }

  async getKarigarLabour(req: Request, res: Response): Promise<Response> {
    try {
      const { search } = req.query;
      const data = reportsService.getKarigarLabourReport({ search: search as string });
      return sendSuccess(res, data, 'Karigar labour report retrieved');
    } catch (err: any) {
      return sendError(res, 'KARIGAR_LABOUR_ERROR', err.message);
    }
  }

  async getRepairs(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, status, ownership, search, page, pageSize } = req.query;
      const data = reportsService.getRepairReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        status: status as string,
        ownership: ownership as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Repair register retrieved');
    } catch (err: any) {
      return sendError(res, 'REPAIR_REGISTER_ERROR', err.message);
    }
  }

  // Girvi
  async getGirviLoans(req: Request, res: Response): Promise<Response> {
    try {
      const { overdueOnly, status, search, page, pageSize } = req.query;
      const data = reportsService.getGirviLoansReport({
        overdueOnly: overdueOnly === 'true',
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Girvi loans report retrieved');
    } catch (err: any) {
      return sendError(res, 'GIRVI_LOANS_ERROR', err.message);
    }
  }

  // Saving Schemes
  async getSavingSchemes(req: Request, res: Response): Promise<Response> {
    try {
      const { status, search, page, pageSize } = req.query;
      const data = reportsService.getSavingSchemeRegister({
        status: status as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Saving schemes register retrieved');
    } catch (err: any) {
      return sendError(res, 'SAVING_SCHEMES_ERROR', err.message);
    }
  }

  async getSavingInstallments(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, status, page, pageSize } = req.query;
      const data = reportsService.getSchemeInstallmentCollectionReport({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        status: status as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'Installment collection report retrieved');
    } catch (err: any) {
      return sendError(res, 'SAVING_INSTALLMENTS_ERROR', err.message);
    }
  }

  // GST Reports
  async getGstSales(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate } = req.query;
      const data = reportsService.getGstSalesSummary({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, data, 'GST sales summary retrieved');
    } catch (err: any) {
      return sendError(res, 'GST_SALES_ERROR', err.message);
    }
  }

  async getGstPurchases(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate } = req.query;
      const data = reportsService.getGstPurchaseSummary({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, data, 'GST purchase summary retrieved');
    } catch (err: any) {
      return sendError(res, 'GST_PURCHASE_ERROR', err.message);
    }
  }

  async getHsnSummary(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate } = req.query;
      const data = reportsService.getHsnSummary({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, data, 'HSN summary retrieved');
    } catch (err: any) {
      return sendError(res, 'HSN_SUMMARY_ERROR', err.message);
    }
  }

  async getGstInvoiceRegister(req: Request, res: Response): Promise<Response> {
    try {
      const { preset, fromDate, toDate, search, page, pageSize } = req.query;
      const data = reportsService.getGstInvoiceRegister({
        preset: preset as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
      return sendSuccess(res, data, 'GST invoice register retrieved');
    } catch (err: any) {
      return sendError(res, 'GST_INVOICE_REGISTER_ERROR', err.message);
    }
  }

  // Shop Header for Print Layouts
  async getShopHeader(req: Request, res: Response): Promise<Response> {
    try {
      const { reportName, fromDate, toDate } = req.query;
      const header = reportsService.getShopReportHeader(
        (reportName as string) || 'Report',
        fromDate as string,
        toDate as string
      );
      return sendSuccess(res, header, 'Shop header retrieved');
    } catch (err: any) {
      return sendError(res, 'SHOP_HEADER_ERROR', err.message);
    }
  }

  // Dashboard Metrics
  async getDashboardMetrics(_req: Request, res: Response): Promise<Response> {
    try {
      const data = reportsService.getDashboardMetrics();
      return sendSuccess(res, data, 'Dashboard metrics retrieved');
    } catch (err: any) {
      return sendError(res, 'DASHBOARD_METRICS_ERROR', err.message);
    }
  }

  // CSV Export
  async exportCsv(req: Request, res: Response): Promise<void> {
    try {
      const { reportType } = req.params;
      const filter = req.query;
      const { filename, content } = reportsService.exportReportCsv(reportType, filter);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(content);
    } catch (err: any) {
      sendError(res, 'CSV_EXPORT_ERROR', err.message);
    }
  }
}

export const reportsController = new ReportsController();
