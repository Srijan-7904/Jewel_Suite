import { request } from './api';
import {
  Customer,
  Supplier,
  Karigar,
  Category,
  Product,
  Metal,
  MetalPurity,
  CurrentRate,
  PaginatedResult,
} from '../types';

export const customerApi = {
  list(params: { page?: number; pageSize?: number; search?: string; customer_type?: string; status?: string }): Promise<PaginatedResult<Customer>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.search) query.set('search', params.search);
    if (params.customer_type) query.set('customer_type', params.customer_type);
    if (params.status) query.set('status', params.status);

    return request<PaginatedResult<Customer>>(`/api/customers?${query.toString()}`);
  },

  getById(id: string): Promise<Customer> {
    return request<Customer>(`/api/customers/${id}`);
  },

  create(data: Partial<Customer>): Promise<Customer> {
    return request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Customer>): Promise<Customer> {
    return request<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleActive(id: string, is_active: number): Promise<Customer> {
    return request<Customer>(`/api/customers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  },
};

export const supplierApi = {
  list(params: { page?: number; pageSize?: number; search?: string; status?: string }): Promise<PaginatedResult<Supplier>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);

    return request<PaginatedResult<Supplier>>(`/api/suppliers?${query.toString()}`);
  },

  getById(id: string): Promise<Supplier> {
    return request<Supplier>(`/api/suppliers/${id}`);
  },

  create(data: Partial<Supplier>): Promise<Supplier> {
    return request<Supplier>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Supplier>): Promise<Supplier> {
    return request<Supplier>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleActive(id: string, is_active: number): Promise<Supplier> {
    return request<Supplier>(`/api/suppliers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  },
};

export const karigarApi = {
  list(params: { page?: number; pageSize?: number; search?: string; specialization?: string; status?: string }): Promise<PaginatedResult<Karigar>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.search) query.set('search', params.search);
    if (params.specialization) query.set('specialization', params.specialization);
    if (params.status) query.set('status', params.status);

    return request<PaginatedResult<Karigar>>(`/api/karigars?${query.toString()}`);
  },

  getById(id: string): Promise<Karigar> {
    return request<Karigar>(`/api/karigars/${id}`);
  },

  create(data: Partial<Karigar>): Promise<Karigar> {
    return request<Karigar>('/api/karigars', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Karigar>): Promise<Karigar> {
    return request<Karigar>(`/api/karigars/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleActive(id: string, is_active: number): Promise<Karigar> {
    return request<Karigar>(`/api/karigars/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  },
};

export const categoryApi = {
  list(params: { page?: number; pageSize?: number; search?: string; status?: string }): Promise<PaginatedResult<Category>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);

    return request<PaginatedResult<Category>>(`/api/categories?${query.toString()}`);
  },

  getAll(all = false): Promise<Category[]> {
    return request<Category[]>(`/api/categories/all?all=${all}`);
  },

  getById(id: string): Promise<Category> {
    return request<Category>(`/api/categories/${id}`);
  },

  create(data: Partial<Category>): Promise<Category> {
    return request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Category>): Promise<Category> {
    return request<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleActive(id: string, is_active: number): Promise<Category> {
    return request<Category>(`/api/categories/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  },
};

export const productApi = {
  list(params: { page?: number; pageSize?: number; search?: string; category_id?: string; metal?: string; purity?: string; status?: string }): Promise<PaginatedResult<Product>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.search) query.set('search', params.search);
    if (params.category_id) query.set('category_id', params.category_id);
    if (params.metal) query.set('metal', params.metal);
    if (params.purity) query.set('purity', params.purity);
    if (params.status) query.set('status', params.status);

    return request<PaginatedResult<Product>>(`/api/products?${query.toString()}`);
  },

  getById(id: string): Promise<Product> {
    return request<Product>(`/api/products/${id}`);
  },

  create(data: Partial<Product>): Promise<Product> {
    return request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Product>): Promise<Product> {
    return request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleActive(id: string, is_active: number): Promise<Product> {
    return request<Product>(`/api/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    });
  },
};

export const rateApi = {
  getMetals(): Promise<Metal[]> {
    return request<Metal[]>('/api/rates/metals');
  },

  getPuritiesByMetal(metalId: string): Promise<MetalPurity[]> {
    return request<MetalPurity[]>(`/api/rates/metals/${metalId}/purities`);
  },

  getAllPurities(): Promise<MetalPurity[]> {
    return request<MetalPurity[]>('/api/rates/purities');
  },

  getCurrentRates(): Promise<CurrentRate[]> {
    return request<CurrentRate[]>('/api/rates/current');
  },

  getRateHistory(purityId?: string, metalId?: string, limit = 50): Promise<CurrentRate[]> {
    const query = new URLSearchParams();
    if (purityId) query.set('purity_id', purityId);
    if (metalId) query.set('metal_id', metalId);
    if (limit) query.set('limit', limit.toString());

    return request<CurrentRate[]>(`/api/rates/history?${query.toString()}`);
  },

  createRate(data: { metal_id: string; purity_id: string; rate: number; unit?: string; effective_from?: string }): Promise<any> {
    return request<any>('/api/rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
