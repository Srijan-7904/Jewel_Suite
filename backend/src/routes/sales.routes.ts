import { Router } from 'express';
import { salesController } from '../controllers/sales.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const salesRoutes = Router();

// Protect all sales routes
salesRoutes.use(requireAuth);

salesRoutes.get('/invoices', salesController.list);
salesRoutes.post('/invoices', salesController.createDraft);

salesRoutes.get('/invoices/:id', salesController.getDetails);
salesRoutes.put('/invoices/:id', salesController.updateDraft);

salesRoutes.post('/invoices/:id/finalize', salesController.finalize);
salesRoutes.post('/invoices/:id/cancel', salesController.cancel);
