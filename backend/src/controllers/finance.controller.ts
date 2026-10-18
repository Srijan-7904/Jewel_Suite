// backend/src/controllers/finance.controller.ts
// Jewel Suite: Finance, Cr/Dr Ledger & Payments Controller

import { Request, Response, NextFunction } from 'express';
import { financeService } from '../services/finance.service.js';
import { sendSuccess } from '../utils/response.js';
import { PartyType } from '../domain/finance.js';

export class FinanceController {
  /**
   * GET /api/finance/ledger
   * Lists ledger entries with pagination, date, party, and search filters
   */
  async getLedgerEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const party_type = req.query.party_type as string | undefined;
      const party_id = req.query.party_id as string | undefined;
      const entry_type = req.query.entry_type as string | undefined;
      const debit_credit = req.query.debit_credit as string | undefined;
      const payment_method = req.query.payment_method as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const search = req.query.search as string | undefined;

      const result = financeService.getLedgerEntries({
        page,
        pageSize,
        party_type,
        party_id,
        entry_type,
        debit_credit,
        payment_method,
        from_date,
        to_date,
        search,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/ledger/customer/:id
   */
  async getCustomerLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.id as string;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;

      const statement = financeService.getPartyStatement(PartyType.CUSTOMER, customerId, from_date, to_date);
      const entries = financeService.getLedgerEntries({
        party_type: PartyType.CUSTOMER,
        party_id: customerId,
        from_date,
        to_date,
        page,
        pageSize,
      });

      sendSuccess(res, {
        statement,
        ...entries,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/ledger/supplier/:id
   */
  async getSupplierLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplierId = req.params.id as string;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;

      const statement = financeService.getPartyStatement(PartyType.SUPPLIER, supplierId, from_date, to_date);
      const entries = financeService.getLedgerEntries({
        party_type: PartyType.SUPPLIER,
        party_id: supplierId,
        from_date,
        to_date,
        page,
        pageSize,
      });

      sendSuccess(res, {
        statement,
        ...entries,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/ledger/karigar/:id
   */
  async getKarigarLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const karigarId = req.params.id as string;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;

      const statement = financeService.getPartyStatement(PartyType.KARIGAR, karigarId, from_date, to_date);
      const entries = financeService.getLedgerEntries({
        party_type: PartyType.KARIGAR,
        party_id: karigarId,
        from_date,
        to_date,
        page,
        pageSize,
      });

      sendSuccess(res, {
        statement,
        ...entries,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/payments
   */
  async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const party_type = req.query.party_type as string | undefined;
      const party_id = req.query.party_id as string | undefined;
      const payment_type = req.query.payment_type as string | undefined;
      const payment_mode = req.query.payment_mode as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const search = req.query.search as string | undefined;

      const result = financeService.getPayments({
        page,
        pageSize,
        party_type,
        party_id,
        payment_type,
        payment_mode,
        from_date,
        to_date,
        search,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/payments/:id
   */
  async getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = financeService.getPaymentById(req.params.id as string);
      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/payments
   */
  async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const result = financeService.recordPayment(req.body, userId);
      sendSuccess(res, result, 'Payment recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/finance/adjustments
   */
  async createAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const result = financeService.recordAdjustment(req.body, userId);
      sendSuccess(res, result, 'Ledger adjustment created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/cash-book
   */
  async getCashBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const search = req.query.search as string | undefined;

      const result = financeService.getCashBook({
        page,
        pageSize,
        from_date,
        to_date,
        search,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/finance/summary
   */
  async getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = financeService.getFinanceSummary();
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  }
}

export const financeController = new FinanceController();
