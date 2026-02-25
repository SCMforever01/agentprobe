import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getStatusColor(code: number | null): string {
  if (!code) return 'text-text-tertiary';
  if (code < 300) return 'text-accent-success';
  if (code < 400) return 'text-accent-warning';
  if (code < 500) return 'text-accent-error';
  return 'text-red-500';
}

export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-accent-success/15 text-accent-success',
    POST: 'bg-accent-blue/15 text-accent-blue',
    PUT: 'bg-accent-orange/15 text-accent-orange',
    PATCH: 'bg-accent-orange/15 text-accent-orange',
    DELETE: 'bg-accent-error/15 text-accent-error',
    OPTIONS: 'bg-surface-4 text-text-secondary',
    HEAD: 'bg-surface-4 text-text-secondary',
  };
  return colors[method.toUpperCase()] || 'bg-surface-4 text-text-secondary';
}

export function getAgentColor(agent: string): string {
  const colors: Record<string, string> = {
    claude_code: '#4361ee',
    opencode: '#2ec4b6',
    cline: '#06d6a0',
    codex: '#fb8500',
    gemini: '#7209b7',
    unknown: '#5a5a72',
  };
  return colors[agent] || colors.unknown;
}

export function getAgentLabel(agent: string): string {
  const labels: Record<string, string> = {
    claude_code: 'Claude',
    opencode: 'OpenCode',
    cline: 'Cline',
    codex: 'Codex',
    gemini: 'Gemini',
    unknown: 'Unknown',
  };
  return labels[agent] || agent;
}

export function getProtocolLabel(protocol: string): string {
  const labels: Record<string, string> = {
    llm_api: 'LLM',
    mcp: 'MCP',
    other: 'Other',
  };
  return labels[protocol] || protocol;
}

export function getRowBgClass(req: { protocol_type: string; status_code: number | null; is_streaming: boolean }): string {
  if (req.status_code && req.status_code >= 400) return 'bg-accent-error/[0.04]';
  if (req.is_streaming) return 'bg-accent-purple/[0.04]';
  if (req.protocol_type === 'mcp') return 'bg-accent-green/[0.04]';
  if (req.protocol_type === 'llm_api') return 'bg-accent-blue/[0.04]';
  return '';
}
