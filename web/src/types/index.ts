export interface RequestSummary {
  id: string;
  sequence: number;
  timestamp: string;
  method: string;
  host: string;
  path: string;
  status_code: number | null;
  agent_type: string;
  protocol_type: string;
  duration_ms: number | null;
  response_size: number;
  is_streaming: boolean;
}

export interface CapturedRequest extends RequestSummary {
  url: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  request_size: number;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  sse_events: SSEEvent[] | null;
  ttfb_ms: number | null;
  api_provider: string | null;
  session_id: string | null;
  conversation_id: string | null;
  source_pid: number | null;
}

export interface SSEEvent {
  id: string;
  request_id: string;
  event_index: number;
  event_type: string;
  data: string;
  timestamp: string;
}

export interface TrafficStats {
  total_requests: number;
  total_size: number;
  requests_by_agent: Record<string, number>;
  requests_by_protocol: Record<string, number>;
}

export type AgentType = 'claude_code' | 'opencode' | 'cline' | 'codex' | 'gemini' | 'unknown';
export type ProtocolType = 'llm_api' | 'mcp' | 'other';

export interface Filters {
  agentType: string | null;
  protocolType: string | null;
  search: string;
}

export interface WSMessage {
  type: 'new_request' | 'update_request' | 'stats_update';
  data: RequestSummary | TrafficStats;
}

// ── Parsed Anthropic Message Types ──────────────────────────────────────

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = ThinkingBlock | TextBlock | ToolUseBlock | ToolResultBlock;

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ParsedAnthropicMessage {
  id: string;
  model: string;
  role: 'assistant' | 'user';
  stop_reason: string | null;
  usage: AnthropicUsage;
  content: ContentBlock[];
}
