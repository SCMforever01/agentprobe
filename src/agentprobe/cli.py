from __future__ import annotations

import asyncio
import logging
import sys
import threading

import click
import uvicorn
from rich.console import Console

from agentprobe import __version__

console = Console()


@click.group()
def cli() -> None:
    pass


@cli.command()
@click.option("--proxy-port", default=9090, type=int, show_default=True)
@click.option("--web-port", default=9091, type=int, show_default=True)
@click.option("--host", default="127.0.0.1", show_default=True)
@click.option("--headless", is_flag=True, default=False)
def start(proxy_port: int, web_port: int, host: str, headless: bool) -> None:
    from agentprobe.api import create_app
    from agentprobe.api.websocket import WebSocketHub, hub
    from agentprobe.config import Config
    from agentprobe.proxy.addon import AgentProbeAddon
    from agentprobe.proxy.launcher import ProxyLauncher
    from agentprobe.storage.database import Database

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    )

    config = Config(
        proxy_host=host,
        proxy_port=proxy_port,
        web_host="0.0.0.0",
        web_port=web_port,
        headless=headless,
    )
    db = Database()
    ws_hub: WebSocketHub = hub

    addon = AgentProbeAddon(db=db, hub=ws_hub)
    launcher = ProxyLauncher(config=config, addon=addon)
    app = create_app(config=config, db=db)

    console.print(f"[bold green]AgentProbe v{__version__}[/]")
    console.print(f"  Proxy  → [cyan]http://{host}:{proxy_port}[/]")
    console.print(f"  Web UI → [cyan]http://0.0.0.0:{web_port}[/]")

    async def _run() -> None:
        await db.init(config.db_path)
        uv_config = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=web_port,
            log_level="warning",
        )
        server = uvicorn.Server(uv_config)
        web_thread = threading.Thread(target=server.run, daemon=True)
        web_thread.start()
        try:
            await launcher.start()
        finally:
            server.should_exit = True
            await db.close()

    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        console.print("\n[yellow]shutting down…[/]")


@cli.command()
def init() -> None:
    from agentprobe.config import Config

    config = Config()
    console.print(f"[green]✓[/] data directory: {config.data_dir}")
    if config.ca_cert_path.exists():
        console.print(f"[green]✓[/] CA cert found: {config.ca_cert_path}")
    else:
        console.print(
            f"[yellow]![/] CA cert not found at {config.ca_cert_path}\n"
            "  Run [bold]mitmproxy[/] once to generate, then [bold]agentprobe trust[/]."
        )


@cli.command()
def trust() -> None:
    from agentprobe.cert.trust import install_ca_certificate
    from agentprobe.config import Config

    config = Config()
    ok = install_ca_certificate(config)
    if ok:
        console.print("[green]✓[/] CA certificate installed to system trust store")
    else:
        click.echo("failed to install CA certificate", err=True)
        sys.exit(1)


@cli.command()
def env() -> None:
    from agentprobe.cert.trust import format_env_export, get_env_vars
    from agentprobe.config import Config

    config = Config()
    env_vars = get_env_vars(config)
    console.print(format_env_export(env_vars))


@cli.command()
def version() -> None:
    console.print(f"agentprobe {__version__}")
