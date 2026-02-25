from __future__ import annotations

CREATE_REQUESTS_TABLE = """
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    sequence INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    source_pid INTEGER,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    host TEXT NOT NULL,
    path TEXT NOT NULL,
    request_headers TEXT NOT NULL DEFAULT '{}',
    request_body TEXT,
    request_size INTEGER NOT NULL DEFAULT 0,
    status_code INTEGER,
    response_headers TEXT,
    response_body TEXT,
    response_size INTEGER NOT NULL DEFAULT 0,
    sse_events TEXT,
    duration_ms REAL,
    ttfb_ms REAL,
    protocol_type TEXT NOT NULL DEFAULT 'http',
    api_provider TEXT,
    session_id TEXT,
    conversation_id TEXT,
    is_streaming INTEGER NOT NULL DEFAULT 0
)
"""

CREATE_SSE_EVENTS_TABLE = """
CREATE TABLE IF NOT EXISTS sse_events (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'message',
    data TEXT NOT NULL DEFAULT '',
    timestamp TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
)
"""

CREATE_REQUESTS_TIMESTAMP_IDX = (
    "CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)"
)

CREATE_REQUESTS_HOST_IDX = (
    "CREATE INDEX IF NOT EXISTS idx_requests_host ON requests(host)"
)

CREATE_REQUESTS_AGENT_IDX = (
    "CREATE INDEX IF NOT EXISTS idx_requests_agent_type ON requests(agent_type)"
)

CREATE_SSE_REQUEST_IDX = (
    "CREATE INDEX IF NOT EXISTS idx_sse_events_request_id ON sse_events(request_id)"
)

SCHEMA_STATEMENTS: list[str] = [
    CREATE_REQUESTS_TABLE,
    CREATE_SSE_EVENTS_TABLE,
    CREATE_REQUESTS_TIMESTAMP_IDX,
    CREATE_REQUESTS_HOST_IDX,
    CREATE_REQUESTS_AGENT_IDX,
    CREATE_SSE_REQUEST_IDX,
]

INSERT_REQUEST = """
INSERT INTO requests (
    id, sequence, timestamp, agent_type, source_pid,
    method, url, host, path,
    request_headers, request_body, request_size,
    status_code, response_headers, response_body, response_size,
    sse_events, duration_ms, ttfb_ms,
    protocol_type, api_provider,
    session_id, conversation_id, is_streaming
) VALUES (
    :id, :sequence, :timestamp, :agent_type, :source_pid,
    :method, :url, :host, :path,
    :request_headers, :request_body, :request_size,
    :status_code, :response_headers, :response_body, :response_size,
    :sse_events, :duration_ms, :ttfb_ms,
    :protocol_type, :api_provider,
    :session_id, :conversation_id, :is_streaming
)
"""

INSERT_SSE_EVENT = """
INSERT INTO sse_events (id, request_id, event_index, event_type, data, timestamp)
VALUES (:id, :request_id, :event_index, :event_type, :data, :timestamp)
"""

SELECT_REQUEST_BY_ID = "SELECT * FROM requests WHERE id = :id"

SELECT_SSE_EVENTS_BY_REQUEST = """
SELECT * FROM sse_events WHERE request_id = :request_id ORDER BY event_index
"""

DELETE_ALL_REQUESTS = "DELETE FROM requests"
DELETE_ALL_SSE_EVENTS = "DELETE FROM sse_events"

STATS_QUERY = """
SELECT
    COUNT(*) AS total_requests,
    COUNT(DISTINCT host) AS unique_hosts,
    COUNT(DISTINCT agent_type) AS unique_agents,
    SUM(request_size) AS total_request_bytes,
    SUM(response_size) AS total_response_bytes,
    AVG(duration_ms) AS avg_duration_ms,
    SUM(CASE WHEN is_streaming = 1 THEN 1 ELSE 0 END) AS streaming_count
FROM requests
"""

SUMMARY_COLUMNS = (
    "id, sequence, timestamp, method, host, path, status_code, "
    "agent_type, protocol_type, duration_ms, response_size, is_streaming"
)

FILTER_FIELDS: dict[str, str] = {
    "agent_type": "agent_type = :agent_type",
    "host": "host = :host",
    "method": "method = :method",
    "protocol_type": "protocol_type = :protocol_type",
    "status_code": "status_code = :status_code",
    "is_streaming": "is_streaming = :is_streaming",
    "session_id": "session_id = :session_id",
    "api_provider": "api_provider = :api_provider",
    "search": "(url LIKE :search OR host LIKE :search OR path LIKE :search)",
}


def build_list_query(
    filters: dict[str, object] | None = None,
    order_by: str = "sequence DESC",
    limit: int = 100,
    offset: int = 0,
) -> tuple[str, dict[str, object]]:
    clauses: list[str] = []
    params: dict[str, object] = {}

    if filters:
        for key, value in filters.items():
            if key in FILTER_FIELDS and value is not None:
                clauses.append(FILTER_FIELDS[key])
                if key == "search":
                    params["search"] = f"%{value}%"
                elif key == "is_streaming":
                    params["is_streaming"] = 1 if value else 0
                else:
                    params[key] = value

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"SELECT {SUMMARY_COLUMNS} FROM requests{where} ORDER BY {order_by} LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    return sql, params


def build_update_query(fields: dict[str, object], request_id: str) -> tuple[str, dict[str, object]]:
    set_clauses = [f"{key} = :{key}" for key in fields]
    params: dict[str, object] = {**fields, "id": request_id}
    sql = f"UPDATE requests SET {', '.join(set_clauses)} WHERE id = :id"
    return sql, params
