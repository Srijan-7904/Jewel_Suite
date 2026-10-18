// backend/src/services/savingScheme.service.ts
// Jewel Suite: Saving Schemes Service Layer with Financial Integration

import { z } from 'zod';
import {
  savingSchemeRepository,
  SavingSchemeQueryParams,
} from '../repositories/savingScheme.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { financeRepository } from '../repositories/finance.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction } from '../database/connection/db.js';
import {
  SavingScheme,
  SavingSchemeType,
  SavingSchemeStatus,
  InstallmentStatus,
  MaturityBenefitType,
} from '../domain/savingScheme.js';
import { PartyType, EntryType, DebitCredit, PaymentType, PaymentMode } from '../domain/finance.js';
import {
  generateInstallmentSchedule,
  calculateMaturityBenefit,
} from '../utils/savingSchemeMath.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const createSavingSchemeTypeSchema = z.object({
  name: z.string().min(1, 'Scheme name is required').trim(),
  code: z.string().min(1, 'Scheme code is required').trim(),
  duration_months: z.number().int().positive('Duration must be at least 1 month'),
  installment_amount: z.number().positive('Monthly installment amount must be greater than zero'),
  maturity_benefit_type: z.enum(['NONE', 'FIXED', 'PERCENTAGE', 'BONUS']).default('BONUS'),
  maturity_benefit_value: z.number().nonnegative().default(1.0),
  description: z.string().trim().nullable().optional(),
});

export const enrollCustomerSchemeSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
  scheme_type_id: z.string().min(1, 'Scheme Type ID is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  notes: z.string().trim().nullable().optional(),
});

export const payInstallmentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'BANK', 'CREDIT']).default('CASH'),
  reference_number: z.string().trim().nullable().optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  notes: z.string().trim().nullable().optional(),
});

export class SavingSchemeService {
  // --- Master Types ---

  listTypes(): SavingSchemeType[] {
    return savingSchemeRepository.findTypes();
  }

  getType(id: string): SavingSchemeType {
    const type = savingSchemeRepository.findTypeById(id);
    if (!type) {
      throw new NotFoundError(`Saving scheme type with ID '${id}' not found`);
    }
    return type;
  }

  createType(data: unknown): SavingSchemeType {
    const validated = createSavingSchemeTypeSchema.parse(data);
    return savingSchemeRepository.createType(validated);
  }

  // --- Customer Scheme Enrollment ---

  enrollCustomer(data: unknown, userId?: string): SavingScheme {
    const validated = enrollCustomerSchemeSchema.parse(data);

    // 1. Validate Customer
    const customer = customerRepository.findById(validated.customer_id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${validated.customer_id}' not found`);
    }

    // 2. Validate Scheme Type
    const schemeType = savingSchemeRepository.findTypeById(validated.scheme_type_id);
    if (!schemeType) {
      throw new NotFoundError(`Saving scheme type with ID '${validated.scheme_type_id}' not found`);
    }

    const startDate = validated.start_date || new Date().toISOString().substring(0, 10);

    // 3. Compute Schedule and Maturity Date
    const schedule = generateInstallmentSchedule(
      startDate,
      schemeType.duration_months,
      schemeType.installment_amount
    );
    const lastInstallment = schedule[schedule.length - 1];
    const maturityDate = lastInstallment ? lastInstallment.due_date : startDate;

    return withTransaction(() => {
      // 4. Create Scheme Record
      const scheme = savingSchemeRepository.createScheme({
        customer_id: validated.customer_id,
        scheme_type_id: validated.scheme_type_id,
        start_date: startDate,
        maturity_date: maturityDate,
        installment_amount: schemeType.installment_amount,
        total_installments: schemeType.duration_months,
        paid_installments: 0,
        paid_amount: 0,
        maturity_amount: 0,
        status: SavingSchemeStatus.ACTIVE,
        notes: validated.notes || null,
        created_by: userId || null,
      });

      // 5. Generate all scheduled monthly installments
      savingSchemeRepository.createInstallments(scheme.id, schedule);

      // 6. Audit Log
      auditRepository.log({
        user_id: userId,
        action: 'SAVING_SCHEME_CREATED',
        entity_type: 'SAVING_SCHEME',
        entity_id: scheme.id,
        metadata: {
          scheme_number: scheme.scheme_number,
          customer_name: customer.name,
          scheme_type: schemeType.name,
          duration_months: schemeType.duration_months,
          installment_amount: schemeType.installment_amount,
        },
      });

      return savingSchemeRepository.findById(scheme.id)!;
    });
  }

  /**
   * Records payment for a specific scheme installment:
   * 1. Validates installment status (not already PAID)
   * 2. Atomic Finance RECEIPT voucher created (Money received by shop)
   * 3. Customer Ledger CREDIT created (Customer savings balance credited)
   * 4. Updates installment status (PAID or PARTIAL)
   * 5. Updates scheme totals (paid_amount, paid_installments)
   * 6. Checks if all installments are completed -> transitions scheme to MATURED
   * 7. Audit log written
   */
  payInstallment(
    schemeId: string,
    installmentId: string,
    data: unknown,
    userId?: string
  ): { scheme: SavingScheme; installment: unknown } {
    const validated = payInstallmentSchema.parse(data);

    const scheme = savingSchemeRepository.findById(schemeId);
    if (!scheme) {
      throw new NotFoundError(`Saving scheme with ID '${schemeId}' not found`);
    }

    if (scheme.status !== SavingSchemeStatus.ACTIVE) {
      throw new BadRequestError(
        `Cannot accept payment for scheme '${scheme.scheme_number}' in '${scheme.status}' status (must be ACTIVE)`
      );
    }

    const installment = savingSchemeRepository.findInstallmentById(installmentId);
    if (!installment || installment.saving_scheme_id !== scheme.id) {
      throw new NotFoundError(`Installment with ID '${installmentId}' not found in scheme '${scheme.scheme_number}'`);
    }

    if (installment.status === InstallmentStatus.PAID) {
      throw new BadRequestError(`Installment #${installment.installment_number} is already paid in full.`);
    }

    const remainingDueOnInst = Number((installment.amount_due - installment.amount_paid).toFixed(2));
    if (validated.amount > remainingDueOnInst) {
      throw new BadRequestError(
        `Payment amount ₹${validated.amount.toLocaleString('en-IN')} exceeds remaining amount due ₹${remainingDueOnInst.toLocaleString('en-IN')} on installment #${installment.installment_number}. Overpayment is not permitted.`
      );
    }

    const now = new Date().toISOString();
    const paymentDate = validated.payment_date || now.substring(0, 10);

    return withTransaction(() => {
      // 1. Create Finance Receipt Voucher (Shop receives money from customer)
      const pmt = financeRepository.createPayment({
        party_type: PartyType.CUSTOMER,
        party_id: scheme.customer_id,
        payment_type: PaymentType.RECEIPT,
        payment_mode: validated.payment_mode as PaymentMode,
        amount: validated.amount,
        reference_number: validated.reference_number || null,
        payment_date: paymentDate,
        reference_type: 'SAVING_SCHEME',
        reference_id: scheme.id,
        notes: `Saving Scheme Installment #${installment.installment_number} - ${scheme.scheme_number}${validated.notes ? ` - ${validated.notes}` : ''}`,
        created_by: userId || null,
      });

      // 2. Customer Ledger Credit Entry
      financeRepository.createLedgerEntry({
        party_type: PartyType.CUSTOMER,
        party_id: scheme.customer_id,
        entry_type: EntryType.OTHER,
        debit_credit: DebitCredit.CREDIT,
        amount: validated.amount,
        reference_type: 'SAVING_SCHEME',
        reference_id: scheme.id,
        reference_number: scheme.scheme_number,
        description: `Saving Scheme Installment #${installment.installment_number} (${scheme.scheme_type_name || scheme.scheme_number})`,
        payment_method: validated.payment_mode as PaymentMode,
        created_by: userId || null,
      });

      // 3. Update Installment
      const newAmountPaid = Number((installment.amount_paid + validated.amount).toFixed(2));
      const isFullyPaid = newAmountPaid >= installment.amount_due;
      const newStatus = isFullyPaid ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL;

      savingSchemeRepository.updateInstallment(installment.id, {
        amount_paid: newAmountPaid,
        payment_date: paymentDate,
        payment_mode: validated.payment_mode,
        reference_number: validated.reference_number || null,
        status: newStatus,
        finance_payment_id: pmt.id,
        notes: validated.notes || null,
      });

      // 4. Update Scheme Totals
      const updatedSchemeBefore = savingSchemeRepository.findById(scheme.id)!;
      const allInsts = updatedSchemeBefore.installments || [];
      const paidInstCount = allInsts.filter((i) => i.status === InstallmentStatus.PAID).length;
      const totalPaidAmount = allInsts.reduce((sum, i) => sum + i.amount_paid, 0);

      let schemeStatus = updatedSchemeBefore.status;
      // If all installments are now fully paid, transition scheme to MATURED!
      if (paidInstCount >= scheme.total_installments) {
        schemeStatus = SavingSchemeStatus.MATURED;
      }

      const updatedScheme = savingSchemeRepository.updateScheme(scheme.id, {
        paid_installments: paidInstCount,
        paid_amount: Number(totalPaidAmount.toFixed(2)),
        status: schemeStatus,
      });

      // 5. Audit Log
      auditRepository.log({
        user_id: userId,
        action: 'SAVING_INSTALLMENT_PAID',
        entity_type: 'SAVING_SCHEME',
        entity_id: scheme.id,
        metadata: {
          scheme_number: scheme.scheme_number,
          installment_number: installment.installment_number,
          amount_paid: validated.amount,
          new_installment_status: newStatus,
          scheme_status: schemeStatus,
        },
      });

      return {
        scheme: updatedScheme,
        installment: savingSchemeRepository.findInstallmentById(installment.id),
      };
    });
  }

  /**
   * Matures an active or matured saving scheme and calculates bonus benefit payout.
   */
  matureScheme(schemeId: string, notes?: string, userId?: string): SavingScheme {
    const scheme = savingSchemeRepository.findById(schemeId);
    if (!scheme) {
      throw new NotFoundError(`Saving scheme with ID '${schemeId}' not found`);
    }

    if (scheme.status !== SavingSchemeStatus.ACTIVE && scheme.status !== SavingSchemeStatus.MATURED) {
      throw new BadRequestError(
        `Cannot process maturity for scheme '${scheme.scheme_number}' because it is in '${scheme.status}' status`
      );
    }

    const schemeType = savingSchemeRepository.findTypeById(scheme.scheme_type_id);
    const benefitType = schemeType ? schemeType.maturity_benefit_type : MaturityBenefitType.NONE;
    const benefitValue = schemeType ? schemeType.maturity_benefit_value : 0;

    const { bonusAmount, totalMaturityAmount } = calculateMaturityBenefit(
      scheme.paid_amount,
      scheme.installment_amount,
      benefitType,
      benefitValue
    );

    const today = new Date().toISOString().substring(0, 10);

    const updated = savingSchemeRepository.updateScheme(scheme.id, {
      status: SavingSchemeStatus.MATURED,
      maturity_amount: totalMaturityAmount,
      maturity_payout_date: today,
      maturity_notes: notes || `Matured with bonus ₹${bonusAmount.toLocaleString('en-IN')}`,
    });

    auditRepository.log({
      user_id: userId,
      action: 'SAVING_SCHEME_MATURED',
      entity_type: 'SAVING_SCHEME',
      entity_id: scheme.id,
      metadata: {
        scheme_number: scheme.scheme_number,
        paid_amount: scheme.paid_amount,
        bonus_amount: bonusAmount,
        total_maturity_amount: totalMaturityAmount,
      },
    });

    return updated;
  }

  getScheme(id: string): SavingScheme {
    const scheme = savingSchemeRepository.findById(id);
    if (!scheme) {
      throw new NotFoundError(`Saving scheme with ID '${id}' not found`);
    }
    return scheme;
  }

  listSchemes(params: SavingSchemeQueryParams = {}): PaginatedResult<SavingScheme> {
    return savingSchemeRepository.findSchemes(params);
  }

  getCustomerSchemes(customerId: string): SavingScheme[] {
    return savingSchemeRepository.getCustomerSchemes(customerId);
  }
}

export const savingSchemeService = new SavingSchemeService();
