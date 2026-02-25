from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class CapturedRequest(BaseModel):
    id: str = Field(default_factory=_uuid)
    sequence: int
    timestamp: datetime = Field(default_factory=_utcnow)

    agent_type: str
    source_pid: int | None = None

    method: str
    url: str
    host: str
    path: str

    request_headers: dict[str, str] = Field(default_factory=dict)
    request_body: str | None = None
    request_size: int = 0

    status_code: int | None = None
    response_headers: dict[str, str] | None = None
    response_body: str | None = None
    response_size: int = 0

    sse_events: list[dict[str, str]] | None = None
    duration_ms: float | None = None
    ttfb_ms: float | None = None

    protocol_type: str = "http"
    api_provider: str | None = None

    session_id: str | None = None
    conversation_id: str | None = None
    is_streaming: bool = False

    def to_summary(self) -> RequestSummary:
        return RequestSummary(
            id=self.id,
            sequence=self.sequence,
            timestamp=self.timestamp,
            method=self.method,
            host=self.host,
            path=self.path,
            status_code=self.status_code,
            agent_type=self.agent_type,
            protocol_type=self.protocol_type,
            duration_ms=self.duration_ms,
            response_size=self.response_size,
            is_streaming=self.is_streaming,
        )


class RequestSummary(BaseModel):
    id: str
    sequence: int
    timestamp: datetime
    method: str
    host: str
    path: str
    status_code: int | None = None
    agent_type: str
    protocol_type: str
    duration_ms: float | None = None
    response_size: int = 0
    is_streaming: bool = False


class SSEEvent(BaseModel):
    id: str = Field(default_factory=_uuid)
    request_id: str
    event_index: int
    event_type: str = "message"
    data: str = ""
    timestamp: datetime = Field(default_factory=_utcnow)
