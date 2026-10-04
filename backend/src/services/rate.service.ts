import { z } from 'zod';
import { metalRepository, CurrentRateRecord, MetalRecord, MetalPurityRecord, MetalRateRecord } from '../repositories/metal.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const createRateSchema = z.object({
  metal_id: z.string().min(1, 'Metal is required'),
  purity_id: z.string().min(1, 'Purity is required'),
  rate: z.number().positive('Rate must be greater than 0'),
  unit: z.string().default('gram'),
  effective_from: z.string().optional(),
});

export class RateService {
  getMetals(): MetalRecord[] {
    return metalRepository.getMetals();
  }

  getPuritiesByMetal(metalId: string): MetalPurityRecord[] {
    return metalRepository.getPuritiesByMetal(metalId);
  }

  getAllPurities(): MetalPurityRecord[] {
    return metalRepository.getAllPurities();
  }

  getCurrentRates(): CurrentRateRecord[] {
    return metalRepository.getCurrentRates();
  }

  getRateHistory(purityId?: string, metalId?: string, limit = 50): CurrentRateRecord[] {
    return metalRepository.getRateHistory(purityId, metalId, limit);
  }

  createRate(data: unknown, userId?: string): MetalRateRecord {
    const validated = createRateSchema.parse(data);

    const metal = metalRepository.getMetalById(validated.metal_id);
    if (!metal) throw new NotFoundError('Metal not found');

    const purity = metalRepository.getPurityById(validated.purity_id);
    if (!purity) throw new NotFoundError('Purity not found');

    if (purity.metal_id !== metal.id) {
      throw new BadRequestError(`Purity '${purity.code}' does not belong to metal '${metal.code}'`);
    }

    const rateRecord = metalRepository.createRate({
      metal_id: validated.metal_id,
      purity_id: validated.purity_id,
      rate: validated.rate,
      unit: validated.unit,
      effective_from: validated.effective_from || new Date().toISOString(),
      created_by: userId || null,
    });

    auditRepository.log({
      user_id: userId,
      action: 'RATE_CREATED',
      entity_type: 'METAL_RATE',
      entity_id: rateRecord.id,
      metadata: {
        metal: metal.code,
        purity: purity.code,
        rate: rateRecord.rate,
        unit: rateRecord.unit,
        effective_from: rateRecord.effective_from,
      },
    });

    return rateRecord;
  }
}

export const rateService = new RateService();
