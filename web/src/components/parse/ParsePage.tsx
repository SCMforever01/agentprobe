import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, FileSearch } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { fetchRequest } from '../../utils/api';
import type { CapturedRequest } from '../../types';

// ─── 占位组件 ──────────────────────────────────────────────────
// 这些组件将由其他任务实现，此处仅提供占位符

/** Anthropic 消息结构化视图 (占位符) */
function AnthropicMessageView({ data }: { data: string }) {
  return (
    <div className="p-4">
      <div className="panel">
        <div className="panel-header">Anthropic Message View</div>
        <pre className="p-4 text-xs font-mono text-text-secondary overflow-auto max-h-[calc(100vh-200px)] whitespace-pre-wrap break-all">
          {data}
        </pre>
      </div>
    </div>
  );
}

/** JSON 通用回退视图 (占位符) */
function JsonFallbackView({ data }: { data: string }) {
  let formatted = data;
  try {
    formatted = JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    // 解析失败则保持原始文本
  }

  return (
    <div className="p-4">
      <div className="panel">
        <div className="panel-header">JSON View</div>
        <pre className="p-4 text-xs font-mono text-text-secondary overflow-auto max-h-[calc(100vh-200px)] whitespace-pre-wrap break-all">
          {formatted}
        </pre>
      </div>
    </div>
  );
}

// ─── Tab 类型 ─────────────────────────────────────────────────

type ParseTarget = 'request' | 'response';

// ─── 主组件 ───────────────────────────────────────────────────

/**
 * ParsePage - 解析页面主容器
 *
 * 全屏布局，用于结构化展示 AI API 的请求/响应数据。
 * 根据 api_provider 选择合适的渲染组件：
 *   - anthropic → AnthropicMessageView
 *   - 其他     → JsonFallbackView
 *
 * 从 useTrafficStore.parseContext 获取解析上下文 (requestId + target)
 */
export function ParsePage() {
  const parseContext = useTrafficStore((s) => s.parseContext);
  const closeParsePage = useTrafficStore((s) => s.closeParsePage);

  // 本地状态：请求详情 + 加载/错误
  const [request, setRequest] = useState<CapturedRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 当前查看的 target (request/response)，初始值来自 parseContext
  const [activeTarget, setActiveTarget] = useState<ParseTarget>(
    parseContext?.target ?? 'request'
  );

  // ─── 加载请求详情 ────────────────────────────────────────────
  useEffect(() => {
    if (!parseContext) return;

    setIsLoading(true);
    setError(null);
    setActiveTarget(parseContext.target);

    fetchRequest(parseContext.requestId)
      .then((detail) => {
        setRequest(detail);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载请求数据失败');
        setIsLoading(false);
      });
  }, [parseContext?.requestId]);

  // ─── 防御：parseContext 为空 ─────────────────────────────────
  if (!parseContext) {
    return (
      <div className="h-screen w-screen flex flex-col bg-surface-1">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-xl bg-surface-3/30 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-accent-error" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-text-primary">无解析上下文</div>
              <div className="text-xs text-text-tertiary">请从请求列表中选择一个请求进行解析</div>
            </div>
            <button
              onClick={closeParsePage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-primary bg-surface-3/50 hover:bg-surface-4/60 rounded-md transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 根据 target 提取展示数据 ────────────────────────────────
  const getDisplayData = (): string | null => {
    if (!request) return null;

    if (activeTarget === 'request') {
      return request.request_body;
    }

    // response: 优先使用 sse_events 的聚合数据，否则用 response_body
    if (request.sse_events && request.sse_events.length > 0) {
      // 聚合所有 SSE event data
      const aggregated = request.sse_events
        .map((e) => e.data)
        .filter(Boolean)
        .join('\n');
      return aggregated || request.response_body;
    }

    return request.response_body;
  };

  // ─── 根据 api_provider 选择渲染组件 ──────────────────────────
  const renderContent = () => {
    const data = getDisplayData();

    if (!data) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-surface-3/30 flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-text-tertiary" />
            </div>
            <div className="text-xs text-text-tertiary">
              {activeTarget === 'request' ? '请求体为空' : '响应体为空'}
            </div>
          </div>
        </div>
      );
    }

    // 根据 api_provider 选择渲染器
    const provider = request?.api_provider?.toLowerCase();

    if (provider === 'anthropic') {
      return <AnthropicMessageView data={data} />;
    }

    // 默认: JSON 回退视图 (支持 openai, google 及其他)
    return <JsonFallbackView data={data} />;
  };

  // ─── 渲染 ─────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-1">
      {/* ── 顶部工具栏 ── */}
      <div className="flex items-center gap-3 px-4 h-[52px] shrink-0 bg-surface-0/50 border-b border-border">
        {/* 左侧: 返回按钮 */}
        <button
          onClick={closeParsePage}
          className="flex items-center gap-1.5 px-2 py-1.5 -ml-1 text-xs font-medium text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-3/50 transition-colors"
          title="返回流量列表"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </button>

        {/* 分隔符 */}
        <div className="w-px h-4 bg-border" />

        {/* 中间: 标题 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-text-primary truncate">
            {activeTarget === 'request' ? '解析请求' : '解析响应'}
          </span>
          {request?.api_provider && (
            <span className="badge bg-accent-blue/15 text-accent-blue shrink-0">
              {request.api_provider}
            </span>
          )}
          {request?.method && (
            <span className="text-2xs font-mono text-text-tertiary truncate">
              {request.method} {request.host}{request.path}
            </span>
          )}
        </div>

        {/* 右侧: Request / Response 切换 Tab */}
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
      </div>

      {/* ── 内容区 ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-surface-1">
        {/* 加载中 */}
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />
              <span className="text-xs">加载请求数据…</span>
            </div>
          </div>
        )}

        {/* 加载出错 */}
        {!isLoading && error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-accent-error/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-accent-error" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-text-primary">加载失败</div>
                <div className="text-xs text-text-tertiary max-w-xs">{error}</div>
              </div>
              <button
                onClick={closeParsePage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-primary bg-surface-3/50 hover:bg-surface-4/60 rounded-md transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回
              </button>
            </div>
          </div>
        )}

        {/* 请求未找到 */}
        {!isLoading && !error && !request && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-surface-3/30 flex items-center justify-center">
                <FileSearch className="w-5 h-5 text-text-tertiary" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-text-primary">请求未找到</div>
                <div className="text-xs text-text-tertiary">
                  ID: {parseContext.requestId}
                </div>
              </div>
              <button
                onClick={closeParsePage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-primary bg-surface-3/50 hover:bg-surface-4/60 rounded-md transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回
              </button>
            </div>
          </div>
        )}

        {/* 正常内容渲染 */}
        {!isLoading && !error && request && renderContent()}
      </div>
    </div>
  );
}
