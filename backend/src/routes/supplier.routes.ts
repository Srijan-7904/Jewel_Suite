import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller.js';
import { purchaseController } from '../controllers/purchase.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();

supplierRoutes.use(requireAuth);

supplierRoutes.get('/', (req, res, next) => supplierController.list(req, res, next));
supplierRoutes.get('/:id', (req, res, next) => supplierController.getById(req, res, next));
supplierRoutes.get('/:supplierId/purchases', (req, res, next) => purchaseController.getPurchasesBySupplier(req, res, next));
supplierRoutes.post('/', (req, res, next) => supplierController.create(req, res, next));
supplierRoutes.put('/:id', (req, res, next) => supplierController.update(req, res, next));
supplierRoutes.patch('/:id/status', (req, res, next) => supplierController.toggleActive(req, res, next));
