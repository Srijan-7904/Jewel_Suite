import { Request, Response, NextFunction } from 'express';
import { purchaseService } from '../services/purchase.service.js';
import { sendSuccess } from '../utils/response.js';

export class PurchaseController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const supplier_id = req.query.supplier_id as string | undefined;
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = purchaseService.list({
        page,
        pageSize,
        search,
        supplier_id,
        status,
        startDate,
        endDate,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.getById(req.params.id as string);
      sendSuccess(res, bill);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.createDraft(req.body, req.user?.id);
      sendSuccess(res, bill, 'Purchase bill draft created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.updateDraft(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, bill, 'Purchase bill updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.addItem(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, bill, 'Purchase item added successfully');
    } catch (err) {
      next(err);
    }
  }

  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.removeItem(
        req.params.id as string,
        req.params.itemId as string,
        req.user?.id
      );
      sendSuccess(res, bill, 'Purchase item removed successfully');
    } catch (err) {
      next(err);
    }
  }

  async addPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.addPayment(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, bill, 'Payment added to purchase bill successfully');
    } catch (err) {
      next(err);
    }
  }

  async finalize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.finalizePurchase(req.params.id as string, req.user?.id);
      sendSuccess(res, bill, 'Purchase bill finalized and stock items inwarded successfully');
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bill = purchaseService.cancelPurchase(req.params.id as string, req.user?.id);
      sendSuccess(res, bill, 'Purchase bill cancelled successfully');
    } catch (err) {
      next(err);
    }
  }

  async getPurchasesBySupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = purchaseService.getPurchasesBySupplier(req.params.supplierId as string);
      sendSuccess(res, list);
    } catch (err) {
      next(err);
    }
  }
}

export const purchaseController = new PurchaseController();
