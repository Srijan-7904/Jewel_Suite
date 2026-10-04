import { request } from './api';
import {
  PurchaseBill,
  PurchaseBillDetails,
  CreatePurchaseInput,
  AddPurchaseItemInput,
  AddPurchasePaymentInput,
  PaginatedResult,
} from '../types';

export interface PurchaseListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  supplier_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const purchaseApi = {
  async list(params: PurchaseListParams = {}): Promise<PaginatedResult<PurchaseBill>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.supplier_id && params.supplier_id !== 'ALL') query.append('supplier_id', params.supplier_id);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);

    const qs = query.toString();
    return request<PaginatedResult<PurchaseBill>>(`/api/purchases${qs ? `?${qs}` : ''}`);
  },

  async getById(id: string): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${id}`);
  },

  async create(data: CreatePurchaseInput): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<CreatePurchaseInput>): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async addItem(billId: string, itemData: AddPurchaseItemInput): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${billId}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  async removeItem(billId: string, itemId: string): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${billId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  async addPayment(billId: string, paymentData: AddPurchasePaymentInput): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${billId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  async finalize(id: string): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${id}/finalize`, {
      method: 'POST',
    });
  },

  async cancel(id: string): Promise<PurchaseBillDetails> {
    return request<PurchaseBillDetails>(`/api/purchases/${id}/cancel`, {
      method: 'POST',
    });
  },

  async getPurchasesBySupplier(supplierId: string): Promise<PurchaseBill[]> {
    return request<PurchaseBill[]>(`/api/suppliers/${supplierId}/purchases`);
  },
};
