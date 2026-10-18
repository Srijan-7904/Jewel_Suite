import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import * as dbModule from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { girviService } from '../src/services/girvi.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { financeRepository } from '../src/repositories/finance.repository.js';
import { GirviLoanStatus, GirviPledgeStatus } from '../src/domain/girvi.js';
import { PartyType } from '../src/domain/finance.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite Part 9: Girvi Loan Domain & Lifecycle Unit Tests', () => {
  let testDb: DatabaseType;
  let customerId: string;

  beforeAll(() => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);

    const cust = customerRepository.create({
      name: 'Rahul Sharma (Girvi Client)',
      phone: '9876543210',
      city: 'Mumbai',
    });
    customerId = cust.id;
  });

  afterAll(() => {
    testDb.close();
  });

  it('should create loan with pledged item, calculate valuation and validate LTV', () => {
    // 10g net, 100% tunch, ₹7,000/g -> Valuation = ₹70,000
    // LTV 70% -> Max Loan = ₹49,000
    // Requesting ₹50,000 without override should fail
    expect(() =>
      girviService.createLoan({
        customer_id: customerId,
        loan_date: '2026-02-01',
        due_date: '2026-08-01',
        principal_amount: 50000.0, // Exceeds ₹49,000
        interest_rate: 2.0,
        interest_type: 'MONTHLY_PERCENT',
        ltv_percent: 70.0,
        items: [
          {
            description: '22K Gold Bangles (2 pcs)',
            gross_weight: 10.5,
            less_weight: 0.5, // Net = 10.0g
            tunch_percent: 100.0, // Fine = 10.0g
            valuation_rate: 7000.0, // Valuation = ₹70,000
          },
        ],
      })
    ).toThrow(BadRequestError);

    // Creating within LTV limit (₹45,000 <= ₹49,000) should succeed
    const loan = girviService.createLoan({
      customer_id: customerId,
      loan_date: '2026-02-01',
      due_date: '2026-08-01',
      principal_amount: 45000.0,
      interest_rate: 2.0,
      interest_type: 'MONTHLY_PERCENT',
      ltv_percent: 70.0,
      processing_fee: 500.0,
      items: [
        {
          description: '22K Gold Bangles (2 pcs)',
          gross_weight: 10.5,
          less_weight: 0.5,
          tunch_percent: 100.0,
          valuation_rate: 7000.0,
        },
      ],
    });

    expect(loan.status).toBe(GirviLoanStatus.DRAFT);
    expect(loan.principal_amount).toBe(45000.0);
    expect(loan.items).toHaveLength(1);
    expect(loan.items![0].fine_weight).toBe(10.0);
    expect(loan.items![0].valuation_amount).toBe(70000.0);
    expect(loan.items![0].status).toBe(GirviPledgeStatus.PLEDGED);
  });

  it('should disburse loan atomically, posting Finance Payment and Customer Ledger Debit', () => {
    const loan = girviService.createLoan({
      customer_id: customerId,
      loan_date: '2026-02-01',
      due_date: '2026-08-01',
      principal_amount: 40000.0,
      interest_rate: 2.0,
      interest_type: 'MONTHLY_PERCENT',
      ltv_percent: 70.0,
      items: [
        {
          description: 'Gold Chain',
          gross_weight: 10.0,
          less_weight: 0.0,
          tunch_percent: 100.0,
          valuation_rate: 7000.0,
        },
      ],
    });

    const balanceBefore = financeRepository.getLatestPartyBalance(PartyType.CUSTOMER, customerId);

    const disbursed = girviService.disburseLoan(loan.id, { payment_mode: 'CASH' });
    expect(disbursed.status).toBe(GirviLoanStatus.ACTIVE);
    expect(disbursed.disbursement_date).toBeTruthy();

    // Customer ledger receivable must have increased by loan principal
    const balanceAfter = financeRepository.getLatestPartyBalance(PartyType.CUSTOMER, customerId);
    expect(balanceAfter).toBe(Number((balanceBefore + 40000.0).toFixed(2)));

    // Ledger entries should contain the Girvi Loan Disbursement entry
    const ledger = financeRepository.findLedgerEntries({ party_type: PartyType.CUSTOMER, party_id: customerId });
    const entry = ledger.items.find((e) => e.reference_id === loan.id && e.debit_credit === 'DEBIT');
    expect(entry).toBeDefined();
    expect(entry!.amount).toBe(40000.0);
  });

  it('should process partial and full repayments, updating outstanding and closing loan', () => {
    // Principal ₹50,000 with override
    const loan = girviService.createLoan({
      customer_id: customerId,
      loan_date: '2026-02-01',
      due_date: '2026-08-01',
      principal_amount: 50000.0,
      interest_rate: 2.0,
      interest_type: 'MONTHLY_PERCENT',
      override_ltv: true,
      override_reason: 'Trusted customer gold pledge',
      disburse_immediately: true,
      items: [
        {
          description: 'Gold Necklace',
          gross_weight: 10.0,
          less_weight: 0.0,
          tunch_percent: 100.0,
          valuation_rate: 7000.0,
        },
      ],
    });

    expect(loan.status).toBe(GirviLoanStatus.ACTIVE);
    const initialOutstanding = loan.outstanding_amount;

    // Partial Repayment: ₹20,000 (Principal ₹18,000 + Interest ₹2,000)
    const afterPartial = girviService.recordRepayment(loan.id, {
      principal_amount: 18000.0,
      interest_amount: 2000.0,
      charges_amount: 0,
      payment_mode: 'UPI',
      reference_number: 'UPI987654321',
    });

    expect(afterPartial.status).toBe(GirviLoanStatus.PARTIALLY_PAID);
    expect(afterPartial.total_repaid).toBe(20000.0);
    expect(afterPartial.outstanding_amount).toBe(Number((initialOutstanding + 2000.0 - 20000.0).toFixed(2)));

    // Final Repayment to settle outstanding completely
    const remainingToPay = afterPartial.outstanding_amount;
    const afterFull = girviService.recordRepayment(loan.id, {
      principal_amount: remainingToPay,
      interest_amount: 0,
      charges_amount: 0,
      payment_mode: 'CASH',
    });

    expect(afterFull.outstanding_amount).toBe(0);
    expect(afterFull.status).toBe(GirviLoanStatus.CLOSED);

    // Release Pledged Items
    const afterRelease = girviService.releasePledge(loan.id, 'Customer collected physical ornaments in full');
    expect(afterRelease.items![0].status).toBe(GirviPledgeStatus.RELEASED);
    expect(afterRelease.pledge_events).toBeDefined();
    expect(afterRelease.pledge_events!.some((e) => e.event_type === 'RELEASED')).toBe(true);
  });

  it('should reject payment exceeding current outstanding balance (overpayment protection)', () => {
    const loan = girviService.createLoan({
      customer_id: customerId,
      due_date: '2026-08-01',
      principal_amount: 10000.0,
      interest_rate: 0,
      interest_type: 'FLAT_AMOUNT',
      override_ltv: true,
      disburse_immediately: true,
      items: [
        {
          description: 'Silver Plate',
          gross_weight: 100.0,
          less_weight: 0.0,
          tunch_percent: 100.0,
          valuation_rate: 100.0,
        },
      ],
    });

    // Outstanding is ₹10,000. Paying ₹15,000 must throw error
    expect(() =>
      girviService.recordRepayment(loan.id, {
        principal_amount: 15000.0,
        interest_amount: 0,
        charges_amount: 0,
        payment_mode: 'CASH',
      })
    ).toThrow(BadRequestError);
  });
});
