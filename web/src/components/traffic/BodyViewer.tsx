import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface BodyViewerProps {
  body: string | null;
  contentType?: string;
}

type ViewMode = 'pretty' | 'raw' | 'hex';

function CopyAllButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium
                 text-text-secondary hover:text-text-primary hover:bg-surface-4 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-accent-success" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 3);

  if (value === null) {
    return <span className="text-text-tertiary italic">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-accent-purple">{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-accent-orange">{value}</span>;
  }
  if (typeof value === 'string') {
    const truncated = value.length > 500 ? value.slice(0, 500) + '…' : value;
    return <span className="text-accent-success">"{truncated}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-tertiary">[]</span>;

    if (collapsed) {
      return (
        <span
          onClick={() => setCollapsed(false)}
          className="cursor-pointer hover:bg-surface-4/50 rounded px-0.5"
        >
          <ChevronRight className="w-3 h-3 inline text-text-tertiary" />
          <span className="text-text-tertiary">
            Array({value.length})
          </span>
        </span>
      );
    }

    return (
      <span>
        <span
          onClick={() => setCollapsed(true)}
          className="cursor-pointer hover:bg-surface-4/50 rounded px-0.5"
        >
          <ChevronDown className="w-3 h-3 inline text-text-tertiary" />
        </span>
        {'[\n'}
        {value.map((item, i) => (
          <span key={i}>
            {'  '.repeat(depth + 1)}
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {'  '.repeat(depth)}
        {']'}
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-text-tertiary">{'{}'}</span>;

    if (collapsed) {
      return (
        <span
          onClick={() => setCollapsed(false)}
          className="cursor-pointer hover:bg-surface-4/50 rounded px-0.5"
        >
          <ChevronRight className="w-3 h-3 inline text-text-tertiary" />
          <span className="text-text-tertiary">
            {'{'}…{'}'}({entries.length})
          </span>
        </span>
      );
    }

    return (
      <span>
        <span
          onClick={() => setCollapsed(true)}
          className="cursor-pointer hover:bg-surface-4/50 rounded px-0.5"
        >
          <ChevronDown className="w-3 h-3 inline text-text-tertiary" />
        </span>
        {'{\n'}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {'  '.repeat(depth + 1)}
            <span className="text-accent-blue">"{k}"</span>
            <span className="text-text-tertiary">: </span>
            <JsonValue value={v} depth={depth + 1} />
            {i < entries.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {'  '.repeat(depth)}
        {'}'}
      </span>
    );
  }

  return <span className="text-text-secondary">{String(value)}</span>;
}

function toHex(str: string): string {
  const lines: string[] = [];
  for (let i = 0; i < str.length; i += 16) {
    const slice = str.slice(i, i + 16);
    const hex = Array.from(slice)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(slice)
      .map((c) => {
        const code = c.charCodeAt(0);
        return code >= 32 && code <= 126 ? c : '.';
      })
      .join('');
    lines.push(
      `${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`
    );
  }
  return lines.join('\n');
}

export function BodyViewer({ body }: BodyViewerProps) {
  const [mode, setMode] = useState<ViewMode>('pretty');

  const parsedJson = useMemo(() => {
    if (!body) return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }, [body]);

  if (!body) {
    return (
      <div className="flex items-center justify-center h-32 text-text-tertiary text-xs">
        No body
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-0.5">
          {(['pretty', 'raw', 'hex'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-2 py-0.5 rounded text-2xs font-medium transition-colors capitalize',
                mode === m
                  ? 'bg-accent-blue/15 text-accent-blue'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <CopyAllButton text={body} />
      </div>

      <div className="flex-1 overflow-auto p-3">
        {mode === 'pretty' && parsedJson !== null ? (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
            <JsonValue value={parsedJson} />
          </pre>
        ) : mode === 'hex' ? (
          <pre className="text-xs font-mono text-text-secondary whitespace-pre leading-relaxed">
            {toHex(body)}
          </pre>
        ) : (
          <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all leading-relaxed">
            {body}
          </pre>
        )}
      </div>
    </div>
  );
}
