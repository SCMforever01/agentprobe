from __future__ import annotations

import logging
import platform
import shutil
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agentprobe.config import Config

log = logging.getLogger(__name__)

_LINUX_CA_DIR = Path("/usr/local/share/ca-certificates")
_MACOS_KEYCHAIN = "/Library/Keychains/System.keychain"


def install_ca_certificate(config: Config) -> bool:
    cert_path = config.ca_cert_path
    if not cert_path.exists():
        log.error("mitmproxy CA not found at %s — run mitmproxy once to generate it", cert_path)
        return False

    system = platform.system().lower()
    try:
        if system == "linux":
            return _install_linux(cert_path)
        if system == "darwin":
            return _install_macos(cert_path)
        log.warning("unsupported platform %s for automatic CA install", system)
        return False
    except Exception:
        log.exception("CA installation failed")
        return False


def get_env_vars(config: Config) -> dict[str, str]:
    proxy_url = f"http://{config.proxy_host}:{config.proxy_port}"
    cert_str = str(config.ca_cert_path)
    return {
        "HTTP_PROXY": proxy_url,
        "HTTPS_PROXY": proxy_url,
        "http_proxy": proxy_url,
        "https_proxy": proxy_url,
        "NODE_EXTRA_CA_CERTS": cert_str,
        "REQUESTS_CA_BUNDLE": cert_str,
        "SSL_CERT_FILE": cert_str,
    }


def format_env_export(env_vars: dict[str, str]) -> str:
    lines = [f"export {k}={_shell_quote(v)}" for k, v in env_vars.items()]
    return "\n".join(lines)


def _install_linux(cert_path: Path) -> bool:
    dest = _LINUX_CA_DIR / "mitmproxy-ca.crt"
    _LINUX_CA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cert_path, dest)
    update = shutil.which("update-ca-certificates")
    if update:
        subprocess.run([update], check=True, capture_output=True)
        log.info("CA installed and trust store updated (Linux)")
        return True
    log.warning("copied cert to %s but update-ca-certificates not found", dest)
    return True


def _install_macos(cert_path: Path) -> bool:
    subprocess.run(
        [
            "security", "add-trusted-cert",
            "-d", "-r", "trustRoot",
            "-k", _MACOS_KEYCHAIN,
            str(cert_path),
        ],
        check=True,
        capture_output=True,
    )
    log.info("CA installed to system keychain (macOS)")
    return True


def _shell_quote(value: str) -> str:
    if " " in value or "'" in value or '"' in value:
        escaped = value.replace("'", "'\\''")
        return f"'{escaped}'"
    return value
