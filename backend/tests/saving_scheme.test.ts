import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import * as dbModule from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { savingSchemeService } from '../src/services/savingScheme.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { financeRepository } from '../src/repositories/finance.repository.js';
import { SavingSchemeStatus, InstallmentStatus } from '../src/domain/savingScheme.js';
import { PartyType } from '../src/domain/finance.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite Part 9: Saving Scheme Domain & Lifecycle Unit Tests', () => {
  let testDb: DatabaseType;
  let customerId: string;
  let schemeTypeId: string;

  beforeAll(() => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);

    const cust = customerRepository.create({
      name: 'Pooja Verma (Saving Scheme Customer)',
      phone: '9876543211',
      city: 'Delhi',
    });
    customerId = cust.id;

    // Fetch seeded scheme type (Swarna 11+1 5k)
    const types = savingSchemeService.listTypes();
    expect(types.length).toBeGreaterThan(0);
    const swarna5k = types.find((t) => t.installment_amount === 5000.0) || types[0];
    schemeTypeId = swarna5k.id;
  });

  afterAll(() => {
    testDb.close();
  });

  it('should enroll customer and generate full schedule of monthly installments', () => {
    const scheme = savingSchemeService.enrollCustomer({
      customer_id: customerId,
      scheme_type_id: schemeTypeId,
      start_date: '2026-01-10',
    });

    expect(scheme.scheme_number).toMatch(/^SCH-\d{4}-\d{6}$/);
    expect(scheme.status).toBe(SavingSchemeStatus.ACTIVE);
    expect(scheme.installment_amount).toBe(5000.0);
    expect(scheme.total_installments).toBe(11);
    expect(scheme.paid_installments).toBe(0);
    expect(scheme.paid_amount).toBe(0);

    expect(scheme.installments).toHaveLength(11);
    expect(scheme.installments![0].installment_number).toBe(1);
    expect(scheme.installments![0].status).toBe(InstallmentStatus.PENDING);
    expect(scheme.installments![0].amount_due).toBe(5000.0);
    expect(scheme.installments![0].due_date).toBe('2026-01-10');
  });

  it('should process full installment payment with atomic finance receipt & customer ledger credit', () => {
    const scheme = savingSchemeService.enrollCustomer({
      customer_id: customerId,
      scheme_type_id: schemeTypeId,
      start_date: '2026-01-10',
    });

    const firstInst = scheme.installments![0];
    const customerBalBefore = financeRepository.getLatestPartyBalance(PartyType.CUSTOMER, customerId);

    const result = savingSchemeService.payInstallment(scheme.id, firstInst.id, {
      amount: 5000.0,
      payment_mode: 'UPI',
      reference_number: 'UPI-SCH-001',
    });

    expect(result.scheme.paid_installments).toBe(1);
    expect(result.scheme.paid_amount).toBe(5000.0);

    const updatedInst = result.installment as any;
    expect(updatedInst.status).toBe(InstallmentStatus.PAID);
    expect(updatedInst.amount_paid).toBe(5000.0);

    // Customer ledger should reflect a credit of ₹5,000
    const customerBalAfter = financeRepository.getLatestPartyBalance(PartyType.CUSTOMER, customerId);
    expect(customerBalAfter).toBe(Number((customerBalBefore - 5000.0).toFixed(2)));

    // Verify voucher
    const payments = financeRepository.findPayments({ party_type: PartyType.CUSTOMER, party_id: customerId });
    const receipt = payments.items.find((p) => p.reference_id === scheme.id);
    expect(receipt).toBeDefined();
    expect(receipt!.payment_type).toBe('RECEIPT');
    expect(receipt!.amount).toBe(5000.0);
  });

  it('should support partial installment payment with remaining balance tracking', () => {
    const scheme = savingSchemeService.enrollCustomer({
      customer_id: customerId,
      scheme_type_id: schemeTypeId,
      start_date: '2026-01-10',
    });

    const firstInst = scheme.installments![0];

    // Pay ₹2,500 of ₹5,000 due
    const result = savingSchemeService.payInstallment(scheme.id, firstInst.id, {
      amount: 2500.0,
      payment_mode: 'CASH',
    });

    const updatedInst = result.installment as any;
    expect(updatedInst.status).toBe(InstallmentStatus.PARTIAL);
    expect(updatedInst.amount_paid).toBe(2500.0);
    expect(result.scheme.paid_amount).toBe(2500.0);
    expect(result.scheme.paid_installments).toBe(0); // Not fully paid yet

    // Complete the remaining ₹2,500
    const secondResult = savingSchemeService.payInstallment(scheme.id, firstInst.id, {
      amount: 2500.0,
      payment_mode: 'CASH',
    });

    const finalInst = secondResult.installment as any;
    expect(finalInst.status).toBe(InstallmentStatus.PAID);
    expect(finalInst.amount_paid).toBe(5000.0);
    expect(secondResult.scheme.paid_installments).toBe(1);
    expect(secondResult.scheme.paid_amount).toBe(5000.0);
  });

  it('should reject payment exceeding installment amount due', () => {
    const scheme = savingSchemeService.enrollCustomer({
      customer_id: customerId,
      scheme_type_id: schemeTypeId,
      start_date: '2026-01-10',
    });

    const firstInst = scheme.installments![0];

    // Paying ₹6,000 on a ₹5,000 installment should throw BadRequestError
    expect(() =>
      savingSchemeService.payInstallment(scheme.id, firstInst.id, {
        amount: 6000.0,
        payment_mode: 'CASH',
      })
    ).toThrow(BadRequestError);
  });

  it('should mature scheme with bonus calculation', () => {
    const scheme = savingSchemeService.enrollCustomer({
      customer_id: customerId,
      scheme_type_id: schemeTypeId,
      start_date: '2026-01-10',
    });

    // Pay all 11 installments
    for (const inst of scheme.installments!) {
      savingSchemeService.payInstallment(scheme.id, inst.id, {
        amount: 5000.0,
        payment_mode: 'CASH',
      });
    }

    const matured = savingSchemeService.matureScheme(scheme.id, 'Customer eligible for bonus');
    expect(matured.status).toBe(SavingSchemeStatus.MATURED);
    expect(matured.paid_amount).toBe(55000.0);
    // Swarna 11+1 Bonus Plan gives 1 bonus installment (₹5,000) -> ₹60,000 total maturity
    expect(matured.maturity_amount).toBe(60000.0);
    expect(matured.maturity_payout_date).toBeTruthy();
  });
});
