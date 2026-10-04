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


