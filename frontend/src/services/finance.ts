// frontend/src/services/finance.ts
import { request } from './api';
import {
  LedgerEntry,
  Payment,
  PartyStatementSummary,
  CashBookResponse,
  FinanceSummary,
  PaginatedResult,
} from '../types';

export interface LedgerQueryParams {
  page?: number;
  pageSize?: number;
  party_type?: string;
  party_id?: string;
  entry_type?: string;
  debit_credit?: string;
  payment_method?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface PaymentQueryParams {
  page?: number;
  pageSize?: number;
  party_type?: string;
  party_id?: string;
  payment_type?: string;
  payment_mode?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface CreatePaymentInput {
  party_type: 'CUSTOMER' | 'SUPPLIER' | 'KARIGAR' | 'OTHER';
  party_id: string;
  payment_type: 'RECEIPT' | 'PAYMENT';
  payment_mode: 'CASH' | 'CARD' | 'UPI' | 'BANK' | 'CREDIT';
  amount: number;
  reference_number?: string;
  payment_date?: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

export interface CreateAdjustmentInput {
  party_type: 'CUSTOMER' | 'SUPPLIER' | 'KARIGAR' | 'GIRVI_CLIENT' | 'OTHER';
  party_id: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  reason: string;
  payment_method?: string | null;
  notes?: string;
}

export interface PartyLedgerResponse extends PaginatedResult<LedgerEntry> {
  statement: PartyStatementSummary;
}

export const financeApi = {
  async getSummary(): Promise<FinanceSummary> {
    return request<FinanceSummary>('/api/finance/summary');
  },

  async getLedgerEntries(params: LedgerQueryParams = {}): Promise<PaginatedResult<LedgerEntry>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.party_type && params.party_type !== 'ALL') query.append('party_type', params.party_type);
    if (params.party_id) query.append('party_id', params.party_id);
    if (params.entry_type && params.entry_type !== 'ALL') query.append('entry_type', params.entry_type);
    if (params.debit_credit && params.debit_credit !== 'ALL') query.append('debit_credit', params.debit_credit);
    if (params.payment_method && params.payment_method !== 'ALL') query.append('payment_method', params.payment_method);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.search) query.append('search', params.search);

    const qs = query.toString();
    const res = await request<any>(`/api/finance/ledger${qs ? `?${qs}` : ''}`);
    return {
      items: res.items || [],
      total: res.total || 0,
      page: res.page || 1,
      pageSize: res.pageSize || 20,
      totalPages: res.totalPages || 1,
    };
  },

  async getCustomerLedger(customerId: string, params: { from_date?: string; to_date?: string; page?: number; pageSize?: number } = {}): Promise<PartyLedgerResponse> {
    const query = new URLSearchParams();
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());

    const qs = query.toString();
    return request<PartyLedgerResponse>(`/api/finance/ledger/customer/${customerId}${qs ? `?${qs}` : ''}`);
  },

  async getSupplierLedger(supplierId: string, params: { from_date?: string; to_date?: string; page?: number; pageSize?: number } = {}): Promise<PartyLedgerResponse> {
    const query = new URLSearchParams();
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());

    const qs = query.toString();
    return request<PartyLedgerResponse>(`/api/finance/ledger/supplier/${supplierId}${qs ? `?${qs}` : ''}`);
  },

  async getKarigarLedger(karigarId: string, params: { from_date?: string; to_date?: string; page?: number; pageSize?: number } = {}): Promise<PartyLedgerResponse> {
    const query = new URLSearchParams();
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());

    const qs = query.toString();
    return request<PartyLedgerResponse>(`/api/finance/ledger/karigar/${karigarId}${qs ? `?${qs}` : ''}`);
  },

  async getPayments(params: PaymentQueryParams = {}): Promise<PaginatedResult<Payment>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.party_type && params.party_type !== 'ALL') query.append('party_type', params.party_type);
    if (params.party_id) query.append('party_id', params.party_id);
    if (params.payment_type && params.payment_type !== 'ALL') query.append('payment_type', params.payment_type);
    if (params.payment_mode && params.payment_mode !== 'ALL') query.append('payment_mode', params.payment_mode);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.search) query.append('search', params.search);

    const qs = query.toString();
    const res = await request<any>(`/api/finance/payments${qs ? `?${qs}` : ''}`);
    return {
      items: res.items || [],
      total: res.total || 0,
      page: res.page || 1,
      pageSize: res.pageSize || 20,
      totalPages: res.totalPages || 1,
    };
  },

  async getPaymentById(id: string): Promise<Payment> {
    return request<Payment>(`/api/finance/payments/${id}`);
  },

  async createPayment(data: CreatePaymentInput): Promise<{ payment: Payment; ledger_entry: LedgerEntry }> {
    return request<{ payment: Payment; ledger_entry: LedgerEntry }>('/api/finance/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createAdjustment(data: CreateAdjustmentInput): Promise<LedgerEntry> {
    return request<LedgerEntry>('/api/finance/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCashBook(params: { from_date?: string; to_date?: string; page?: number; pageSize?: number; search?: string } = {}): Promise<CashBookResponse> {
    const query = new URLSearchParams();
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);

    const qs = query.toString();
    return request<CashBookResponse>(`/api/finance/cash-book${qs ? `?${qs}` : ''}`);
  },
};
