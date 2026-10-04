import { Router } from 'express';
import { rateController } from '../controllers/rate.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

export const rateRoutes = Router();

// Rate querying can be accessed by any authenticated terminal session (and dashboard)
rateRoutes.get('/metals', requireAuth, (req, res, next) => rateController.getMetals(req, res, next));
rateRoutes.get('/metals/:id/purities', requireAuth, (req, res, next) => rateController.getPuritiesByMetal(req, res, next));
rateRoutes.get('/purities', requireAuth, (req, res, next) => rateController.getAllPurities(req, res, next));
rateRoutes.get('/current', requireAuth, (req, res, next) => rateController.getCurrentRates(req, res, next));
rateRoutes.get('/history', requireAuth, (req, res, next) => rateController.getRateHistory(req, res, next));

// Only Admin can add or modify metal rates
rateRoutes.post('/', requireAuth, requireRole('Admin'), (req, res, next) => rateController.createRate(req, res, next));
