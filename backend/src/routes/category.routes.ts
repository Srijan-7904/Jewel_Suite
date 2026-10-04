import { Router } from 'express';
import { categoryController } from '../controllers/category.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const categoryRoutes = Router();

categoryRoutes.use(requireAuth);

categoryRoutes.get('/', (req, res, next) => categoryController.list(req, res, next));
categoryRoutes.get('/all', (req, res, next) => categoryController.getAll(req, res, next));
categoryRoutes.get('/:id', (req, res, next) => categoryController.getById(req, res, next));
categoryRoutes.post('/', (req, res, next) => categoryController.create(req, res, next));
categoryRoutes.put('/:id', (req, res, next) => categoryController.update(req, res, next));
categoryRoutes.patch('/:id/status', (req, res, next) => categoryController.toggleActive(req, res, next));
