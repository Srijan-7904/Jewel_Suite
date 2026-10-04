import { z } from 'zod';
import { karigarRepository, KarigarRecord, KarigarQueryParams } from '../repositories/karigar.repository.js';
import { PaginatedResult } from '../repositories/customer.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

export const karigarSchema = z.object({
  karigar_code: z.string().trim().optional(),
  name: z.string().min(1, 'Karigar name is required').trim(),
  phone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  specialization: z.enum(['GOLD', 'SILVER', 'DIAMOND', 'POLISHING', 'SETTING', 'REPAIR', 'OTHER']).default('GOLD'),
  notes: z.string().trim().nullable().optional(),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const updateKarigarSchema = karigarSchema.partial();

export class KarigarService {
  list(params: KarigarQueryParams): PaginatedResult<KarigarRecord> {
    return karigarRepository.find(params);
  }

  getById(id: string): KarigarRecord {
    const karigar = karigarRepository.findById(id);
    if (!karigar) throw new NotFoundError('Karigar not found');
    return karigar;
  }

  create(data: unknown, userId?: string): KarigarRecord {
    const validated = karigarSchema.parse(data);

    if (validated.karigar_code) {
      const existing = karigarRepository.findByCode(validated.karigar_code);
      if (existing) throw new ConflictError(`Karigar code '${validated.karigar_code}' already exists`);
    }

    const karigar = karigarRepository.create(validated);

    auditRepository.log({
      user_id: userId,
      action: 'KARIGAR_CREATED',
      entity_type: 'KARIGAR',
      entity_id: karigar.id,
      metadata: { code: karigar.karigar_code, name: karigar.name, specialization: karigar.specialization },
    });

    return karigar;
  }

  update(id: string, data: unknown, userId?: string): KarigarRecord {
    const validated = updateKarigarSchema.parse(data);
    const existing = karigarRepository.findById(id);
    if (!existing) throw new NotFoundError('Karigar not found');

    if (validated.karigar_code && validated.karigar_code !== existing.karigar_code) {
      const duplicate = karigarRepository.findByCode(validated.karigar_code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Karigar code '${validated.karigar_code}' already exists`);
      }
    }

    const updated = karigarRepository.update(id, validated as any);
    if (!updated) throw new BadRequestError('Failed to update karigar');

    auditRepository.log({
      user_id: userId,
      action: 'KARIGAR_UPDATED',
      entity_type: 'KARIGAR',
      entity_id: updated.id,
      metadata: { code: updated.karigar_code, changes: Object.keys(validated) },
    });

    return updated;
  }

  toggleActive(id: string, isActive: boolean, userId?: string): KarigarRecord {
    const existing = karigarRepository.findById(id);
    if (!existing) throw new NotFoundError('Karigar not found');

    const updated = karigarRepository.setActive(id, isActive);
    if (!updated) throw new BadRequestError('Failed to update karigar status');

    auditRepository.log({
      user_id: userId,
      action: isActive ? 'KARIGAR_ACTIVATED' : 'KARIGAR_DEACTIVATED',
      entity_type: 'KARIGAR',
      entity_id: updated.id,
      metadata: { is_active: isActive ? 1 : 0 },
    });

    return updated;
  }
}

export const karigarService = new KarigarService();
