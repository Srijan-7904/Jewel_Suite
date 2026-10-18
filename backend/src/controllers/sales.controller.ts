import { Request, Response, NextFunction } from 'express';
import { salesService } from '../services/sales.service.js';

export class SalesController {
  createDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = salesService.createDraft(req.body, userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Sales invoice draft created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = salesService.getInvoiceDetails(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const customer_id = req.query.customer_id as string | undefined;
      const status = req.query.status as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;

      const result = salesService.listInvoices({
        page,
        pageSize,
        search,
        customer_id,
        status,
        from_date,
        to_date,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = salesService.updateDraft(req.params.id, req.body, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Sales invoice updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  finalize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = salesService.finalizeSale(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Sales invoice finalized and exchange stock processed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = salesService.cancelDraft(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Sales invoice cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCustomerInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = salesService.getCustomerInvoices(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const salesController = new SalesController();
