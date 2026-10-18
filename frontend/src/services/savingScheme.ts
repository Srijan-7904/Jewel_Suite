// frontend/src/services/savingScheme.ts
// Jewel Suite: Saving Schemes HTTP Client API

import { request } from './api';
import { SavingScheme, SavingSchemeType, PaginatedResult } from '../types';

export interface SavingSchemeQueryParams {
  page?: number;
  pageSize?: number;
  customer_id?: string;
  scheme_type_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export const savingSchemeApi = {
  listTypes: async (): Promise<SavingSchemeType[]> => {
    return request<SavingSchemeType[]>('/api/saving-schemes/types');
  },

  createType: async (data: any): Promise<SavingSchemeType> => {
    return request<SavingSchemeType>('/api/saving-schemes/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listSchemes: async (params: SavingSchemeQueryParams = {}): Promise<PaginatedResult<SavingScheme>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.customer_id) query.set('customer_id', params.customer_id);
    if (params.scheme_type_id) query.set('scheme_type_id', params.scheme_type_id);
    if (params.status) query.set('status', params.status);
    if (params.from_date) query.set('from_date', params.from_date);
    if (params.to_date) query.set('to_date', params.to_date);
    if (params.search) query.set('search', params.search);

    return request<PaginatedResult<SavingScheme>>(`/api/saving-schemes?${query.toString()}`);
  },

  getScheme: async (id: string): Promise<SavingScheme> => {
    return request<SavingScheme>(`/api/saving-schemes/${id}`);
  },

  enrollCustomer: async (data: any): Promise<SavingScheme> => {
    return request<SavingScheme>('/api/saving-schemes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  payInstallment: async (
    schemeId: string,
    installmentId: string,
    data: { amount: number; payment_mode: string; reference_number?: string; notes?: string }
  ): Promise<{ scheme: SavingScheme; installment: any }> => {
    return request<{ scheme: SavingScheme; installment: any }>(
      `/api/saving-schemes/${schemeId}/installments/${installmentId}/pay`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  matureScheme: async (id: string, notes?: string): Promise<SavingScheme> => {
    return request<SavingScheme>(`/api/saving-schemes/${id}/mature`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  getCustomerSchemes: async (customerId: string): Promise<SavingScheme[]> => {
    return request<SavingScheme[]>(`/api/customers/${customerId}/saving-schemes`);
  },
};
