import { Router, Request, Response } from 'express';
import { getDb } from '../database/connection/db.js';
import { shopRepository } from '../repositories/shop.repository.js';
import { settingRepository } from '../repositories/setting.repository.js';
import { sendSuccess } from '../utils/response.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const systemRoutes = Router();

systemRoutes.get('/health', (_req: Request, res: Response) => {
  const db = getDb();
  const test = db.prepare('SELECT 1 as alive').get() as { alive: number };

  sendSuccess(res, {
    status: 'ONLINE',
    database: test.alive === 1 ? 'CONNECTED' : 'ERROR',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'OFFLINE_FIRST',
  }, 'System healthy');
});

systemRoutes.get('/info', requireAuth, (_req: Request, res: Response) => {
  const shop = shopRepository.getShop();
  const settings = settingRepository.getAll();
  const db = getDb();
  const migrations = db.prepare('SELECT migration_name, applied_at FROM schema_migrations ORDER BY id ASC').all();

  sendSuccess(res, {
    shop,
    settings,
    migrations,
  });
});
