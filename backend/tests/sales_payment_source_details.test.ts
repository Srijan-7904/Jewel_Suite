import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import * as dbModule from '../src/database/connection/db.js';
import { getDb } from '../src/database/connection/db.js';
import { salesService } from '../src/services/sales.service.js';
import { salesRepository } from '../src/repositories/sales.repository.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { metalRepository } from '../src/repositories/metal.repository.js';
import { settingsService } from '../src/services/settings.service.js';
import { calculateSalesTotals } from '../src/utils/salesMath.js';
import { BadRequestError } from '../src/utils/errors.js';

describe('Jewel Suite: Invoice Payment Source, Payer Bank & Receiving Account Verification', () => {
  let testDb: DatabaseType;
  let customerAId: string;
  let customerBId: string;
  let gold22kRate: any;

  beforeEach(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    const custA = customerRepository.create({
      name: 'Customer A (Aarav Mehta)',
      phone: '9820011111',
      customer_type: 'RETAIL',
      address: 'Bandra, Mumbai',
    });
    customerAId = custA.id;

    const custB = customerRepository.create({
      name: 'Person B (Bharat Patel)',
      phone: '9820022222',
      customer_type: 'RETAIL',
      address: 'Zaveri Bazaar, Mumbai',
    });
    customerBId = custB.id;

    const rates = metalRepository.getCurrentRates();
    gold22kRate = rates.find((r) => r.metal_code === 'GOLD') || rates[0];
  });

  // -------------------------------------------------------------------------
  // Test 1: Customer pays from their own bank account
  // -------------------------------------------------------------------------
  it('1. Customer pays from their own bank account (Customer A from SBI to shop SBI)', () => {
    const invoice = salesService.createDraft({
      customer_id: customerAId,
      items: [
        {
          item_name: 'Gold Chain 22K',
          metal_id: gold22kRate.metal_id,
          purity_id: gold22kRate.purity_id,
          gross_weight: 10.0,
          less_weight: 0,
          tunch_percent: 91.6,
          rate_per_gram: 7000,
          making_charge: 3000,
          item_amount: 67120, // 9.16 * 7000 + 3000
        },
      ],
      payments: [
        {
          payment_mode: 'BANK',
          amount: 50000,
          payer_type: 'CUSTOMER',
          payer_name: 'Customer A (Aarav Mehta)',
          payer_bank: 'SBI Bank',
          received_in: 'SBI Current Account',
          reference_number: 'UTR-SELF-001',
          notes: 'Customer transferred from personal savings account',
        },
      ],
    });

    expect(invoice.customer_id).toBe(customerAId);
    expect(invoice.payments).toHaveLength(1);

    const payment = invoice.payments[0];
    expect(payment.payment_mode).toBe('BANK');
    expect(payment.amount).toBe(50000);
    expect(payment.payer_type).toBe('CUSTOMER');
    expect(payment.payer_name).toBe('Customer A (Aarav Mehta)');
    expect(payment.payer_bank).toBe('SBI Bank');
    expect(payment.received_in).toBe('SBI Current Account');
    expect(payment.reference_number).toBe('UTR-SELF-001');
  });

  // -------------------------------------------------------------------------
  // Test 2: Real-World Scenario — A third party pays on behalf of the invoice customer
  // -------------------------------------------------------------------------
  it("2. Real-world scenario: Invoice customer A, Person B transfers ₹25,000 from B's HDFC Bank into shop's SBI Current Account", () => {
    // Net Payable: ₹25,000. Customer: A. Payer: B. Payer Bank: HDFC Bank. Received in: SBI Current Account.
    const invoice = salesService.createDraft({
      customer_id: customerAId,
      items: [
        {
          item_name: 'Diamond Gold Pendant',
          metal_id: gold22kRate.metal_id,
          purity_id: gold22kRate.purity_id,
          gross_weight: 5.0,
          less_weight: 0.5,
          tunch_percent: 91.6,
          rate_per_gram: 7000,
          making_charge: 2000,
          item_amount: 30844,
        },
      ],
      payments: [
        {
          payment_mode: 'BANK',
          amount: 25000,
          payer_type: 'MANUAL_EXTERNAL',
          payer_name: 'Person B (Bharat Patel)',
          payer_bank: 'HDFC Bank',
          received_in: 'SBI Current Account',
          reference_number: 'UTR-HDFC-998877',
          notes: 'Transferred by brother B on behalf of customer A',
        },
      ],
    });

    // 1. Invoice MUST retain Customer A
    expect(invoice.customer_id).toBe(customerAId);
    expect(invoice.customer_name).toContain('Customer A');

    // 2. Payment entry separately records B, HDFC Bank, SBI Current Account
    expect(invoice.payments).toHaveLength(1);
    const payEntry = invoice.payments[0];
    expect(payEntry.payer_name).toBe('Person B (Bharat Patel)');
    expect(payEntry.payer_bank).toBe('HDFC Bank');
    expect(payEntry.received_in).toBe('SBI Current Account');
    expect(payEntry.payment_mode).toBe('BANK');
    expect(payEntry.amount).toBe(25000);
    expect(payEntry.reference_number).toBe('UTR-HDFC-998877');

    // 3. Finalize invoice: Customer A is debited for invoice total, credited for ₹25,000,
    // and payment voucher captures B's payment details.
    const finalized = salesService.finalizeSale(invoice.id);
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.customer_id).toBe(customerAId);
  });

  // -------------------------------------------------------------------------
  // Test 3: Multiple payment methods on one invoice
  // -------------------------------------------------------------------------
  it('3. Multiple payment methods on one invoice: ₹10,000 Cash, ₹15,000 3rd-Party Bank Transfer (HDFC->SBI), ₹5,000 UPI', () => {
    const invoice = salesService.createDraft({
      customer_id: customerAId,
      items: [
        {
          item_name: 'Gold Necklace',
          metal_id: gold22kRate.metal_id,
          purity_id: gold22kRate.purity_id,
          gross_weight: 15.0,
          less_weight: 0,
          tunch_percent: 91.6,
          rate_per_gram: 7000,
          making_charge: 5000,
          item_amount: 101180,
        },
      ],
      payments: [
        {
          payment_mode: 'CASH',
          amount: 10000,
          payer_type: 'CUSTOMER',
          received_in: 'Cash Counter',
          notes: 'Cash in counter drawer',
        },
        {
          payment_mode: 'BANK',
          amount: 15000,
          payer_type: 'MANUAL_EXTERNAL',
          payer_name: 'Person B',
          payer_bank: 'HDFC Bank',
          received_in: 'SBI Current Account',
          reference_number: 'UTR-HDFC-15000',
        },
        {
          payment_mode: 'UPI',
          amount: 5000,
          payer_type: 'CUSTOMER',
          payer_name: 'Customer A',
          received_in: 'Store Primary UPI / QR',
          reference_number: 'UPI-REF-5000',
        },
      ],
    });

    expect(invoice.payments).toHaveLength(3);

    // Row 1: Cash
    const cashRow = invoice.payments.find((p) => p.payment_mode === 'CASH')!;
    expect(cashRow.amount).toBe(10000);
    expect(cashRow.received_in).toBe('Cash Counter');
    expect(cashRow.payer_bank).toBeNull();

    // Row 2: Bank Transfer by Person B
    const bankRow = invoice.payments.find((p) => p.payment_mode === 'BANK')!;
    expect(bankRow.amount).toBe(15000);
    expect(bankRow.payer_name).toBe('Person B');
    expect(bankRow.payer_bank).toBe('HDFC Bank');
    expect(bankRow.received_in).toBe('SBI Current Account');
    expect(bankRow.reference_number).toBe('UTR-HDFC-15000');

    // Row 3: UPI
    const upiRow = invoice.payments.find((p) => p.payment_mode === 'UPI')!;
    expect(upiRow.amount).toBe(5000);
    expect(upiRow.received_in).toBe('Store Primary UPI / QR');
    expect(upiRow.reference_number).toBe('UPI-REF-5000');

    // Total Amount Received = 10,000 + 15,000 + 5,000 = 30,000 exactly once
    expect(invoice.amount_paid).toBe(30000);
  });

  // -------------------------------------------------------------------------
  // Test 4: Cash and UPI without unnecessary bank fields
  // -------------------------------------------------------------------------
  it('4. Cash and UPI without unnecessary bank fields', () => {
    const invoice = salesService.createDraft({
      customer_id: customerAId,
      items: [
        {
          item_name: 'Gold Ring',
          metal_id: gold22kRate.metal_id,
          purity_id: gold22kRate.purity_id,
          gross_weight: 4.0,
          less_weight: 0,
          tunch_percent: 91.6,
          rate_per_gram: 7000,
          making_charge: 1000,
          item_amount: 26648,
        },
      ],
      payments: [
        {
          payment_mode: 'CASH',
          amount: 10000,
          payer_type: 'CUSTOMER',
          received_in: 'Cash Counter',
          notes: 'Counter Cash received',
        },
        {
          payment_mode: 'UPI',
          amount: 5000,
          payer_type: 'CUSTOMER',
          received_in: 'Store Primary UPI / QR',
          reference_number: 'UPI-TXN-12345',
        },
      ],
    });

    const cashPay = invoice.payments.find((p) => p.payment_mode === 'CASH')!;
    expect(cashPay.payer_bank).toBeNull();
    expect(cashPay.received_in).toBe('Cash Counter');

    const upiPay = invoice.payments.find((p) => p.payment_mode === 'UPI')!;
    expect(upiPay.payer_bank).toBeNull();
    expect(upiPay.received_in).toBe('Store Primary UPI / QR');
    expect(upiPay.reference_number).toBe('UPI-TXN-12345');
  });

  // -------------------------------------------------------------------------
  // Test 5: Bank transfer with payer bank, receiving account and UTR
  // -------------------------------------------------------------------------
  it('5. Bank transfer with payer bank, receiving account and UTR', () => {
    const invoice = salesService.createDraft({
      customer_id: customerAId,
      items: [
        {
          item_name: 'Gold Bangle',
          metal_id: gold22kRate.metal_id,
          purity_id: gold22kRate.purity_id,
          gross_weight: 20.0,
          less_weight: 0,
          tunch_percent: 91.6,
          rate_per_gram: 7000,
          making_charge: 4000,
          item_amount: 132240,
        },
      ],
      payments: [
        {
          payment_mode: 'BANK',
          amount: 100000,
          payer_type: 'MANUAL_EXTERNAL',
          payer_name: 'Suresh Kumar (Friend)',
          payer_bank: 'ICICI Bank',
          received_in: 'HDFC Current Account',
          reference_number: 'UTR-ICICI-5544332211',
          notes: 'RTGS transfer',
        },
      ],
    });

    const p = invoice.payments[0];
    expect(p.payment_mode).toBe('BANK');
    expect(p.amount).toBe(100000);
    expect(p.payer_name).toBe('Suresh Kumar (Friend)');
    expect(p.payer_bank).toBe('ICICI Bank');
    expect(p.received_in).toBe('HDFC Current Account');
    expect(p.reference_number).toBe('UTR-ICICI-5544332211');
  });

  // -------------------------------------------------------------------------
  // Test 6: Correct total received and invoice balance calculation
  // -------------------------------------------------------------------------
  it('6. Correct total received and invoice balance: Net ₹35,000, payments ₹10,000 + ₹15,000 -> Balance ₹10,000', () => {
    const totals = calculateSalesTotals({
      items: [{ item_amount: 33980.58 }], // With 3% GST rounds to 35,000
      discount_amount: 0,
      gst_rate: 3,
      payments: [
        { amount: 10000 },
        { amount: 15000 },
      ],
    });

    expect(totals.net_payable).toBe(35000);
    expect(totals.amount_paid).toBe(25000);
    expect(totals.balance_amount).toBe(10000);
    expect(totals.change_due).toBe(0);
    expect(totals.is_settled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test 7: Save, reopen and print consistency
  // -------------------------------------------------------------------------
  it('7. Save, reopen and print consistency: details are saved, re-fetched and preserved', () => {
    const created = salesService.createDraft({
      customer_id: customerAId,
      items: [
        {
          item_name: 'Gold Earring Set',
          metal_id: gold22kRate.metal_id,
          purity_id: gold22kRate.purity_id,
          gross_weight: 8.0,
          less_weight: 0,
          tunch_percent: 91.6,
          rate_per_gram: 7000,
          making_charge: 2500,
          item_amount: 53832,
        },
      ],
      payments: [
        {
          payment_mode: 'BANK',
          amount: 30000,
          payer_type: 'MANUAL_EXTERNAL',
          payer_name: 'Uncle Rajesh',
          payer_bank: 'Kotak Mahindra Bank',
          received_in: 'SBI Current Account',
          reference_number: 'UTR-KOTAK-7788',
          notes: 'Wedding gift transfer',
        },
      ],
    });

    // Re-fetch (reopen invoice) from repository
    const reopened = salesService.getInvoiceDetails(created.id);
    expect(reopened.id).toBe(created.id);
    expect(reopened.customer_id).toBe(customerAId);
    expect(reopened.payments).toHaveLength(1);

    const rePay = reopened.payments[0];
    expect(rePay.payer_type).toBe('MANUAL_EXTERNAL');
    expect(rePay.payer_name).toBe('Uncle Rajesh');
    expect(rePay.payer_bank).toBe('Kotak Mahindra Bank');
    expect(rePay.received_in).toBe('SBI Current Account');
    expect(rePay.reference_number).toBe('UTR-KOTAK-7788');
    expect(rePay.notes).toBe('Wedding gift transfer');
  });

  // -------------------------------------------------------------------------
  // Test 8: Backward Compatibility — Existing invoices without payer-bank details remain readable
  // -------------------------------------------------------------------------
  it('8. Existing invoices without payer-bank details remain fully readable and intact', () => {
    // Insert raw legacy record directly into DB mimicking historical record prior to migration 013
    const db = getDb();
    const legacyInvId = 'legacy-inv-2025-001';
    db.prepare(`
      INSERT INTO sales_invoices (
        id, invoice_number, customer_id, invoice_date, grand_total, net_payable, amount_paid, balance_amount, status
      ) VALUES (?, 'INV-HISTORICAL-001', ?, '2025-01-15', 50000, 50000, 50000, 0, 'FINALIZED')
    `).run(legacyInvId, customerAId);

    const legacyPayId = 'legacy-pay-001';
    db.prepare(`
      INSERT INTO sales_invoice_payments (
        id, sales_invoice_id, payment_mode, amount, reference_number, notes, created_at
      ) VALUES (?, ?, 'CASH', 50000, 'HIST-REF-1', 'Legacy cash tender', '2025-01-15 10:30:00')
    `).run(legacyPayId, legacyInvId);

    // Read back through repository
    const payments = salesRepository.getPaymentsByInvoiceId(legacyInvId);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(50000);
    expect(payments[0].payment_mode).toBe('CASH');
    expect(payments[0].reference_number).toBe('HIST-REF-1');
    // Newly added columns are safely handled with defaults/null
    expect(payments[0].payer_type).toBe('CUSTOMER');
    expect(payments[0].payer_bank).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Extra Validation: Payer Name Required when Payer Type != 'CUSTOMER'
  // -------------------------------------------------------------------------
  it('Validation: requires payer_name when payer_type differs from invoice customer', () => {
    expect(() => {
      salesService.createDraft({
        customer_id: customerAId,
        items: [
          {
            item_name: 'Gold Ring',
            metal_id: gold22kRate.metal_id,
            purity_id: gold22kRate.purity_id,
            gross_weight: 4.0,
            less_weight: 0,
            tunch_percent: 91.6,
            rate_per_gram: 7000,
            item_amount: 25648,
          },
        ],
        payments: [
          {
            payment_mode: 'BANK',
            amount: 25000,
            payer_type: 'MANUAL_EXTERNAL',
            payer_name: '', // Empty payer name should fail validation
          },
        ],
      });
    }).toThrow();
  });

  // -------------------------------------------------------------------------
  // Settings Integration: Shop Receiving Accounts
  // -------------------------------------------------------------------------
  it('Settings: getReceivingAccounts returns default accounts and allows updating', () => {
    const defaultAccounts = settingsService.getReceivingAccounts();
    expect(defaultAccounts.length).toBeGreaterThanOrEqual(3);

    const cashAcc = defaultAccounts.find((a) => a.account_type === 'CASH');
    expect(cashAcc).toBeDefined();
    expect(cashAcc?.account_name).toBe('Cash Counter');

    const bankAcc = defaultAccounts.find((a) => a.account_type === 'BANK');
    expect(bankAcc).toBeDefined();

    // Update receiving accounts
    const updated = settingsService.updateReceivingAccounts([
      ...defaultAccounts,
      {
        id: 'acc-custom-icici',
        account_name: 'ICICI Current Account',
        account_type: 'BANK',
        bank_name: 'ICICI Bank',
        account_number: '1234567890',
        ifsc: 'ICIC0001234',
        is_active: true,
      },
    ]);

    expect(updated.some((a) => a.account_name === 'ICICI Current Account')).toBe(true);

    // Verify persisted
    const fetched = settingsService.getReceivingAccounts();
    expect(fetched.some((a) => a.account_name === 'ICICI Current Account')).toBe(true);
  });
});
