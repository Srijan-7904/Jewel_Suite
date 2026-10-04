import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';

import { customerService } from '../src/services/customer.service.js';
import { supplierService } from '../src/services/supplier.service.js';
import { karigarService } from '../src/services/karigar.service.js';
import { categoryService } from '../src/services/category.service.js';
import { productService } from '../src/services/product.service.js';
import { rateService } from '../src/services/rate.service.js';
import { ConflictError, NotFoundError } from '../src/utils/errors.js';

describe('Jewel Suite Part 2: Masters & Core Business Data Tests', () => {
  let testDb: DatabaseType;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  // 1. Customers
  describe('Customer Master', () => {
    it('should create a customer with code and defaults', () => {
      const customer = customerService.create({
        name: 'Rajesh Verma',
        phone: '9820112233',
        customer_type: 'RETAIL',
        city: 'Mumbai',
      });

      expect(customer.id).toBeDefined();
      expect(customer.customer_code).toMatch(/^CUST-\d{4}$/);
      expect(customer.name).toBe('Rajesh Verma');
      expect(customer.is_active).toBe(1);
    });

    it('should prevent duplicate customer codes', () => {
      customerService.create({
        customer_code: 'CUST-9999',
        name: 'First Jeweller',
      });

      expect(() => {
        customerService.create({
          customer_code: 'CUST-9999',
          name: 'Duplicate Jeweller',
        });
      }).toThrow(ConflictError);
    });

    it('should update customer details', () => {
      const customer = customerService.create({
        name: 'Pooja Sharma',
        phone: '9811223344',
      });

      const updated = customerService.update(customer.id, {
        phone: '9999988888',
        address: 'Bandra West',
      });

      expect(updated.phone).toBe('9999988888');
      expect(updated.address).toBe('Bandra West');
    });

    it('should search and filter customers by type and query', () => {
      customerService.create({ name: 'Kiran Wholesalers', phone: '9123456789', customer_type: 'WHOLESALE' });
      customerService.create({ name: 'Amit Retailer', phone: '9234567890', customer_type: 'RETAIL' });

      const searchResult = customerService.list({ search: 'Kiran' });
      expect(searchResult.total).toBe(1);
      expect(searchResult.items[0].name).toBe('Kiran Wholesalers');

      const filterResult = customerService.list({ customer_type: 'WHOLESALE' });
      expect(filterResult.items.some((c) => c.name === 'Kiran Wholesalers')).toBe(true);
      expect(filterResult.items.every((c) => c.customer_type === 'WHOLESALE')).toBe(true);
    });

    it('should soft-deactivate and reactivate customer without data loss', () => {
      const customer = customerService.create({ name: 'Inactive Test' });
      expect(customer.is_active).toBe(1);

      const deactivated = customerService.toggleActive(customer.id, false);
      expect(deactivated.is_active).toBe(0);

      const reactivated = customerService.toggleActive(customer.id, true);
      expect(reactivated.is_active).toBe(1);
    });
  });

  // 2. Suppliers
  describe('Supplier Master', () => {
    it('should create and search suppliers', () => {
      const supplier = supplierService.create({
        name: 'Zaveri Bullion Refineries',
        phone: '0222345678',
        city: 'Mumbai',
        gstin: '27AABCU9603R1ZM',
      });

      expect(supplier.id).toBeDefined();
      expect(supplier.supplier_code).toMatch(/^SUPP-\d{4}$/);

      const search = supplierService.list({ search: 'Bullion' });
      expect(search.total).toBe(1);
      expect(search.items[0].name).toBe('Zaveri Bullion Refineries');
    });

    it('should update supplier details', () => {
      const supplier = supplierService.create({ name: 'Choksi Gold' });
      const updated = supplierService.update(supplier.id, { name: 'Choksi Bullion Private Ltd' });
      expect(updated.name).toBe('Choksi Bullion Private Ltd');
    });
  });

  // 3. Karigars
  describe('Karigar Master', () => {
    it('should create and update karigar artisans', () => {
      const karigar = karigarService.create({
        name: 'Shyamal Mukherjee',
        phone: '9830123456',
        specialization: 'POLISHING',
      });

      expect(karigar.karigar_code).toMatch(/^KRG-\d{4}$/);
      expect(karigar.specialization).toBe('POLISHING');

      const updated = karigarService.update(karigar.id, { specialization: 'SETTING' });
      expect(updated.specialization).toBe('SETTING');
    });
  });

  // 4. Categories
  describe('Category Master', () => {
    it('should enforce unique category name and code', () => {
      // 'Rings' was seeded in seeder.ts
      expect(() => {
        categoryService.create({
          name: 'Rings',
          code: 'RNG2',
        });
      }).toThrow(ConflictError);

      expect(() => {
        categoryService.create({
          name: 'Unique Bangles',
          code: 'BNG', // code 'BNG' already seeded
        });
      }).toThrow(ConflictError);
    });

    it('should create and update categories', () => {
      const cat = categoryService.create({
        name: 'Brooches',
        code: 'BRC-NEW',
        description: 'Antique and modern brooches',
      });

      expect(cat.id).toBeDefined();
      expect(cat.name).toBe('Brooches');

      const updated = categoryService.update(cat.id, { description: 'Updated brooches' });
      expect(updated.description).toBe('Updated brooches');
    });
  });

  // 5. Products
  describe('Product Master', () => {
    it('should create product with category relationship and enforce foreign keys', () => {
      const categories = categoryService.getAll();
      const ringCat = categories.find((c) => c.code === 'RNG')!;

      const product = productService.create({
        name: 'Classic Solitaire Ring',
        category_id: ringCat.id,
        default_metal: 'GOLD',
        default_purity: '22K',
        default_unit: 'g',
        hsn_code: '71131910',
      });

      expect(product.id).toBeDefined();
      expect(product.product_code).toMatch(/^PRD-\d{4}$/);
      expect(product.category_name).toBe('Rings');

      // Invalid foreign key should throw
      expect(() => {
        productService.create({
          name: 'Invalid FK Product',
          category_id: 'non-existent-uuid',
        });
      }).toThrow(NotFoundError);
    });
  });

  // 6. Metal Rates & History
  describe('Metal Rates & Historical Immutability', () => {
    it('should retrieve seeded baseline metal rates', () => {
      const rates = rateService.getCurrentRates();
      expect(rates.length).toBeGreaterThan(0);

      const gold22 = rates.find((r) => r.metal_code === 'GOLD' && r.purity_code === '22K');
      expect(gold22).toBeDefined();
      expect(gold22?.rate).toBe(7190.0);
    });

    it('should create new rate and preserve historical records without mutating old rates', () => {
      const metals = rateService.getMetals();
      const gold = metals.find((m) => m.code === 'GOLD')!;
      const purities = rateService.getPuritiesByMetal(gold.id);
      const gold22 = purities.find((p) => p.code === '22K')!;

      // 1. Initial rate is ₹7190
      const initialCurrent = rateService.getCurrentRates().find(
        (r) => r.metal_code === 'GOLD' && r.purity_code === '22K'
      )!;
      expect(initialCurrent.rate).toBe(7190.0);

      // 2. Day 2: Price changes to ₹7350
      const newRateRecord = rateService.createRate({
        metal_id: gold.id,
        purity_id: gold22.id,
        rate: 7350.0,
        unit: 'gram',
        effective_from: '2026-10-05T00:00:00.000Z',
      });

      expect(newRateRecord.rate).toBe(7350.0);

      // 3. Current rate is now ₹7350
      const updatedCurrent = rateService.getCurrentRates().find(
        (r) => r.metal_code === 'GOLD' && r.purity_code === '22K'
      )!;
      expect(updatedCurrent.rate).toBe(7350.0);

      // 4. Rate History preserves the previous rate (₹7190) and new rate (₹7350)
      const history = rateService.getRateHistory(gold22.id, gold.id);
      expect(history.length).toBeGreaterThanOrEqual(2);

      const ratesList = history.map((h) => h.rate);
      expect(ratesList).toContain(7350.0);
      expect(ratesList).toContain(7190.0);
    });
  });
});
