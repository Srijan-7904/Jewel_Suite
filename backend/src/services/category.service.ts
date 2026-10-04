import { z } from 'zod';
import { categoryRepository, CategoryRecord, CategoryQueryParams } from '../repositories/category.repository.js';
import { PaginatedResult } from '../repositories/customer.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
  code: z.string().min(1, 'Category code is required').trim(),
  description: z.string().trim().nullable().optional(),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const updateCategorySchema = categorySchema.partial();

export class CategoryService {
  list(params: CategoryQueryParams): PaginatedResult<CategoryRecord> {
    return categoryRepository.find(params);
  }

  getAll(activeOnly = true): CategoryRecord[] {
    return categoryRepository.findAll(activeOnly);
  }

  getById(id: string): CategoryRecord {
    const category = categoryRepository.findById(id);
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  create(data: unknown, userId?: string): CategoryRecord {
    const validated = categorySchema.parse(data);

    if (categoryRepository.findByCode(validated.code)) {
      throw new ConflictError(`Category code '${validated.code}' already exists`);
    }
    if (categoryRepository.findByName(validated.name)) {
      throw new ConflictError(`Category name '${validated.name}' already exists`);
    }

    const category = categoryRepository.create(validated);

    auditRepository.log({
      user_id: userId,
      action: 'CATEGORY_CREATED',
      entity_type: 'CATEGORY',
      entity_id: category.id,
      metadata: { code: category.code, name: category.name },
    });

    return category;
  }

  update(id: string, data: unknown, userId?: string): CategoryRecord {
    const validated = updateCategorySchema.parse(data);
    const existing = categoryRepository.findById(id);
    if (!existing) throw new NotFoundError('Category not found');

    if (validated.code && validated.code.toUpperCase() !== existing.code.toUpperCase()) {
      const dup = categoryRepository.findByCode(validated.code);
      if (dup && dup.id !== id) throw new ConflictError(`Category code '${validated.code}' already exists`);
    }

    if (validated.name && validated.name.toLowerCase() !== existing.name.toLowerCase()) {
      const dup = categoryRepository.findByName(validated.name);
      if (dup && dup.id !== id) throw new ConflictError(`Category name '${validated.name}' already exists`);
    }

    const updated = categoryRepository.update(id, validated);
    if (!updated) throw new BadRequestError('Failed to update category');

    auditRepository.log({
      user_id: userId,
      action: 'CATEGORY_UPDATED',
      entity_type: 'CATEGORY',
      entity_id: updated.id,
      metadata: { code: updated.code, name: updated.name },
    });

    return updated;
  }

  toggleActive(id: string, isActive: boolean, userId?: string): CategoryRecord {
    const existing = categoryRepository.findById(id);
    if (!existing) throw new NotFoundError('Category not found');

    const updated = categoryRepository.setActive(id, isActive);
    if (!updated) throw new BadRequestError('Failed to update category status');

    auditRepository.log({
      user_id: userId,
      action: isActive ? 'CATEGORY_ACTIVATED' : 'CATEGORY_DEACTIVATED',
      entity_type: 'CATEGORY',
      entity_id: updated.id,
      metadata: { is_active: isActive ? 1 : 0 },
    });

    return updated;
  }
}

export const categoryService = new CategoryService();
