from agentprobe.parser.detector import detect_agent


def test_detect_agent_claude_cli_user_agent() -> None:
    headers = {
        "User-Agent": "claude-cli/1.0.118 (external, cli)",
        "Anthropic-Version": "2023-06-01",
    }

    assert detect_agent(headers) == "claude_code"


def test_detect_agent_claude_code_from_x_app() -> None:
    headers = {
        "anthropic-version": "2023-06-01",
        "x-app": "claude-code",
    }

    assert detect_agent(headers) == "claude_code"


def test_detect_agent_unknown_without_claude_markers() -> None:
    headers = {
        "user-agent": "python-requests/2.32.0",
        "anthropic-version": "2023-06-01",
    }

    assert detect_agent(headers) == "unknown"
