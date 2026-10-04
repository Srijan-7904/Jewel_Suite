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
