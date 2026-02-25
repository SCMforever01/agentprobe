from __future__ import annotations

_METHOD_CATEGORIES: dict[str, str] = {
    "initialize": "lifecycle",
    "initialized": "lifecycle",
    "shutdown": "lifecycle",
    "notifications/initialized": "lifecycle",
    "notifications/cancelled": "lifecycle",
    "tools/list": "tools",
    "tools/call": "tools",
    "resources/list": "resources",
    "resources/read": "resources",
    "resources/subscribe": "resources",
    "resources/unsubscribe": "resources",
    "prompts/list": "prompts",
    "prompts/get": "prompts",
    "completion/complete": "completion",
    "logging/setLevel": "logging",
    "notifications/resources/updated": "resources",
    "notifications/resources/list_changed": "resources",
    "notifications/tools/list_changed": "tools",
    "notifications/prompts/list_changed": "prompts",
}


def parse_mcp_message(body: dict) -> dict:
    jsonrpc = body.get("jsonrpc", "")
    msg_id = body.get("id")
    method = body.get("method")
    params = body.get("params", {})
    result = body.get("result")
    error = body.get("error")

    if method is not None:
        msg_type = "notification" if msg_id is None else "request"
    elif result is not None or error is not None:
        msg_type = "response"
    else:
        msg_type = "unknown"

    parsed: dict = {
        "jsonrpc": jsonrpc,
        "message_type": msg_type,
    }

    if msg_id is not None:
        parsed["id"] = msg_id

    if method is not None:
        parsed["method"] = method
        parsed["category"] = classify_mcp_method(method)

    if msg_type == "request":
        parsed["params"] = _summarize_params(method or "", params)

    if msg_type == "notification":
        parsed["params"] = _summarize_params(method or "", params)

    if msg_type == "response":
        if error is not None:
            parsed["is_error"] = True
            parsed["error_code"] = error.get("code", 0) if isinstance(error, dict) else 0
            parsed["error_message"] = error.get("message", "") if isinstance(error, dict) else str(error)
        else:
            parsed["is_error"] = False
            parsed["result_summary"] = _summarize_result(result)

    return parsed


def classify_mcp_method(method: str) -> str:
    if method in _METHOD_CATEGORIES:
        return _METHOD_CATEGORIES[method]

    prefix = method.split("/")[0] if "/" in method else method
    category_map = {
        "tools": "tools",
        "resources": "resources",
        "prompts": "prompts",
        "notifications": "notifications",
        "completion": "completion",
        "logging": "logging",
        "sampling": "sampling",
    }
    if prefix in category_map:
        return category_map[prefix]

    return "custom"


def _summarize_params(method: str, params: dict) -> dict:
    if not isinstance(params, dict):
        return {}

    if method == "tools/call":
        return {
            "tool_name": params.get("name", ""),
            "has_arguments": bool(params.get("arguments")),
            "argument_keys": list(params.get("arguments", {}).keys())
            if isinstance(params.get("arguments"), dict) else [],
        }

    if method == "resources/read":
        return {"uri": params.get("uri", "")}

    if method == "prompts/get":
        return {
            "prompt_name": params.get("name", ""),
            "has_arguments": bool(params.get("arguments")),
        }

    if method == "initialize":
        client_info = params.get("clientInfo", {})
        return {
            "protocol_version": params.get("protocolVersion", ""),
            "client_name": client_info.get("name", "") if isinstance(client_info, dict) else "",
            "client_version": client_info.get("version", "") if isinstance(client_info, dict) else "",
            "capabilities": list(params.get("capabilities", {}).keys())
            if isinstance(params.get("capabilities"), dict) else [],
        }

    if method == "completion/complete":
        ref = params.get("ref", {})
        return {
            "ref_type": ref.get("type", "") if isinstance(ref, dict) else "",
            "argument_name": params.get("argument", {}).get("name", "")
            if isinstance(params.get("argument"), dict) else "",
        }

    return {"keys": list(params.keys())} if params else {}


def _summarize_result(result: object) -> dict:
    if result is None:
        return {"type": "null"}
    if isinstance(result, dict):
        summary: dict = {"keys": list(result.keys())}
        if "tools" in result:
            tools = result["tools"]
            if isinstance(tools, list):
                summary["tool_count"] = len(tools)
                summary["tool_names"] = [
                    t.get("name", "") for t in tools if isinstance(t, dict)
                ]
        if "resources" in result:
            resources = result["resources"]
            if isinstance(resources, list):
                summary["resource_count"] = len(resources)
        if "prompts" in result:
            prompts = result["prompts"]
            if isinstance(prompts, list):
                summary["prompt_count"] = len(prompts)
        if "content" in result:
            content = result["content"]
            if isinstance(content, list):
                summary["content_count"] = len(content)
        if "serverInfo" in result:
            si = result["serverInfo"]
            if isinstance(si, dict):
                summary["server_name"] = si.get("name", "")
                summary["server_version"] = si.get("version", "")
        return summary
    if isinstance(result, list):
        return {"type": "list", "length": len(result)}
    return {"type": type(result).__name__}
