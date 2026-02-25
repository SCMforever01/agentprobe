from __future__ import annotations

import shlex
from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse

from agentprobe.storage.database import Database


async def list_requests(db: Database) -> list[dict[str, Any]]:
    rows = await db.list_requests()
    return [r.model_dump(mode="json") for r in rows]


async def get_request(db: Database, request_id: str) -> dict[str, Any]:
    row = await db.get_request(request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return row.model_dump(mode="json")


async def get_request_sse_events(db: Database, request_id: str) -> list[dict[str, Any]]:
    row = await db.get_request(request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    events = await db.get_sse_events(request_id)
    return [e.model_dump(mode="json") for e in events]


async def clear_requests(db: Database) -> JSONResponse:
    await db.clear_all()
    return JSONResponse({"status": "ok"})


async def get_stats(db: Database) -> dict[str, Any]:
    return await db.get_stats()


async def export_har(db: Database) -> dict[str, Any]:
    summaries = await db.list_requests(limit=10000)
    requests = []
    for s in summaries:
        full = await db.get_request(s.id)
        if full is not None:
            requests.append(full)
    entries = []
    for req in requests:
        entry: dict[str, Any] = {
            "startedDateTime": req.timestamp,
            "time": req.duration_ms or 0,
            "request": {
                "method": req.method,
                "url": req.url,
                "httpVersion": "HTTP/1.1",
                "headers": [{"name": k, "value": v} for k, v in (req.request_headers or {}).items()],
                "queryString": [],
                "bodySize": len(req.request_body) if req.request_body else 0,
                "postData": {
                    "mimeType": req.request_headers.get("content-type", "") if req.request_headers else "",
                    "text": req.request_body or "",
                } if req.request_body else None,
            },
            "response": {
                "status": req.status_code or 0,
                "statusText": "",
                "httpVersion": "HTTP/1.1",
                "headers": [{"name": k, "value": v} for k, v in (req.response_headers or {}).items()],
                "content": {
                    "size": len(req.response_body) if req.response_body else 0,
                    "mimeType": req.response_headers.get("content-type", "") if req.response_headers else "",
                    "text": req.response_body or "",
                },
                "bodySize": len(req.response_body) if req.response_body else 0,
            },
            "cache": {},
            "timings": {"send": 0, "wait": req.duration_ms or 0, "receive": 0},
        }
        entries.append(entry)

    return {
        "log": {
            "version": "1.2",
            "creator": {"name": "AgentProbe", "version": "0.1.0"},
            "entries": entries,
        }
    }


async def export_curl(db: Database, request_id: str) -> JSONResponse:
    row = await db.get_request(request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")

    parts = ["curl", "-X", row.method, shlex.quote(row.url)]
    for name, value in (row.request_headers or {}).items():
        parts.extend(["-H", shlex.quote(f"{name}: {value}")])
    if row.request_body:
        parts.extend(["--data-raw", shlex.quote(row.request_body)])

    return JSONResponse({"curl": " ".join(parts)})
