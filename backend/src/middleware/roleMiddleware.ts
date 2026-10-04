import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = req.user.role;
    const hasRole = allowedRoles.some(
      (role) => role.toUpperCase() === userRole.toUpperCase()
    );

    if (!hasRole) {
      return next(
        new ForbiddenError(
          `Action restricted. Required role: [${allowedRoles.join(', ')}]. Current role: '${userRole}'.`
        )
      );
    }

    next();
  };
}
