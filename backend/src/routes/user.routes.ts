// backend/src/routes/user.routes.ts
import { Router } from 'express';
import { userManagementController } from '../controllers/userManagement.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

export const userRoutes = Router();

// User management endpoints strictly require ADMIN role
userRoutes.use(requireAuth);
userRoutes.use(requireRole('ADMIN'));

userRoutes.get('/', (req, res, next) => userManagementController.getAllUsers(req, res, next));
userRoutes.get('/:id', (req, res, next) => userManagementController.getUserById(req, res, next));
userRoutes.post('/', (req, res, next) => userManagementController.createUser(req, res, next));
userRoutes.put('/:id', (req, res, next) => userManagementController.updateUser(req, res, next));
userRoutes.post('/:id/reset-password', (req, res, next) => userManagementController.resetPassword(req, res, next));
userRoutes.post('/:id/deactivate', (req, res, next) => userManagementController.deactivateUser(req, res, next));
