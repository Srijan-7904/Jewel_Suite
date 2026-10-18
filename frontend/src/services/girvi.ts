// frontend/src/services/girvi.ts
// Jewel Suite: Girvi / Pledged Jewellery HTTP Client API

import { request } from './api';
import { GirviLoan, GirviMetrics, PaginatedResult } from '../types';

export interface GirviQueryParams {
  page?: number;
  pageSize?: number;
  customer_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export const girviApi = {
  getMetrics: async (): Promise<GirviMetrics> => {
    return request<GirviMetrics>('/api/girvi/metrics');
  },

  listLoans: async (params: GirviQueryParams = {}): Promise<PaginatedResult<GirviLoan>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.customer_id) query.set('customer_id', params.customer_id);
    if (params.status) query.set('status', params.status);
    if (params.from_date) query.set('from_date', params.from_date);
    if (params.to_date) query.set('to_date', params.to_date);
    if (params.search) query.set('search', params.search);

    return request<PaginatedResult<GirviLoan>>(`/api/girvi/loans?${query.toString()}`);
  },

  getLoan: async (id: string): Promise<GirviLoan> => {
    return request<GirviLoan>(`/api/girvi/loans/${id}`);
  },

  createLoan: async (data: any): Promise<GirviLoan> => {
    return request<GirviLoan>('/api/girvi/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  disburseLoan: async (id: string, data?: { payment_mode?: string }): Promise<GirviLoan> => {
    return request<GirviLoan>(`/api/girvi/loans/${id}/disburse`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  recordRepayment: async (id: string, data: any): Promise<GirviLoan> => {
    return request<GirviLoan>(`/api/girvi/loans/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  closeLoan: async (id: string, notes?: string): Promise<GirviLoan> => {
    return request<GirviLoan>(`/api/girvi/loans/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  releasePledge: async (id: string, notes?: string): Promise<GirviLoan> => {
    return request<GirviLoan>(`/api/girvi/loans/${id}/release`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  getCustomerLoans: async (customerId: string): Promise<GirviLoan[]> => {
    return request<GirviLoan[]>(`/api/customers/${customerId}/girvi-loans`);
  },
};
