import type { CapturedRequest, RequestSummary, SSEEvent, TrafficStats } from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface RequestParams {
  page?: number;
  per_page?: number;
  agent_type?: string;
  protocol_type?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function fetchRequests(params: RequestParams = {}): Promise<PaginatedResponse<RequestSummary>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return request<PaginatedResponse<RequestSummary>>(`/requests${qs ? `?${qs}` : ''}`);
}

export async function fetchRequest(id: string): Promise<CapturedRequest> {
  return request<CapturedRequest>(`/requests/${id}`);
}

export async function fetchSSEEvents(id: string): Promise<SSEEvent[]> {
  return request<SSEEvent[]>(`/requests/${id}/sse-events`);
}

export async function clearRequests(): Promise<void> {
  await fetch(`${API_BASE}/requests`, { method: 'DELETE' });
}

export async function fetchStats(): Promise<TrafficStats> {
  return request<TrafficStats>('/stats');
}
