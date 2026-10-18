// backend/tests/finance.test.ts
// Jewel Suite Part 8: Finance, Cr/Dr Ledger & Payments Core Logic Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import * as dbModule from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { financeRepository } from '../src/repositories/finance.repository.js';
import { financeService } from '../src/services/finance.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { supplierRepository } from '../src/repositories/supplier.repository.js';
import { karigarRepository } from '../src/repositories/karigar.repository.js';
import { PartyType, EntryType, DebitCredit, PaymentType, PaymentMode, calculateNextBalance } from '../src/domain/finance.js';

describe('Jewel Suite Part 8: Finance Domain & Ledger Unit Tests', () => {
  let testDb: DatabaseType;
  let customerId: string;
  let supplierId: string;
  let karigarId: string;

  beforeAll(() => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);

    // Seed test customer
    const cust = customerRepository.create({
      name: 'Ramesh Verma',
      phone: '9898001122',
      customer_type: 'RETAIL',
      opening_balance: 0,
      opening_balance_type: 'DEBIT',
    });
    customerId = cust.id;

    // Seed test supplier
    const supp = supplierRepository.create({
      name: 'MMTC Bullion Refiners',
      phone: '9898003344',
    });
    supplierId = supp.id;

    // Seed test karigar
    const kar = karigarRepository.create({
      name: 'Mahesh Master Goldsmith',
      phone: '9898005566',
      specialization: 'GOLD',
    });
    karigarId = kar.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb) {
      testDb.close();
    }
  });

  it('calculateNextBalance should calculate customer debit/credit balance correctly', () => {
    // Customer: Debits increase receivable; Credits decrease receivable
    let balance = 0;
    balance = calculateNextBalance(PartyType.CUSTOMER, balance, DebitCredit.DEBIT, 100000);
    expect(balance).toBe(100000); // Customer owes 100,000

    balance = calculateNextBalance(PartyType.CUSTOMER, balance, DebitCredit.CREDIT, 70000);
    expect(balance).toBe(30000); // Outstanding is 30,000
  });

  it('calculateNextBalance should calculate supplier credit/debit payable balance correctly', () => {
    // Supplier: Credits increase payable; Debits decrease payable
    let balance = 0;
    balance = calculateNextBalance(PartyType.SUPPLIER, balance, DebitCredit.CREDIT, 100000);
    expect(balance).toBe(100000); // Shop owes supplier 100,000

    balance = calculateNextBalance(PartyType.SUPPLIER, balance, DebitCredit.DEBIT, 60000);
    expect(balance).toBe(40000); // Payable is 40,000
  });

  it('Customer Ledger: Sale ₹100,000, Payment ₹70,000 -> Outstanding ₹30,000', () => {
    // 1. Post Sale Debit ₹100,000
    const entry1 = financeRepository.createLedgerEntry({
      party_type: PartyType.CUSTOMER,
      party_id: customerId,
      entry_type: EntryType.SALE,
      debit_credit: DebitCredit.DEBIT,
      amount: 100000.0,
      reference_type: 'SALES_INVOICE',
      reference_number: 'INV-2026-000001',
      description: 'Retail Gold Jewellery Sale',
    });

    expect(entry1.balance_before).toBe(0);
    expect(entry1.balance_after).toBe(100000);
    expect(entry1.amount).toBe(100000);

    // 2. Post Payment Receipt Credit ₹70,000
    const res = financeService.recordPayment({
      party_type: PartyType.CUSTOMER,
      party_id: customerId,
      payment_type: PaymentType.RECEIPT,
      payment_mode: PaymentMode.CASH,
      amount: 70000.0,
      notes: 'Partial cash payment against invoice',
    });

    expect(res.payment.payment_number).toMatch(/^REC-\d{4}-\d{6}$/);
    expect(res.ledger_entry.balance_before).toBe(100000);
    expect(res.ledger_entry.balance_after).toBe(30000);

    // Verify current party balance
    const currentBalance = financeRepository.getLatestPartyBalance(PartyType.CUSTOMER, customerId);
    expect(currentBalance).toBe(30000.0);
  });

  it('Supplier Ledger: Purchase ₹100,000, Payment ₹60,000 -> Payable ₹40,000', () => {
    // 1. Post Purchase Credit ₹100,000
    const entry1 = financeRepository.createLedgerEntry({
      party_type: PartyType.SUPPLIER,
      party_id: supplierId,
      entry_type: EntryType.PURCHASE,
      debit_credit: DebitCredit.CREDIT,
      amount: 100000.0,
      reference_type: 'PURCHASE_BILL',
      reference_number: 'PUR-2026-000001',
      description: 'Gold Bullion Purchase',
    });

    expect(entry1.balance_before).toBe(0);
    expect(entry1.balance_after).toBe(100000);

    // 2. Post Payment to Supplier Debit ₹60,000
    const res = financeService.recordPayment({
      party_type: PartyType.SUPPLIER,
      party_id: supplierId,
      payment_type: PaymentType.PAYMENT,
      payment_mode: PaymentMode.BANK,
      amount: 60000.0,
      reference_number: 'NEFT99887766',
      notes: 'Supplier bank transfer',
    });

    expect(res.payment.payment_number).toMatch(/^PAY-\d{4}-\d{6}$/);
    expect(res.ledger_entry.balance_before).toBe(100000);
    expect(res.ledger_entry.balance_after).toBe(40000);

    const currentPayable = financeRepository.getLatestPartyBalance(PartyType.SUPPLIER, supplierId);
    expect(currentPayable).toBe(40000.0);
  });

  it('Karigar Ledger: Labour ₹20,000, Payment ₹10,000 -> Payable ₹10,000', () => {
    // 1. Post Karigar Labour Credit ₹20,000
    const entry1 = financeRepository.createLedgerEntry({
      party_type: PartyType.KARIGAR,
      party_id: karigarId,
      entry_type: EntryType.KARIGAR_LABOUR,
      debit_credit: DebitCredit.CREDIT,
      amount: 20000.0,
      reference_type: 'WORKSHOP_JOB',
      reference_number: 'JOB-2026-000001',
      description: 'Bridal necklace crafting labour',
    });

    expect(entry1.balance_before).toBe(0);
    expect(entry1.balance_after).toBe(20000);

    // 2. Post Karigar Payment Debit ₹10,000
    const res = financeService.recordPayment({
      party_type: PartyType.KARIGAR,
      party_id: karigarId,
      payment_type: PaymentType.PAYMENT,
      payment_mode: PaymentMode.CASH,
      amount: 10000.0,
      notes: 'Weekly artisan labour advance payment',
    });

    expect(res.payment.payment_number).toMatch(/^PAY-\d{4}-\d{6}$/);
    expect(res.ledger_entry.balance_before).toBe(20000);
    expect(res.ledger_entry.balance_after).toBe(10000);

    const currentPayable = financeRepository.getLatestPartyBalance(PartyType.KARIGAR, karigarId);
    expect(currentPayable).toBe(10000.0);
  });

  it('Cash Book: calculates cash in, cash out, and running cash balance', () => {
    // So far in this test:
    // - Customer paid Cash: +₹70,000
    // - Supplier paid Bank: ₹60,000 (Non-cash, excluded from Cash Book)
    // - Karigar paid Cash: -₹10,000
    // Expected Cash Balance = 70,000 - 10,000 = ₹60,000!

    const cashBook = financeService.getCashBook({});
    expect(cashBook.total_cash_in).toBe(70000.0);
    expect(cashBook.total_cash_out).toBe(10000.0);
    expect(cashBook.closing_balance).toBe(60000.0);
  });

  it('Overpayment Protection: rejects payment greater than outstanding balance', () => {
    // Customer current balance is ₹30,000
    expect(() => {
      financeService.recordPayment({
        party_type: PartyType.CUSTOMER,
        party_id: customerId,
        payment_type: PaymentType.RECEIPT,
        payment_mode: PaymentMode.CASH,
        amount: 35000.0, // Exceeds 30,000
      });
    }).toThrow(/exceeds current outstanding receivable balance/);

    // Balance remains unchanged at 30,000
    const currentBalance = financeRepository.getLatestPartyBalance(PartyType.CUSTOMER, customerId);
    expect(currentBalance).toBe(30000.0);
  });

  it('Payment Transaction Rollback: atomic failure guarantees no partial entries', () => {
    const initialPaymentsCount = (testDb.prepare('SELECT COUNT(*) as c FROM payments').get() as any).c;
    const initialLedgerCount = (testDb.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as any).c;

    // Simulate an error during payment processing by sending invalid electronic payment without reference
    expect(() => {
      financeService.recordPayment({
        party_type: PartyType.CUSTOMER,
        party_id: customerId,
        payment_type: PaymentType.RECEIPT,
        payment_mode: PaymentMode.UPI,
        amount: 5000.0,
        reference_number: '', // Will fail validation
      });
    }).toThrow();

    const postPaymentsCount = (testDb.prepare('SELECT COUNT(*) as c FROM payments').get() as any).c;
    const postLedgerCount = (testDb.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as any).c;

    expect(postPaymentsCount).toBe(initialPaymentsCount);
    expect(postLedgerCount).toBe(initialLedgerCount);
  });

  it('Immutability: Ledger entries cannot be deleted or modified through service', () => {
    // Verify financeService does NOT expose any deleteLedgerEntry or updateLedgerEntry
    expect((financeService as any).deleteLedgerEntry).toBeUndefined();
    expect((financeService as any).updateLedgerEntry).toBeUndefined();

    // Verify adjustments are used instead
    const adjustment = financeService.recordAdjustment({
      party_type: PartyType.CUSTOMER,
      party_id: customerId,
      amount: 500.0,
      direction: DebitCredit.CREDIT,
      reason: 'Festive goodwill round-off discount',
    });

    expect(adjustment.entry_type).toBe(EntryType.ADJUSTMENT);
    expect(adjustment.balance_before).toBe(30000.0);
    expect(adjustment.balance_after).toBe(29500.0);
  });

  it('Dashboard Summary: computes live totals from ledger without hardcoded values', () => {
    const summary = financeService.getFinanceSummary();
    expect(summary.total_receivables).toBe(29500.0);
    expect(summary.supplier_payables).toBe(40000.0);
    expect(summary.karigar_payables).toBe(10000.0);
    expect(summary.total_payables).toBe(50000.0);
    expect(summary.cash_balance).toBe(60000.0);
  });
});
