import { ApiResponse } from '../types';

const TOKEN_KEY = 'jewel_suite_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  public code: string;
  public details?: unknown;
  public statusCode: number;

  constructor(message: string, code = 'API_ERROR', statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errorObj = data.error || {};
    throw new ApiClientError(
      errorObj.message || 'An unexpected error occurred',
      errorObj.code || 'UNKNOWN_ERROR',
      response.status,
      errorObj.details
    );
  }

  return (data as ApiResponse<T>).data;
}
