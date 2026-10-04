import { Router } from 'express';
import { customerController } from '../controllers/customer.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const customerRoutes = Router();

customerRoutes.use(requireAuth);

customerRoutes.get('/', (req, res, next) => customerController.list(req, res, next));
customerRoutes.get('/:id', (req, res, next) => customerController.getById(req, res, next));
customerRoutes.post('/', (req, res, next) => customerController.create(req, res, next));
customerRoutes.put('/:id', (req, res, next) => customerController.update(req, res, next));
customerRoutes.patch('/:id/status', (req, res, next) => customerController.toggleActive(req, res, next));
