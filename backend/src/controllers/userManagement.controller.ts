// backend/src/controllers/userManagement.controller.ts
import { Request, Response, NextFunction } from 'express';
import { userManagementService } from '../services/userManagement.service.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';

export class UserManagementController {
  async getAllUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = userManagementService.getAllUsers();
      sendSuccess(res, users, 'Users retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = userManagementService.getUserById(id);
      sendSuccess(res, user, 'User details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user?.id;
      const user = await userManagementService.createUser(req.body, adminUserId);
      sendSuccess(res, user, 'User created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.id;
      const updated = userManagementService.updateUser(id, req.body, adminUserId);
      sendSuccess(res, updated, 'User updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password) {
        throw new BadRequestError('New password is required in request body', 'VALIDATION_ERROR');
      }
      const adminUserId = req.user?.id;
      const result = await userManagementService.resetPassword(id, password, adminUserId);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.id;
      const deactivated = userManagementService.deactivateUser(id, adminUserId);
      sendSuccess(res, deactivated, 'User deactivated successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const userManagementController = new UserManagementController();
