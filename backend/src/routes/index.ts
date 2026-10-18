import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { systemRoutes } from './system.routes.js';
import { customerRoutes } from './customer.routes.js';
import { supplierRoutes } from './supplier.routes.js';
import { karigarRoutes } from './karigar.routes.js';
import { categoryRoutes } from './category.routes.js';
import { productRoutes } from './product.routes.js';
import { rateRoutes } from './rate.routes.js';
import { inventoryRoutes } from './inventory.routes.js';
import { purchaseRoutes } from './purchase.routes.js';
import { exchangeRoutes } from './exchange.routes.js';
import { salesRoutes } from './sales.routes.js';
import { workshopRoutes } from './workshop.routes.js';
import { repairRoutes } from './repair.routes.js';
import { financeRoutes } from './finance.routes.js';
import { girviRoutes } from './girvi.routes.js';
import { savingSchemeRoutes } from './savingScheme.routes.js';
import { exchangeController } from '../controllers/exchange.controller.js';
import { salesController } from '../controllers/sales.controller.js';
import { girviController } from '../controllers/girvi.controller.js';
import { savingSchemeController } from '../controllers/savingScheme.controller.js';
import { reportsRoutes } from './reports.routes.js';
import { settingsRoutes } from './settings.routes.js';
import { userRoutes } from './user.routes.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const apiRouter = Router();

apiRouter.use('/reports', reportsRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/users', userRoutes);

apiRouter.use('/auth', authRoutes);
apiRouter.use('/system', systemRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/karigars', karigarRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/rates', rateRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/purchases', purchaseRoutes);
apiRouter.use('/purchase', purchaseRoutes);
apiRouter.use('/exchanges', exchangeRoutes);
apiRouter.use('/exchange', exchangeRoutes);
apiRouter.use('/sales', salesRoutes);
apiRouter.use('/workshop', workshopRoutes);
apiRouter.use('/repairs', repairRoutes);
apiRouter.use('/repair', repairRoutes);
apiRouter.use('/finance', financeRoutes);
apiRouter.use('/girvi', girviRoutes);
apiRouter.use('/saving-schemes', savingSchemeRoutes);
apiRouter.use('/finance/girvi', girviRoutes);
apiRouter.use('/finance/saving-schemes', savingSchemeRoutes);

// Customer sub-resource history endpoints
apiRouter.get('/customers/:id/exchanges', requireAuth, exchangeController.getCustomerExchanges);
apiRouter.get('/customers/:id/invoices', requireAuth, salesController.getCustomerInvoices);
apiRouter.get('/customers/:id/girvi-loans', requireAuth, girviController.getCustomerLoans);
apiRouter.get('/customers/:id/saving-schemes', requireAuth, savingSchemeController.getCustomerSchemes);

// Compatibility alias for /api/masters/...
apiRouter.use('/masters/metals', rateRoutes);
apiRouter.use('/masters/customers', customerRoutes);
apiRouter.use('/masters/suppliers', supplierRoutes);
apiRouter.use('/masters/categories', categoryRoutes);
apiRouter.use('/masters/products', productRoutes);
apiRouter.use('/masters/karigars', karigarRoutes);

// Catch-all JSON 404 for unmatched /api routes
apiRouter.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint '${req.method} ${req.originalUrl}' not found`,
    },
  });
});


