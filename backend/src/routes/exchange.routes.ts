import { Router } from 'express';
import { exchangeController } from '../controllers/exchange.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const exchangeRoutes = Router();

// Protect all exchange routes
exchangeRoutes.use(requireAuth);

exchangeRoutes.get('/', exchangeController.list);
exchangeRoutes.post('/', exchangeController.createDraft);

exchangeRoutes.get('/:id', exchangeController.getDetails);
exchangeRoutes.put('/:id', exchangeController.updateDraft);

exchangeRoutes.get('/:id/items', exchangeController.getItems);
exchangeRoutes.post('/:id/items', exchangeController.addItem);
exchangeRoutes.delete('/:id/items/:itemId', exchangeController.removeItem);

exchangeRoutes.post('/:id/finalize', exchangeController.finalize);
exchangeRoutes.post('/:id/cancel', exchangeController.cancel);
