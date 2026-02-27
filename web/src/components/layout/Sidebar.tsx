import {
  Globe,
  Bot,
  Cpu,
  Sparkles,
  HelpCircle,
  Network,
  Layers,
  FileCode,
  WandSparkles,
  MoreHorizontal,
} from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { cn, getAgentColor } from '../../utils/helpers';
import { useMemo, type ReactNode } from 'react';

interface SidebarItemProps {
  label: string;
  icon: ReactNode;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}

function SidebarItem({ label, icon, count, active, color, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors group',
        active
          ? 'bg-accent-blue/10 text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-3/50'
      )}
    >
      <span
        className="w-4 h-4 flex items-center justify-center shrink-0"
        style={color ? { color } : undefined}
      >
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'min-w-[1.25rem] h-4 px-1 rounded text-2xs font-mono font-medium flex items-center justify-center',
            active ? 'bg-accent-blue/20 text-accent-blue' : 'bg-surface-4 text-text-tertiary'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const requests = useTrafficStore((s) => s.requests);
  const filters = useTrafficStore((s) => s.filters);
  const setFilter = useTrafficStore((s) => s.setFilter);
  const stats = useTrafficStore((s) => s.stats);
  const unknownHostsExpanded = useTrafficStore((s) => s.unknownHostsExpanded);
  const setUnknownHostsExpanded = useTrafficStore((s) => s.setUnknownHostsExpanded);
  const selectedUnknownHost = useTrafficStore((s) => s.selectedUnknownHost);
  const setSelectedUnknownHost = useTrafficStore((s) => s.setSelectedUnknownHost);
  const currentView = useTrafficStore((s) => s.currentView);
  const openStandaloneParsePage = useTrafficStore((s) => s.openStandaloneParsePage);

  const agentCounts = stats.requests_by_agent;
  const protocolCounts = stats.requests_by_protocol;

  const agents: { key: string | null; label: string; icon: ReactNode; color: string }[] = [
    { key: null, label: 'All Agents', icon: <Globe className="w-3.5 h-3.5" />, color: '#8e8ea0' },
    { key: 'claude_code', label: 'Claude Code', icon: <Bot className="w-3.5 h-3.5" />, color: getAgentColor('claude_code') },
    { key: 'opencode', label: 'OpenCode', icon: <Cpu className="w-3.5 h-3.5" />, color: getAgentColor('opencode') },
    { key: 'cline', label: 'Cline', icon: <Bot className="w-3.5 h-3.5" />, color: getAgentColor('cline') },
    { key: 'codex', label: 'Codex', icon: <FileCode className="w-3.5 h-3.5" />, color: getAgentColor('codex') },
    { key: 'gemini', label: 'Gemini', icon: <Sparkles className="w-3.5 h-3.5" />, color: getAgentColor('gemini') },
    { key: 'unknown', label: 'Unknown', icon: <HelpCircle className="w-3.5 h-3.5" />, color: getAgentColor('unknown') },
  ];

  const protocols: { key: string | null; label: string; icon: ReactNode }[] = [
    { key: null, label: 'All Protocols', icon: <Network className="w-3.5 h-3.5" /> },
    { key: 'llm_api', label: 'LLM API', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'mcp', label: 'MCP', icon: <MoreHorizontal className="w-3.5 h-3.5" /> },
    { key: 'other', label: 'Other', icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  const unknownHosts = useMemo(
    () =>
      Object.entries(
        requests
          .filter((req) => req.agent_type === 'unknown')
          .reduce<Record<string, number>>((acc, req) => {
            acc[req.host] = (acc[req.host] || 0) + 1;
            return acc;
          }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .map(([host, count]) => ({ host, count })),
    [requests]
  );

  const handleAgentClick = (agentKey: string | null) => {
    if (agentKey === 'unknown') {
      const shouldCollapse = filters.agentType === 'unknown' && unknownHostsExpanded;
      if (shouldCollapse) {
        setUnknownHostsExpanded(false);
        setSelectedUnknownHost(null);
        setFilter({ agentType: null, host: null });
        return;
      }

      setUnknownHostsExpanded(true);
      setSelectedUnknownHost(null);
      setFilter({ agentType: 'unknown', host: null });
      return;
    }

    setUnknownHostsExpanded(false);
    setSelectedUnknownHost(null);
    setFilter({ agentType: agentKey, host: null });
  };

  return (
    <div className="w-[220px] shrink-0 bg-surface-0 border-r border-border flex flex-col overflow-hidden select-none">
      <div className="px-3 pt-3 pb-1">
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-text-tertiary">
          Agents
        </h3>
      </div>
      <div className="px-1.5 space-y-0.5">
        {agents.map((agent) => (
          <div key={agent.label} className="space-y-0.5">
            <SidebarItem
              label={agent.label}
              icon={agent.icon}
              count={agent.key ? (agentCounts[agent.key] || 0) : stats.total_requests}
              color={agent.color}
              active={filters.agentType === agent.key}
              onClick={() => handleAgentClick(agent.key)}
            />
            {agent.key === 'unknown' && unknownHostsExpanded && (
              <div className="ml-5 space-y-0.5">
                {unknownHosts.map((entry) => (
                  <button
                    key={entry.host}
                    onClick={() => {
                      setSelectedUnknownHost(entry.host);
                      setFilter({ agentType: 'unknown', host: entry.host });
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1 rounded text-2xs font-mono transition-colors',
                      selectedUnknownHost === entry.host
                        ? 'bg-accent-purple/12 text-text-primary'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-surface-3/40'
                    )}
                  >
                    <span className="truncate flex-1 text-left">{entry.host}</span>
                    <span className="text-2xs text-text-tertiary">{entry.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 pt-4 pb-1">
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-text-tertiary">
          Protocols
        </h3>
      </div>
      <div className="px-1.5 space-y-0.5">
        {protocols.map((proto) => (
          <SidebarItem
            key={proto.label}
            label={proto.label}
            icon={proto.icon}
            count={proto.key ? (protocolCounts[proto.key] || 0) : stats.total_requests}
            active={filters.protocolType === proto.key}
            onClick={() => setFilter({ protocolType: proto.key })}
          />
        ))}
      </div>

      <div className="flex-1" />

      <div className="px-3 pt-3 pb-1 border-t border-border/70">
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-text-tertiary">
          Tools
        </h3>
      </div>
      <div className="px-1.5 pb-2">
        <SidebarItem
          label="Parser"
          icon={<WandSparkles className="w-3.5 h-3.5" />}
          count={0}
          active={currentView === 'parse'}
          onClick={openStandaloneParsePage}
        />
      </div>

      <div className="p-3 border-t border-border">
        <div className="text-2xs text-text-tertiary text-center">
          v0.1.0 · HTTP Inspector
        </div>
      </div>
    </div>
  );
}
