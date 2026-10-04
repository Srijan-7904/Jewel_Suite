import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { sendSuccess } from '../utils/response.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await authService.login(req.body);
      sendSuccess(res, session, 'Authentication successful');
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        auditRepository.log({
          user_id: req.user.id,
          action: 'USER_LOGOUT',
          entity_type: 'USER',
          entity_id: req.user.id,
          metadata: { username: req.user.username },
        });
      }
      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = authService.getCurrentUser(req.user!.id);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
