import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/supplier.service.js';
import { sendSuccess } from '../utils/response.js';

export class SupplierController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const status = req.query.status as any;

      const result = supplierService.list({ page, pageSize, search, status });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = supplierService.getById(req.params.id as string);
      sendSuccess(res, supplier);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = supplierService.create(req.body, req.user?.id);
      sendSuccess(res, supplier, 'Supplier created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supplier = supplierService.update(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, supplier, 'Supplier updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.body.is_active === 1 || req.body.is_active === true;
      const supplier = supplierService.toggleActive(req.params.id as string, isActive, req.user?.id);
      sendSuccess(res, supplier, `Supplier ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }
}

export const supplierController = new SupplierController();
