// backend/src/services/finance.service.ts
// Jewel Suite: Central Finance Business Logic & Orchestration

import { z } from 'zod';
import {
  financeRepository,
  PaymentRecord,
  LedgerEntryRecord,
  LedgerQueryParams,
  PaymentQueryParams,
  CashBookQueryParams,
} from '../repositories/finance.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import { karigarRepository } from '../repositories/karigar.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction } from '../database/connection/db.js';
import { PartyType, EntryType, DebitCredit, PaymentType, PaymentMode } from '../domain/finance.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const paymentSchema = z.object({
  party_type: z.enum(['CUSTOMER', 'SUPPLIER', 'KARIGAR', 'OTHER']),
  party_id: z.string().min(1, 'Party ID is required'),
  payment_type: z.enum(['RECEIPT', 'PAYMENT']),
  payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'BANK', 'CREDIT', 'GOLD', 'SILVER', 'OTHER']),
  amount: z.number().positive('Payment amount must be greater than zero'),
  reference_number: z.string().trim().nullable().optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  reference_type: z.string().trim().nullable().optional(),
  reference_id: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
}).refine(
  (data) => {
    // If payment mode is electronic or bank, a reference ID/UTR is expected
    if (['CARD', 'UPI', 'BANK'].includes(data.payment_mode)) {
      return !!data.reference_number && data.reference_number.trim().length > 0;
    }
    return true;
  },
  {
    message: 'Reference number is required for Card, UPI, and Bank payment modes',
    path: ['reference_number'],
  }
);

export const adjustmentSchema = z.object({
  party_type: z.enum(['CUSTOMER', 'SUPPLIER', 'KARIGAR', 'GIRVI_CLIENT', 'OTHER']),
  party_id: z.string().min(1, 'Party ID is required'),
  amount: z.number().positive('Adjustment amount must be positive'),
  direction: z.enum(['DEBIT', 'CREDIT']),
  reason: z.string().min(3, 'Adjustment reason must be at least 3 characters').trim(),
  payment_method: z.enum(['CASH', 'CARD', 'UPI', 'BANK', 'CREDIT']).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const openingBalanceSchema = z.object({
  party_type: z.enum(['CUSTOMER', 'SUPPLIER', 'KARIGAR']),
  party_id: z.string().min(1, 'Party ID is required'),
  amount: z.number().nonnegative('Opening balance cannot be negative'),
  direction: z.enum(['DEBIT', 'CREDIT']).default('DEBIT'),
  notes: z.string().trim().nullable().optional(),
});

export class FinanceService {
  /**
   * Validates party existence and returns human-readable name.
   */
  private validateParty(partyType: string, partyId: string): { id: string; name: string } {
    if (partyType === PartyType.CUSTOMER) {
      const cust = customerRepository.findById(partyId);
      if (!cust) throw new NotFoundError(`Customer with ID '${partyId}' not found`);
      return { id: cust.id, name: cust.name };
    } else if (partyType === PartyType.SUPPLIER) {
      const supp = supplierRepository.findById(partyId);
      if (!supp) throw new NotFoundError(`Supplier with ID '${partyId}' not found`);
      return { id: supp.id, name: supp.name };
    } else if (partyType === PartyType.KARIGAR) {
      const kar = karigarRepository.findById(partyId);
      if (!kar) throw new NotFoundError(`Karigar with ID '${partyId}' not found`);
      return { id: kar.id, name: kar.name };
    }
    return { id: partyId, name: 'Party' };
  }

  /**
   * Records a Payment or Receipt voucher atomically:
   * 1. Validates party
   * 2. Checks overpayment prevention rule
   * 3. Creates payment record in payments table
   * 4. Creates corresponding ledger entry in ledger_entries table
   * 5. Logs audit entry
   * 6. Rolls back on error
   */
  recordPayment(data: unknown, userId?: string): { payment: PaymentRecord; ledger_entry: LedgerEntryRecord } {
    const validated = paymentSchema.parse(data);
    const party = this.validateParty(validated.party_type, validated.party_id);

    // Overpayment check
    const currentBalance = financeRepository.getLatestPartyBalance(validated.party_type, validated.party_id);

    if (validated.party_type === PartyType.CUSTOMER && validated.payment_type === PaymentType.RECEIPT) {
      if (currentBalance > 0 && validated.amount > currentBalance) {
        throw new BadRequestError(
          `Payment amount ₹${validated.amount.toLocaleString('en-IN')} exceeds current outstanding receivable balance of ₹${currentBalance.toLocaleString('en-IN')}. Overpayment is not permitted.`
        );
      }
    } else if (validated.party_type === PartyType.SUPPLIER && validated.payment_type === PaymentType.PAYMENT) {
      if (currentBalance > 0 && validated.amount > currentBalance) {
        throw new BadRequestError(
          `Payment amount ₹${validated.amount.toLocaleString('en-IN')} exceeds current outstanding supplier payable of ₹${currentBalance.toLocaleString('en-IN')}. Overpayment is not permitted.`
        );
      }
    } else if (validated.party_type === PartyType.KARIGAR && validated.payment_type === PaymentType.PAYMENT) {
      if (currentBalance > 0 && validated.amount > currentBalance) {
        throw new BadRequestError(
          `Payment amount ₹${validated.amount.toLocaleString('en-IN')} exceeds current outstanding karigar payable of ₹${currentBalance.toLocaleString('en-IN')}. Overpayment is not permitted.`
        );
      }
    }

    // Atomic transaction for Payment + Ledger entry
    return withTransaction(() => {
      // 1. Create payment voucher
      const payment = financeRepository.createPayment({
        party_type: validated.party_type,
        party_id: validated.party_id,
        payment_type: validated.payment_type,
        payment_mode: validated.payment_mode,
        amount: validated.amount,
        reference_number: validated.reference_number || null,
        payment_date: validated.payment_date,
        reference_type: validated.reference_type || 'DIRECT',
        reference_id: validated.reference_id || null,
        notes: validated.notes || null,
        created_by: userId || null,
      });

      // 2. Determine corresponding ledger entry semantics
      let entryType: EntryType;
      let debitCredit: DebitCredit;

      if (validated.party_type === PartyType.CUSTOMER) {
        // Customer Receipt reduces customer receivable -> CREDIT
        entryType = EntryType.SALE_PAYMENT;
        debitCredit = DebitCredit.CREDIT;
      } else if (validated.party_type === PartyType.SUPPLIER) {
        // Supplier Payment reduces supplier payable -> DEBIT
        entryType = EntryType.PURCHASE_PAYMENT;
        debitCredit = DebitCredit.DEBIT;
      } else if (validated.party_type === PartyType.KARIGAR) {
        // Karigar Payment reduces karigar payable -> DEBIT
        entryType = EntryType.KARIGAR_PAYMENT;
        debitCredit = DebitCredit.DEBIT;
      } else {
        entryType = EntryType.OTHER;
        debitCredit = validated.payment_type === PaymentType.RECEIPT ? DebitCredit.CREDIT : DebitCredit.DEBIT;
      }

      const description = `${validated.payment_type === PaymentType.RECEIPT ? 'Receipt' : 'Payment'} (${validated.payment_mode}) - ${payment.payment_number}${validated.notes ? ` - ${validated.notes}` : ''}`;

      // 3. Create immutable ledger entry
      const ledgerEntry = financeRepository.createLedgerEntry({
        party_type: validated.party_type,
        party_id: validated.party_id,
        entry_type: entryType,
        debit_credit: debitCredit,
        amount: validated.amount,
        reference_type: 'PAYMENT',
        reference_id: payment.id,
        reference_number: payment.payment_number,
        description,
        payment_method: validated.payment_mode as PaymentMode,
        created_by: userId || null,
      });

      // 4. Audit log
      auditRepository.log({
        user_id: userId,
        action: 'PAYMENT_CREATED',
        entity_type: 'PAYMENT',
        entity_id: payment.id,
        metadata: {
          payment_number: payment.payment_number,
          party_type: payment.party_type,
          party_name: party.name,
          payment_type: payment.payment_type,
          payment_mode: payment.payment_mode,
          amount: payment.amount,
        },
      });

      return {
        payment,
        ledger_entry: ledgerEntry,
      };
    });
  }

  /**
   * Records a manual ledger adjustment (Debit / Credit)
   */
  recordAdjustment(data: unknown, userId?: string): LedgerEntryRecord {
    const validated = adjustmentSchema.parse(data);
    const party = this.validateParty(validated.party_type, validated.party_id);

    return withTransaction(() => {
      const ledgerEntry = financeRepository.createLedgerEntry({
        party_type: validated.party_type,
        party_id: validated.party_id,
        entry_type: EntryType.ADJUSTMENT,
        debit_credit: validated.direction as DebitCredit,
        amount: validated.amount,
        reference_type: 'ADJUSTMENT',
        reference_number: `ADJ-${Date.now()}`,
        description: `Adjustment: ${validated.reason}${validated.notes ? ` (${validated.notes})` : ''}`,
        payment_method: (validated.payment_method as PaymentMode) || null,
        created_by: userId || null,
      });

      auditRepository.log({
        user_id: userId,
        action: 'LEDGER_ADJUSTMENT_CREATED',
        entity_type: 'LEDGER_ENTRY',
        entity_id: ledgerEntry.id,
        metadata: {
          party_type: validated.party_type,
          party_name: party.name,
          direction: validated.direction,
          amount: validated.amount,
          reason: validated.reason,
        },
      });

      return ledgerEntry;
    });
  }

  /**
   * Initializes opening balance for a party in the central ledger
   */
  recordOpeningBalance(data: unknown, userId?: string): LedgerEntryRecord {
    const validated = openingBalanceSchema.parse(data);
    const party = this.validateParty(validated.party_type, validated.party_id);

    return withTransaction(() => {
      // Determine direction:
      // Customer: DEBIT (Receivable) or CREDIT (Advance)
      // Supplier/Karigar: CREDIT (Payable) or DEBIT (Advance)
      const debitCredit = validated.direction as DebitCredit;

      const ledgerEntry = financeRepository.createLedgerEntry({
        party_type: validated.party_type,
        party_id: validated.party_id,
        entry_type: EntryType.OPENING_BALANCE,
        debit_credit: debitCredit,
        amount: validated.amount,
        reference_type: 'OPENING_BALANCE',
        reference_number: `OB-${party.id.substring(0, 8).toUpperCase()}`,
        description: `Opening Balance for ${party.name}${validated.notes ? ` (${validated.notes})` : ''}`,
        payment_method: null,
        created_by: userId || null,
      });

      auditRepository.log({
        user_id: userId,
        action: 'OPENING_BALANCE_CREATED',
        entity_type: 'LEDGER_ENTRY',
        entity_id: ledgerEntry.id,
        metadata: {
          party_type: validated.party_type,
          party_name: party.name,
          amount: validated.amount,
          direction: debitCredit,
        },
      });

      return ledgerEntry;
    });
  }

  getLedgerEntries(params: LedgerQueryParams): PaginatedResult<LedgerEntryRecord> {
    return financeRepository.findLedgerEntries(params);
  }

  getPartyStatement(partyType: string, partyId: string, fromDate?: string, toDate?: string) {
    this.validateParty(partyType, partyId);
    return financeRepository.getPartyStatement(partyType, partyId, fromDate, toDate);
  }

  getPayments(params: PaymentQueryParams): PaginatedResult<PaymentRecord> {
    return financeRepository.findPayments(params);
  }

  getPaymentById(id: string): PaymentRecord {
    const payment = financeRepository.getPaymentById(id);
    if (!payment) throw new NotFoundError(`Payment record '${id}' not found`);
    return payment;
  }

  getCashBook(params: CashBookQueryParams) {
    return financeRepository.getCashBook(params);
  }

  getFinanceSummary() {
    return financeRepository.getFinanceMetrics();
  }
}

export const financeService = new FinanceService();
