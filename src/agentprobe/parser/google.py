from __future__ import annotations


def parse_google_request(body: dict) -> dict:
    contents = body.get("contents", [])
    gen_config = body.get("generationConfig", {})
    tools = body.get("tools", [])
    system_instruction = body.get("systemInstruction", {})

    system_text = _extract_parts_text(system_instruction.get("parts", []))
    tool_decls = _extract_tool_declarations(tools)

    return {
        "model": body.get("model", ""),
        "contents_count": len(contents),
        "contents_summary": _summarize_contents(contents),
        "system_length": len(system_text),
        "max_output_tokens": gen_config.get("maxOutputTokens", 0),
        "temperature": gen_config.get("temperature"),
        "top_p": gen_config.get("topP"),
        "top_k": gen_config.get("topK"),
        "stop_sequences": gen_config.get("stopSequences", []),
        "tool_names": [t["name"] for t in tool_decls],
        "tool_count": len(tool_decls),
        "has_tool_use": len(tool_decls) > 0,
        "safety_settings": body.get("safetySettings", []),
        "input_tokens_estimate": _estimate_tokens(contents, system_text),
    }


def parse_google_response(body: dict) -> dict:
    candidates = body.get("candidates", [])
    first = candidates[0] if candidates else {}
    content = first.get("content", {})
    parts = content.get("parts", [])

    text_parts: list[str] = []
    function_calls: list[dict] = []

    for part in parts:
        if not isinstance(part, dict):
            continue
        if "text" in part:
            text_parts.append(part["text"])
        if "functionCall" in part:
            fc = part["functionCall"]
            function_calls.append({
                "name": fc.get("name", ""),
                "args": fc.get("args", {}),
            })

    usage = body.get("usageMetadata", {})

    return {
        "text": "\n".join(text_parts),
        "text_length": sum(len(t) for t in text_parts),
        "function_calls": function_calls,
        "function_call_count": len(function_calls),
        "finish_reason": first.get("finishReason", ""),
        "safety_ratings": first.get("safetyRatings", []),
        "prompt_token_count": usage.get("promptTokenCount", 0),
        "candidates_token_count": usage.get("candidatesTokenCount", 0),
        "total_token_count": usage.get("totalTokenCount", 0),
        "candidate_count": len(candidates),
    }


def parse_google_sse_event(data: dict) -> dict:
    if not data:
        return {"event_type": "empty"}

    candidates = data.get("candidates", [])
    first = candidates[0] if candidates else {}
    content = first.get("content", {})
    parts = content.get("parts", [])

    result: dict = {"event_type": "generateContent.chunk"}

    text_parts: list[str] = []
    function_calls: list[dict] = []

    for part in parts:
        if not isinstance(part, dict):
            continue
        if "text" in part:
            text_parts.append(part["text"])
        if "functionCall" in part:
            fc = part["functionCall"]
            function_calls.append({
                "name": fc.get("name", ""),
                "args": fc.get("args", {}),
            })

    if text_parts:
        result["text"] = "".join(text_parts)
        result["text_length"] = sum(len(t) for t in text_parts)

    if function_calls:
        result["function_calls"] = function_calls

    finish_reason = first.get("finishReason")
    if finish_reason:
        result["finish_reason"] = finish_reason

    usage = data.get("usageMetadata")
    if usage:
        result["prompt_token_count"] = usage.get("promptTokenCount", 0)
        result["candidates_token_count"] = usage.get("candidatesTokenCount", 0)
        result["total_token_count"] = usage.get("totalTokenCount", 0)

    return result


def _extract_parts_text(parts: list) -> str:
    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict) and "text" in part:
            texts.append(part["text"])
    return " ".join(texts)


def _extract_tool_declarations(tools: list) -> list[dict]:
    decls: list[dict] = []
    for tool_group in tools:
        if not isinstance(tool_group, dict):
            continue
        for decl in tool_group.get("functionDeclarations", []):
            if isinstance(decl, dict):
                decls.append({
                    "name": decl.get("name", ""),
                    "description": decl.get("description", ""),
                })
    return decls


def _summarize_contents(contents: list) -> list[dict]:
    summary = []
    for content in contents:
        if not isinstance(content, dict):
            continue
        role = content.get("role", "")
        parts = content.get("parts", [])
        part_types: list[str] = []
        text_len = 0
        for part in parts:
            if not isinstance(part, dict):
                continue
            if "text" in part:
                part_types.append("text")
                text_len += len(part["text"])
            elif "functionCall" in part:
                part_types.append("functionCall")
            elif "functionResponse" in part:
                part_types.append("functionResponse")
            elif "inlineData" in part:
                part_types.append("inlineData")
        summary.append({
            "role": role,
            "part_types": part_types,
            "text_length": text_len,
        })
    return summary


def _estimate_tokens(contents: list, system_text: str) -> int:
    chars = len(system_text)
    for content in contents:
        if not isinstance(content, dict):
            continue
        for part in content.get("parts", []):
            if isinstance(part, dict) and "text" in part:
                chars += len(part["text"])
    return chars // 4
