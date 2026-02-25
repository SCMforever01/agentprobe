import type { SSEEvent, ParsedAnthropicMessage, ContentBlock } from '../types';

export function parseAnthropicMessage(data: string | SSEEvent[]): ParsedAnthropicMessage {
  try {
    if (typeof data === 'string') {
      const json = JSON.parse(data);
      const blocks: ContentBlock[] = ((json?.messages ?? []) as any[])
        .filter((m) => m?.role === 'assistant')
        .map((m) => ({ type: 'text', text: m?.content ?? '' } as ContentBlock));

      return {
        model: json?.model,
        blocks,
        stop_reason: null,
        usage: json?.usage ?? null,
      } as any;
    }

    const events = data.map((ev) => {
      let parsed = null as any;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        parsed = null;
      }
      return { ...ev, parsedData: parsed, event: ev.event_type || 'message' };
    });

    const state: { blocks: Array<any>; usage: any; model: string | null; stop_reason: string | null } = {
      blocks: [],
      usage: null,
      model: null,
      stop_reason: null,
    };

    events.forEach((ev) => {
      const d = ev.parsedData;
      if (!d) return;
      switch (d.type) {
        case 'message_start':
          state.model = d.message?.model ?? null;
          state.usage = d.message?.usage ?? state.usage;
          break;
        case 'content_block_start': {
          const cb = d.content_block ?? {};
          state.blocks[d.index] = {
            type: cb.type,
            index: d.index,
            content: '',
            id: cb.id,
            name: cb.name,
            input: '',
            signature: '',
          } as any;
          break;
        }
        case 'content_block_delta': {
          const block = state.blocks[d.index];
          if (block) {
            const delta = d.delta;
            if (delta?.type === 'thinking_delta') {
              block.content = (block.content ?? '') + (delta.thinking ?? '');
            } else if (delta?.type === 'text_delta') {
              block.content = (block.content ?? '') + (delta.text ?? '');
            } else if (delta?.type === 'input_json_delta') {
              block.input = (block.input ?? '') + (delta.partial_json ?? '');
            } else if (delta?.type === 'signature_delta') {
              block.signature = delta.signature ?? '';
            }
          }
          break;
        }
        case 'content_block_stop':
          break;
        case 'message_delta': {
          state.stop_reason = d.delta?.stop_reason ?? state.stop_reason;
          if (d.usage) {
            state.usage = { ...(state.usage ?? {}), ...d.usage };
          }
          break;
        }
      }
    });

    const blocks: ContentBlock[] = (state.blocks || [])
      .filter((b) => b && b.type)
      .map((b: any) => {
        switch (b.type) {
          case 'thinking':
            return { type: 'thinking', thinking: b.content ?? '', signature: b.signature ?? '' } as ContentBlock;
          case 'text':
            return { type: 'text', text: b.content ?? '' } as ContentBlock;
          case 'tool_use':
            return { type: 'tool_use', id: b.id ?? '', name: b.name ?? '', input: b.input ?? '' } as ContentBlock;
          case 'tool_result': {
            const content = b.content ?? '';
            const is_error = /error|Error:/i.test(content);
            return { type: 'tool_result', tool_use_id: b.id ?? '', content, is_error } as ContentBlock;
          }
          default:
            return { type: 'text', text: b.content ?? '' } as ContentBlock;
        }
      });

    return {
      model: state.model,
      blocks,
      stop_reason: state.stop_reason,
      usage: state.usage ?? null,
    } as any;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`parseAnthropicMessage failed: ${message}`);
  }
}
