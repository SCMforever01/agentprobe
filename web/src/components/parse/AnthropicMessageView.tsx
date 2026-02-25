import { cn } from '../../utils/helpers';
import type {
  ParsedAnthropicMessage,
  ContentBlock,
  ThinkingBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
} from '../../types';

// ── Block Type Config ────────────────────────────────────────────────

const BLOCK_STYLES = {
  thinking: {
    label: 'Thinking',
    badge: 'bg-accent-blue/15 text-accent-blue',
    border: 'border-accent-blue/20',
    glow: 'bg-accent-blue/[0.03]',
    icon: '🧠',
  },
  text: {
    label: 'Text',
    badge: 'bg-accent-green/15 text-accent-green',
    border: 'border-accent-green/20',
    glow: 'bg-accent-green/[0.03]',
    icon: '📝',
  },
  tool_use: {
    label: 'Tool Use',
    badge: 'bg-accent-warning/15 text-accent-warning',
    border: 'border-accent-warning/20',
    glow: 'bg-accent-warning/[0.03]',
    icon: '⚡',
  },
  tool_result: {
    label: 'Tool Result',
    badge: 'bg-accent-success/15 text-accent-success',
    border: 'border-accent-success/20',
    glow: 'bg-accent-success/[0.03]',
    icon: '✅',
  },
  tool_result_error: {
    label: 'Tool Error',
    badge: 'bg-accent-error/15 text-accent-error',
    border: 'border-accent-error/20',
    glow: 'bg-accent-error/[0.03]',
    icon: '❌',
  },
} as const;

// ── Metadata Card ────────────────────────────────────────────────────

function MetadataCard({ message }: { message: ParsedAnthropicMessage }) {
  const totalTokens = message.usage.input_tokens + message.usage.output_tokens;

  return (
    <div className="rounded-lg bg-surface-2 border border-border overflow-hidden">
      {/* Header row */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
        <span className="badge bg-accent-blue/15 text-accent-blue">{message.role}</span>
        <span className="text-xs font-mono font-medium text-text-primary truncate">
          {message.model}
        </span>
        {message.stop_reason && (
          <span className="badge bg-accent-purple/15 text-accent-purple ml-auto capitalize">
            {message.stop_reason}
          </span>
        )}
      </div>

      {/* Token usage grid */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Total</div>
          <div className="text-sm font-mono font-semibold text-text-primary">
            {totalTokens.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Input</div>
          <div className="text-sm font-mono font-medium text-accent-blue">
            {message.usage.input_tokens.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Output</div>
          <div className="text-sm font-mono font-medium text-accent-green">
            {message.usage.output_tokens.toLocaleString()}
          </div>
        </div>
        {message.usage.cache_read_input_tokens !== undefined && (
          <div>
            <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Cache Read</div>
            <div className="text-sm font-mono font-medium text-accent-orange">
              {message.usage.cache_read_input_tokens.toLocaleString()}
            </div>
          </div>
        )}
        {message.usage.cache_creation_input_tokens !== undefined && (
          <div>
            <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Cache Write</div>
            <div className="text-sm font-mono font-medium text-accent-purple">
              {message.usage.cache_creation_input_tokens.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual Block Renderers ───────────────────────────────────────

function ThinkingBlockView({ block }: { block: ThinkingBlock }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed italic">
        {block.thinking}
      </div>
      {block.signature && (
        <div className="pt-3 border-t border-border/30">
          <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1">Signature</div>
          <div className="text-2xs font-mono text-text-tertiary truncate">{block.signature}</div>
        </div>
      )}
    </div>
  );
}

function TextBlockView({ block }: { block: TextBlock }) {
  return (
    <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
      {block.text}
    </div>
  );
}

function ToolUseBlockView({ block }: { block: ToolUseBlock }) {
  let inputStr: string;
  try {
    inputStr = JSON.stringify(block.input, null, 2);
  } catch {
    inputStr = String(block.input);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xs text-text-tertiary uppercase tracking-wider">Name</span>
        <span className="text-xs font-mono font-semibold text-accent-warning">{block.name}</span>
        <span className="text-2xs text-text-tertiary uppercase tracking-wider ml-4">ID</span>
        <span className="text-2xs font-mono text-text-tertiary">{block.id}</span>
      </div>
      <div>
        <div className="text-2xs text-text-tertiary uppercase tracking-wider mb-1.5">Input</div>
        <div className="bg-surface-0 rounded-md p-3 overflow-x-auto border border-border/30">
          <pre className="text-xs font-mono text-accent-blue whitespace-pre-wrap break-all leading-relaxed">
            {inputStr}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ToolResultBlockView({ block }: { block: ToolResultBlock }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xs text-text-tertiary uppercase tracking-wider">Tool Use ID</span>
        <span className="text-2xs font-mono text-text-tertiary">{block.tool_use_id}</span>
        {block.is_error && (
          <span className="badge bg-accent-error/15 text-accent-error ml-auto">Error</span>
        )}
      </div>
      <div className="bg-surface-0 rounded-md p-3 overflow-x-auto border border-border/30">
        <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all leading-relaxed">
          {block.content}
        </pre>
      </div>
    </div>
  );
}

// ── Content Block Card ───────────────────────────────────────────────

function ContentBlockCard({ block, index }: { block: ContentBlock; index: number }) {
  const isError = block.type === 'tool_result' && block.is_error;
  const styleKey = isError ? 'tool_result_error' : block.type;
  const style = BLOCK_STYLES[styleKey];

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-colors',
        'bg-surface-2',
        style.border,
      )}
    >
      {/* Block header */}
      <div
        className={cn(
          'px-4 py-2 border-b flex items-center gap-2',
          style.glow,
          style.border,
        )}
      >
        <span className="text-xs">{style.icon}</span>
        <span className={cn('badge', style.badge)}>{style.label}</span>
        <span className="text-2xs font-mono text-text-tertiary ml-auto">#{index}</span>
      </div>

      {/* Block content */}
      <div className="p-4">
        {block.type === 'thinking' && <ThinkingBlockView block={block} />}
        {block.type === 'text' && <TextBlockView block={block} />}
        {block.type === 'tool_use' && <ToolUseBlockView block={block} />}
        {block.type === 'tool_result' && <ToolResultBlockView block={block} />}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function AnthropicMessageView({ message }: { message: ParsedAnthropicMessage }) {
  return (
    <div className="space-y-4 p-4">
      {/* Metadata */}
      <MetadataCard message={message} />

      {/* Content Blocks */}
      {message.content.length > 0 && (
        <div className="space-y-3">
          <div className="text-2xs text-text-tertiary uppercase tracking-wider font-medium px-1">
            Content Blocks ({message.content.length})
          </div>
          {message.content.map((block, idx) => (
            <ContentBlockCard key={idx} block={block} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
