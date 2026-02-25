from __future__ import annotations

import asyncio
import itertools
import json
import logging
import time
from typing import TYPE_CHECKING

from mitmproxy import http

from agentprobe.parser.detector import detect_agent, detect_protocol, is_sse_response
from agentprobe.proxy.sse import SSEParser
from agentprobe.storage.models import CapturedRequest, SSEEvent

if TYPE_CHECKING:
    from agentprobe.api.websocket import WebSocketHub
    from agentprobe.storage.database import Database

log = logging.getLogger(__name__)

_seq = itertools.count(1)


class AgentProbeAddon:
    def __init__(self, db: Database, hub: WebSocketHub) -> None:
        self._db = db
        self._hub = hub
        self._pending: dict[int, _FlowState] = {}

    def request(self, flow: http.HTTPFlow) -> None:
        try:
            self._handle_request(flow)
        except Exception:
            log.exception("addon request hook failed for %s %s", flow.request.method, flow.request.url)

    def responseheaders(self, flow: http.HTTPFlow) -> None:
        try:
            if flow.response is None:
                return
            ct = flow.response.headers.get("content-type", "")
            if is_sse_response(ct):
                state = self._pending.get(id(flow))
                if state:
                    state.is_sse = True
                    state.sse_parser = SSEParser()
                flow.response.stream = self._make_stream_callback(flow)
        except Exception:
            log.exception("addon responseheaders hook failed")

    def response(self, flow: http.HTTPFlow) -> None:
        try:
            self._handle_response(flow)
        except Exception:
            log.exception("addon response hook failed for %s %s", flow.request.method, flow.request.url)

    def _handle_request(self, flow: http.HTTPFlow) -> None:
        headers = dict(flow.request.headers)
        body_text = _safe_get_text(flow.request)
        body_dict = _try_parse_json(body_text)
        agent = detect_agent(headers)
        protocol_type, api_provider = detect_protocol(flow.request.host, flow.request.path, body_dict)

        captured = CapturedRequest(
            sequence=next(_seq),
            agent_type=agent,
            method=flow.request.method,
            url=flow.request.url,
            host=flow.request.host,
            path=flow.request.path,
            request_headers=headers,
            request_body=body_text,
            request_size=len(body_text.encode()) if body_text else 0,
            protocol_type=protocol_type,
            api_provider=api_provider,
            is_streaming=False,
        )

        state = _FlowState(captured=captured, start_time=time.monotonic())
        self._pending[id(flow)] = state

        _run_async(self._db.save_request(captured))
        _run_async(self._hub.broadcast({
            "type": "new_request",
            "data": captured.to_summary().model_dump(mode="json"),
        }))

    def _handle_response(self, flow: http.HTTPFlow) -> None:
        state = self._pending.pop(id(flow), None)
        if state is None:
            return

        captured = state.captured
        elapsed = (time.monotonic() - state.start_time) * 1000
        update_fields: dict = {}

        if flow.response is not None:
            captured.status_code = flow.response.status_code
            captured.response_headers = dict(flow.response.headers)
            captured.duration_ms = elapsed
            captured.ttfb_ms = state.ttfb_ms

            if state.is_sse:
                captured.is_streaming = True
                if state.sse_parser:
                    remaining = state.sse_parser.flush()
                    state.sse_events.extend(remaining)
                captured.sse_events = state.sse_events
                captured.response_body = _format_sse_events(state.sse_events)
                captured.response_size = len(captured.response_body.encode()) if captured.response_body else 0
            else:
                resp_text = _safe_get_text(flow.response)
                captured.response_body = resp_text
                captured.response_size = len(resp_text.encode()) if resp_text else 0

            update_fields = {
                "status_code": captured.status_code,
                "response_headers": captured.response_headers,
                "response_body": captured.response_body,
                "response_size": captured.response_size,
                "duration_ms": captured.duration_ms,
                "ttfb_ms": captured.ttfb_ms,
                "is_streaming": captured.is_streaming,
                "sse_events": captured.sse_events,
            }

        _run_async(self._db.update_request(captured.id, update_fields))

        # Save SSE events to separate sse_events table (batch)
        if captured.sse_events:
            sse_event_models = [
                SSEEvent(
                    request_id=captured.id,
                    event_index=idx,
                    event_type=raw.get("event", "message"),
                    data=raw.get("data", ""),
                )
                for idx, raw in enumerate(captured.sse_events)
            ]
            _run_async(self._db.save_sse_events(sse_event_models))
        _run_async(self._hub.broadcast({
            "type": "request_complete",
            "data": captured.to_summary().model_dump(mode="json"),
        }))

    def _make_stream_callback(self, flow: http.HTTPFlow):
        def stream_callback(data: bytes) -> bytes:
            state = self._pending.get(id(flow))
            if state is None:
                return data
            if state.ttfb_ms is None:
                state.ttfb_ms = (time.monotonic() - state.start_time) * 1000
            if state.sse_parser and data:
                events = state.sse_parser.feed(data)
                state.sse_events.extend(events)
            return data
        return stream_callback


class _FlowState:
    __slots__ = ("captured", "start_time", "is_sse", "sse_parser", "sse_events", "ttfb_ms")

    def __init__(self, captured: CapturedRequest, start_time: float) -> None:
        self.captured = captured
        self.start_time = start_time
        self.is_sse = False
        self.sse_parser: SSEParser | None = None
        self.sse_events: list[dict] = []
        self.ttfb_ms: float | None = None


def _safe_get_text(msg: http.Request | http.Response) -> str:
    try:
        return msg.get_text() or ""
    except Exception:
        return ""


def _try_parse_json(text: str) -> dict | None:
    if not text:
        return None
    try:
        result = json.loads(text)
        return result if isinstance(result, dict) else None
    except (json.JSONDecodeError, ValueError):
        return None


def _format_sse_events(events: list[dict]) -> str:
    parts: list[str] = []
    for ev in events:
        if "event" in ev:
            parts.append(f"event: {ev['event']}")
        if "data" in ev:
            parts.append(f"data: {ev['data']}")
        parts.append("")
    return "\n".join(parts)


def _run_async(coro) -> None:  # noqa: ANN001
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        try:
            asyncio.run(coro)
        except Exception:
            log.debug("failed to schedule async task", exc_info=True)
