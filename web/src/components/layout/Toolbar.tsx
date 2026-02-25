import {
  Search,
  Circle,
  CircleStop,
  Trash2,
  Settings,
  Zap,
} from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { cn } from '../../utils/helpers';

export function Toolbar() {
  const isCapturing = useTrafficStore((s) => s.isCapturing);
  const toggleCapture = useTrafficStore((s) => s.toggleCapture);
  const clearAll = useTrafficStore((s) => s.clearAll);
  const search = useTrafficStore((s) => s.filters.search);
  const setFilter = useTrafficStore((s) => s.setFilter);

  return (
    <div className="h-12 flex items-center gap-3 px-4 bg-surface-0 border-b border-border shrink-0 select-none">
      <div className="flex items-center gap-2 mr-2">
        <div className="w-6 h-6 rounded-md bg-accent-blue/20 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-text-primary">
          AgentProbe
        </span>
      </div>

      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Filter by host, path, method…"
            value={search}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="w-full h-7 pl-8 pr-3 text-xs bg-surface-2 border border-border rounded-md
                       text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20
                       transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleCapture}
          className={cn(
            'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
            isCapturing
              ? 'bg-accent-error/10 text-accent-error hover:bg-accent-error/20'
              : 'bg-accent-success/10 text-accent-success hover:bg-accent-success/20'
          )}
        >
          {isCapturing ? (
            <>
              <CircleStop className="w-3 h-3" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Circle className="w-3 h-3" />
              <span>Record</span>
            </>
          )}
        </button>

        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium
                     text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear</span>
        </button>

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md
                     text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
