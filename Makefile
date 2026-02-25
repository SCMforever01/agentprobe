.PHONY: dev build install clean test lint web-dev web-build

# === Backend ===
install:
	uv sync

dev:
	uv run agentprobe start

test:
	uv run pytest

lint:
	uv run ruff check src/ tests/
	uv run ruff format --check src/ tests/

format:
	uv run ruff format src/ tests/

# === Frontend ===
web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

web-build:
	cd web && npm run build

# === Combined ===
setup: install web-install
	@echo "✅ All dependencies installed"

start: web-build dev

clean:
	rm -rf .venv node_modules web/node_modules web/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# === Certificate ===
init:
	uv run agentprobe init

trust:
	uv run agentprobe trust

env:
	@uv run agentprobe env
