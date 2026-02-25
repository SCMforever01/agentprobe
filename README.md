# AgentProbe

WSL-based HTTP/HTTPS traffic capture tool for AI coding agents (Claude Code, OpenCode, Codex CLI, Gemini CLI).

## Features

- **Protocol-Aware Parsing**: Anthropic, OpenAI, Google AI, MCP
- **Real-Time WebSocket**: Live traffic updates
- **SSE Streaming**: Incremental chunk visualization
- **Dark Theme UI**: Three-column Proxyman-inspired layout
- **SQLite Storage**: Persistent traffic history
- **Virtual Scrolling**: Efficient rendering for thousands of requests

## Quick Start

### 1. Install Dependencies

```bash
# Clone or navigate to project directory
cd agentprobe

# Install backend dependencies (Python)
uv sync

# Install frontend dependencies (Node.js)
cd web
npm install
cd ..
```

### 2. Initialize CA Certificate

```bash
# Generate and install HTTPS certificate (requires sudo)
uv run agentprobe init

# Or generate only (without auto-install)
uv run agentprobe trust
```

> **Note**: This creates CA certificate in `~/.mitmproxy/` and attempts to add it to system trust chain. On Linux, you'll be prompted for password.

### 3. Start Service

```bash
# Start proxy server + Web UI
uv run agentprobe start

# Expected output:
# AgentProbe v0.1.0
#   Proxy  → http://127.0.0.1:9090
#   Web UI → http://0.0.0.0:9091
```

### 4. Configure AI Tool Proxy

In **another terminal window**, set environment variables:

```bash
# Export proxy configuration
export HTTP_PROXY=http://127.0.0.1:9090
export HTTPS_PROXY=http://127.0.0.1:9090

# Verify proxy works
curl --proxy http://127.0.0.1:9090 https://api.anthropic.com/v1/messages

# Launch your AI tool
# e.g., claude-code, opencode, codex, etc.
```

### 5. Open Web UI

```bash
# Visit in browser
http://localhost:9091
```

You'll see:
- **Left**: Filters (by Agent type, Protocol type)
- **Center**: Request list (real-time updates)
- **Right**: Request details (click list item to view)

---

## CLI Commands

```bash
# Show version
uv run agentprobe version

# Show environment configuration
uv run agentprobe env

# Install CA certificate only
uv run agentprobe trust

# Start with custom ports
uv run agentprobe start --proxy-port 8080 --web-port 8081

# Start in headless mode (no auto-open browser)
uv run agentprobe start --headless

# Show help
uv run agentprobe --help
```

---

## Architecture

### Backend (25 Python files)

```
src/agentprobe/
├── config.py                    # Config dataclass + env loader
├── cli.py                       # Click CLI: start/init/trust/env/version
├── storage/
│   ├── models.py                # SQLAlchemy models
│   ├── database.py              # aiosqlite + migrations
│   └── queries.py               # CRUD operations
├── parser/
│   ├── detector.py              # Agent/protocol detection
│   ├── anthropic.py             # Claude API parser
│   ├── openai.py                # OpenAI/compatible parser
│   ├── google.py                # Google AI parser
│   ├── mcp.py                   # JSON-RPC 2.0 parser
│   └── session.py               # Session tracking
├── api/
│   ├── websocket.py             # WebSocket hub
│   ├── handlers.py              # FastAPI endpoints
│   ├── router.py                # URL routing
│   └── __init__.py              # create_app()
├── proxy/
│   ├── addon.py                 # mitmproxy hooks
│   ├── launcher.py              # Proxy lifecycle
│   └── sse.py                   # SSE streaming parser
└── cert/
    └── trust.py                 # CA installation
```

### Frontend (15 TypeScript files)

```
web/src/
├── App.tsx                      # Three-column layout
├── main.tsx                     # React entry point
├── types/index.ts               # TypeScript interfaces
├── stores/trafficStore.ts       # Zustand state management
├── hooks/useWebSocket.ts        # WS connection + auto-reconnect
├── utils/
│   ├── api.ts                   # REST client
│   └── helpers.ts               # Formatters + colors
└── components/
    ├── layout/
    │   ├── Toolbar.tsx          # Controls + filters
    │   ├── Sidebar.tsx          # Agent/protocol filters
    │   └── StatusBar.tsx        # Connection status
    └── traffic/
        ├── RequestList.tsx      # Virtual scrolling list
        ├── RequestDetail.tsx    # Request/response viewer
        ├── HeadersView.tsx      # Headers table
        ├── BodyViewer.tsx       # JSON pretty-printer
        └── SSEViewer.tsx        # SSE event timeline
```

**Tech Stack**:
- **Proxy**: mitmproxy addon (port 9090)
- **Backend**: FastAPI + SQLite (port 9091)
- **Frontend**: React + TypeScript + TailwindCSS
- **Storage**: SQLite with aiosqlite
- **State**: Zustand + WebSocket real-time
- **UI**: Virtual scrolling (@tanstack/react-virtual)

---

## Troubleshooting

### Port Already in Use

```bash
# Check port occupation
sudo lsof -i :9090
sudo lsof -i :9091

# Kill process or use different ports
uv run agentprobe start --proxy-port 9999
```

### HTTPS Certificate Not Trusted

```bash
# Linux - manually install certificate
sudo cp ~/.mitmproxy/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates/mitmproxy.crt
sudo update-ca-certificates

# macOS - manually install
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
```

### Frontend Assets 404

```bash
# Rebuild frontend
cd web
npm run build
cd ..

# Restart service
uv run agentprobe start
```

---

## Testing Example

After starting the service, run in a terminal with proxy configured:

```bash
# Test plain HTTPS request
curl --proxy http://127.0.0.1:9090 https://www.google.com

# Test Anthropic API (requires real API key)
export ANTHROPIC_API_KEY=sk-ant-xxx
curl --proxy http://127.0.0.1:9090 https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
```

In Web UI (http://localhost:9091) you'll see in real-time:
- Request details (URL, Headers, Body)
- Response content (Status, Body, SSE stream)
- Protocol type (LLM API / MCP)
- Agent detection (Claude / OpenCode / Codex)

---

## License

MIT
