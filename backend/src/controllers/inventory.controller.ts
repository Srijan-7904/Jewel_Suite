import { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services/inventory.service.js';
import { sendSuccess } from '../utils/response.js';

export class InventoryController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const product_id = req.query.product_id as string | undefined;
      const category_id = req.query.category_id as string | undefined;
      const metal_code = req.query.metal as string | undefined;
      const purity_code = req.query.purity as string | undefined;
      const status = req.query.status as string | undefined;

      const result = inventoryService.list({
        page,
        pageSize,
        search,
        product_id,
        category_id,
        metal_code,
        purity_code,
        status,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = inventoryService.getById(req.params.id as string);
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async getByTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = inventoryService.getByTag(req.params.tagNo as string);
      sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = inventoryService.createStockItem(req.body, req.user?.id);
      sendSuccess(res, item, 'Stock item created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = inventoryService.update(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, item, 'Stock item updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = inventoryService.changeStatus(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, item, `Stock item status updated to ${item.status}`);
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const movements = inventoryService.getMovements(req.params.id as string);
      sendSuccess(res, movements);
    } catch (err) {
      next(err);
    }
  }

  async listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const stock_item_id = req.query.stock_item_id as string | undefined;
      const movement_type = req.query.movement_type as string | undefined;

      const result = inventoryService.listMovements({
        page,
        pageSize,
        stock_item_id,
        movement_type,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getValuation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const valuation = inventoryService.getStockValuation();
      sendSuccess(res, valuation);
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
