// frontend/src/services/repair.ts
import { request } from './api';
import { Repair, PaginatedResult } from '../types';

export interface RepairListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  ownership?: string;
  karigar_id?: string;
  customer_id?: string;
  status?: string;
  priority?: string;
  from_date?: string;
  to_date?: string;
}

export interface CreateRepairInput {
  ownership?: 'CUSTOMER_OWNED' | 'SHOP_OWNED';
  customer_id?: string | null;
  stock_item_id?: string | null;
  karigar_id?: string | null;
  item_description: string;
  metal_type?: string;
  purity?: string;
  gross_weight?: number;
  net_weight?: number;
  problem_description: string;
  instructions?: string;
  estimated_cost?: number;
  priority?: string;
  expected_completion_date?: string;
  notes?: string;
}

export const repairApi = {
  async listRepairs(params: RepairListParams = {}): Promise<PaginatedResult<Repair>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.ownership && params.ownership !== 'ALL') query.append('ownership', params.ownership);
    if (params.karigar_id && params.karigar_id !== 'ALL') query.append('karigar_id', params.karigar_id);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.priority && params.priority !== 'ALL') query.append('priority', params.priority);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);

    const qs = query.toString();
    const res = await request<any>(`/api/repairs${qs ? `?${qs}` : ''}`);
    return {
      items: res.items || [],
      total: res.total || 0,
      page: res.page || 1,
      pageSize: res.pageSize || 20,
      totalPages: res.totalPages || 1,
    };
  },

  async getRepairById(id: string): Promise<Repair> {
    return request<Repair>(`/api/repairs/${id}`);
  },

  async createRepair(data: CreateRepairInput): Promise<Repair> {
    return request<Repair>('/api/repairs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async assignRepair(id: string, karigar_id: string): Promise<Repair> {
    return request<Repair>(`/api/repairs/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ karigar_id }),
    });
  },

  async startRepair(id: string): Promise<Repair> {
    return request<Repair>(`/api/repairs/${id}/start`, {
      method: 'POST',
    });
  },

  async completeRepair(id: string, actual_cost?: number): Promise<Repair> {
    return request<Repair>(`/api/repairs/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actual_cost }),
    });
  },

  async deliverRepair(id: string): Promise<Repair> {
    return request<Repair>(`/api/repairs/${id}/deliver`, {
      method: 'POST',
    });
  },

  async cancelRepair(id: string): Promise<Repair> {
    return request<Repair>(`/api/repairs/${id}/cancel`, {
      method: 'POST',
    });
  },
};
