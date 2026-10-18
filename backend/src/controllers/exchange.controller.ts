import { Request, Response, NextFunction } from 'express';
import { exchangeService } from '../services/exchange.service.js';
import { exchangeRepository } from '../repositories/exchange.repository.js';

export class ExchangeController {
  createDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = exchangeService.createDraft(req.body, userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Exchange draft created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = exchangeService.getExchangeDetails(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const customer_id = req.query.customer_id as string | undefined;
      const status = req.query.status as string | undefined;
      const from_date = req.query.from_date as string | undefined;
      const to_date = req.query.to_date as string | undefined;

      const result = exchangeService.listExchanges({
        page,
        pageSize,
        search,
        customer_id,
        status,
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

  updateDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = exchangeService.updateDraft(req.params.id, req.body, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Exchange draft updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = exchangeService.addItem(req.params.id, req.body, userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Item added to exchange successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = exchangeService.removeItem(req.params.id, req.params.itemId, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Item removed from exchange successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = exchangeRepository.getItemsByExchangeId(req.params.id);
      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  };

  finalize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = exchangeService.finalizeExchange(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Exchange finalized and stock inwarded successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const result = exchangeService.cancelDraft(req.params.id, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Exchange draft cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCustomerExchanges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = exchangeService.getCustomerExchanges(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const exchangeController = new ExchangeController();
