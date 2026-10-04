import { z } from 'zod';
import { supplierRepository, SupplierRecord, SupplierQueryParams } from '../repositories/supplier.repository.js';
import { PaginatedResult } from '../repositories/customer.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

export const supplierSchema = z.object({
  supplier_code: z.string().trim().optional(),
  name: z.string().min(1, 'Supplier name is required').trim(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  pincode: z.string().trim().nullable().optional(),
  gstin: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const updateSupplierSchema = supplierSchema.partial();

export class SupplierService {
  list(params: SupplierQueryParams): PaginatedResult<SupplierRecord> {
    return supplierRepository.find(params);
  }

  getById(id: string): SupplierRecord {
    const supplier = supplierRepository.findById(id);
    if (!supplier) throw new NotFoundError('Supplier not found');
    return supplier;
  }

  create(data: unknown, userId?: string): SupplierRecord {
    const validated = supplierSchema.parse(data);

    if (validated.supplier_code) {
      const existing = supplierRepository.findByCode(validated.supplier_code);
      if (existing) throw new ConflictError(`Supplier code '${validated.supplier_code}' already exists`);
    }

    const supplier = supplierRepository.create({
      ...validated,
      email: validated.email || null,
    });

    auditRepository.log({
      user_id: userId,
      action: 'SUPPLIER_CREATED',
      entity_type: 'SUPPLIER',
      entity_id: supplier.id,
      metadata: { code: supplier.supplier_code, name: supplier.name },
    });

    return supplier;
  }

  update(id: string, data: unknown, userId?: string): SupplierRecord {
    const validated = updateSupplierSchema.parse(data);
    const existing = supplierRepository.findById(id);
    if (!existing) throw new NotFoundError('Supplier not found');

    if (validated.supplier_code && validated.supplier_code !== existing.supplier_code) {
      const duplicate = supplierRepository.findByCode(validated.supplier_code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Supplier code '${validated.supplier_code}' already exists`);
      }
    }

    const updated = supplierRepository.update(id, validated as any);
    if (!updated) throw new BadRequestError('Failed to update supplier');

    auditRepository.log({
      user_id: userId,
      action: 'SUPPLIER_UPDATED',
      entity_type: 'SUPPLIER',
      entity_id: updated.id,
      metadata: { code: updated.supplier_code, changes: Object.keys(validated) },
    });

    return updated;
  }

  toggleActive(id: string, isActive: boolean, userId?: string): SupplierRecord {
    const existing = supplierRepository.findById(id);
    if (!existing) throw new NotFoundError('Supplier not found');

    const updated = supplierRepository.setActive(id, isActive);
    if (!updated) throw new BadRequestError('Failed to update supplier status');

    auditRepository.log({
      user_id: userId,
      action: isActive ? 'SUPPLIER_ACTIVATED' : 'SUPPLIER_DEACTIVATED',
      entity_type: 'SUPPLIER',
      entity_id: updated.id,
      metadata: { is_active: isActive ? 1 : 0 },
    });

    return updated;
  }
}

export const supplierService = new SupplierService();
