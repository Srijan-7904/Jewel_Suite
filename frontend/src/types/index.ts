export interface User {
  id: string;
  username: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SystemHealth {
  status: string;
  database: string;
  version: string;
  mode: string;
  timestamp: string;
}

export interface NavSubItem {
  id: string;
  label: string;
  path: string;
  badge?: string;
}

export interface NavSection {
  id: string;
  label: string;
  iconName: string;
  items: NavSubItem[];
}
