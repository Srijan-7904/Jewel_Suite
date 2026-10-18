// backend/src/routes/girvi.routes.ts
// Jewel Suite: Girvi / Pledged Jewellery Loans REST Routes

import { Router } from 'express';
import { girviController } from '../controllers/girvi.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const girviRoutes = Router();

// All Girvi operations require active authentication
girviRoutes.use(requireAuth);

girviRoutes.get('/metrics', girviController.getMetrics);
girviRoutes.get('/loans', girviController.listLoans);
girviRoutes.get('/loans/:id', girviController.getLoan);
girviRoutes.post('/loans', girviController.createLoan);
girviRoutes.post('/loans/:id/disburse', girviController.disburseLoan);
girviRoutes.post('/loans/:id/payments', girviController.recordRepayment);
girviRoutes.post('/loans/:id/close', girviController.closeLoan);
girviRoutes.post('/loans/:id/release', girviController.releasePledge);
