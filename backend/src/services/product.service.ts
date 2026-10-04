import { z } from 'zod';
import { productRepository, ProductRecord, ProductQueryParams } from '../repositories/product.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { PaginatedResult } from '../repositories/customer.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

export const productSchema = z.object({
  product_code: z.string().trim().optional(),
  name: z.string().min(1, 'Product name is required').trim(),
  category_id: z.string().min(1, 'Category is required'),
  description: z.string().trim().nullable().optional(),
  default_metal: z.string().trim().nullable().optional(),
  default_purity: z.string().trim().nullable().optional(),
  default_unit: z.string().default('g'),
  hsn_code: z.string().trim().nullable().optional(),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const updateProductSchema = productSchema.partial();

export class ProductService {
  list(params: ProductQueryParams): PaginatedResult<ProductRecord> {
    return productRepository.find(params);
  }

  getById(id: string): ProductRecord {
    const product = productRepository.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  create(data: unknown, userId?: string): ProductRecord {
    const validated = productSchema.parse(data);

    // Validate category exists
    const category = categoryRepository.findById(validated.category_id);
    if (!category) throw new NotFoundError(`Category with ID '${validated.category_id}' does not exist`);

    if (validated.product_code) {
      const existing = productRepository.findByCode(validated.product_code);
      if (existing) throw new ConflictError(`Product code '${validated.product_code}' already exists`);
    }

    const product = productRepository.create(validated);

    auditRepository.log({
      user_id: userId,
      action: 'PRODUCT_CREATED',
      entity_type: 'PRODUCT',
      entity_id: product.id,
      metadata: { code: product.product_code, name: product.name, category: category.name },
    });

    return product;
  }

  update(id: string, data: unknown, userId?: string): ProductRecord {
    const validated = updateProductSchema.parse(data);
    const existing = productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product not found');

    if (validated.category_id) {
      const category = categoryRepository.findById(validated.category_id);
      if (!category) throw new NotFoundError(`Category with ID '${validated.category_id}' does not exist`);
    }

    if (validated.product_code && validated.product_code !== existing.product_code) {
      const dup = productRepository.findByCode(validated.product_code);
      if (dup && dup.id !== id) throw new ConflictError(`Product code '${validated.product_code}' already exists`);
    }

    const updated = productRepository.update(id, validated as any);
    if (!updated) throw new BadRequestError('Failed to update product');

    auditRepository.log({
      user_id: userId,
      action: 'PRODUCT_UPDATED',
      entity_type: 'PRODUCT',
      entity_id: updated.id,
      metadata: { code: updated.product_code, name: updated.name },
    });

    return updated;
  }

  toggleActive(id: string, isActive: boolean, userId?: string): ProductRecord {
    const existing = productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product not found');

    const updated = productRepository.setActive(id, isActive);
    if (!updated) throw new BadRequestError('Failed to update product status');

    auditRepository.log({
      user_id: userId,
      action: isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      entity_type: 'PRODUCT',
      entity_id: updated.id,
      metadata: { is_active: isActive ? 1 : 0 },
    });

    return updated;
  }
}

export const productService = new ProductService();
