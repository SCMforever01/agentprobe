import { useState, useEffect } from 'react';
import { X, Loader2, Clock, Zap, FileCode } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { fetchSSEEvents } from '../../utils/api';
import { HeadersView } from './HeadersView';
import { BodyViewer } from './BodyViewer';
import { SSEViewer } from './SSEViewer';
import {
  cn,
  formatBytes,
  formatDuration,
  getStatusColor,
  getMethodColor,
  getAgentLabel,
  getAgentColor,
} from '../../utils/helpers';
import type { SSEEvent } from '../../types';

type ReqTab = 'headers' | 'body' | 'query';
type ResTab = 'headers' | 'body' | 'sse-timing' | 'sse-data' | 'timing';

function parseQueryParams(url: string): Record<string, string> {
  try {
    const parsed = new URL(url, 'http://localhost');
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    return params;
  } catch {
    return {};
  }
}

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; hidden?: boolean }[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="flex items-center gap-0 border-b border-border shrink-0">
      {tabs
        .filter((t) => !t.hidden)
        .map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            data-active={active === tab.key}
            className="tab-trigger"
          >
            {tab.label}
          </button>
        ))}
    </div>
  );
}

function TimingView({ req }: { req: NonNullable<ReturnType<typeof useTrafficStore.getState>['selectedRequest']> }) {
  const bars = [
    { label: 'TTFB', value: req.ttfb_ms, color: 'bg-accent-blue' },
    { label: 'Total', value: req.duration_ms, color: 'bg-accent-green' },
  ];

  const maxMs = Math.max(...bars.map((b) => b.value || 0), 1);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{bar.label}</span>
              <span className="font-mono text-text-primary">{formatDuration(bar.value)}</span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', bar.color)}
                style={{ width: `${((bar.value || 0) / maxMs) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-3 rounded-md bg-surface-3/30">
          <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Request Size</div>
          <div className="text-sm font-mono font-medium text-text-primary">{formatBytes(req.request_size)}</div>
        </div>
        <div className="p-3 rounded-md bg-surface-3/30">
          <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Response Size</div>
          <div className="text-sm font-mono font-medium text-text-primary">{formatBytes(req.response_size)}</div>
        </div>
        {req.api_provider && (
          <div className="p-3 rounded-md bg-surface-3/30">
            <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Provider</div>
            <div className="text-sm font-medium text-text-primary">{req.api_provider}</div>
          </div>
        )}
        {req.source_pid && (
          <div className="p-3 rounded-md bg-surface-3/30">
            <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">PID</div>
            <div className="text-sm font-mono font-medium text-text-primary">{req.source_pid}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RequestDetail() {
  const selectedRequest = useTrafficStore((s) => s.selectedRequest);
  const isLoadingDetail = useTrafficStore((s) => s.isLoadingDetail);
  const selectRequest = useTrafficStore((s) => s.selectRequest);
  const openParsePage = useTrafficStore((s) => s.openParsePage);
  const [reqTab, setReqTab] = useState<ReqTab>('headers');
  const [resTab, setResTab] = useState<ResTab>('body');
  const [sseEvents, setSseEvents] = useState<SSEEvent[]>([]);

  useEffect(() => {
    if (!selectedRequest) return;
    setReqTab('headers');
    setResTab('body');
    setSseEvents([]);

    if (selectedRequest.is_streaming && selectedRequest.id) {
      fetchSSEEvents(selectedRequest.id)
        .then(setSseEvents)
        .catch(() => setSseEvents([]));
    }
  }, [selectedRequest?.id]);

  if (!selectedRequest && !isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary select-none">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-surface-3/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-text-tertiary" />
          </div>
          <div className="text-xs">Select a request to inspect</div>
        </div>
      </div>
    );
  }

  if (isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
      </div>
    );
  }

  const req = selectedRequest!;
  const queryParams = parseQueryParams(req.url || req.path);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-0/50 border-b border-border shrink-0">
        <span className={cn('badge', getMethodColor(req.method))}>{req.method}</span>
        <span className={cn('text-xs font-mono font-medium', getStatusColor(req.status_code))}>
          {req.status_code || '…'}
        </span>
        <span className="flex-1 min-w-0 text-xs font-mono text-text-primary truncate">
          {req.host}{req.path}
        </span>
        <span
          className="badge bg-surface-4/60 text-2xs"
          style={{ color: getAgentColor(req.agent_type) }}
        >
          {getAgentLabel(req.agent_type)}
        </span>
        {req.duration_ms !== null && (
          <span className="flex items-center gap-1 text-2xs font-mono text-text-secondary">
            <Clock className="w-3 h-3" />
            {formatDuration(req.duration_ms)}
          </span>
        )}
        <button
          onClick={() => selectRequest(null)}
          className="p-1 rounded hover:bg-surface-4 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-b border-border">
  <div className="panel-header text-2xs flex items-center gap-2">
            <span>Request</span>
            <span className="text-text-tertiary font-mono normal-case">{formatBytes(req.request_size)}</span>
            <button
              onClick={() => openParsePage(req.id, 'request')}
              className="p-1 rounded hover:bg-surface-4 text-text-tertiary hover:text-text-primary transition-colors inline-flex items-center gap-1"
              title="解析请求"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="text-xs select-none">解析请求</span>
            </button>
          </div>
          <TabBar
            tabs={[
              { key: 'headers' as ReqTab, label: 'Headers' },
              { key: 'body' as ReqTab, label: 'Body' },
              { key: 'query' as ReqTab, label: `Params (${Object.keys(queryParams).length})`, hidden: Object.keys(queryParams).length === 0 },
            ]}
            active={reqTab}
            onChange={setReqTab}
          />
          <div className="flex-1 overflow-auto">
            {reqTab === 'headers' && <HeadersView headers={req.request_headers} />}
            {reqTab === 'body' && <BodyViewer body={req.request_body} />}
            {reqTab === 'query' && <HeadersView headers={queryParams} />}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="panel-header text-2xs flex items-center gap-2">
            <span>Response</span>
            <span className="text-text-tertiary font-mono normal-case">{formatBytes(req.response_size)}</span>
            {req.is_streaming && (
              <span className="badge bg-accent-purple/15 text-accent-purple">SSE</span>
            )}
            <button
              onClick={() => openParsePage(req.id, 'response')}
              className="p-1 rounded hover:bg-surface-4 text-text-tertiary hover:text-text-primary transition-colors inline-flex items-center gap-1"
              title="解析响应"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="text-xs select-none">解析响应</span>
            </button>
          </div>
          <TabBar
            tabs={[
              { key: 'headers' as ResTab, label: 'Headers' },
              { key: 'body' as ResTab, label: 'Body' },
              { key: 'sse-timing' as ResTab, label: `SSE Events (${sseEvents.length})`, hidden: !req.is_streaming },
              { key: 'sse-data' as ResTab, label: 'SSE Data', hidden: !req.is_streaming },
              { key: 'timing' as ResTab, label: 'Timing' },
            ]}
            active={resTab}
            onChange={setResTab}
          />
          <div className="flex-1 overflow-auto">
            {resTab === 'headers' && <HeadersView headers={req.response_headers || {}} />}
            {resTab === 'body' && <BodyViewer body={req.response_body} />}
            {resTab === 'sse-timing' && <SSEViewer mode="timeline" events={sseEvents} isLive={req.status_code === null} />}
            {resTab === 'sse-data' && <SSEViewer mode="aggregated" events={sseEvents} isLive={req.status_code === null} />}
            {resTab === 'timing' && <TimingView req={req} />}
          </div>
        </div>
      </div>
    </div>
  );
}
