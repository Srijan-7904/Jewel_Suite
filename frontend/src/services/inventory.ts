import { request } from './api';
import {
  StockItem,
  StockMovement,
  StockValuationResponse,
  CreateStockInput,
  PaginatedResult,
} from '../types';

export interface StockListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  product_id?: string;
  category_id?: string;
  metal?: string;
  purity?: string;
  status?: string;
}

export const inventoryApi = {
  async list(params: StockListParams = {}): Promise<PaginatedResult<StockItem>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.product_id) query.append('product_id', params.product_id);
    if (params.category_id && params.category_id !== 'ALL') query.append('category_id', params.category_id);
    if (params.metal && params.metal !== 'ALL') query.append('metal', params.metal);
    if (params.purity && params.purity !== 'ALL') query.append('purity', params.purity);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);

    const qs = query.toString();
    return request<PaginatedResult<StockItem>>(`/api/inventory/stock${qs ? `?${qs}` : ''}`);
  },

  async getById(id: string): Promise<StockItem> {
    return request<StockItem>(`/api/inventory/stock/${id}`);
  },

  async getByTag(tagNo: string): Promise<StockItem> {
    return request<StockItem>(`/api/inventory/stock/tag/${encodeURIComponent(tagNo)}`);
  },

  async create(data: CreateStockInput): Promise<StockItem> {
    return request<StockItem>('/api/inventory/stock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<CreateStockInput>): Promise<StockItem> {
    return request<StockItem>(`/api/inventory/stock/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changeStatus(
    id: string,
    data: { to_status: string; notes?: string; reference_type?: string; reference_id?: string }
  ): Promise<StockItem> {
    return request<StockItem>(`/api/inventory/stock/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getMovements(stockItemId: string): Promise<StockMovement[]> {
    return request<StockMovement[]>(`/api/inventory/stock/${stockItemId}/movements`);
  },

  async getValuation(): Promise<StockValuationResponse> {
    return request<StockValuationResponse>('/api/inventory/valuation');
  },
};
