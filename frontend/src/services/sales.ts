// frontend/src/services/sales.ts
import { request } from './api';
import { PaginatedResult } from '../types';

export interface SalesInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  invoice_date: string;

  subtotal: number;
  discount_amount: number;
  taxable_amount: number;

  gst_rate: number;
  gst_amount: number;

  round_off: number;
  grand_total: number;

  exchange_amount: number;
  net_payable: number;

  amount_paid: number;
  balance_amount: number;

  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  notes: string | null;

  created_by?: string | null;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesInvoiceItem {
  id: string;
  sales_invoice_id: string;
  stock_item_id: string | null;

  tag_no: string;
  item_name: string;
  metal_id: string;
  metal_name?: string;
  purity_id: string;
  purity_name?: string;

  huid?: string;

  gross_weight: number;
  less_weight: number;
  net_weight: number;

  tunch_percent: number;
  fine_weight: number;

  wastage_percent?: number;
  wastage_weight?: number;
  wastage_amount?: number;

  metal_rate?: number;
  rate_per_gram?: number;
  metal_value: number;

  pieces?: number;
  making_rate?: number;
  making_charge_type?: 'PER_GRAM' | 'FIXED' | 'PER_PIECE' | 'PERCENTAGE';
  making_charges?: number;
  making_charge?: number;

  item_total?: number;
  item_amount?: number;
}

export interface SalesPaymentRecord {
  id: string;
  sales_invoice_id: string;
  payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT' | 'GOLD' | 'SILVER' | 'OTHER';
  amount: number;
  metal_weight?: number | null;
  metal_rate?: number | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface SalesInvoiceDetails extends SalesInvoice {
  items: SalesInvoiceItem[];
  payments?: SalesPaymentRecord[];
  exchanges?: any[];
  exchange?: any;
}

export const salesApi = {
  list(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    customer_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<PaginatedResult<SalesInvoice>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.search) query.set('search', params.search);
    if (params.customer_id) query.set('customer_id', params.customer_id);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.from_date) query.set('from_date', params.from_date);
    if (params.to_date) query.set('to_date', params.to_date);

    return request<PaginatedResult<SalesInvoice>>(`/api/sales/invoices?${query.toString()}`);
  },

  getDetails(id: string): Promise<SalesInvoiceDetails> {
    return request<SalesInvoiceDetails>(`/api/sales/invoices/${id}`);
  },

  createDraft(data: {
    customer_id: string;
    invoice_date?: string;
    discount_amount?: number;
    gst_rate?: number;
    notes?: string;
    items?: {
      stock_item_id?: string;
      tag_no?: string;
      item_name: string;
      metal_id: string;
      purity_id: string;
      gross_weight: number;
      less_weight?: number;
      tunch_percent?: number;
      rate_per_gram?: number;
      pieces?: number;
      making_charge?: number;
      metal_rate?: number;
      making_rate?: number;
      making_charge_type?: 'PER_GRAM' | 'FIXED' | 'PER_PIECE' | 'PERCENTAGE';
    }[];
    payments?: {
      payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT' | 'GOLD' | 'SILVER' | 'OTHER';
      amount: number;
      metal_weight?: number;
      metal_rate?: number;
      metal_id?: string;
      purity_id?: string;
      reference_number?: string;
      notes?: string;
    }[];
  }): Promise<SalesInvoiceDetails> {
    return request<SalesInvoiceDetails>('/api/sales/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  finalize(id: string, payments?: {
    payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT' | 'GOLD' | 'SILVER' | 'OTHER';
    amount: number;
    metal_weight?: number;
    metal_rate?: number;
    metal_id?: string;
    purity_id?: string;
    reference_number?: string;
    notes?: string;
  }[]): Promise<SalesInvoiceDetails> {
    return request<SalesInvoiceDetails>(`/api/sales/invoices/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ payments }),
    });
  },

  cancel(id: string): Promise<SalesInvoiceDetails> {
    return request<SalesInvoiceDetails>(`/api/sales/invoices/${id}/cancel`, {
      method: 'POST',
    });
  },
};
