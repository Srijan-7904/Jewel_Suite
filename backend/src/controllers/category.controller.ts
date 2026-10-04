import { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service.js';
import { sendSuccess } from '../utils/response.js';

export class CategoryController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;
      const search = req.query.search as string | undefined;
      const status = req.query.status as any;

      const result = categoryService.list({ page, pageSize, search, status });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query.all !== 'true';
      const categories = categoryService.getAll(activeOnly);
      sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = categoryService.getById(req.params.id as string);
      sendSuccess(res, category);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = categoryService.create(req.body, req.user?.id);
      sendSuccess(res, category, 'Category created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = categoryService.update(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, category, 'Category updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.body.is_active === 1 || req.body.is_active === true;
      const category = categoryService.toggleActive(req.params.id as string, isActive, req.user?.id);
      sendSuccess(res, category, `Category ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }
}

export const categoryController = new CategoryController();
