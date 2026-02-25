from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite

from agentprobe.storage.models import CapturedRequest, RequestSummary, SSEEvent
from agentprobe.storage.queries import (
    DELETE_ALL_REQUESTS,
    DELETE_ALL_SSE_EVENTS,
    INSERT_REQUEST,
    INSERT_SSE_EVENT,
    SCHEMA_STATEMENTS,
    SELECT_REQUEST_BY_ID,
    SELECT_SSE_EVENTS_BY_REQUEST,
    STATS_QUERY,
    build_list_query,
    build_update_query,
)


class Database:
    def __init__(self) -> None:
        self._db: aiosqlite.Connection | None = None

    async def init(self, db_path: str | Path) -> None:
        self._db = await aiosqlite.connect(str(db_path))
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA foreign_keys=ON")
        await self._init_schema()

    async def _init_schema(self) -> None:
        db = self._get_db()
        for stmt in SCHEMA_STATEMENTS:
            await db.execute(stmt)
        await db.commit()

    def _get_db(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("Database not initialized. Call init() first.")
        return self._db

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    def _serialize_request(self, req: CapturedRequest) -> dict[str, Any]:
        return {
            "id": req.id,
            "sequence": req.sequence,
            "timestamp": req.timestamp.isoformat(),
            "agent_type": req.agent_type,
            "source_pid": req.source_pid,
            "method": req.method,
            "url": req.url,
            "host": req.host,
            "path": req.path,
            "request_headers": json.dumps(req.request_headers),
            "request_body": req.request_body,
            "request_size": req.request_size,
            "status_code": req.status_code,
            "response_headers": json.dumps(req.response_headers) if req.response_headers is not None else None,
            "response_body": req.response_body,
            "response_size": req.response_size,
            "sse_events": json.dumps(req.sse_events) if req.sse_events is not None else None,
            "duration_ms": req.duration_ms,
            "ttfb_ms": req.ttfb_ms,
            "protocol_type": req.protocol_type,
            "api_provider": req.api_provider,
            "session_id": req.session_id,
            "conversation_id": req.conversation_id,
            "is_streaming": 1 if req.is_streaming else 0,
        }

    def _deserialize_request(self, row: aiosqlite.Row) -> CapturedRequest:
        data = dict(row)
        data["request_headers"] = json.loads(data["request_headers"])
        if data["response_headers"] is not None:
            data["response_headers"] = json.loads(data["response_headers"])
        if data["sse_events"] is not None:
            data["sse_events"] = json.loads(data["sse_events"])
        data["is_streaming"] = bool(data["is_streaming"])
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return CapturedRequest.model_validate(data)

    def _deserialize_summary(self, row: aiosqlite.Row) -> RequestSummary:
        data = dict(row)
        data["is_streaming"] = bool(data["is_streaming"])
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return RequestSummary.model_validate(data)

    def _deserialize_sse_event(self, row: aiosqlite.Row) -> SSEEvent:
        data = dict(row)
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return SSEEvent.model_validate(data)

    async def save_request(self, request: CapturedRequest) -> None:
        db = self._get_db()
        params = self._serialize_request(request)
        await db.execute(INSERT_REQUEST, params)
        await db.commit()

    async def save_sse_event(self, event: SSEEvent) -> None:
        db = self._get_db()
        params = {
            "id": event.id,
            "request_id": event.request_id,
            "event_index": event.event_index,
            "event_type": event.event_type,
            "data": event.data,
            "timestamp": event.timestamp.isoformat(),
        }
        await db.execute(INSERT_SSE_EVENT, params)
        await db.commit()

    async def save_sse_events(self, events: list[SSEEvent]) -> None:
        if not events:
            return
        db = self._get_db()
        params_list = [
            {
                "id": event.id,
                "request_id": event.request_id,
                "event_index": event.event_index,
                "event_type": event.event_type,
                "data": event.data,
                "timestamp": event.timestamp.isoformat(),
            }
            for event in events
        ]
        await db.executemany(INSERT_SSE_EVENT, params_list)
        await db.commit()

    async def update_request(self, request_id: str, fields: dict[str, Any]) -> None:
        db = self._get_db()
        serialized: dict[str, Any] = {}
        for key, value in fields.items():
            if key in ("request_headers", "response_headers", "sse_events") and value is not None:
                serialized[key] = json.dumps(value)
            elif key == "is_streaming":
                serialized[key] = 1 if value else 0
            elif key == "timestamp" and isinstance(value, datetime):
                serialized[key] = value.isoformat()
            else:
                serialized[key] = value
        sql, params = build_update_query(serialized, request_id)
        await db.execute(sql, params)
        await db.commit()

    async def get_request(self, request_id: str) -> CapturedRequest | None:
        db = self._get_db()
        cursor = await db.execute(SELECT_REQUEST_BY_ID, {"id": request_id})
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._deserialize_request(row)

    async def list_requests(
        self,
        filters: dict[str, Any] | None = None,
        order_by: str = "sequence DESC",
        limit: int = 100,
        offset: int = 0,
    ) -> list[RequestSummary]:
        db = self._get_db()
        sql, params = build_list_query(filters=filters, order_by=order_by, limit=limit, offset=offset)
        cursor = await db.execute(sql, params)
        rows = await cursor.fetchall()
        return [self._deserialize_summary(row) for row in rows]

    async def get_sse_events(self, request_id: str) -> list[SSEEvent]:
        db = self._get_db()
        cursor = await db.execute(SELECT_SSE_EVENTS_BY_REQUEST, {"request_id": request_id})
        rows = await cursor.fetchall()
        return [self._deserialize_sse_event(row) for row in rows]

    async def clear_all(self) -> None:
        db = self._get_db()
        await db.execute(DELETE_ALL_SSE_EVENTS)
        await db.execute(DELETE_ALL_REQUESTS)
        await db.commit()

    async def get_stats(self) -> dict[str, Any]:
        db = self._get_db()
        cursor = await db.execute(STATS_QUERY)
        row = await cursor.fetchone()
        if row is None:
            return {
                "total_requests": 0,
                "unique_hosts": 0,
                "unique_agents": 0,
                "total_request_bytes": 0,
                "total_response_bytes": 0,
                "avg_duration_ms": None,
                "streaming_count": 0,
            }
        data = dict(row)
        return {
            "total_requests": data["total_requests"] or 0,
            "unique_hosts": data["unique_hosts"] or 0,
            "unique_agents": data["unique_agents"] or 0,
            "total_request_bytes": data["total_request_bytes"] or 0,
            "total_response_bytes": data["total_response_bytes"] or 0,
            "avg_duration_ms": data["avg_duration_ms"],
            "streaming_count": data["streaming_count"] or 0,
        }
