// backend/src/controllers/savingScheme.controller.ts
// Jewel Suite: Saving Schemes REST Controller

import { Request, Response, NextFunction } from 'express';
import { savingSchemeService } from '../services/savingScheme.service.js';

export class SavingSchemeController {
  listTypes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const types = savingSchemeService.listTypes();
      res.status(200).json({
        success: true,
        data: types,
      });
    } catch (err) {
      next(err);
    }
  };

  createType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const type = savingSchemeService.createType(req.body);
      res.status(201).json({
        success: true,
        message: 'Saving scheme type created successfully',
        data: type,
      });
    } catch (err) {
      next(err);
    }
  };

  enrollCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = savingSchemeService.enrollCustomer(req.body, req.user?.id);
      res.status(201).json({
        success: true,
        message: 'Customer enrolled in saving scheme successfully',
        data: scheme,
      });
    } catch (err) {
      next(err);
    }
  };

  payInstallment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = savingSchemeService.payInstallment(
        req.params.id,
        req.params.installmentId,
        req.body,
        req.user?.id
      );
      res.status(200).json({
        success: true,
        message: 'Installment payment recorded successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  matureScheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = savingSchemeService.matureScheme(req.params.id, req.body.notes, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Saving scheme matured successfully',
        data: scheme,
      });
    } catch (err) {
      next(err);
    }
  };

  getScheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scheme = savingSchemeService.getScheme(req.params.id);
      res.status(200).json({
        success: true,
        data: scheme,
      });
    } catch (err) {
      next(err);
    }
  };

  listSchemes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const customer_id = req.query.customer_id as string | undefined;
      const scheme_type_id = req.query.scheme_type_id as string | undefined;
      const status = req.query.status as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;
      const search = req.query.search as string | undefined;

      const result = savingSchemeService.listSchemes({
        page,
        pageSize,
        customer_id,
        scheme_type_id,
        status,
        from_date,
        to_date,
        search,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  };

  getCustomerSchemes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schemes = savingSchemeService.getCustomerSchemes(req.params.id);
      res.status(200).json({
        success: true,
        data: schemes,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const savingSchemeController = new SavingSchemeController();
