// backend/src/domain/girvi.ts
// Jewel Suite: Girvi / Pledged Jewellery Domain Definitions & Types

export enum GirviLoanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  OVERDUE = 'OVERDUE',
  CLOSED = 'CLOSED',
  DEFAULTED = 'DEFAULTED',
  CANCELLED = 'CANCELLED',
}

export enum GirviInterestType {
  MONTHLY_PERCENT = 'MONTHLY_PERCENT',
  ANNUAL_PERCENT = 'ANNUAL_PERCENT',
  FLAT_AMOUNT = 'FLAT_AMOUNT',
}

export enum GirviItemSourceType {
  CUSTOMER_ITEM = 'CUSTOMER_ITEM',
  SHOP_STOCK = 'SHOP_STOCK',
}

export enum GirviPledgeStatus {
  PLEDGED = 'PLEDGED',
  RELEASED = 'RELEASED',
  FORFEITED = 'FORFEITED',
}

export enum GirviPledgeEventType {
  PLEDGED = 'PLEDGED',
  RELEASED = 'RELEASED',
  FORFEITED = 'FORFEITED',
  ADJUSTED = 'ADJUSTED',
}

export interface GirviLoanItem {
  id: string;
  loan_id: string;
  source_type: GirviItemSourceType | string;
  stock_item_id?: string | null;
  description: string;
  tag_no?: string | null;
  metal_id?: string | null;
  metal_name?: string | null;
  purity_id?: string | null;
  purity_name?: string | null;
  gross_weight: number;
  less_weight: number;
  net_weight: number;
  tunch_percent: number;
  fine_weight: number;
  valuation_rate: number;
  valuation_amount: number;
  pledged_value: number;
  status: GirviPledgeStatus | string;
  release_date?: string | null;
  released_by?: string | null;
  release_notes?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GirviLoanPayment {
  id: string;
  loan_id: string;
  payment_number: string;
  payment_date: string;
  principal_amount: number;
  interest_amount: number;
  charges_amount: number;
  total_amount: number;
  payment_mode: string;
  reference_number?: string | null;
  finance_payment_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface GirviPledgeEvent {
  id: string;
  loan_id: string;
  loan_item_id?: string | null;
  event_type: GirviPledgeEventType | string;
  event_date: string;
  description: string;
  created_by?: string | null;
  created_at: string;
}

export interface GirviLoan {
  id: string;
  loan_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  loan_date: string;
  due_date: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: GirviInterestType | string;
  processing_fee: number;
  other_charges: number;
  total_interest: number;
  total_charges: number;
  total_repaid: number;
  outstanding_amount: number;
  status: GirviLoanStatus | string;
  ltv_percent: number;
  max_allowed_loan: number;
  is_overridden: number;
  override_reason?: string | null;
  disbursement_date?: string | null;
  disbursed_by?: string | null;
  closure_date?: string | null;
  closed_by?: string | null;
  closure_notes?: string | null;
  notes?: string | null;
  items?: GirviLoanItem[];
  payments?: GirviLoanPayment[];
  pledge_events?: GirviPledgeEvent[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
