import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

interface HeadersViewProps {
  headers: Record<string, string>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-4 transition-opacity"
    >
      {copied ? (
        <Check className="w-3 h-3 text-accent-success" />
      ) : (
        <Copy className="w-3 h-3 text-text-tertiary" />
      )}
    </button>
  );
}

export function HeadersView({ headers }: HeadersViewProps) {
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-tertiary text-xs">
        No headers
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex items-start gap-3 px-3 py-1.5 group row-hover"
        >
          <div className="w-48 shrink-0 text-xs font-mono font-medium text-accent-blue truncate">
            {key}
          </div>
          <div className="flex-1 min-w-0 text-xs font-mono text-text-secondary break-all">
            {value}
          </div>
          <CopyButton text={`${key}: ${value}`} />
        </div>
      ))}
    </div>
  );
}
