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

  const text = await response.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    if (!response.ok) {
      throw new ApiClientError(
        `Server returned error ${response.status} (${response.statusText})`,
        'SERVER_ERROR',
        response.status
      );
    }
    throw new ApiClientError(
      'Invalid JSON response from server',
      'PARSE_ERROR',
      response.status
    );
  }

  if (!response.ok || !data.success) {
    const errorObj = data.error || {};
    let msg = errorObj.message || 'An unexpected error occurred';
    if (errorObj.details && Array.isArray(errorObj.details) && errorObj.details.length > 0) {
      const first = errorObj.details[0];
      if (first.field && first.message) {
        msg = `${first.field}: ${first.message}`;
      } else if (first.message) {
        msg = first.message;
      }
    }
    throw new ApiClientError(
      msg,
      errorObj.code || 'UNKNOWN_ERROR',
      response.status,
      errorObj.details
    );
  }

  return (data as ApiResponse<T>).data !== undefined ? (data as ApiResponse<T>).data : (data as unknown as T);
}
