// backend/src/routes/savingScheme.routes.ts
// Jewel Suite: Saving Schemes REST Routes

import { Router } from 'express';
import { savingSchemeController } from '../controllers/savingScheme.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const savingSchemeRoutes = Router();

// All Saving Scheme operations require active authentication
savingSchemeRoutes.use(requireAuth);

savingSchemeRoutes.get('/types', savingSchemeController.listTypes);
savingSchemeRoutes.post('/types', savingSchemeController.createType);

savingSchemeRoutes.get('/', savingSchemeController.listSchemes);
savingSchemeRoutes.get('/:id', savingSchemeController.getScheme);
savingSchemeRoutes.post('/', savingSchemeController.enrollCustomer);
savingSchemeRoutes.post('/:id/installments/:installmentId/pay', savingSchemeController.payInstallment);
savingSchemeRoutes.post('/:id/mature', savingSchemeController.matureScheme);
