import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const inventoryRoutes = Router();

// Protect all inventory routes with authenticated session
inventoryRoutes.use(requireAuth);

// Stock Valuation endpoint (placed before :id param)
inventoryRoutes.get('/valuation', (req, res, next) => inventoryController.getValuation(req, res, next));

// Movements history endpoint
inventoryRoutes.get('/movements', (req, res, next) => inventoryController.listMovements(req, res, next));

// Stock Items CRUD & Queries
inventoryRoutes.get('/stock', (req, res, next) => inventoryController.list(req, res, next));
inventoryRoutes.get('/stock/tag/:tagNo', (req, res, next) => inventoryController.getByTag(req, res, next));
inventoryRoutes.get('/stock/:id', (req, res, next) => inventoryController.getById(req, res, next));
inventoryRoutes.post('/stock', (req, res, next) => inventoryController.create(req, res, next));
inventoryRoutes.put('/stock/:id', (req, res, next) => inventoryController.update(req, res, next));
inventoryRoutes.put('/stock/:id/status', (req, res, next) => inventoryController.changeStatus(req, res, next));
inventoryRoutes.get('/stock/:id/movements', (req, res, next) => inventoryController.getMovements(req, res, next));
