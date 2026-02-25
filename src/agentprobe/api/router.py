from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from agentprobe.api import handlers
from agentprobe.api.websocket import hub

router = APIRouter()


@router.get("/api/requests")
async def list_requests(request: Request) -> list[dict[str, Any]]:
    return await handlers.list_requests(request.app.state.db)


@router.get("/api/requests/{request_id}")
async def get_request(request_id: str, request: Request) -> dict[str, Any]:
    return await handlers.get_request(request.app.state.db, request_id)


@router.get("/api/requests/{request_id}/sse-events")
async def get_request_sse_events(request_id: str, request: Request) -> list[dict[str, Any]]:
    return await handlers.get_request_sse_events(request.app.state.db, request_id)


@router.delete("/api/requests")
async def clear_requests(request: Request):  # type: ignore[no-untyped-def]
    return await handlers.clear_requests(request.app.state.db)


@router.get("/api/stats")
async def get_stats(request: Request) -> dict[str, Any]:
    return await handlers.get_stats(request.app.state.db)


@router.get("/api/export/har")
async def export_har(request: Request) -> dict[str, Any]:
    return await handlers.export_har(request.app.state.db)


@router.get("/api/export/curl/{request_id}")
async def export_curl(request_id: str, request: Request):  # type: ignore[no-untyped-def]
    return await handlers.export_curl(request.app.state.db, request_id)


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
