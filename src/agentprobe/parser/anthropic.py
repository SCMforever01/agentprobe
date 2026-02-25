from __future__ import annotations


def parse_anthropic_request(body: dict) -> dict:
    messages = body.get("messages", [])
    system_parts = body.get("system", "")
    if isinstance(system_parts, list):
        system_text = " ".join(
            p.get("text", "") if isinstance(p, dict) else str(p)
            for p in system_parts
        )
    else:
        system_text = str(system_parts) if system_parts else ""

    tool_names = [t.get("name", "") for t in body.get("tools", [])]
    input_tokens_est = _estimate_message_tokens(messages, system_text)

    return {
        "model": body.get("model", ""),
        "max_tokens": body.get("max_tokens", 0),
        "temperature": body.get("temperature"),
        "stream": body.get("stream", False),
        "system_length": len(system_text),
        "message_count": len(messages),
        "messages_summary": _summarize_messages(messages),
        "tool_names": tool_names,
        "tool_count": len(tool_names),
        "has_tool_use": len(tool_names) > 0,
        "stop_sequences": body.get("stop_sequences", []),
        "metadata": body.get("metadata", {}),
        "input_tokens_estimate": input_tokens_est,
    }


def parse_anthropic_response(body: dict) -> dict:
    content_blocks = body.get("content", [])
    text_parts: list[str] = []
    tool_calls: list[dict] = []

    for block in content_blocks:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type", "")
        if block_type == "text":
            text_parts.append(block.get("text", ""))
        elif block_type == "tool_use":
            tool_calls.append({
                "id": block.get("id", ""),
                "name": block.get("name", ""),
                "input": block.get("input", {}),
            })

    usage = body.get("usage", {})

    return {
        "id": body.get("id", ""),
        "model": body.get("model", ""),
        "role": body.get("role", ""),
        "stop_reason": body.get("stop_reason", ""),
        "text": "\n".join(text_parts),
        "text_length": sum(len(t) for t in text_parts),
        "tool_calls": tool_calls,
        "tool_call_count": len(tool_calls),
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cache_read_tokens": usage.get("cache_read_input_tokens", 0),
        "cache_creation_tokens": usage.get("cache_creation_input_tokens", 0),
    }


def parse_anthropic_sse_event(event_type: str, data: dict) -> dict:
    result: dict = {"event_type": event_type}

    if event_type == "message_start":
        message = data.get("message", {})
        result["id"] = message.get("id", "")
        result["model"] = message.get("model", "")
        result["role"] = message.get("role", "")
        usage = message.get("usage", {})
        result["input_tokens"] = usage.get("input_tokens", 0)

    elif event_type == "content_block_start":
        block = data.get("content_block", {})
        result["index"] = data.get("index", 0)
        result["block_type"] = block.get("type", "")
        if block.get("type") == "tool_use":
            result["tool_name"] = block.get("name", "")
            result["tool_id"] = block.get("id", "")

    elif event_type == "content_block_delta":
        delta = data.get("delta", {})
        delta_type = delta.get("type", "")
        result["index"] = data.get("index", 0)
        result["delta_type"] = delta_type
        if delta_type == "text_delta":
            result["text"] = delta.get("text", "")
            result["text_length"] = len(delta.get("text", ""))
        elif delta_type == "input_json_delta":
            result["partial_json"] = delta.get("partial_json", "")

    elif event_type == "content_block_stop":
        result["index"] = data.get("index", 0)

    elif event_type == "message_delta":
        delta = data.get("delta", {})
        result["stop_reason"] = delta.get("stop_reason", "")
        usage = data.get("usage", {})
        result["output_tokens"] = usage.get("output_tokens", 0)

    elif event_type == "message_stop":
        pass

    elif event_type == "ping":
        pass

    elif event_type == "error":
        error = data.get("error", {})
        result["error_type"] = error.get("type", "")
        result["error_message"] = error.get("message", "")

    return result


def _summarize_messages(messages: list) -> list[dict]:
    summary = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "")
        content = msg.get("content", "")
        if isinstance(content, str):
            summary.append({"role": role, "type": "text", "length": len(content)})
        elif isinstance(content, list):
            block_types: list[str] = []
            total_len = 0
            for block in content:
                if isinstance(block, dict):
                    bt = block.get("type", "text")
                    block_types.append(bt)
                    if bt == "text":
                        total_len += len(block.get("text", ""))
                    elif bt == "tool_result":
                        for sub in block.get("content", []):
                            if isinstance(sub, dict) and sub.get("type") == "text":
                                total_len += len(sub.get("text", ""))
            summary.append({
                "role": role,
                "block_types": block_types,
                "length": total_len,
            })
    return summary


def _estimate_message_tokens(messages: list, system_text: str) -> int:
    char_count = len(system_text)
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            char_count += len(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    char_count += len(block.get("text", ""))
                    if block.get("type") == "tool_result":
                        for sub in block.get("content", []):
                            if isinstance(sub, dict):
                                char_count += len(sub.get("text", ""))
    return char_count // 4
