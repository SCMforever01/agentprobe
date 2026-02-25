import { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTrafficStore, useFilteredRequests } from '../../stores/trafficStore';
import {
  cn,
  formatBytes,
  formatDuration,
  formatTimestamp,
  getStatusColor,
  getMethodColor,
  getAgentLabel,
  getAgentColor,
  getProtocolLabel,
  getRowBgClass,
} from '../../utils/helpers';

const COLUMNS = [
  { key: 'sequence', label: '#', width: 'w-12' },
  { key: 'status', label: 'Status', width: 'w-14' },
  { key: 'method', label: 'Method', width: 'w-16' },
  { key: 'agent', label: 'Agent', width: 'w-16' },
  { key: 'host', label: 'Host', width: 'w-40' },
  { key: 'path', label: 'Path', width: 'flex-1 min-w-0' },
  { key: 'type', label: 'Type', width: 'w-12' },
  { key: 'duration', label: 'Time', width: 'w-16' },
  { key: 'size', label: 'Size', width: 'w-16' },
  { key: 'timestamp', label: 'When', width: 'w-16' },
];

const ROW_HEIGHT = 28;

export function RequestList() {
  const filteredRequests = useFilteredRequests();
  const selectedRequestId = useTrafficStore((s) => s.selectedRequestId);
  const selectRequest = useTrafficStore((s) => s.selectRequest);
  const parentRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);

  const virtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const scrollToBottom = useCallback(() => {
    if (parentRef.current) {
      const el = parentRef.current;
      wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    }
  }, []);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', scrollToBottom);
    return () => el.removeEventListener('scroll', scrollToBottom);
  }, [scrollToBottom]);

  useEffect(() => {
    if (wasAtBottom.current && filteredRequests.length > 0) {
      virtualizer.scrollToIndex(filteredRequests.length - 1, { align: 'end' });
    }
  }, [filteredRequests.length, virtualizer]);

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex items-center h-7 px-2 bg-surface-0/50 border-b border-border shrink-0 select-none">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn('text-2xs font-medium text-text-tertiary uppercase tracking-wider px-1.5', col.width)}
          >
            {col.label}
          </div>
        ))}
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        {filteredRequests.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
            <div className="text-center space-y-2">
              <div className="text-3xl opacity-30">⚡</div>
              <div>No requests captured yet</div>
              <div className="text-2xs">Traffic will appear here in real-time</div>
            </div>
          </div>
        ) : (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const req = filteredRequests[virtualRow.index];
              const isSelected = selectedRequestId === req.id;

              return (
                <div
                  key={req.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  onClick={() => selectRequest(req.id)}
                  className={cn(
                    'absolute top-0 left-0 w-full flex items-center h-7 px-2 cursor-pointer border-b border-border/30',
                    'transition-colors duration-75',
                    isSelected
                      ? 'bg-accent-blue/10 border-l-2 border-l-accent-blue'
                      : getRowBgClass(req),
                    !isSelected && 'hover:bg-surface-3/40'
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="w-12 px-1.5 text-2xs font-mono text-text-tertiary">
                    {req.sequence}
                  </div>

                  <div className={cn('w-14 px-1.5 text-xs font-mono font-medium', getStatusColor(req.status_code))}>
                    {req.status_code || '…'}
                  </div>

                  <div className="w-16 px-1.5">
                    <span className={cn('badge', getMethodColor(req.method))}>
                      {req.method}
                    </span>
                  </div>

                  <div className="w-16 px-1.5">
                    <span
                      className="badge bg-surface-4/60"
                      style={{ color: getAgentColor(req.agent_type) }}
                    >
                      {getAgentLabel(req.agent_type).slice(0, 5)}
                    </span>
                  </div>

                  <div className="w-40 px-1.5 text-xs text-text-secondary truncate font-mono">
                    {req.host}
                  </div>

                  <div className="flex-1 min-w-0 px-1.5 text-xs text-text-primary truncate font-mono">
                    {req.path}
                    {req.is_streaming && (
                      <span className="ml-1.5 text-accent-purple text-2xs">● SSE</span>
                    )}
                  </div>

                  <div className="w-12 px-1.5">
                    <span className="text-2xs text-text-tertiary">
                      {getProtocolLabel(req.protocol_type)}
                    </span>
                  </div>

                  <div className="w-16 px-1.5 text-xs font-mono text-text-secondary text-right">
                    {formatDuration(req.duration_ms)}
                  </div>

                  <div className="w-16 px-1.5 text-xs font-mono text-text-tertiary text-right">
                    {formatBytes(req.response_size)}
                  </div>

                  <div className="w-16 px-1.5 text-2xs font-mono text-text-tertiary text-right">
                    {formatTimestamp(req.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
