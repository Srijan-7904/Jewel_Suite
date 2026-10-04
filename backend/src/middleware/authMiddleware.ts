import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthTokenPayload } from '../utils/jwt.js';
import { userRepository, UserRecord } from '../repositories/user.repository.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface AuthenticatedUser extends Omit<UserRecord, 'password_hash'> {}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid');
    }

    const token = authHeader.slice(7).trim();
    let payload: AuthTokenPayload;

    try {
      payload = verifyToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication session');
    }

    const user = userRepository.findById(payload.userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('User session is invalid or user has been disabled');
    }

    const { password_hash, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    next(err);
  }
}
