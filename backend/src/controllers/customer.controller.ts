import { Request, Response, NextFunction } from 'express';
import { customerService } from '../services/customer.service.js';
import { sendSuccess } from '../utils/response.js';

export class CustomerController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const customer_type = req.query.customer_type as string | undefined;
      const status = req.query.status as any;

      const result = customerService.list({ page, pageSize, search, customer_type, status });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = customerService.getById(req.params.id as string);
      sendSuccess(res, customer);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = customerService.create(req.body, req.user?.id);
      sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = customerService.update(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, customer, 'Customer updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.body.is_active === 1 || req.body.is_active === true;
      const customer = customerService.toggleActive(req.params.id as string, isActive, req.user?.id);
      sendSuccess(res, customer, `Customer ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }
}

export const customerController = new CustomerController();
