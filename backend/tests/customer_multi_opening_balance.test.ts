// backend/tests/customer_multi_opening_balance.test.ts
// Jewel Suite: Multi-Type Opening Balance for Customer Creation Tests

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';

import { customerService } from '../src/services/customer.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { financeService } from '../src/services/finance.service.js';
import { financeRepository } from '../src/repositories/finance.repository.js';
import { rateService } from '../src/services/rate.service.js';
import { DebitCredit, EntryType, PaymentMode, MetalEntryType } from '../src/domain/finance.js';

describe('Jewel Suite: Multi-Type Opening Balance in Customer Creation', () => {
  let testDb: DatabaseType;
  let gold22kPurityId: string;
  let silver925PurityId: string;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    // Look up seeded purities for test fixtures
    const metals = rateService.getMetals();
    const goldMetal = metals.find((m) => m.code === 'GOLD')!;
    const silverMetal = metals.find((m) => m.code === 'SILVER')!;

    const goldPurities = rateService.getPuritiesByMetal(goldMetal.id);
    const silverPurities = rateService.getPuritiesByMetal(silverMetal.id);

    gold22kPurityId = goldPurities.find((p) => p.code === '22K')!.id;
    silver925PurityId = silverPurities.find((p) => p.code === '925')!.id;
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb && testDb.open) {
      testDb.close();
    }
  });

  // 1. Zero Opening Balance
  it('creates customer with zero opening balance safely and creates no ledger entries', () => {
    const customer = customerService.create({
      name: 'Zero Balance Customer',
      phone: '9876543210',
      customer_type: 'RETAIL',
      opening_balance: 0,
      opening_cash_balance: 0,
      opening_bank_balance: 0,
      opening_gold_weight: 0,
      opening_silver_weight: 0,
    });

    expect(customer.id).toBeDefined();
    expect(customer.opening_balance).toBe(0);
    expect(customer.current_balance).toBe(0);
    expect(customer.gold_balance_grams).toBe(0);
    expect(customer.silver_balance_grams).toBe(0);

    const statement = financeService.getPartyStatement('CUSTOMER', customer.id);
    expect(statement.current_balance).toBe(0);
    expect(statement.total_debit).toBe(0);
    expect(statement.total_credit).toBe(0);

    const metalBalances = financeService.getPartyMetalBalances('CUSTOMER', customer.id);
    const gold = metalBalances.find((m) => m.metal_code === 'GOLD');
    const silver = metalBalances.find((m) => m.metal_code === 'SILVER');
    expect(gold?.balance_grams).toBe(0);
    expect(silver?.balance_grams).toBe(0);
  });

  // 2. Cash Opening Balance Only (DEBIT = Customer Owes Us)
  it('creates customer with Cash opening balance (Customer Owes Us) and posts to ledger', () => {
    const customer = customerService.create({
      name: 'Cash Debit Customer',
      phone: '9811122233',
      customer_type: 'RETAIL',
      opening_balance_date: '2026-10-01',
      opening_balance_ref: 'REF-CASH-01',
      opening_balance_notes: 'Brought forward from manual khata',
      opening_cash_balance: 25000.50,
      opening_cash_type: 'DEBIT',
    });

    expect(customer.opening_cash_balance).toBe(25000.50);
    expect(customer.opening_cash_type).toBe('DEBIT');
    expect(customer.opening_balance).toBe(25000.50);
    expect(customer.opening_balance_type).toBe('DEBIT');
    expect(customer.current_balance).toBe(25000.50);

    const statement = financeService.getPartyStatement('CUSTOMER', customer.id);
    expect(statement.current_balance).toBe(25000.50);
    expect(statement.total_debit).toBe(25000.50);
    expect(statement.total_credit).toBe(0);

    const ledger = financeService.getLedgerEntries({ party_type: 'CUSTOMER', party_id: customer.id });
    expect(ledger.items.length).toBe(1);
    expect(ledger.items[0].entry_type).toBe(EntryType.OPENING_BALANCE);
    expect(ledger.items[0].debit_credit).toBe(DebitCredit.DEBIT);
    expect(ledger.items[0].amount).toBe(25000.50);
    expect(ledger.items[0].payment_method).toBe(PaymentMode.CASH);
    expect(ledger.items[0].reference_number).toBe('REF-CASH-01');
    expect(ledger.items[0].description).toContain('Brought forward from manual khata');
  });

  // 3. Cash Opening Balance Only (CREDIT = We Owe Customer / Advance)
  it('creates customer with Cash advance opening balance (We Owe Customer)', () => {
    const customer = customerService.create({
      name: 'Advance Deposit Customer',
      phone: '9822233344',
      customer_type: 'RETAIL',
      opening_cash_balance: 15000,
      opening_cash_type: 'CREDIT',
    });

    expect(customer.opening_cash_balance).toBe(15000);
    expect(customer.opening_cash_type).toBe('CREDIT');
    expect(customer.opening_balance).toBe(15000);
    expect(customer.opening_balance_type).toBe('CREDIT');
    expect(customer.current_balance).toBe(-15000); // Negative indicates store credit / payable

    const statement = financeService.getPartyStatement('CUSTOMER', customer.id);
    expect(statement.current_balance).toBe(-15000);
    expect(statement.total_credit).toBe(15000);
  });

  // 4. Bank / RTGS Opening Balance
  it('creates customer with Bank/RTGS opening balance', () => {
    const customer = customerService.create({
      name: 'Bank RTGS Customer',
      phone: '9833344455',
      customer_type: 'WHOLESALE',
      opening_bank_balance: 50000,
      opening_bank_type: 'DEBIT',
      opening_balance_ref: 'NEFT-OB-99',
    });

    expect(customer.opening_bank_balance).toBe(50000);
    expect(customer.opening_bank_type).toBe('DEBIT');
    expect(customer.current_balance).toBe(50000);

    const ledger = financeService.getLedgerEntries({ party_type: 'CUSTOMER', party_id: customer.id });
    expect(ledger.items.length).toBe(1);
    expect(ledger.items[0].payment_method).toBe(PaymentMode.BANK);
    expect(ledger.items[0].amount).toBe(50000);
  });

  // 5. Gold Opening Balance with Karat Purity and Fractional Grams
  it('creates customer with Gold opening balance, purity, and fractional grams', () => {
    const customer = customerService.create({
      name: 'Gold Metal Customer',
      phone: '9844455566',
      customer_type: 'RETAIL',
      opening_gold_weight: 12.4565,
      opening_gold_type: 'DEBIT', // Customer owes us 12.4565g
      opening_gold_purity_id: gold22kPurityId,
      opening_gold_rate: 7190,
      opening_gold_value: 0, // Auto-computed from rate * weight
    });

    expect(customer.opening_gold_weight).toBe(12.4565);
    expect(customer.opening_gold_type).toBe('DEBIT');
    expect(customer.opening_gold_rate).toBe(7190);
    // Value = 12.4565 * 7190 = 89562.235 => 89562.24
    expect(customer.opening_gold_value).toBeCloseTo(89562.24, 2);
    expect(customer.gold_balance_grams).toBe(12.4565);

    // Verify metal ledger entry
    const metalBalances = financeService.getPartyMetalBalances('CUSTOMER', customer.id);
    const gold = metalBalances.find((m) => m.metal_code === 'GOLD');
    expect(gold?.balance_grams).toBe(12.4565);

    const metalLedger = financeService.getPartyMetalLedger('CUSTOMER', customer.id);
    expect(metalLedger.items.length).toBe(1);
    const entry = metalLedger.items[0];
    expect(entry.entry_type).toBe(MetalEntryType.OPENING_BALANCE);
    expect(entry.debit_credit).toBe(DebitCredit.DEBIT);
    expect(entry.weight).toBe(12.4565);
    expect(entry.purity_name).toBe('22 Karat 916');
    expect(entry.fine_weight).toBeCloseTo(12.4565 * (91.67 / 100), 3);
    expect(entry.balance_before).toBe(0);
    expect(entry.balance_after).toBe(12.4565);
  });

  // 6. Silver Opening Balance with Purity
  it('creates customer with Silver opening balance (Shop owes customer metal / CREDIT)', () => {
    const customer = customerService.create({
      name: 'Silver Credit Customer',
      phone: '9855566677',
      customer_type: 'RETAIL',
      opening_silver_weight: 250.75,
      opening_silver_type: 'CREDIT', // Shop owes customer 250.75g silver
      opening_silver_purity_id: silver925PurityId,
      opening_silver_rate: 94.50,
    });

    expect(customer.opening_silver_weight).toBe(250.75);
    expect(customer.opening_silver_type).toBe('CREDIT');
    expect(customer.silver_balance_grams).toBe(-250.75); // Shop owes customer

    const metalBalances = financeService.getPartyMetalBalances('CUSTOMER', customer.id);
    const silver = metalBalances.find((m) => m.metal_code === 'SILVER');
    expect(silver?.balance_grams).toBe(-250.75);

    const metalLedger = financeService.getPartyMetalLedger('CUSTOMER', customer.id);
    expect(metalLedger.items.length).toBe(1);
    expect(metalLedger.items[0].debit_credit).toBe(DebitCredit.CREDIT);
    expect(metalLedger.items[0].balance_after).toBe(-250.75);
  });

  // 7. Multi-Type Combination: Cash, Bank, Gold, and Silver with Independent Directions
  it('supports simultaneous Cash, Bank, Gold, and Silver opening balances with independent directions', () => {
    const customer = customerService.create({
      name: 'Omni Balance Customer',
      phone: '9866677788',
      customer_type: 'WHOLESALE',
      opening_balance_date: '2026-10-15',
      opening_balance_ref: 'OMNI-SETTLE-01',
      opening_balance_notes: 'Consolidated opening ledger',
      
      // Monetary: Cash Dr 20,000, Bank Cr 5,000 => Net Dr 15,000
      opening_cash_balance: 20000,
      opening_cash_type: 'DEBIT',
      opening_bank_balance: 5000,
      opening_bank_type: 'CREDIT',

      // Metals: Gold Dr 8.5g (Customer owes), Silver Cr 100g (Shop owes)
      opening_gold_weight: 8.5,
      opening_gold_type: 'DEBIT',
      opening_gold_purity_id: gold22kPurityId,
      opening_gold_rate: 7190,

      opening_silver_weight: 100,
      opening_silver_type: 'CREDIT',
      opening_silver_purity_id: silver925PurityId,
      opening_silver_rate: 94.50,
    });

    // Check Customer Record Fields
    expect(customer.opening_balance).toBe(15000);
    expect(customer.opening_balance_type).toBe('DEBIT');
    expect(customer.current_balance).toBe(15000);
    expect(customer.gold_balance_grams).toBe(8.5);
    expect(customer.silver_balance_grams).toBe(-100);

    // Verify Monetary Ledger Entries: 2 separate entries (1 Cash Dr, 1 Bank Cr)
    const monetaryLedger = financeService.getLedgerEntries({ party_type: 'CUSTOMER', party_id: customer.id });
    expect(monetaryLedger.items.length).toBe(2);
    
    const cashEntry = monetaryLedger.items.find((e) => e.payment_method === PaymentMode.CASH);
    const bankEntry = monetaryLedger.items.find((e) => e.payment_method === PaymentMode.BANK);
    
    expect(cashEntry?.debit_credit).toBe(DebitCredit.DEBIT);
    expect(cashEntry?.amount).toBe(20000);

    expect(bankEntry?.debit_credit).toBe(DebitCredit.CREDIT);
    expect(bankEntry?.amount).toBe(5000);

    // Verify Metal Ledger Entries: 2 separate entries (1 Gold Dr, 1 Silver Cr)
    const metalLedger = financeService.getPartyMetalLedger('CUSTOMER', customer.id);
    expect(metalLedger.items.length).toBe(2);

    const goldEntry = metalLedger.items.find((e) => e.metal_code === 'GOLD');
    const silverEntry = metalLedger.items.find((e) => e.metal_code === 'SILVER');

    expect(goldEntry?.debit_credit).toBe(DebitCredit.DEBIT);
    expect(goldEntry?.weight).toBe(8.5);

    expect(silverEntry?.debit_credit).toBe(DebitCredit.CREDIT);
    expect(silverEntry?.weight).toBe(100);

    // Verify findById reloads exact values without drift
    const reloaded = customerRepository.findById(customer.id)!;
    expect(reloaded.current_balance).toBe(15000);
    expect(reloaded.gold_balance_grams).toBe(8.5);
    expect(reloaded.silver_balance_grams).toBe(-100);
    expect(reloaded.opening_gold_purity_name).toBe('22 Karat 916');
    expect(reloaded.opening_silver_purity_name).toBe('Sterling Silver 925');
  });

  // 8. Subsequent Payment Integration
  it('correctly reduces outstanding balance when subsequent payment is received', () => {
    // Customer starts with Cash Opening Balance ₹10,000 Dr
    const customer = customerService.create({
      name: 'Paying Customer',
      phone: '9877788899',
      customer_type: 'RETAIL',
      opening_cash_balance: 10000,
      opening_cash_type: 'DEBIT',
    });

    expect(customer.current_balance).toBe(10000);

    // Customer pays ₹4,000 via UPI
    const receipt = financeService.recordPayment({
      party_type: 'CUSTOMER',
      party_id: customer.id,
      payment_type: 'RECEIPT',
      payment_mode: 'UPI',
      amount: 4000,
      reference_number: 'UPI-TXN-101',
    });

    expect(receipt.payment.amount).toBe(4000);
    expect(receipt.ledger_entry.balance_after).toBe(6000);

    // Customer balance now ₹6,000
    const reloaded = customerRepository.findById(customer.id)!;
    expect(reloaded.current_balance).toBe(6000);

    // Statement verification
    const statement = financeService.getPartyStatement('CUSTOMER', customer.id);
    expect(statement.total_debit).toBe(10000);
    expect(statement.total_credit).toBe(4000);
    expect(statement.current_balance).toBe(6000);
  });

  // 9. Validation of Negative Amounts and Weights
  it('rejects negative amounts or negative weights', () => {
    expect(() => {
      customerService.create({
        name: 'Invalid Negative Cash',
        opening_cash_balance: -500,
      });
    }).toThrow();

    expect(() => {
      customerService.create({
        name: 'Invalid Negative Weight',
        opening_gold_weight: -2.5,
      });
    }).toThrow();

    expect(() => {
      customerService.create({
        name: 'Invalid Date',
        opening_balance_date: 'invalid-date',
      });
    }).toThrow();
  });

  // 10. Backward Compatibility for Legacy Customer Creation
  it('preserves backward compatibility when only opening_balance and opening_balance_type are provided', () => {
    const customer = customerService.create({
      name: 'Legacy Customer',
      phone: '9888899900',
      opening_balance: 12500,
      opening_balance_type: 'DEBIT',
    });

    expect(customer.opening_balance).toBe(12500);
    expect(customer.opening_cash_balance).toBe(12500);
    expect(customer.current_balance).toBe(12500);

    const ledger = financeService.getLedgerEntries({ party_type: 'CUSTOMER', party_id: customer.id });
    expect(ledger.items.length).toBe(1);
    expect(ledger.items[0].amount).toBe(12500);
  });
});
