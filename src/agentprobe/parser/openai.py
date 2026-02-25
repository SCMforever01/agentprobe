from __future__ import annotations


def parse_openai_request(body: dict) -> dict:
    messages = body.get("messages", [])
    tools = body.get("tools", [])
    tool_names = [
        t.get("function", {}).get("name", "")
        for t in tools
        if isinstance(t, dict)
    ]

    system_msgs = [
        m for m in messages
        if isinstance(m, dict) and m.get("role") in ("system", "developer")
    ]
    system_length = sum(
        len(m.get("content", "")) if isinstance(m.get("content"), str)
        else sum(
            len(p.get("text", ""))
            for p in (m.get("content") or [])
            if isinstance(p, dict) and p.get("type") == "text"
        )
        for m in system_msgs
    )

    return {
        "model": body.get("model", ""),
        "max_tokens": body.get("max_tokens") or body.get("max_completion_tokens", 0),
        "temperature": body.get("temperature"),
        "stream": body.get("stream", False),
        "system_length": system_length,
        "message_count": len(messages),
        "messages_summary": _summarize_messages(messages),
        "tool_names": tool_names,
        "tool_count": len(tool_names),
        "has_tool_use": len(tool_names) > 0,
        "tool_choice": body.get("tool_choice"),
        "response_format": body.get("response_format"),
        "stream_options": body.get("stream_options"),
        "input_tokens_estimate": _estimate_tokens(messages),
    }


def parse_openai_response(body: dict) -> dict:
    choices = body.get("choices", [])
    first_choice = choices[0] if choices else {}
    message = first_choice.get("message", {})

    text = message.get("content") or ""
    tool_calls_raw = message.get("tool_calls", [])
    tool_calls = [
        {
            "id": tc.get("id", ""),
            "name": tc.get("function", {}).get("name", ""),
            "arguments": tc.get("function", {}).get("arguments", ""),
        }
        for tc in tool_calls_raw
        if isinstance(tc, dict)
    ]

    usage = body.get("usage", {})

    return {
        "id": body.get("id", ""),
        "model": body.get("model", ""),
        "finish_reason": first_choice.get("finish_reason", ""),
        "text": text,
        "text_length": len(text),
        "tool_calls": tool_calls,
        "tool_call_count": len(tool_calls),
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "cached_tokens": usage.get("prompt_tokens_details", {}).get("cached_tokens", 0),
        "choice_count": len(choices),
        "system_fingerprint": body.get("system_fingerprint", ""),
    }


def parse_openai_sse_event(data: dict) -> dict:
    if not data:
        return {"event_type": "empty"}

    if data.get("object") == "chat.completion.chunk":
        return _parse_chat_chunk(data)

    if "type" in data and data.get("type", "").startswith("response."):
        return _parse_responses_event(data)

    return {
        "event_type": "unknown",
        "id": data.get("id", ""),
        "raw_keys": list(data.keys()),
    }


def _parse_chat_chunk(data: dict) -> dict:
    choices = data.get("choices", [])
    first = choices[0] if choices else {}
    delta = first.get("delta", {})

    result: dict = {
        "event_type": "chat.completion.chunk",
        "id": data.get("id", ""),
        "model": data.get("model", ""),
        "finish_reason": first.get("finish_reason"),
    }

    if "content" in delta and delta["content"] is not None:
        result["text"] = delta["content"]
        result["text_length"] = len(delta["content"])

    if "tool_calls" in delta:
        tc_deltas = delta["tool_calls"]
        result["tool_call_deltas"] = [
            {
                "index": tc.get("index", 0),
                "id": tc.get("id", ""),
                "name": tc.get("function", {}).get("name", ""),
                "arguments_chunk": tc.get("function", {}).get("arguments", ""),
            }
            for tc in tc_deltas
            if isinstance(tc, dict)
        ]

    if "role" in delta:
        result["role"] = delta["role"]

    usage = data.get("usage")
    if usage:
        result["prompt_tokens"] = usage.get("prompt_tokens", 0)
        result["completion_tokens"] = usage.get("completion_tokens", 0)

    return result


def _parse_responses_event(data: dict) -> dict:
    event_type = data.get("type", "")
    result: dict = {"event_type": event_type}

    if event_type == "response.created":
        resp = data.get("response", {})
        result["id"] = resp.get("id", "")
        result["model"] = resp.get("model", "")
        result["status"] = resp.get("status", "")

    elif event_type == "response.output_item.added":
        item = data.get("item", {})
        result["item_type"] = item.get("type", "")
        result["item_id"] = item.get("id", "")

    elif event_type == "response.content_part.delta":
        delta = data.get("delta", {})
        result["text"] = delta.get("text", "")
        result["text_length"] = len(delta.get("text", ""))

    elif event_type == "response.output_item.done":
        item = data.get("item", {})
        result["item_type"] = item.get("type", "")
        if item.get("type") == "function_call":
            result["tool_name"] = item.get("name", "")
            result["tool_call_id"] = item.get("call_id", "")
            result["arguments"] = item.get("arguments", "")

    elif event_type == "response.completed":
        resp = data.get("response", {})
        usage = resp.get("usage", {})
        result["id"] = resp.get("id", "")
        result["status"] = resp.get("status", "")
        result["input_tokens"] = usage.get("input_tokens", 0)
        result["output_tokens"] = usage.get("output_tokens", 0)

    return result


def _summarize_messages(messages: list) -> list[dict]:
    summary = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "")
        content = msg.get("content")
        if content is None:
            has_tc = bool(msg.get("tool_calls"))
            summary.append({"role": role, "type": "tool_call_only" if has_tc else "empty", "length": 0})
        elif isinstance(content, str):
            summary.append({"role": role, "type": "text", "length": len(content)})
        elif isinstance(content, list):
            types = []
            total = 0
            for part in content:
                if isinstance(part, dict):
                    pt = part.get("type", "text")
                    types.append(pt)
                    if pt == "text":
                        total += len(part.get("text", ""))
            summary.append({"role": role, "block_types": types, "length": total})
    return summary


def _estimate_tokens(messages: list) -> int:
    chars = 0
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            chars += len(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    chars += len(part.get("text", ""))
    return chars // 4
