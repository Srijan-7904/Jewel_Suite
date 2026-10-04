import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const productRoutes = Router();

productRoutes.use(requireAuth);

productRoutes.get('/', (req, res, next) => productController.list(req, res, next));
productRoutes.get('/:id', (req, res, next) => productController.getById(req, res, next));
productRoutes.post('/', (req, res, next) => productController.create(req, res, next));
productRoutes.put('/:id', (req, res, next) => productController.update(req, res, next));
productRoutes.patch('/:id/status', (req, res, next) => productController.toggleActive(req, res, next));
