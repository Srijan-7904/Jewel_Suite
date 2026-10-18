import { z } from 'zod';
import { customerRepository, CustomerRecord, CustomerQueryParams, PaginatedResult } from '../repositories/customer.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

export const customerSchema = z.object({
  customer_code: z.string().trim().optional(),
  name: z.string().min(1, 'Customer name is required').trim(),
  phone: z.string().trim().nullable().optional(),
  alternate_phone: z.string().trim().nullable().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  pincode: z.string().trim().nullable().optional(),
  gstin: z.string().trim().nullable().optional(),
  customer_type: z.enum(['RETAIL', 'WHOLESALE', 'GIRVI_CLIENT']).default('RETAIL'),
  opening_balance: z.number().nonnegative('Opening balance must be 0 or positive').default(0),
  opening_balance_type: z.enum(['DEBIT', 'CREDIT']).default('DEBIT'),
  notes: z.string().trim().nullable().optional(),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const updateCustomerSchema = customerSchema.partial();

export class CustomerService {
  list(params: CustomerQueryParams): PaginatedResult<CustomerRecord> {
    return customerRepository.find(params);
  }

  getById(id: string): CustomerRecord {
    const customer = customerRepository.findById(id);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  create(data: unknown, userId?: string): CustomerRecord {
    const validated = customerSchema.parse(data);

    if (validated.customer_code) {
      const existing = customerRepository.findByCode(validated.customer_code);
      if (existing) throw new ConflictError(`Customer code '${validated.customer_code}' already exists`);
    }

    const customer = customerRepository.create({
      ...validated,
      email: validated.email || null,
    });

    if (customer.opening_balance > 0) {
      try {
        // Lazy import to prevent circular dependency
        import('./finance.service.js').then(({ financeService }) => {
          financeService.recordOpeningBalance(
            {
              party_type: 'CUSTOMER',
              party_id: customer.id,
              amount: customer.opening_balance,
              direction: customer.opening_balance_type,
              notes: 'Initial customer master opening balance',
            },
            userId
          );
        }).catch(() => {});
      } catch (e) {
        // Suppress if finance not yet initialized
      }
    }

    auditRepository.log({
      user_id: userId,
      action: 'CUSTOMER_CREATED',
      entity_type: 'CUSTOMER',
      entity_id: customer.id,
      metadata: { code: customer.customer_code, name: customer.name, type: customer.customer_type },
    });

    return customer;
  }

  update(id: string, data: unknown, userId?: string): CustomerRecord {
    const validated = updateCustomerSchema.parse(data);
    const existing = customerRepository.findById(id);
    if (!existing) throw new NotFoundError('Customer not found');

    if (validated.customer_code && validated.customer_code !== existing.customer_code) {
      const duplicate = customerRepository.findByCode(validated.customer_code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Customer code '${validated.customer_code}' already exists`);
      }
    }

    const updated = customerRepository.update(id, validated as any);
    if (!updated) throw new BadRequestError('Failed to update customer');

    auditRepository.log({
      user_id: userId,
      action: 'CUSTOMER_UPDATED',
      entity_type: 'CUSTOMER',
      entity_id: updated.id,
      metadata: { code: updated.customer_code, changes: Object.keys(validated) },
    });

    return updated;
  }

  toggleActive(id: string, isActive: boolean, userId?: string): CustomerRecord {
    const existing = customerRepository.findById(id);
    if (!existing) throw new NotFoundError('Customer not found');

    const updated = customerRepository.setActive(id, isActive);
    if (!updated) throw new BadRequestError('Failed to change customer status');

    auditRepository.log({
      user_id: userId,
      action: isActive ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED',
      entity_type: 'CUSTOMER',
      entity_id: updated.id,
      metadata: { is_active: isActive ? 1 : 0 },
    });

    return updated;
  }
}

export const customerService = new CustomerService();
