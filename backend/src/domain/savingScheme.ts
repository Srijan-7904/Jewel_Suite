// backend/src/domain/savingScheme.ts
// Jewel Suite: Saving Scheme Domain Definitions & Types

export enum SavingSchemeStatus {
  ACTIVE = 'ACTIVE',
  MATURED = 'MATURED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DEFAULTED = 'DEFAULTED',
}

export enum InstallmentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export enum MaturityBenefitType {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
  BONUS = 'BONUS',
}

export interface SavingSchemeType {
  id: string;
  name: string;
  code: string;
  duration_months: number;
  installment_amount: number;
  maturity_benefit_type: MaturityBenefitType | string;
  maturity_benefit_value: number;
  description?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SavingSchemeInstallment {
  id: string;
  saving_scheme_id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  payment_date?: string | null;
  payment_mode?: string | null;
  reference_number?: string | null;
  status: InstallmentStatus | string;
  finance_payment_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SavingScheme {
  id: string;
  scheme_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  scheme_type_id: string;
  scheme_type_name?: string;
  scheme_type_code?: string;
  start_date: string;
  maturity_date: string;
  installment_amount: number;
  total_installments: number;
  paid_installments: number;
  paid_amount: number;
  maturity_amount: number;
  status: SavingSchemeStatus | string;
  maturity_payout_date?: string | null;
  maturity_notes?: string | null;
  notes?: string | null;
  installments?: SavingSchemeInstallment[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
