import { Request, Response, NextFunction } from 'express';
import { karigarService } from '../services/karigar.service.js';
import { sendSuccess } from '../utils/response.js';

export class KarigarController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const specialization = req.query.specialization as string | undefined;
      const status = req.query.status as any;

      const result = karigarService.list({ page, pageSize, search, specialization, status });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const karigar = karigarService.getById(req.params.id as string);
      sendSuccess(res, karigar);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const karigar = karigarService.create(req.body, req.user?.id);
      sendSuccess(res, karigar, 'Karigar registered successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const karigar = karigarService.update(req.params.id as string, req.body, req.user?.id);
      sendSuccess(res, karigar, 'Karigar profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.body.is_active === 1 || req.body.is_active === true;
      const karigar = karigarService.toggleActive(req.params.id as string, isActive, req.user?.id);
      sendSuccess(res, karigar, `Karigar ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }
}

export const karigarController = new KarigarController();
