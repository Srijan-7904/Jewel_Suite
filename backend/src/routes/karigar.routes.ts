import { Router } from 'express';
import { karigarController } from '../controllers/karigar.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const karigarRoutes = Router();

karigarRoutes.use(requireAuth);

karigarRoutes.get('/', (req, res, next) => karigarController.list(req, res, next));
karigarRoutes.get('/:id', (req, res, next) => karigarController.getById(req, res, next));
karigarRoutes.post('/', (req, res, next) => karigarController.create(req, res, next));
karigarRoutes.put('/:id', (req, res, next) => karigarController.update(req, res, next));
karigarRoutes.patch('/:id/status', (req, res, next) => karigarController.toggleActive(req, res, next));
