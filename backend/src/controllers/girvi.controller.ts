// backend/src/controllers/girvi.controller.ts
// Jewel Suite: Girvi / Pledged Jewellery Loans REST Controller

import { Request, Response, NextFunction } from 'express';
import { girviService } from '../services/girvi.service.js';

export class GirviController {
  createLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = girviService.createLoan(req.body, req.user?.id);
      res.status(201).json({
        success: true,
        message: 'Girvi loan created successfully',
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  };

  disburseLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = girviService.disburseLoan(req.params.id, req.body, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Girvi loan disbursed successfully',
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  };

  recordRepayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = girviService.recordRepayment(req.params.id, req.body, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Loan repayment recorded successfully',
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  };

  closeLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = girviService.closeLoan(req.params.id, req.body.notes, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Girvi loan closed successfully',
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  };

  releasePledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = girviService.releasePledge(req.params.id, req.body.notes, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Pledged jewellery items released successfully',
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  };

  getLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = girviService.getLoan(req.params.id);
      res.status(200).json({
        success: true,
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  };

  listLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const customer_id = req.query.customer_id as string | undefined;
      const status = req.query.status as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const search = req.query.search as string | undefined;

      const result = girviService.listLoans({
        page,
        pageSize,
        customer_id,
        status,
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
  };

  getMetrics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = girviService.getMetrics();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (err) {
      next(err);
    }
  };

  getCustomerLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loans = girviService.getCustomerLoans(req.params.id);
      res.status(200).json({
        success: true,
        data: loans,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const girviController = new GirviController();
