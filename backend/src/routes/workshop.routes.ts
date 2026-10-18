import { Router } from 'express';
import { workshopController } from '../controllers/workshop.controller.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const workshopRoutes = Router();

// Protect all workshop routes
workshopRoutes.use(requireAuth);

workshopRoutes.get('/jobs', workshopController.listJobs);
workshopRoutes.post('/jobs', workshopController.createJob);
workshopRoutes.get('/issue-register', workshopController.getIssueRegister);

workshopRoutes.get('/jobs/:id', workshopController.getJobById);
workshopRoutes.post('/jobs/:id/items', workshopController.addItem);
workshopRoutes.delete('/jobs/:id/items/:itemId', workshopController.removeItem);

workshopRoutes.post('/jobs/:id/issue', workshopController.issueJob);
workshopRoutes.post('/jobs/:id/start', workshopController.startJob);
workshopRoutes.post('/jobs/:id/return', workshopController.returnJob);
workshopRoutes.post('/jobs/:id/complete', workshopController.completeJob);
workshopRoutes.post('/jobs/:id/cancel', workshopController.cancelJob);
