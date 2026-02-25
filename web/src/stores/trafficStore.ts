import { create } from 'zustand';
import type { CapturedRequest, Filters, RequestSummary, TrafficStats } from '../types';
import { fetchRequest as apiFetchRequest, clearRequests as apiClearRequests } from '../utils/api';

interface TrafficState {
  requests: RequestSummary[];
  selectedRequestId: string | null;
  selectedRequest: CapturedRequest | null;
  isLoadingDetail: boolean;
  filters: Filters;
  isCapturing: boolean;
  stats: TrafficStats;
  wsConnected: boolean;

  // 新增：当前视图模式（traffic/parse）
  currentView: 'traffic' | 'parse';
  // 新增：解析上下文（请求ID + 解析目标），为空表示未处于解析视图
  parseContext: { requestId: string; target: 'request' | 'response' } | null;

  addRequest: (req: RequestSummary) => void;
  updateRequest: (req: RequestSummary) => void;
  selectRequest: (id: string | null) => void;
  setFilter: (filter: Partial<Filters>) => void;
  clearAll: () => void;
  toggleCapture: () => void;
  setWsConnected: (connected: boolean) => void;
  updateStats: (stats: TrafficStats) => void;
  setRequests: (requests: RequestSummary[]) => void;
  openParsePage: (requestId: string, target: 'request' | 'response') => void;
  closeParsePage: () => void;
}

export const useTrafficStore = create<TrafficState>((set, get) => ({
  requests: [],
  selectedRequestId: null,
  selectedRequest: null,
  isLoadingDetail: false,
  filters: {
    agentType: null,
    protocolType: null,
    search: '',
  },
  isCapturing: true,
  stats: {
    total_requests: 0,
    total_size: 0,
    requests_by_agent: {},
    requests_by_protocol: {},
  },
  wsConnected: false,

  // initial view
  currentView: 'traffic',
  parseContext: null,

  addRequest: (req) => {
    set((state) => ({
      requests: [...state.requests, req],
      stats: {
        ...state.stats,
        total_requests: state.stats.total_requests + 1,
        total_size: state.stats.total_size + req.response_size,
      },
    }));
  },

  updateRequest: (req) => {
    set((state) => {
      const idx = state.requests.findIndex((r) => r.id === req.id);
      if (idx === -1) return { requests: [...state.requests, req] };
      const updated = [...state.requests];
      updated[idx] = req;
      const newState: Partial<TrafficState> = { requests: updated };
      if (state.selectedRequestId === req.id && state.selectedRequest) {
        newState.selectedRequest = { ...state.selectedRequest, ...req };
      }
      return newState;
    });
  },

  selectRequest: async (id) => {
    if (!id) {
      set({ selectedRequestId: null, selectedRequest: null });
      return;
    }
    set({ selectedRequestId: id, isLoadingDetail: true });
    try {
      const detail = await apiFetchRequest(id);
      if (get().selectedRequestId === id) {
        set({ selectedRequest: detail, isLoadingDetail: false });
      }
    } catch {
      set({ isLoadingDetail: false });
    }
  },

  setFilter: (filter) => {
    set((state) => ({
      filters: { ...state.filters, ...filter },
    }));
  },

  clearAll: () => {
    (async () => {
      try {
        await apiClearRequests();
      } catch { /* ignore */ }
      set({
        requests: [],
        selectedRequestId: null,
        selectedRequest: null,
        stats: {
          total_requests: 0,
          total_size: 0,
          requests_by_agent: {},
          requests_by_protocol: {},
        },
      });
    })();
  },


  toggleCapture: () => {
    set((state) => ({ isCapturing: !state.isCapturing }));
  },

  setWsConnected: (connected) => {
    set({ wsConnected: connected });
  },

  updateStats: (stats) => {
    set({ stats });
  },

  setRequests: (requests) => {
    set({ requests });
  },

  openParsePage: (requestId, target) => {
    set({ currentView: 'parse', parseContext: { requestId, target } });
  },
  closeParsePage: () => {
    set({ currentView: 'traffic', parseContext: null });
  },
}));

export function useFilteredRequests(): RequestSummary[] {
  const requests = useTrafficStore((s) => s.requests);
  const filters = useTrafficStore((s) => s.filters);
  return requests.filter((req) => {
    if (filters.agentType && req.agent_type !== filters.agentType) return false;
    if (filters.protocolType && req.protocol_type !== filters.protocolType) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        req.host.toLowerCase().includes(q) ||
        req.path.toLowerCase().includes(q) ||
        req.method.toLowerCase().includes(q) ||
        req.agent_type.toLowerCase().includes(q)
      );
    }
    return true;
  });
}
