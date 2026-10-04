import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { systemRoutes } from './system.routes.js';
import { customerRoutes } from './customer.routes.js';
import { supplierRoutes } from './supplier.routes.js';
import { karigarRoutes } from './karigar.routes.js';
import { categoryRoutes } from './category.routes.js';
import { productRoutes } from './product.routes.js';
import { rateRoutes } from './rate.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/system', systemRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/karigars', karigarRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/rates', rateRoutes);

// Compatibility alias for /api/masters/...
apiRouter.use('/masters/metals', rateRoutes);
apiRouter.use('/masters/customers', customerRoutes);
apiRouter.use('/masters/suppliers', supplierRoutes);
apiRouter.use('/masters/categories', categoryRoutes);
apiRouter.use('/masters/products', productRoutes);
apiRouter.use('/masters/karigars', karigarRoutes);

