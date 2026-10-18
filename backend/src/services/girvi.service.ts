// backend/src/services/girvi.service.ts
// Jewel Suite: Girvi / Pledged Jewellery Loans Service Layer

import { z } from 'zod';
import {
  girviRepository,
  GirviQueryParams,
  GirviMetrics,
} from '../repositories/girvi.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { financeRepository } from '../repositories/finance.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { withTransaction } from '../database/connection/db.js';
import {
  GirviLoan,
  GirviLoanStatus,
  GirviInterestType,
  GirviItemSourceType,
  GirviPledgeStatus,
  GirviPledgeEventType,
} from '../domain/girvi.js';
import { PartyType, EntryType, DebitCredit, PaymentType, PaymentMode } from '../domain/finance.js';
import {
  calculateFineWeight,
  calculateItemValuation,
  calculateMaxLoan,
  calculateInterest,
  calculateOutstanding,
} from '../utils/girviMath.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { PaginatedResult } from '../repositories/customer.repository.js';

export const createGirviLoanItemSchema = z.object({
  source_type: z.enum(['CUSTOMER_ITEM', 'SHOP_STOCK']).default('CUSTOMER_ITEM'),
  stock_item_id: z.string().trim().nullable().optional(),
  description: z.string().min(1, 'Item description is required').trim(),
  tag_no: z.string().trim().nullable().optional(),
  metal_id: z.string().trim().nullable().optional(),
  purity_id: z.string().trim().nullable().optional(),
  gross_weight: z.number().positive('Gross weight must be greater than zero'),
  less_weight: z.number().nonnegative('Less weight cannot be negative').default(0),
  tunch_percent: z.number().min(0).max(100, 'Tunch % must be between 0 and 100'),
  valuation_rate: z.number().positive('Valuation rate per gram must be greater than zero'),
  pledged_value: z.number().nonnegative().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const createGirviLoanSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
  loan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  principal_amount: z.number().positive('Principal amount must be greater than zero'),
  interest_rate: z.number().nonnegative('Interest rate cannot be negative'),
  interest_type: z.enum(['MONTHLY_PERCENT', 'ANNUAL_PERCENT', 'FLAT_AMOUNT']).default('MONTHLY_PERCENT'),
  processing_fee: z.number().nonnegative().default(0),
  other_charges: z.number().nonnegative().default(0),
  ltv_percent: z.number().min(1).max(100).default(75.0),
  override_ltv: z.boolean().default(false),
  override_reason: z.string().trim().nullable().optional(),
  items: z.array(createGirviLoanItemSchema).min(1, 'At least one pledged jewellery item is required'),
  disburse_immediately: z.boolean().default(false),
  disbursement_payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'BANK']).default('CASH'),
  notes: z.string().trim().nullable().optional(),
});

export const girviRepaymentSchema = z.object({
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  principal_amount: z.number().nonnegative().default(0),
  interest_amount: z.number().nonnegative().default(0),
  charges_amount: z.number().nonnegative().default(0),
  payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'BANK', 'CREDIT']).default('CASH'),
  reference_number: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
}).refine(
  (data) => {
    const total = data.principal_amount + data.interest_amount + data.charges_amount;
    return total > 0;
  },
  {
    message: 'Total repayment amount (principal + interest + charges) must be greater than zero',
    path: ['principal_amount'],
  }
);

export class GirviService {
  /**
   * Creates a new Girvi Loan with pledged items, valuation, and LTV validation.
   */
  createLoan(data: unknown, userId?: string): GirviLoan {
    const validated = createGirviLoanSchema.parse(data);

    // 1. Validate Customer
    const customer = customerRepository.findById(validated.customer_id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${validated.customer_id}' not found`);
    }

    // 2. Process and compute item weights, fine weight, and valuation
    let totalValuation = 0;
    const computedItems = validated.items.map((item) => {
      const netWeight = Number((item.gross_weight - item.less_weight).toFixed(3));
      if (netWeight <= 0) {
        throw new BadRequestError(`Item '${item.description}' has invalid net weight (${netWeight}g)`);
      }
      const fineWeight = calculateFineWeight(netWeight, item.tunch_percent);
      const valuationAmount = calculateItemValuation(fineWeight, item.valuation_rate);
      totalValuation += valuationAmount;

      return {
        ...item,
        net_weight: netWeight,
        fine_weight: fineWeight,
        valuation_amount: valuationAmount,
        pledged_value: item.pledged_value ?? valuationAmount,
      };
    });

    totalValuation = Number(totalValuation.toFixed(2));

    // 3. LTV Validation
    const maxAllowedLoan = calculateMaxLoan(totalValuation, validated.ltv_percent);
    if (validated.principal_amount > maxAllowedLoan && !validated.override_ltv) {
      throw new BadRequestError(
        `Requested principal ₹${validated.principal_amount.toLocaleString('en-IN')} exceeds maximum allowed LTV (${validated.ltv_percent}%) limit of ₹${maxAllowedLoan.toLocaleString('en-IN')} for pledged collateral valued at ₹${totalValuation.toLocaleString('en-IN')}. Set override_ltv with an authorized reason to proceed.`
      );
    }

    const loanDate = validated.loan_date || new Date().toISOString().substring(0, 10);
    const initialInterest = calculateInterest(
      validated.principal_amount,
      validated.interest_rate,
      validated.interest_type,
      loanDate,
      validated.due_date
    );

    const totalCharges = validated.processing_fee + validated.other_charges;
    const initialOutstanding = calculateOutstanding(
      validated.principal_amount,
      initialInterest,
      totalCharges,
      0
    );

    return withTransaction(() => {
      // 4. Create Loan
      const loan = girviRepository.createLoan({
        customer_id: validated.customer_id,
        loan_date: loanDate,
        due_date: validated.due_date,
        principal_amount: validated.principal_amount,
        interest_rate: validated.interest_rate,
        interest_type: validated.interest_type,
        processing_fee: validated.processing_fee,
        other_charges: validated.other_charges,
        total_interest: initialInterest,
        total_charges: totalCharges,
        total_repaid: 0,
        outstanding_amount: initialOutstanding,
        status: GirviLoanStatus.DRAFT,
        ltv_percent: validated.ltv_percent,
        max_allowed_loan: maxAllowedLoan,
        is_overridden: validated.override_ltv ? 1 : 0,
        override_reason: validated.override_reason || null,
        notes: validated.notes || null,
        created_by: userId || null,
      });

      // 5. Create Items & Initial Custody Events
      for (const item of computedItems) {
        const loanItem = girviRepository.createLoanItem({
          loan_id: loan.id,
          source_type: item.source_type,
          stock_item_id: item.stock_item_id || null,
          description: item.description,
          tag_no: item.tag_no || null,
          metal_id: item.metal_id || null,
          purity_id: item.purity_id || null,
          gross_weight: item.gross_weight,
          less_weight: item.less_weight,
          net_weight: item.net_weight,
          tunch_percent: item.tunch_percent,
          fine_weight: item.fine_weight,
          valuation_rate: item.valuation_rate,
          valuation_amount: item.valuation_amount,
          pledged_value: item.pledged_value,
          status: GirviPledgeStatus.PLEDGED,
          notes: item.notes || null,
        });

        girviRepository.createPledgeEvent({
          loan_id: loan.id,
          loan_item_id: loanItem.id,
          event_type: GirviPledgeEventType.PLEDGED,
          description: `Pledged collateral received: ${item.description} (Gross: ${item.gross_weight}g, Net: ${item.net_weight}g, Fine: ${item.fine_weight}g)`,
          created_by: userId || null,
        });
      }

      auditRepository.log({
        user_id: userId,
        action: 'GIRVI_CREATED',
        entity_type: 'GIRVI_LOAN',
        entity_id: loan.id,
        metadata: {
          loan_number: loan.loan_number,
          customer_name: customer.name,
          principal_amount: loan.principal_amount,
          total_valuation: totalValuation,
          ltv_percent: loan.ltv_percent,
        },
      });

      // If immediate disbursement was requested
      if (validated.disburse_immediately) {
        return this.disburseLoan(loan.id, { payment_mode: validated.disbursement_payment_mode }, userId);
      }

      return girviRepository.findById(loan.id)!;
    });
  }

  /**
   * Disburses principal money to customer:
   * 1. Loan transitions from DRAFT -> ACTIVE
   * 2. Atomic Finance PAYMENT voucher created (money paid out by shop)
   * 3. Customer Ledger DEBIT created (receivable balance increases)
   * 4. Audit log written
   */
  disburseLoan(loanId: string, options?: { payment_mode?: string }, userId?: string): GirviLoan {
    const loan = girviRepository.findById(loanId);
    if (!loan) {
      throw new NotFoundError(`Girvi Loan with ID '${loanId}' not found`);
    }

    if (loan.status !== GirviLoanStatus.DRAFT) {
      throw new BadRequestError(`Cannot disburse loan '${loan.loan_number}' because it is in '${loan.status}' status (must be DRAFT)`);
    }

    const paymentMode = (options?.payment_mode as PaymentMode) || PaymentMode.CASH;
    const now = new Date().toISOString();
    const today = now.substring(0, 10);

    return withTransaction(() => {
      // 1. Create Finance Payment Voucher (Shop pays customer)
      const pmt = financeRepository.createPayment({
        party_type: PartyType.CUSTOMER,
        party_id: loan.customer_id,
        payment_type: PaymentType.PAYMENT,
        payment_mode: paymentMode,
        amount: loan.principal_amount,
        payment_date: today,
        reference_type: 'GIRVI_LOAN',
        reference_id: loan.id,
        notes: `Disbursement for Girvi Loan ${loan.loan_number}`,
        created_by: userId || null,
      });

      // 2. Create Customer Ledger Debit entry (Customer owes shop this loan amount)
      financeRepository.createLedgerEntry({
        party_type: PartyType.CUSTOMER,
        party_id: loan.customer_id,
        entry_type: EntryType.OTHER,
        debit_credit: DebitCredit.DEBIT,
        amount: loan.principal_amount,
        reference_type: 'GIRVI_LOAN',
        reference_id: loan.id,
        reference_number: loan.loan_number,
        description: `Girvi Loan Disbursement - ${loan.loan_number}`,
        payment_method: paymentMode,
        created_by: userId || null,
      });

      // 3. Update Loan status to ACTIVE
      const updated = girviRepository.updateLoan(loan.id, {
        status: GirviLoanStatus.ACTIVE,
        disbursement_date: today,
        disbursed_by: userId || null,
      });

      // 4. Audit log
      auditRepository.log({
        user_id: userId,
        action: 'GIRVI_DISBURSED',
        entity_type: 'GIRVI_LOAN',
        entity_id: loan.id,
        metadata: {
          loan_number: loan.loan_number,
          principal_amount: loan.principal_amount,
          payment_number: pmt.payment_number,
          payment_mode: paymentMode,
        },
      });

      return updated;
    });
  }

  /**
   * Records a repayment against an active Girvi loan:
   * 1. Validates payment amount
   * 2. Atomic Finance RECEIPT voucher created (money received by shop)
   * 3. Customer Ledger CREDIT created (receivable balance decreases)
   * 4. Girvi Loan payment recorded & loan totals/status updated
   * 5. Audit log written
   */
  recordRepayment(loanId: string, data: unknown, userId?: string): GirviLoan {
    const validated = girviRepaymentSchema.parse(data);
    const loan = girviRepository.findById(loanId);
    if (!loan) {
      throw new NotFoundError(`Girvi Loan with ID '${loanId}' not found`);
    }

    if (
      loan.status !== GirviLoanStatus.ACTIVE &&
      loan.status !== GirviLoanStatus.PARTIALLY_PAID &&
      loan.status !== GirviLoanStatus.OVERDUE
    ) {
      throw new BadRequestError(
        `Cannot record repayment for loan '${loan.loan_number}' because it is in '${loan.status}' status (must be ACTIVE, PARTIALLY_PAID, or OVERDUE)`
      );
    }

    const totalAmount = Number(
      (validated.principal_amount + validated.interest_amount + validated.charges_amount).toFixed(2)
    );

    if (totalAmount > loan.outstanding_amount) {
      throw new BadRequestError(
        `Repayment amount ₹${totalAmount.toLocaleString('en-IN')} exceeds current outstanding loan balance of ₹${loan.outstanding_amount.toLocaleString('en-IN')}. Overpayment is not permitted.`
      );
    }

    const now = new Date().toISOString();
    const paymentDate = validated.payment_date || now.substring(0, 10);

    return withTransaction(() => {
      // 1. Finance Receipt Voucher (Customer pays shop)
      const pmt = financeRepository.createPayment({
        party_type: PartyType.CUSTOMER,
        party_id: loan.customer_id,
        payment_type: PaymentType.RECEIPT,
        payment_mode: validated.payment_mode as PaymentMode,
        amount: totalAmount,
        reference_number: validated.reference_number || null,
        payment_date: paymentDate,
        reference_type: 'GIRVI_LOAN',
        reference_id: loan.id,
        notes: `Repayment for Girvi Loan ${loan.loan_number}${validated.notes ? ` - ${validated.notes}` : ''}`,
        created_by: userId || null,
      });

      // 2. Customer Ledger Credit Entry
      financeRepository.createLedgerEntry({
        party_type: PartyType.CUSTOMER,
        party_id: loan.customer_id,
        entry_type: EntryType.OTHER,
        debit_credit: DebitCredit.CREDIT,
        amount: totalAmount,
        reference_type: 'GIRVI_LOAN',
        reference_id: loan.id,
        reference_number: loan.loan_number,
        description: `Girvi Loan Repayment - ${loan.loan_number} (Principal: ₹${validated.principal_amount}, Interest: ₹${validated.interest_amount}, Charges: ₹${validated.charges_amount})`,
        payment_method: validated.payment_mode as PaymentMode,
        created_by: userId || null,
      });

      // 3. Record Girvi Loan Payment
      const loanPayment = girviRepository.createPayment({
        loan_id: loan.id,
        payment_date: paymentDate,
        principal_amount: validated.principal_amount,
        interest_amount: validated.interest_amount,
        charges_amount: validated.charges_amount,
        total_amount: totalAmount,
        payment_mode: validated.payment_mode,
        reference_number: validated.reference_number || null,
        finance_payment_id: pmt.id,
        notes: validated.notes || null,
        created_by: userId || null,
      });

      // 4. Update Loan Balance and Status
      const newTotalRepaid = Number((loan.total_repaid + totalAmount).toFixed(2));
      const newTotalInterest = Number((loan.total_interest + validated.interest_amount).toFixed(2));
      const newTotalCharges = Number((loan.total_charges + validated.charges_amount).toFixed(2));
      const newOutstanding = calculateOutstanding(
        loan.principal_amount,
        newTotalInterest,
        newTotalCharges,
        newTotalRepaid
      );

      let newStatus: GirviLoanStatus;
      let closureDate: string | null = null;
      let closedBy: string | null = null;

      if (newOutstanding <= 0) {
        newStatus = GirviLoanStatus.CLOSED;
        closureDate = paymentDate;
        closedBy = userId || null;
      } else {
        newStatus = GirviLoanStatus.PARTIALLY_PAID;
      }

      const updated = girviRepository.updateLoan(loan.id, {
        total_repaid: newTotalRepaid,
        total_interest: newTotalInterest,
        total_charges: newTotalCharges,
        outstanding_amount: newOutstanding,
        status: newStatus,
        closure_date: closureDate,
        closed_by: closedBy,
      });

      // 5. Audit Log
      auditRepository.log({
        user_id: userId,
        action: 'GIRVI_PAYMENT_CREATED',
        entity_type: 'GIRVI_LOAN',
        entity_id: loan.id,
        metadata: {
          loan_number: loan.loan_number,
          payment_number: loanPayment.payment_number,
          total_amount: totalAmount,
          outstanding_remaining: newOutstanding,
          status: newStatus,
        },
      });

      return updated;
    });
  }

  /**
   * Closes an active/partially-paid loan:
   * Requires outstanding balance to be zero (or authorized waiver).
   */
  closeLoan(loanId: string, notes?: string, userId?: string): GirviLoan {
    const loan = girviRepository.findById(loanId);
    if (!loan) {
      throw new NotFoundError(`Girvi Loan with ID '${loanId}' not found`);
    }

    if (loan.outstanding_amount > 0) {
      throw new BadRequestError(
        `Cannot close loan '${loan.loan_number}' because it has an outstanding unpaid balance of ₹${loan.outstanding_amount.toLocaleString('en-IN')}. Outstanding must be zero before closing.`
      );
    }

    const today = new Date().toISOString().substring(0, 10);

    const updated = girviRepository.updateLoan(loan.id, {
      status: GirviLoanStatus.CLOSED,
      closure_date: today,
      closed_by: userId || null,
      closure_notes: notes || null,
    });

    auditRepository.log({
      user_id: userId,
      action: 'GIRVI_CLOSED',
      entity_type: 'GIRVI_LOAN',
      entity_id: loan.id,
      metadata: {
        loan_number: loan.loan_number,
        closure_notes: notes || null,
      },
    });

    return updated;
  }

  /**
   * Releases pledged items back to customer after loan closure:
   * 1. Loan must be CLOSED
   * 2. Marks items RELEASED
   * 3. Records pledge custody event
   * 4. Audit log written
   */
  releasePledge(loanId: string, notes?: string, userId?: string): GirviLoan {
    const loan = girviRepository.findById(loanId);
    if (!loan) {
      throw new NotFoundError(`Girvi Loan with ID '${loanId}' not found`);
    }

    if (loan.status !== GirviLoanStatus.CLOSED) {
      throw new BadRequestError(
        `Cannot release pledged items for loan '${loan.loan_number}' because the loan is '${loan.status}' (must be CLOSED)`
      );
    }

    const now = new Date().toISOString();
    const today = now.substring(0, 10);

    return withTransaction(() => {
      if (loan.items) {
        for (const item of loan.items) {
          if (item.status === GirviPledgeStatus.PLEDGED) {
            girviRepository.updateLoanItem(item.id, {
              status: GirviPledgeStatus.RELEASED,
              release_date: today,
              released_by: userId || null,
              release_notes: notes || null,
            });

            girviRepository.createPledgeEvent({
              loan_id: loan.id,
              loan_item_id: item.id,
              event_type: GirviPledgeEventType.RELEASED,
              description: `Pledged item '${item.description}' released back to customer: ${notes || 'Loan settled in full'}`,
              created_by: userId || null,
            });
          }
        }
      }

      auditRepository.log({
        user_id: userId,
        action: 'GIRVI_RELEASED',
        entity_type: 'GIRVI_LOAN',
        entity_id: loan.id,
        metadata: {
          loan_number: loan.loan_number,
          notes: notes || null,
        },
      });

      return girviRepository.findById(loan.id)!;
    });
  }

  getLoan(id: string): GirviLoan {
    const loan = girviRepository.findById(id);
    if (!loan) {
      throw new NotFoundError(`Girvi Loan with ID '${id}' not found`);
    }
    return loan;
  }

  listLoans(params: GirviQueryParams = {}): PaginatedResult<GirviLoan> {
    return girviRepository.findLoans(params);
  }

  getMetrics(): GirviMetrics {
    return girviRepository.getMetrics();
  }

  getCustomerLoans(customerId: string): GirviLoan[] {
    return girviRepository.getCustomerLoans(customerId);
  }
}

export const girviService = new GirviService();
