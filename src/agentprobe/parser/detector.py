import re

_AGENT_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "claude_code": [
        re.compile(r"claude[-_]?code", re.IGNORECASE),
        re.compile(r"claude[-_]?cli", re.IGNORECASE),
        re.compile(r"anthropic[-_]?cli", re.IGNORECASE),
    ],
    "opencode": [
        re.compile(r"opencode", re.IGNORECASE),
        re.compile(r"open[-_]?code", re.IGNORECASE),
    ],
    "cline": [
        re.compile(r"cline", re.IGNORECASE),
        re.compile(r"vscode.*cline", re.IGNORECASE),
    ],
    "codex": [
        re.compile(r"codex", re.IGNORECASE),
        re.compile(r"vscode.*codex", re.IGNORECASE),
        re.compile(r"openai[-_]?codex", re.IGNORECASE),
    ],
    "gemini": [
        re.compile(r"gemini[-_]?cli", re.IGNORECASE),
        re.compile(r"google[-_]?gemini", re.IGNORECASE),
    ],
}

_ANTHROPIC_HOSTS = {"api.anthropic.com"}
_OPENAI_HOSTS = {"api.openai.com"}
_GOOGLE_HOSTS = {"generativelanguage.googleapis.com"}

_ANTHROPIC_PATH_RE = re.compile(r"^/v1/messages")
_OPENAI_CHAT_PATH_RE = re.compile(r"^/v1/chat/completions")
_OPENAI_RESPONSES_PATH_RE = re.compile(r"^/v1/responses")
_GOOGLE_PATH_RE = re.compile(r"^/v1beta/models/.+:(generateContent|streamGenerateContent)")
_MCP_METHODS = {
    "initialize",
    "initialized",
    "shutdown",
    "tools/list",
    "tools/call",
    "resources/list",
    "resources/read",
    "prompts/list",
    "prompts/get",
    "notifications/initialized",
    "notifications/cancelled",
    "completion/complete",
}


def detect_agent(headers: dict | None, user_agent: str | None = None) -> str:
    normalized_headers = (
        {str(key).lower(): str(value) for key, value in headers.items()}
        if isinstance(headers, dict)
        else {}
    )

    ua = str(user_agent) if user_agent else normalized_headers.get("user-agent", "")
    x_client = normalized_headers.get("x-client-name", "")
    x_app = normalized_headers.get("x-app", "")

    combined = f"{ua} {x_client} {x_app}"
    for agent_name, patterns in _AGENT_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(combined):
                return agent_name

    has_anthropic_headers = (
        "anthropic-version" in normalized_headers or "anthropic-beta" in normalized_headers
    )
    if has_anthropic_headers:
        if any(p.search(combined) for p in _AGENT_PATTERNS["claude_code"]):
            return "claude_code"
        if x_app.lower() in {"cli", "claude-code"}:
            return "claude_code"

    return "unknown"


def detect_protocol(
    host: str, path: str, request_body: dict | None = None
) -> tuple[str, str | None]:
    host_lower = host.lower().split(":")[0]
    path_clean = path.split("?")[0]

    if request_body and _is_mcp_message(request_body):
        return ("mcp", None)

    if host_lower in _ANTHROPIC_HOSTS or _ANTHROPIC_PATH_RE.match(path_clean):
        if "anthropic" in host_lower:
            return ("anthropic", "anthropic")
        return ("anthropic", _guess_provider(host_lower))

    if (
        host_lower in _OPENAI_HOSTS
        or _OPENAI_CHAT_PATH_RE.match(path_clean)
        or _OPENAI_RESPONSES_PATH_RE.match(path_clean)
    ):
        if "openai" in host_lower:
            return ("openai", "openai")
        return ("openai", _guess_provider(host_lower))

    if host_lower in _GOOGLE_HOSTS or _GOOGLE_PATH_RE.match(path_clean):
        return ("google", "google")

    if request_body:
        if "model" in request_body and "messages" in request_body:
            if "anthropic-version" in str(request_body.get("metadata", "")):
                return ("anthropic", _guess_provider(host_lower))
            return ("openai", _guess_provider(host_lower))
        if "contents" in request_body and "generationConfig" in request_body:
            return ("google", _guess_provider(host_lower))

    return ("unknown", None)


def is_sse_response(content_type: str | None) -> bool:
    if not content_type:
        return False
    ct_lower = content_type.lower()
    return "text/event-stream" in ct_lower


def _is_mcp_message(body: dict) -> bool:
    if body.get("jsonrpc") == "2.0":
        method = body.get("method", "")
        if method in _MCP_METHODS or "/" in method:
            return True
        if "id" in body and ("result" in body or "error" in body):
            return True
    return False


def _guess_provider(host: str) -> str | None:
    if "anthropic" in host:
        return "anthropic"
    if "openai" in host:
        return "openai"
    if "google" in host or "googleapis" in host:
        return "google"
    if "azure" in host:
        return "azure"
    if "openrouter" in host:
        return "openrouter"
    return None
