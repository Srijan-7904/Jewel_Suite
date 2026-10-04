import { Request, Response, NextFunction } from 'express';
import { rateService } from '../services/rate.service.js';
import { sendSuccess } from '../utils/response.js';

export class RateController {
  async getMetals(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metals = rateService.getMetals();
      sendSuccess(res, metals);
    } catch (err) {
      next(err);
    }
  }

  async getPuritiesByMetal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const purities = rateService.getPuritiesByMetal(req.params.id as string);
      sendSuccess(res, purities);
    } catch (err) {
      next(err);
    }
  }

  async getAllPurities(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const purities = rateService.getAllPurities();
      sendSuccess(res, purities);
    } catch (err) {
      next(err);
    }
  }

  async getCurrentRates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rates = rateService.getCurrentRates();
      sendSuccess(res, rates);
    } catch (err) {
      next(err);
    }
  }

  async getRateHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const purityId = req.query.purity_id as string | undefined;
      const metalId = req.query.metal_id as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const history = rateService.getRateHistory(purityId, metalId, limit);
      sendSuccess(res, history);
    } catch (err) {
      next(err);
    }
  }

  async createRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rateRecord = rateService.createRate(req.body, req.user?.id);
      sendSuccess(res, rateRecord, 'Metal rate recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }
}

export const rateController = new RateController();
