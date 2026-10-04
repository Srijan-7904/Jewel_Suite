import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle custom application errors
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Handle schema validation errors (Zod)
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    sendError(res, 'VALIDATION_ERROR', 'Input validation failed', 400, details);
    return;
  }

  // Handle SQLite / Database constraint errors safely
  if ('code' in err && typeof err.code === 'string' && err.code.startsWith('SQLITE_')) {
    console.error('[Database Error]', err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      sendError(res, 'RECORD_ALREADY_EXISTS', 'A record with these unique details already exists.', 409);
      return;
    }
    sendError(res, 'DATABASE_ERROR', 'A database operation error occurred.', 500);
    return;
  }

  // Unexpected runtime errors
  console.error('[Unhandled Server Error]', err);
  sendError(res, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred. Please try again.', 500);
}
