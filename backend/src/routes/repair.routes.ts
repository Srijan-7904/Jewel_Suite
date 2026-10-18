import { Router } from 'express';
import { repairController } from '../controllers/repair.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const repairRoutes = Router();

// Protect all repair routes
repairRoutes.use(requireAuth);

repairRoutes.get('/', repairController.listRepairs);
repairRoutes.post('/', repairController.createRepair);

repairRoutes.get('/:id', repairController.getRepairById);
repairRoutes.put('/:id', repairController.updateRepair);

repairRoutes.post('/:id/assign', repairController.assignRepair);
repairRoutes.post('/:id/start', repairController.startRepair);
repairRoutes.post('/:id/complete', repairController.completeRepair);
repairRoutes.post('/:id/deliver', repairController.deliverRepair);
repairRoutes.post('/:id/cancel', repairController.cancelRepair);
