export interface User {
  id: string;
  username: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SystemHealth {
  status: string;
  database: string;
  version: string;
  mode: string;
  timestamp: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Master Entities
export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  customer_type: 'RETAIL' | 'WHOLESALE' | 'GIRVI_CLIENT';
  opening_balance: number;
  opening_balance_type: 'DEBIT' | 'CREDIT';
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Karigar {
  id: string;
  karigar_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  specialization: 'GOLD' | 'SILVER' | 'DIAMOND' | 'POLISHING' | 'SETTING' | 'REPAIR' | 'OTHER';
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_code: string;
  name: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  description: string | null;
  default_metal: string | null;
  default_purity: string | null;
  default_unit: string;
  hsn_code: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Metal {
  id: string;
  code: string;
  name: string;
  is_active: number;
  created_at: string;
}

export interface MetalPurity {
  id: string;
  metal_id: string;
  metal_code?: string;
  metal_name?: string;
  code: string;
  name: string;
  tunch_percent: number | null;
  is_active: number;
  created_at: string;
}

export interface CurrentRate {
  id: string;
  metal_id: string;
  metal_code: string;
  metal_name: string;
  purity_id: string;
  purity_code: string;
  purity_name: string;
  tunch_percent: number | null;
  rate: number;
  unit: string;
  effective_from: string;
  created_by: string | null;
  created_by_username: string | null;
  created_at: string;
}

// Inventory Entities (Part 3)
export interface StockItem {
  id: string;
  tag_no: string;
  product_id: string;
  metal_id: string;
  purity_id: string;

  gross_weight: number;
  less_weight: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  wastage_percent: number;
  making_charge: number;

  rate_per_gram: number;
  metal_value: number;
  current_value: number | null;

  acquisition_type: string;
  acquisition_reference: string | null;

  status: 'IN_STOCK' | 'SOLD' | 'EXCHANGED' | 'REPAIR' | 'WITH_KARIGAR' | 'RESERVED' | 'RETURNED' | 'ADJUSTED' | 'DAMAGED';
  huid: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;

  product_code?: string;
  product_name?: string;
  category_id?: string;
  category_name?: string;
  category_code?: string;
  metal_code?: string;
  metal_name?: string;
  purity_code?: string;
  purity_name?: string;
  current_rate?: number | null;
  current_valuation?: number | null;
}

export interface StockMovement {
  id: string;
  stock_item_id: string;
  tag_no?: string;
  movement_type: string;
  reference_type: string | null;
  reference_id: string | null;
  from_status: string | null;
  to_status: string;
  quantity: number;
  gross_weight: number;
  net_weight: number;
  fine_weight: number;
  notes: string | null;
  created_by: string | null;
  created_by_username?: string | null;
  created_at: string;
}

export interface ValuationSummaryGroup {
  metal_id: string;
  metal_code: string;
  metal_name: string;
  purity_id: string;
  purity_code: string;
  purity_name: string;
  item_count: number;
  gross_weight: number;
  less_weight: number;
  net_weight: number;
  fine_weight: number;
  current_rate: number;
  current_valuation: number;
  acquisition_value: number;
}

export interface StockValuationResponse {
  total_items: number;
  total_gross_weight: number;
  total_less_weight: number;
  total_net_weight: number;
  total_fine_weight: number;
  total_acquisition_value: number;
  total_current_valuation: number;
  groups: ValuationSummaryGroup[];
}

export interface CreateStockInput {
  tag_no: string;
  product_id: string;
  metal_id: string;
  purity_id: string;
  gross_weight: number;
  less_weight?: number;
  tunch_percent: number;
  wastage_percent?: number;
  making_charge?: number;
  rate_per_gram?: number;
  acquisition_type?: string;
  status?: string;
  huid?: string;
  notes?: string;
}

// Purchase Billing Entities (Part 5)
export interface PurchaseBillItem {
  id: string;
  purchase_bill_id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  category_name?: string;
  metal_id: string;
  metal_code?: string;
  metal_name?: string;
  purity_id: string;
  purity_code?: string;
  purity_name?: string;
  tag_no: string;
  item_name: string;
  gross_weight: number;
  less_weight: number;
  net_weight: number;
  tunch_percent: number;
  fine_weight: number;
  wastage_percent: number;
  wastage_weight?: number;
  wastage_amount?: number;
  making_charge: number;
  rate_per_gram: number;
  metal_value: number;
  item_amount: number;
  huid: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseBillPayment {
  id: string;
  purchase_bill_id: string;
  payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT';
  amount: number;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseBill {
  id: string;
  purchase_number: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_code?: string;
  supplier_phone?: string | null;
  supplier_gstin?: string | null;
  purchase_date: string;
  supplier_invoice_number: string | null;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  balance_amount: number;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  notes: string | null;
  created_by: string | null;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseBillDetails extends PurchaseBill {
  items: PurchaseBillItem[];
  payments: PurchaseBillPayment[];
}

export interface CreatePurchaseInput {
  supplier_id: string;
  purchase_date?: string;
  supplier_invoice_number?: string;
  discount_amount?: number;
  gst_rate?: number;
  notes?: string;
  items?: AddPurchaseItemInput[];
  payments?: AddPurchasePaymentInput[];
}

export interface AddPurchaseItemInput {
  product_id: string;
  metal_id: string;
  purity_id: string;
  tag_no: string;
  gross_weight: number;
  less_weight?: number;
  tunch_percent: number;
  wastage_percent?: number;
  making_charge?: number;
  rate_per_gram: number;
  huid?: string;
  notes?: string;
}

export interface AddPurchasePaymentInput {
  payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT';
  amount: number;
  reference_number?: string;
  notes?: string;
}

// ==================== WORKSHOP TYPES (Part 7) ====================
export type JobType = 'REPAIR' | 'MANUFACTURING' | 'POLISHING' | 'SETTING' | 'ALTERATION' | 'OTHER';
export type JobStatus = 'DRAFT' | 'READY_TO_ISSUE' | 'ISSUED' | 'IN_PROGRESS' | 'RETURNED' | 'QUALITY_CHECK' | 'COMPLETED' | 'CANCELLED';
export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface WorkshopJobItem {
  id: string;
  workshop_job_id: string;
  stock_item_id: string | null;
  tag_no: string;
  issue_gross_weight: number;
  issue_less_weight: number;
  issue_net_weight: number;
  issue_fine_weight: number;
  return_gross_weight: number | null;
  return_less_weight: number | null;
  return_net_weight: number | null;
  return_fine_weight: number | null;
  weight_difference: number;
  material_issued: string | null;
  material_returned: string | null;
  labour_charge: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopJob {
  id: string;
  job_number: string;
  job_type: JobType;
  karigar_id: string;
  karigar_name?: string;
  karigar_phone?: string | null;
  karigar_specialization?: string;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: JobStatus;
  priority: JobPriority;
  issue_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  description: string;
  instructions: string | null;
  estimated_labour: number;
  actual_labour: number;
  estimated_weight: number;
  returned_weight: number;
  notes: string | null;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: WorkshopJobItem[];
}

export type RepairStatus = 'RECEIVED' | 'ASSIGNED' | 'IN_REPAIR' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type RepairOwnership = 'CUSTOMER_OWNED' | 'SHOP_OWNED';

export interface Repair {
  id: string;
  repair_number: string;
  ownership: RepairOwnership;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  stock_item_id: string | null;
  tag_no?: string | null;
  karigar_id: string | null;
  karigar_name?: string | null;
  karigar_phone?: string | null;
  item_description: string;
  metal_type: string | null;
  purity: string | null;
  gross_weight: number | null;
  net_weight: number | null;
  problem_description: string;
  instructions: string | null;
  estimated_cost: number;
  actual_cost: number;
  status: RepairStatus;
  priority: JobPriority;
  received_date: string;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  delivered_date: string | null;
  notes: string | null;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== FINANCE TYPES (Part 8) ====================
export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'KARIGAR' | 'GIRVI_CLIENT' | 'OTHER';
export type EntryType =
  | 'SALE'
  | 'SALE_PAYMENT'
  | 'PURCHASE'
  | 'PURCHASE_PAYMENT'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT'
  | 'KARIGAR_LABOUR'
  | 'KARIGAR_PAYMENT'
  | 'REFUND'
  | 'OTHER';

export type DebitCredit = 'DEBIT' | 'CREDIT';
export type PaymentType = 'RECEIPT' | 'PAYMENT';
export type PaymentMode = 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT' | 'GOLD' | 'SILVER' | 'OTHER';

export interface LedgerEntry {
  id: string;
  party_type: PartyType;
  party_id: string;
  party_name?: string;
  party_code?: string;
  entry_type: EntryType;
  debit_credit: DebitCredit;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  description: string | null;
  payment_method: PaymentMode | null;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  payment_number: string;
  party_type: PartyType;
  party_id: string;
  party_name?: string;
  party_code?: string;
  payment_type: PaymentType;
  payment_mode: PaymentMode;
  amount: number;
  reference_number: string | null;
  payment_date: string;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
}

export interface PartyStatementSummary {
  total_debit: number;
  total_credit: number;
  entry_count: number;
  current_balance: number;
}

export interface CashBookRow {
  id: string;
  date: string;
  reference_number: string;
  description: string;
  party_type: string;
  party_id: string;
  party_name: string;
  cash_in: number;
  cash_out: number;
  running_balance: number;
}

export interface CashBookResponse {
  items: CashBookRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  opening_balance: number;
  closing_balance: number;
  total_cash_in: number;
  total_cash_out: number;
}

export interface FinanceSummary {
  total_receivables: number;
  total_payables: number;
  supplier_payables: number;
  karigar_payables: number;
  cash_balance: number;
  today_collections: number;
  today_payments: number;
  today_sales: number;
}

// --- Part 9: Girvi Loans & Pledged Jewellery ---
export type GirviLoanStatus = 'DRAFT' | 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CLOSED' | 'DEFAULTED' | 'CANCELLED';
export type GirviInterestType = 'MONTHLY_PERCENT' | 'ANNUAL_PERCENT' | 'FLAT_AMOUNT';
export type GirviPledgeStatus = 'PLEDGED' | 'RELEASED' | 'FORFEITED';

export interface GirviLoanItem {
  id: string;
  loan_id: string;
  source_type: string;
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
  status: GirviPledgeStatus;
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
  event_type: string;
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
  interest_type: GirviInterestType;
  processing_fee: number;
  other_charges: number;
  total_interest: number;
  total_charges: number;
  total_repaid: number;
  outstanding_amount: number;
  status: GirviLoanStatus;
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

export interface GirviMetrics {
  active_loans_count: number;
  total_principal_outstanding: number;
  total_interest_accrued: number;
  overdue_loans_count: number;
  total_pledged_value: number;
  total_repaid_amount: number;
}

// --- Part 9: Saving Schemes (Chits) ---
export type SavingSchemeStatus = 'ACTIVE' | 'MATURED' | 'COMPLETED' | 'CANCELLED' | 'DEFAULTED';
export type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type MaturityBenefitType = 'NONE' | 'FIXED' | 'PERCENTAGE' | 'BONUS';

export interface SavingSchemeType {
  id: string;
  name: string;
  code: string;
  duration_months: number;
  installment_amount: number;
  maturity_benefit_type: MaturityBenefitType;
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
  status: InstallmentStatus;
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
  status: SavingSchemeStatus;
  maturity_payout_date?: string | null;
  maturity_notes?: string | null;
  notes?: string | null;
  installments?: SavingSchemeInstallment[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}



