import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { ArrowLeft, Loader2, AlertCircle, FileSearch, ChevronRight, ChevronDown } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { fetchRequest } from '../../utils/api';
import type { CapturedRequest } from '../../types';

type JsonObject = Record<string, unknown>;

type ParseSectionTab = 'aggregate' | 'role' | 'tools' | 'mcp' | 'skills';

interface RoleEntry {
  source: string;
  role: string;
  content: unknown;
}

interface ToolEntry {
  source: string;
  kind: 'definition' | 'use' | 'result';
  name: string;
  payload: unknown;
}

interface MCPEntry {
  source: string;
  method: string;
  payload: unknown;
}

interface SkillEntry {
  source: string;
  name: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseJsonObject(data: string): JsonObject | null {
  try {
    const parsed = JSON.parse(data);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function collectMessageLikeContainers(payload: JsonObject): Array<{ source: string; node: JsonObject }> {
  const containers: Array<{ source: string; node: JsonObject }> = [];

  const messages = asArray(payload.messages);
  messages.forEach((item, index) => {
    if (isObject(item)) {
      containers.push({ source: `messages[${index}]`, node: item });
    }
  });

  const input = asArray(payload.input);
  input.forEach((item, index) => {
    if (isObject(item)) {
      containers.push({ source: `input[${index}]`, node: item });
    }
  });

  return containers;
}

function extractRoleEntries(payload: JsonObject): RoleEntry[] {
  const entries: RoleEntry[] = [];

  if (typeof payload.role === 'string') {
    entries.push({ source: 'root.role', role: payload.role, content: payload.content ?? null });
  }

  collectMessageLikeContainers(payload).forEach(({ source, node }) => {
    const role = node.role;
    if (typeof role === 'string') {
      entries.push({
        source,
        role,
        content: node.content ?? null,
      });
    }
  });

  return entries;
}

function extractContentBlocks(node: JsonObject): unknown[] {
  const blocks = asArray(node.content);
  return blocks.length > 0 ? blocks : [];
}

function extractToolEntries(payload: JsonObject): ToolEntry[] {
  const entries: ToolEntry[] = [];

  const tools = asArray(payload.tools);
  tools.forEach((tool, index) => {
    if (!isObject(tool)) {
      return;
    }

    const name = typeof tool.name === 'string' ? tool.name : `tool_${index}`;
    entries.push({
      source: `tools[${index}]`,
      kind: 'definition',
      name,
      payload: tool,
    });
  });

  const allContainers = collectMessageLikeContainers(payload);
  if (asArray(payload.content).length > 0) {
    allContainers.push({ source: 'root.content', node: payload });
  }

  allContainers.forEach(({ source, node }) => {
    extractContentBlocks(node).forEach((block, index) => {
      if (!isObject(block) || typeof block.type !== 'string') {
        return;
      }

      if (block.type === 'tool_use') {
        const name = typeof block.name === 'string' ? block.name : `tool_use_${index}`;
        entries.push({
          source: `${source}.content[${index}]`,
          kind: 'use',
          name,
          payload: block.input ?? block,
        });
      }

      if (block.type === 'tool_result') {
        const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : `tool_result_${index}`;
        entries.push({
          source: `${source}.content[${index}]`,
          kind: 'result',
          name: toolUseId,
          payload: block,
        });
      }
    });
  });

  return entries;
}

function extractMCPEntries(payload: JsonObject): MCPEntry[] {
  const entries: MCPEntry[] = [];

  if (typeof payload.method === 'string' && typeof payload.jsonrpc === 'string') {
    entries.push({
      source: 'root',
      method: payload.method,
      payload: {
        jsonrpc: payload.jsonrpc,
        id: payload.id ?? null,
        params: payload.params ?? null,
      },
    });
  }

  const mcpServers = payload.mcp_servers;
  if (isObject(mcpServers)) {
    Object.entries(mcpServers).forEach(([name, config]) => {
      entries.push({
        source: `mcp_servers.${name}`,
        method: name,
        payload: config,
      });
    });
  }

  return entries;
}

function parseSkillNamesFromText(text: string): string[] {
  const matches = text.matchAll(/-\s*([a-zA-Z0-9_-]+)\s*:/g);
  return Array.from(matches, (match) => match[1]);
}

function extractSkillEntries(payload: JsonObject): SkillEntry[] {
  const entries: SkillEntry[] = [];
  const seen = new Set<string>();

  const addSkill = (name: string, source: string) => {
    const key = `${source}:${name}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    entries.push({ source, name });
  };

  const loadSkills = asArray(payload.load_skills);
  loadSkills.forEach((skill, index) => {
    if (typeof skill === 'string') {
      addSkill(skill, `load_skills[${index}]`);
    }
  });

  const inspectTextForSkills = (text: string, source: string) => {
    if (!text.includes('skills') && !text.includes('Skill tool')) {
      return;
    }

    parseSkillNamesFromText(text).forEach((skillName) => addSkill(skillName, source));
  };

  collectMessageLikeContainers(payload).forEach(({ source, node }) => {
    const content = node.content;

    if (typeof content === 'string') {
      inspectTextForSkills(content, `${source}.content`);
      return;
    }

    asArray(content).forEach((part, index) => {
      if (!isObject(part)) {
        return;
      }

      const text = part.text;
      if (typeof text === 'string') {
        inspectTextForSkills(text, `${source}.content[${index}].text`);
      }

      const input = part.input;
      if (isObject(input)) {
        asArray(input.load_skills).forEach((skill, skillIndex) => {
          if (typeof skill === 'string') {
            addSkill(skill, `${source}.content[${index}].input.load_skills[${skillIndex}]`);
          }
        });
      }
    });
  });

  return entries;
}

function JsonBlock({ value }: { value: unknown }) {
  const text = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  return (
    <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all leading-relaxed bg-surface-2/40 border border-border/30 rounded-md p-3 overflow-auto">
      {text}
    </pre>
  );
}

function toPreviewText(value: unknown, maxLength = 140): string {
  if (value === null || value === undefined) {
    return 'No data';
  }

  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else {
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
  }

  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return 'No data';
  }

  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}

interface CollapsibleDataCardProps {
  header: ReactNode;
  source: string;
  preview: string;
  value: unknown;
}

function CollapsibleDataCard({ header, source, preview, value }: CollapsibleDataCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-md border border-border/40 bg-surface-2/30 overflow-hidden">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left px-3 py-2 border-b border-border/30 hover:bg-surface-3/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {header}
          <span className="text-2xs font-mono text-text-tertiary ml-auto">{source}</span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
          )}
        </div>
        <div className="mt-1 text-xs text-text-secondary font-mono truncate">{preview}</div>
      </button>

      {isOpen && (
        <div className="p-3 bg-surface-1/40">
          <JsonBlock value={value} />
        </div>
      )}
    </div>
  );
}

function ULWStructuredView({ data, target }: { data: string; target: ParseTarget }) {
  const [section, setSection] = useState<ParseSectionTab>('aggregate');

  const parsed = useMemo(() => parseJsonObject(data), [data]);
  const roleEntries = useMemo(() => (parsed ? extractRoleEntries(parsed) : []), [parsed]);
  const toolEntries = useMemo(() => (parsed ? extractToolEntries(parsed) : []), [parsed]);
  const mcpEntries = useMemo(() => (parsed ? extractMCPEntries(parsed) : []), [parsed]);
  const skillEntries = useMemo(() => (parsed ? extractSkillEntries(parsed) : []), [parsed]);

  if (!parsed) {
    return (
      <div className="p-4">
        <div className="panel">
          <div className="panel-header">Raw {target === 'request' ? 'Request' : 'Response'} Body</div>
          <div className="p-4">
            <JsonBlock value={data} />
          </div>
        </div>
      </div>
    );
  }

  const tabs: Array<{ key: ParseSectionTab; label: string }> = [
    { key: 'aggregate', label: 'Aggregate' },
    { key: 'role', label: `Role (${roleEntries.length})` },
    { key: 'tools', label: `Tools (${toolEntries.length})` },
    { key: 'mcp', label: `MCP (${mcpEntries.length})` },
    { key: 'skills', label: `Skills (${skillEntries.length})` },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <span>ULW Structured {target === 'request' ? 'Request' : 'Response'}</span>
          <span className="text-2xs font-mono text-text-tertiary normal-case">
            role:{roleEntries.length} · tools:{toolEntries.length} · mcp:{mcpEntries.length} · skills:{skillEntries.length}
          </span>
        </div>

        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSection(tab.key)}
              data-active={section === tab.key}
              className="tab-trigger"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {section === 'aggregate' && <JsonBlock value={parsed} />}

          {section === 'role' && (
            <div className="space-y-3">
              {roleEntries.length === 0 && <div className="text-xs text-text-tertiary">No role inputs detected.</div>}
              {roleEntries.map((entry, index) => (
                <CollapsibleDataCard
                  key={`${entry.source}-${index}`}
                  header={<span className="badge bg-accent-blue/15 text-accent-blue">{entry.role}</span>}
                  source={entry.source}
                  preview={toPreviewText(entry.content)}
                  value={entry.content}
                />
              ))}
            </div>
          )}

          {section === 'tools' && (
            <div className="space-y-3">
              {toolEntries.length === 0 && <div className="text-xs text-text-tertiary">No tools input detected.</div>}
              {toolEntries.map((entry, index) => (
                <CollapsibleDataCard
                  key={`${entry.source}-${entry.name}-${index}`}
                  header={
                    <>
                      <span className="badge bg-accent-warning/15 text-accent-warning">{entry.kind}</span>
                      <span className="text-xs font-mono text-text-primary">{entry.name}</span>
                    </>
                  }
                  source={entry.source}
                  preview={toPreviewText(entry.payload)}
                  value={entry.payload}
                />
              ))}
            </div>
          )}

          {section === 'mcp' && (
            <div className="space-y-3">
              {mcpEntries.length === 0 && <div className="text-xs text-text-tertiary">No MCP input detected.</div>}
              {mcpEntries.map((entry, index) => (
                <div key={`${entry.source}-${entry.method}-${index}`} className="rounded-md border border-border/40 bg-surface-2/30 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
                    <span className="badge bg-accent-green/15 text-accent-green">{entry.method}</span>
                    <span className="text-2xs font-mono text-text-tertiary">{entry.source}</span>
                  </div>
                  <div className="p-3">
                    <JsonBlock value={entry.payload} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'skills' && (
            <div className="space-y-3">
              {skillEntries.length === 0 && <div className="text-xs text-text-tertiary">No skills input detected.</div>}
              {skillEntries.map((entry, index) => (
                <CollapsibleDataCard
                  key={`${entry.source}-${entry.name}-${index}`}
                  header={<span className="badge bg-accent-purple/15 text-accent-purple">{entry.name}</span>}
                  source={entry.source}
                  preview={toPreviewText({ name: entry.name, source: entry.source })}
                  value={{
                    name: entry.name,
                    source: entry.source,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ParseTarget = 'request' | 'response';
type ParseMode = 'dialogue' | 'sse';

interface ParsedSSEEvent {
  id: string;
  event: string;
  data: string;
  parsedData: unknown;
}

function collectOpenAIResponseOutputText(value: unknown): string[] {
  if (!isObject(value) || !Array.isArray(value.output)) {
    return [];
  }

  const segments: string[] = [];
  value.output.forEach((item) => {
    if (!isObject(item) || !Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((part) => {
      if (!isObject(part)) {
        return;
      }

      if (typeof part.text === 'string') {
        segments.push(part.text);
      }
    });
  });

  return segments;
}

function aggregateSSEResponseText(events: ParsedSSEEvent[]): string {
  const deltaSegments: string[] = [];
  let completedText = '';
  const rawSegments: string[] = [];

  events.forEach((event) => {
    const payload = event.parsedData;
    if (typeof payload === 'string' && payload.trim()) {
      rawSegments.push(payload);
    }

    if (!isObject(payload)) {
      return;
    }

    if (typeof payload.type === 'string') {
      if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
        deltaSegments.push(payload.delta);
      }

      if (payload.type === 'response.output_text.done' && typeof payload.text === 'string') {
        completedText = payload.text;
      }

      if (payload.type === 'content_block_delta' && isObject(payload.delta) && typeof payload.delta.text === 'string') {
        deltaSegments.push(payload.delta.text);
      }

      if (payload.type === 'content_block_start' && isObject(payload.content_block) && typeof payload.content_block.text === 'string') {
        deltaSegments.push(payload.content_block.text);
      }
    }

    if (isObject(payload.response)) {
      const outputTexts = collectOpenAIResponseOutputText(payload.response);
      if (outputTexts.length > 0) {
        completedText = outputTexts.join('');
      }
    }
  });

  if (completedText) {
    return completedText;
  }

  if (deltaSegments.length > 0) {
    return deltaSegments.join('');
  }

  return rawSegments.join('\n');
}

function parseJsonLines(rawText: string): ParsedSSEEvent[] {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const events: ParsedSSEEvent[] = [];

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line);
      let eventName = 'json_line';

      if (isObject(parsed) && typeof parsed.type === 'string') {
        eventName = parsed.type;
      } else if (isObject(parsed) && isObject(parsed.response) && typeof parsed.response.object === 'string') {
        eventName = parsed.response.object;
      }

      events.push({
        id: `${index}-${Math.random().toString(36).slice(2, 8)}`,
        event: eventName,
        data: line,
        parsedData: parsed,
      });
    } catch {
      events.push({
        id: `${index}-${Math.random().toString(36).slice(2, 8)}`,
        event: 'raw_line',
        data: line,
        parsedData: line,
      });
    }
  });

  return events;
}

function parseRawSSE(rawText: string): ParsedSSEEvent[] {
  const lines = rawText.split('\n');
  const events: ParsedSSEEvent[] = [];

  let started = false;
  let currentEvent = '';
  let currentData: string[] = [];

  const flush = () => {
    if (!currentEvent && currentData.length === 0) {
      return;
    }

    const data = currentData.join('\n');
    let parsedData: unknown = data;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }

    events.push({
      id: `${events.length}-${Math.random().toString(36).slice(2, 8)}`,
      event: currentEvent || 'message',
      data,
      parsedData,
    });

    currentEvent = '';
    currentData = [];
  };

  for (const originalLine of lines) {
    const line = originalLine.trimEnd();

    if (!started && (line.startsWith('event:') || line.startsWith('data:'))) {
      started = true;
    }

    if (!started) {
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }

    if (line.startsWith('event:')) {
      currentEvent = line.slice('event:'.length).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      currentData.push(line.slice('data:'.length).trim());
      continue;
    }
  }

  flush();

  if (events.length > 0) {
    return events;
  }

  return parseJsonLines(rawText);
}

function detectParseMode(text: string): ParseMode {
  try {
    const parsed = JSON.parse(text);
    if (isObject(parsed)) {
      if (Array.isArray(parsed.messages)) {
        return 'dialogue';
      }

      if (Array.isArray(parsed.input)) {
        return 'dialogue';
      }
    }
  } catch {
    return 'sse';
  }

  return 'sse';
}

function SSEEventItem({ event }: { event: ParsedSSEEvent }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2 text-left hover:bg-surface-3/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="badge bg-accent-purple/15 text-accent-purple">{event.event}</span>
          <span className="text-xs font-mono text-text-secondary truncate flex-1">{toPreviewText(event.data, 110)}</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" /> : <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          <JsonBlock value={event.parsedData} />
        </div>
      )}
    </div>
  );
}

export function ParsePage() {
  const parseContext = useTrafficStore((s) => s.parseContext);
  const closeParsePage = useTrafficStore((s) => s.closeParsePage);
  const parseDraft = useTrafficStore((s) => s.parseDraft);
  const setParseDraft = useTrafficStore((s) => s.setParseDraft);

  const [request, setRequest] = useState<CapturedRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<ParseTarget>(parseContext?.target ?? 'request');

  const [inputText, setInputText] = useState(parseDraft);
  const [parsedText, setParsedText] = useState(parseDraft);
  const [parseMode, setParseMode] = useState<ParseMode>(detectParseMode(parseDraft || '{}'));
  const [sseEvents, setSseEvents] = useState<ParsedSSEEvent[]>([]);

  const aggregatedSSEText = useMemo(() => aggregateSSEResponseText(sseEvents), [sseEvents]);

  useEffect(() => {
    if (!parseContext) {
      return;
    }

    queueMicrotask(() => {
      setIsLoading(true);
      setError(null);
      setActiveTarget(parseContext.target);
    });

    fetchRequest(parseContext.requestId)
      .then((detail) => {
        setRequest(detail);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载请求数据失败');
        setIsLoading(false);
      });
  }, [parseContext]);

  const contextData = useMemo(() => {
    if (!parseContext || !request) {
      return null;
    }

    if (activeTarget === 'request') {
      return request.request_body;
    }

    if (request.sse_events && request.sse_events.length > 0) {
      const aggregated = request.sse_events.map((event) => event.data).filter(Boolean).join('\n');
      return aggregated || request.response_body;
    }

    return request.response_body;
  }, [activeTarget, parseContext, request]);

  useEffect(() => {
    if (!parseContext || contextData === null) {
      return;
    }

    const mode = detectParseMode(contextData);
    queueMicrotask(() => {
      setInputText(contextData);
      setParsedText(contextData);
      setParseMode(mode);
      setSseEvents(mode === 'sse' ? parseRawSSE(contextData) : []);
      setParseDraft(contextData);
    });
  }, [contextData, parseContext, setParseDraft]);

  const handleParse = () => {
    const text = inputText.trim();
    if (!text) {
      setParsedText('');
      setSseEvents([]);
      setParseDraft('');
      return;
    }

    const mode = detectParseMode(text);
    setParseMode(mode);
    setParsedText(text);
    setSseEvents(mode === 'sse' ? parseRawSSE(text) : []);
    setParseDraft(text);
  };

  const handleClear = () => {
    setInputText('');
    setParsedText('');
    setSseEvents([]);
    setParseDraft('');
  };

  const handleBack = () => {
    setParseDraft(inputText);
    closeParsePage();
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-surface-1">
      <div className="flex items-center gap-3 px-4 h-[52px] shrink-0 bg-surface-0/50 border-b border-border">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-2 py-1.5 -ml-1 text-xs font-medium text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3/50 transition-colors"
          title="返回"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </button>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-text-primary truncate">Parser Workspace</span>
          <span className="badge bg-accent-blue/15 text-accent-blue">{parseMode.toUpperCase()}</span>
          {parseContext && (
            <span className="text-2xs font-mono text-text-tertiary">
              {activeTarget === 'request' ? 'Request' : 'Response'}
            </span>
          )}
        </div>

        {parseContext && (
          <div className="ml-auto flex items-center gap-0 shrink-0">
            <button
              onClick={() => setActiveTarget('request')}
              data-active={activeTarget === 'request'}
              className="tab-trigger"
            >
              Request
            </button>
            <button
              onClick={() => setActiveTarget('response')}
              data-active={activeTarget === 'response'}
              className="tab-trigger"
            >
              Response
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="w-[36%] min-w-[320px] border-r border-border flex flex-col bg-surface-0/30">
          <div className="p-3 border-b border-border/40 space-y-2">
            <div className="text-2xs font-semibold uppercase tracking-widest text-text-tertiary">Raw Input</div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste request/response/SSE data..."
              className="w-full h-44 p-3 rounded-md bg-surface-2 border border-border/50 text-xs font-mono text-text-secondary resize-none outline-none focus:border-accent-blue/50"
            />
            <div className="flex items-center gap-2">
              <button onClick={handleParse} className="px-3 py-1.5 rounded-md bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-colors">Parse</button>
              <button onClick={handleClear} className="px-3 py-1.5 rounded-md bg-surface-3/60 text-text-secondary text-xs font-medium hover:bg-surface-4/60 transition-colors">Clear</button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {parseMode === 'sse' && sseEvents.length > 0 ? (
              <div className="panel m-3 overflow-hidden">
                <div className="panel-header">Event Sequence ({sseEvents.length})</div>
                <div>
                  {sseEvents.map((event) => (
                    <SSEEventItem key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-text-tertiary">Click Parse to generate structured result.</div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading && parseContext ? (
            <div className="h-full flex items-center justify-center text-text-secondary text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />
              加载请求数据…
            </div>
          ) : !isLoading && error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <AlertCircle className="w-5 h-5 text-accent-error mx-auto" />
                <div className="text-xs text-text-tertiary">{error}</div>
              </div>
            </div>
          ) : parsedText ? (
            parseMode === 'dialogue' ? (
              <ULWStructuredView data={parsedText} target={activeTarget} />
            ) : (
              <div className="p-4">
                <div className="panel">
                  <div className="panel-header">SSE Aggregated Data</div>
                  <div className="p-4">
                    <JsonBlock value={aggregatedSSEText || sseEvents.map((event) => event.parsedData)} />
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="h-full flex items-center justify-center text-text-tertiary">
              <div className="text-center space-y-2">
                <FileSearch className="w-5 h-5 mx-auto" />
                <div className="text-xs">暂无可解析数据</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
