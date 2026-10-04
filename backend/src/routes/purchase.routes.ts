import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const purchaseRoutes = Router();

// Protect all purchase routes with authentication
purchaseRoutes.use(requireAuth);

purchaseRoutes.get('/', (req, res, next) => purchaseController.list(req, res, next));
purchaseRoutes.get('/:id', (req, res, next) => purchaseController.getById(req, res, next));
purchaseRoutes.post('/', (req, res, next) => purchaseController.create(req, res, next));
purchaseRoutes.put('/:id', (req, res, next) => purchaseController.update(req, res, next));

purchaseRoutes.post('/:id/items', (req, res, next) => purchaseController.addItem(req, res, next));
purchaseRoutes.delete('/:id/items/:itemId', (req, res, next) => purchaseController.removeItem(req, res, next));

purchaseRoutes.post('/:id/payments', (req, res, next) => purchaseController.addPayment(req, res, next));

purchaseRoutes.post('/:id/finalize', (req, res, next) => purchaseController.finalize(req, res, next));
purchaseRoutes.post('/:id/cancel', (req, res, next) => purchaseController.cancel(req, res, next));
