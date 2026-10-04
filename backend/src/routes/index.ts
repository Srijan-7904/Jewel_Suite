import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { systemRoutes } from './system.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/system', systemRoutes);
