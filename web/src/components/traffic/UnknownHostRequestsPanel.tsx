import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { formatTimestamp, getMethodColor, getStatusColor, cn } from '../../utils/helpers';

export function UnknownHostRequestsPanel() {
  const requests = useTrafficStore((s) => s.requests);
  const selectedUnknownHost = useTrafficStore((s) => s.selectedUnknownHost);
  const setSelectedUnknownHost = useTrafficStore((s) => s.setSelectedUnknownHost);
  const setFilter = useTrafficStore((s) => s.setFilter);

  const hostRequests = useMemo(() => {
    if (!selectedUnknownHost) {
      return [];
    }

    return requests
      .filter((req) => req.agent_type === 'unknown' && req.host === selectedUnknownHost)
      .sort((a, b) => b.sequence - a.sequence);
  }, [requests, selectedUnknownHost]);

  if (!selectedUnknownHost) {
    return null;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-10 shrink-0 px-3 flex items-center gap-2 border-b border-border bg-surface-0/40">
        <div className="text-xs text-text-secondary">Unknown Host</div>
        <div className="text-xs font-mono text-text-primary truncate flex-1">{selectedUnknownHost}</div>
        <button
          className="p-1 rounded hover:bg-surface-3/60 text-text-tertiary hover:text-text-primary"
          onClick={() => {
            setSelectedUnknownHost(null);
            setFilter({ host: null });
          }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {hostRequests.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-text-tertiary">
            No requests for this host
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {hostRequests.map((req) => (
              <div key={req.id} className="px-3 py-2 text-xs grid grid-cols-[auto_auto_1fr_auto] gap-2 items-center">
                <span className={cn('badge', getMethodColor(req.method))}>{req.method}</span>
                <span className={cn('font-mono', getStatusColor(req.status_code))}>{req.status_code ?? '…'}</span>
                <span className="font-mono text-text-secondary truncate">{req.path}</span>
                <span className="font-mono text-text-tertiary">{formatTimestamp(req.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
