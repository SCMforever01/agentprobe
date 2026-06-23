"""AgentProbe configuration management."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Config:
    """Application configuration."""

    # Proxy settings
    proxy_host: str = "127.0.0.1"
    proxy_port: int = 9090

    # Web UI settings
    web_host: str = "0.0.0.0"
    web_port: int = 9091

    # Storage
    data_dir: Path = field(default_factory=lambda: Path.home() / ".agentprobe")
    db_path: Path = field(default=None)  # type: ignore[assignment]

    # mitmproxy CA
    mitmproxy_dir: Path = field(default_factory=lambda: Path.home() / ".mitmproxy")

    # Behavior
    headless: bool = False
    max_body_size: int = 10 * 1024 * 1024  # 10MB — bodies larger than this stored as file refs
    max_requests_in_memory: int = 10000

    def __post_init__(self) -> None:
        if self.db_path is None:
            self.db_path = self.data_dir / "agentprobe.db"
        self.data_dir.mkdir(parents=True, exist_ok=True)

    @property
    def ca_cert_path(self) -> Path:
        return self.mitmproxy_dir / "mitmproxy-ca-cert.pem"

    @property
    def static_dir(self) -> Path:
        """Path to built frontend static files."""
        return Path(__file__).parent.parent.parent / "web" / "dist"

    @classmethod
    def from_env(cls) -> Config:
        """Create config from environment variables."""
        kwargs: dict = {}
        if v := os.environ.get("AGENTPROBE_PROXY_PORT"):
            kwargs["proxy_port"] = int(v)
        if v := os.environ.get("AGENTPROBE_WEB_PORT"):
            kwargs["web_port"] = int(v)
        if v := os.environ.get("AGENTPROBE_DATA_DIR"):
            kwargs["data_dir"] = Path(v)
        return cls(**kwargs)
