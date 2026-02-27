import { useState, useRef, useEffect, useMemo } from 'react';
import type { SSEEvent } from '../../types';
import { cn, formatTimestamp } from '../../utils/helpers';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface SSEViewerProps {
  events: SSEEvent[];
  isLive?: boolean;
  mode?: 'timeline' | 'aggregated';
  }

function EventCard({ event, index }: { event: SSEEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const parsedData = useMemo(() => {
    try {
      return JSON.parse(event.data);
    } catch {
      return null;
    }
  }, [event.data]);

  const eventTypeColors: Record<string, string> = {
    message: 'bg-accent-blue/15 text-accent-blue',
    content_block_delta: 'bg-accent-purple/15 text-accent-purple',
    content_block_start: 'bg-accent-green/15 text-accent-green',
    content_block_stop: 'bg-accent-orange/15 text-accent-orange',
    message_start: 'bg-accent-success/15 text-accent-success',
    message_stop: 'bg-accent-error/15 text-accent-error',
    message_delta: 'bg-accent-warning/15 text-accent-warning',
    ping: 'bg-surface-4 text-text-tertiary',
  };

  return (
    <div className="border border-border/30 rounded-md overflow-hidden animate-fade-in">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 cursor-pointer row-hover select-none"
      >
        <span className="text-2xs font-mono text-text-tertiary w-6 text-right shrink-0">
          {index}
        </span>
        <span className={cn('badge', eventTypeColors[event.event_type] || 'bg-surface-4 text-text-secondary')}>
          {event.event_type}
        </span>
        <span className="flex-1" />
        <span className="text-2xs font-mono text-text-tertiary">
          {formatTimestamp(event.timestamp)}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-tertiary" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-tertiary" />
        )}
      </div>
      {expanded && (
        <div className="p-3 bg-surface-1/50 border-t border-border/30">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed text-text-secondary">
            {parsedData ? JSON.stringify(parsedData, null, 2) : event.data}
          </pre>
        </div>
      )}
    </div>
  );
}

function aggregateSSEContent(events: SSEEvent[]): string {
  const parts: string[] = [];
  let doneText = '';
  
  for (const event of events) {
    try {
      const data = JSON.parse(event.data);

      if (event.event_type === 'response.output_text.delta' && typeof data.delta === 'string') {
        parts.push(data.delta);
        continue;
      }

      if (event.event_type === 'response.output_text.done' && typeof data.text === 'string') {
        doneText = data.text;
        continue;
      }

      if (data.response?.output && Array.isArray(data.response.output)) {
        const chunks: string[] = [];
        data.response.output.forEach((outputItem: unknown) => {
          if (!outputItem || typeof outputItem !== 'object') return;
          const item = outputItem as { content?: unknown[] };
          if (!Array.isArray(item.content)) return;
          item.content.forEach((part: unknown) => {
            if (!part || typeof part !== 'object') return;
            const text = (part as { text?: unknown }).text;
            if (typeof text === 'string') {
              chunks.push(text);
            }
          });
        });

        if (chunks.length > 0) {
          doneText = chunks.join('');
          continue;
        }
      }
      
      // Anthropic: content_block_delta with text delta
      if (event.event_type === 'content_block_delta' && data.delta?.text) {
        parts.push(data.delta.text);
      }
      // OpenAI: choices[0].delta.content
      else if (data.choices?.[0]?.delta?.content) {
        parts.push(data.choices[0].delta.content);
      }
      // Google AI: candidates[0].content.parts[0].text
      else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        parts.push(data.candidates[0].content.parts[0].text);
      }
      // Generic: extract any 'text' or 'content' field
      else if (data.text) {
        parts.push(data.text);
      } else if (data.content && typeof data.content === 'string') {
        parts.push(data.content);
      }
    } catch {
      // Skip unparseable events
    }
  }
  
  return doneText || parts.join('');
}

export function SSEViewer({ events, isLive = false, mode = 'timeline' }: SSEViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLive && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length, isLive]);

  const aggregatedContent = useMemo(() => {
    if (mode === 'aggregated') {
      return aggregateSSEContent(events);
    }
    return '';
  }, [events, mode]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-tertiary text-xs">
        No SSE events
      </div>
    );
  }

  // Timeline mode
  if (mode === 'timeline') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 shrink-0">
          <span className="text-xs text-text-secondary">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-2xs text-accent-purple">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse-dot" />
              Streaming
            </span>
          )}
        </div>
        <div ref={containerRef} className="flex-1 overflow-auto p-2 space-y-1">
          {events.map((event, i) => (
            <EventCard key={event.id || i} event={event} index={event.event_index} />
          ))}
        </div>
      </div>
    );
  }
  
  // Aggregated mode

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 shrink-0">
        <span className="text-xs text-text-secondary">Aggregated from {events.length} events</span>
        {isLive && (
          <span className="flex items-center gap-1.5 text-2xs text-accent-purple">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse-dot" />
            Streaming
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {aggregatedContent ? (
          <div className="space-y-3">
            <div className="text-xs text-text-tertiary mb-2">
              Complete response text:
            </div>
            <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed text-text-primary bg-surface-2/50 p-3 rounded-md border border-border/30">
              {aggregatedContent}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-xs">
            No aggregated content available
          </div>
        )}
      </div>
    </div>
  );
}
