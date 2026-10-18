import { Request, Response, NextFunction } from 'express';
import { workshopService } from '../services/workshop.service.js';

export class WorkshopController {
  createJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.createJob(req.body, userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Workshop job created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getJobById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = workshopService.getJobDetails(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const karigar_id = req.query.karigar_id as string | undefined;
      const customer_id = req.query.customer_id as string | undefined;
      const job_type = req.query.job_type as string | undefined;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;

      const result = workshopService.listJobs({
        page,
        pageSize,
        search,
        karigar_id,
        customer_id,
        job_type,
        status,
        priority,
        from_date,
        to_date,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getIssueRegister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const karigar_id = req.query.karigar_id as string | undefined;
      const status = req.query.status as string | undefined;

      const result = workshopService.getIssueRegister({
        page,
        pageSize,
        search,
        karigar_id,
        status,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.addItem(req.params.id, req.body, userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Item added to job successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.removeItem(req.params.id, req.params.itemId, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Item removed from job successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  issueJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.issueJob(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Job issued to Karigar and stock status updated to WITH_KARIGAR',
      });
    } catch (error) {
      next(error);
    }
  };

  startJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.startJob(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Job marked IN_PROGRESS',
      });
    } catch (error) {
      next(error);
    }
  };

  returnJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.returnJob(req.params.id, req.body, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Items returned from Karigar, weight differences reconciled, and stock restored to IN_STOCK',
      });
    } catch (error) {
      next(error);
    }
  };

  completeJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.completeJob(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Job completed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  cancelJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = workshopService.cancelJob(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Job cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const workshopController = new WorkshopController();
