// frontend/src/services/workshop.ts
import { request } from './api';
import {
  WorkshopJob,
  PaginatedResult,
} from '../types';

export interface WorkshopListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  karigar_id?: string;
  customer_id?: string;
  job_type?: string;
  status?: string;
  priority?: string;
  from_date?: string;
  to_date?: string;
}

export interface CreateJobInput {
  job_type: string;
  karigar_id: string;
  customer_id?: string | null;
  priority?: string;
  issue_date?: string;
  expected_return_date?: string;
  description: string;
  instructions?: string;
  estimated_labour?: number;
  notes?: string;
  items?: {
    stock_item_id?: string;
    tag_no: string;
    material_issued?: string;
    labour_charge?: number;
    notes?: string;
  }[];
}

export interface ReturnJobInput {
  returned_items?: {
    item_id: string;
    return_gross_weight: number;
    return_less_weight?: number;
    material_returned?: string;
    labour_charge?: number;
    notes?: string;
  }[];
  actual_labour?: number;
  notes?: string;
}

export const workshopApi = {
  async listJobs(params: WorkshopListParams = {}): Promise<PaginatedResult<WorkshopJob>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.karigar_id && params.karigar_id !== 'ALL') query.append('karigar_id', params.karigar_id);
    if (params.customer_id) query.append('customer_id', params.customer_id);
    if (params.job_type && params.job_type !== 'ALL') query.append('job_type', params.job_type);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.priority && params.priority !== 'ALL') query.append('priority', params.priority);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);

    const qs = query.toString();
    const res = await request<any>(`/api/workshop/jobs${qs ? `?${qs}` : ''}`);
    return {
      items: res.items || [],
      total: res.total || 0,
      page: res.page || 1,
      pageSize: res.pageSize || 20,
      totalPages: res.totalPages || 1,
    };
  },

  async getJobById(id: string): Promise<WorkshopJob> {
    return request<WorkshopJob>(`/api/workshop/jobs/${id}`);
  },

  async createJob(data: CreateJobInput): Promise<WorkshopJob> {
    return request<WorkshopJob>('/api/workshop/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async issueJob(id: string): Promise<WorkshopJob> {
    return request<WorkshopJob>(`/api/workshop/jobs/${id}/issue`, {
      method: 'POST',
    });
  },

  async startJob(id: string): Promise<WorkshopJob> {
    return request<WorkshopJob>(`/api/workshop/jobs/${id}/start`, {
      method: 'POST',
    });
  },

  async returnJob(id: string, data: ReturnJobInput): Promise<WorkshopJob> {
    return request<WorkshopJob>(`/api/workshop/jobs/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async completeJob(id: string): Promise<WorkshopJob> {
    return request<WorkshopJob>(`/api/workshop/jobs/${id}/complete`, {
      method: 'POST',
    });
  },

  async cancelJob(id: string): Promise<WorkshopJob> {
    return request<WorkshopJob>(`/api/workshop/jobs/${id}/cancel`, {
      method: 'POST',
    });
  },

  async getIssueRegister(params: WorkshopListParams = {}): Promise<PaginatedResult<WorkshopJob>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.karigar_id && params.karigar_id !== 'ALL') query.append('karigar_id', params.karigar_id);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);

    const qs = query.toString();
    const res = await request<any>(`/api/workshop/issue-register${qs ? `?${qs}` : ''}`);
    return {
      items: res.items || [],
      total: res.total || 0,
      page: res.page || 1,
      pageSize: res.pageSize || 20,
      totalPages: res.totalPages || 1,
    };
  },
};
