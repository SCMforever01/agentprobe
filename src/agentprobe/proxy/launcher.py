from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from mitmproxy import options
from mitmproxy.tools.dump import DumpMaster

if TYPE_CHECKING:
    from agentprobe.config import Config
    from agentprobe.proxy.addon import AgentProbeAddon

log = logging.getLogger(__name__)


class ProxyLauncher:
    def __init__(self, config: Config, addon: AgentProbeAddon) -> None:
        self._config = config
        self._addon = addon
        self._master: DumpMaster | None = None

    async def start(self) -> None:
        opts = options.Options(
            listen_host=self._config.proxy_host,
            listen_port=self._config.proxy_port,
        )
        master = DumpMaster(
            opts,
            with_termlog=False,
            with_dumper=False,
        )
        master.addons.add(self._addon)
        self._master = master
        log.info(
            "proxy listening on %s:%d",
            self._config.proxy_host,
            self._config.proxy_port,
        )
        await master.run()

    async def stop(self) -> None:
        if self._master is not None:
            self._master.shutdown()
            self._master = None
            log.info("proxy stopped")
