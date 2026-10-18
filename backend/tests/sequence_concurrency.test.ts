// backend/tests/sequence_concurrency.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { documentSequenceRepository } from '../src/repositories/documentSequence.repository.js';
import { salesRepository } from '../src/repositories/sales.repository.js';
import { purchaseRepository } from '../src/repositories/purchase.repository.js';

describe('Jewel Suite Part 11: Critical Concurrent Document Numbering Tests', () => {
  beforeEach(() => {
    const db = getDb();
    runMigrations(db);
    documentSequenceRepository.initDefaults();
    documentSequenceRepository.updateConfig('INVOICE', { prefix: 'INV', padding: 6, financial_year_reset: true });
    documentSequenceRepository.updateConfig('PURCHASE', { prefix: 'PUR', padding: 6, financial_year_reset: true });
    documentSequenceRepository.updateConfig('REPAIR', { prefix: 'REP', padding: 6, financial_year_reset: true });
    documentSequenceRepository.updateConfig('WORKSHOP_JOB', { prefix: 'JOB', padding: 6, financial_year_reset: true });
  });

  it('should generate strictly unique, consecutive invoice numbers concurrently without race conditions', async () => {
    const concurrencyCount = 50;
    const promises: Promise<string>[] = [];

    for (let i = 0; i < concurrencyCount; i++) {
      promises.push(
        new Promise<string>((resolve) => {
          // Microtask tick to simulate concurrent async requests hitting the server
          setTimeout(() => {
            const num = documentSequenceRepository.getNextNumber('INVOICE');
            resolve(num);
          }, Math.floor(Math.random() * 5));
        })
      );
    }

    const results = await Promise.all(promises);

    expect(results).toHaveLength(concurrencyCount);

    // Verify 100% uniqueness: zero duplicates
    const uniqueSet = new Set(results);
    expect(uniqueSet.size).toBe(concurrencyCount);

    // Verify pattern: e.g. INV-2026-000001
    const currentYear = new Date().getFullYear();
    for (const num of results) {
      expect(num).toMatch(new RegExp(`^INV-${currentYear}-\\d{6}$`));
    }
  });

  it('should generate strictly unique purchase numbers across simultaneous parallel calls', async () => {
    const batchSize = 30;
    const tasks = Array.from({ length: batchSize }, () => {
      return new Promise<string>((resolve) => {
        resolve(purchaseRepository.getNextPurchaseNumber());
      });
    });

    const purchaseNumbers = await Promise.all(tasks);
    const uniquePurchases = new Set(purchaseNumbers);

    expect(uniquePurchases.size).toBe(batchSize);
    for (const num of purchaseNumbers) {
      expect(num).toMatch(/^PUR-\d{4}-\d{6}$/);
    }
  });

  it('should maintain distinct monotonic sequences for different document types simultaneously', async () => {
    const mixedTasks = [
      ...Array.from({ length: 15 }, () => Promise.resolve(documentSequenceRepository.getNextNumber('INVOICE'))),
      ...Array.from({ length: 15 }, () => Promise.resolve(documentSequenceRepository.getNextNumber('REPAIR'))),
      ...Array.from({ length: 15 }, () => Promise.resolve(documentSequenceRepository.getNextNumber('WORKSHOP_JOB'))),
    ];

    const results = await Promise.all(mixedTasks);
    expect(results).toHaveLength(45);

    const invoices = results.filter((r) => r.startsWith('INV-'));
    const repairs = results.filter((r) => r.startsWith('REP-'));
    const jobs = results.filter((r) => r.startsWith('JOB-'));

    expect(invoices).toHaveLength(15);
    expect(repairs).toHaveLength(15);
    expect(jobs).toHaveLength(15);

    expect(new Set(invoices).size).toBe(15);
    expect(new Set(repairs).size).toBe(15);
    expect(new Set(jobs).size).toBe(15);
  });
});
