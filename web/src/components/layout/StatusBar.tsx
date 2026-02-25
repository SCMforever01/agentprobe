import { useTrafficStore } from '../../stores/trafficStore';
import { formatBytes } from '../../utils/helpers';

export function StatusBar() {
  const wsConnected = useTrafficStore((s) => s.wsConnected);
  const isCapturing = useTrafficStore((s) => s.isCapturing);
  const stats = useTrafficStore((s) => s.stats);

  const isActive = wsConnected && isCapturing;

  return (
    <div className="h-7 flex items-center justify-between px-4 bg-surface-0 border-t border-border shrink-0 select-none text-2xs">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isActive
                ? 'bg-accent-success animate-pulse-dot'
                : 'bg-text-tertiary'
            }`}
          />
          <span className={isActive ? 'text-accent-success' : 'text-text-tertiary'}>
            {!wsConnected ? 'Disconnected' : isCapturing ? 'Recording' : 'Paused'}
          </span>
        </div>
      </div>

      <div className="text-text-tertiary font-mono">
        Proxy: 127.0.0.1:9090
      </div>

      <div className="flex items-center gap-3 text-text-secondary">
        <span>{stats.total_requests} requests</span>
        <span className="text-text-tertiary">·</span>
        <span>{formatBytes(stats.total_size)}</span>
      </div>
    </div>
  );
}
