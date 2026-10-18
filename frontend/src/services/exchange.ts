// frontend/src/services/exchange.ts
import { request } from './api';
import { PaginatedResult } from '../types';

export interface ExchangeItem {
  id: string;
  exchange_id: string;
  metal_id: string;
  metal_name?: string;
  metal_code?: string;
  purity_id: string;
  purity_name?: string;
  item_name: string;
  tag_no?: string;
  gross_weight: number;
  less_weight: number;
  net_weight: number;
  tunch_percent: number;
  fine_weight: number;
  exchange_rate: number;
  item_value: number;
  deduction_percent: number;
  deduction_amount: number;
  final_value: number;
  notes?: string;
}

export interface ExchangeRecord {
  id: string;
  exchange_number: string;
  exchange_date: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  sales_invoice_id?: string | null;
  total_gross_weight: number;
  total_net_weight: number;
  total_fine_weight: number;
  total_metal_value: number;
  total_deductions: number;
  final_exchange_value: number;
  payout_amount: number;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  notes?: string;
  created_at: string;
  items?: ExchangeItem[];
}

export interface ExchangeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customer_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export interface CreateExchangeInput {
  customer_id: string;
  exchange_date?: string;
  sales_invoice_id?: string | null;
  payout_amount?: number;
  notes?: string;
  items?: {
    metal_id: string;
    purity_id: string;
    item_name: string;
    gross_weight: number;
    less_weight?: number;
    tunch_percent: number;
    exchange_rate: number;
    deduction_percent?: number;
    deduction_amount?: number;
    notes?: string;
  }[];
}

export const exchangeApi = {
  async list(params: ExchangeListParams = {}): Promise<PaginatedResult<ExchangeRecord>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.customer_id && params.customer_id !== 'ALL') query.append('customer_id', params.customer_id);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);

    const qs = query.toString();
    const res = await request<any>(`/api/exchanges${qs ? `?${qs}` : ''}`);
    return {
      items: res.items || [],
      total: res.total || 0,
      page: res.page || 1,
      pageSize: res.pageSize || 20,
      totalPages: res.totalPages || 1,
    };
  },

  async getDetails(id: string): Promise<ExchangeRecord> {
    return request<ExchangeRecord>(`/api/exchanges/${id}`);
  },

  async createDraft(data: CreateExchangeInput): Promise<ExchangeRecord> {
    return request<ExchangeRecord>('/api/exchanges', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async finalize(id: string): Promise<ExchangeRecord> {
    return request<ExchangeRecord>(`/api/exchanges/${id}/finalize`, {
      method: 'POST',
    });
  },

  async cancel(id: string): Promise<ExchangeRecord> {
    return request<ExchangeRecord>(`/api/exchanges/${id}/cancel`, {
      method: 'POST',
    });
  },
};
