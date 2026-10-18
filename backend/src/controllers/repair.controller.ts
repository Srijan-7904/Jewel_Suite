import { Request, Response, NextFunction } from 'express';
import { repairService } from '../services/repair.service.js';

export class RepairController {
  createRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = repairService.createRepair(req.body, userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Repair intake recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getRepairById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = repairService.getRepairDetails(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listRepairs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const customer_id = req.query.customer_id as string | undefined;
      const karigar_id = req.query.karigar_id as string | undefined;
      const ownership = req.query.ownership as string | undefined;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;

      const result = repairService.listRepairs({
        page,
        pageSize,
        search,
        customer_id,
        karigar_id,
        ownership,
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

  updateRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = repairService.updateRepair(req.params.id, req.body, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Repair details updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  assignRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const karigarId = req.body.karigar_id;
      const result = repairService.assignRepair(req.params.id, karigarId, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Repair assigned to Karigar successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  startRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = repairService.startRepair(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Repair marked IN_REPAIR',
      });
    } catch (error) {
      next(error);
    }
  };

  completeRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const actualCost = req.body.actual_cost ? Number(req.body.actual_cost) : undefined;
      const notes = req.body.notes;
      const result = repairService.completeRepair(req.params.id, actualCost, notes, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Repair completed and marked READY',
      });
    } catch (error) {
      next(error);
    }
  };

  deliverRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = repairService.deliverRepair(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Repair delivered and stock returned where applicable',
      });
    } catch (error) {
      next(error);
    }
  };

  cancelRepair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = repairService.cancelRepair(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Repair cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const repairController = new RepairController();
