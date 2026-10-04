import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service.js';
import { sendSuccess } from '../utils/response.js';

export class ProductController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const category_id = req.query.category_id as string | undefined;
      const metal = req.query.metal as string | undefined;
      const purity = req.query.purity as string | undefined;
      const status = req.query.status as any;

      const result = productService.list({ page, pageSize, search, category_id, metal, purity, status });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = productService.getById(req.params.id as string);
      sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = productService.create(req.body, req.user?.id);
      sendSuccess(res, product, 'Product definition created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = productService.update(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, product, 'Product definition updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.body.is_active === 1 || req.body.is_active === true;
      const product = productService.toggleActive(req.params.id as string, isActive, req.user?.id);
      sendSuccess(res, product, `Product ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }
}

export const productController = new ProductController();
