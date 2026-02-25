from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field


_SESSION_WINDOW_SECONDS = 1800  # 30 minutes


@dataclass
class SessionInfo:
    session_id: str
    agent: str
    host: str
    started_at: float
    last_active: float
    request_count: int = 0
    protocol: str = ""
    api_provider: str | None = None


@dataclass
class SessionTracker:
    _sessions: dict[str, SessionInfo] = field(default_factory=dict)
    _agent_host_index: dict[str, list[str]] = field(default_factory=dict)

    def track(
        self,
        agent: str,
        host: str,
        protocol: str = "",
        api_provider: str | None = None,
        timestamp: float | None = None,
    ) -> SessionInfo:
        now = timestamp if timestamp is not None else time.time()
        index_key = f"{agent}:{host}"

        candidate_ids = self._agent_host_index.get(index_key, [])
        for sid in reversed(candidate_ids):
            session = self._sessions.get(sid)
            if session and (now - session.last_active) < _SESSION_WINDOW_SECONDS:
                session.last_active = now
                session.request_count += 1
                if protocol and not session.protocol:
                    session.protocol = protocol
                if api_provider and not session.api_provider:
                    session.api_provider = api_provider
                return session

        session_id = _generate_session_id(agent, host, now)
        new_session = SessionInfo(
            session_id=session_id,
            agent=agent,
            host=host,
            started_at=now,
            last_active=now,
            request_count=1,
            protocol=protocol,
            api_provider=api_provider,
        )
        self._sessions[session_id] = new_session
        if index_key not in self._agent_host_index:
            self._agent_host_index[index_key] = []
        self._agent_host_index[index_key].append(session_id)
        return new_session

    def get_session(self, session_id: str) -> SessionInfo | None:
        return self._sessions.get(session_id)

    def get_active_sessions(self, timestamp: float | None = None) -> list[SessionInfo]:
        now = timestamp if timestamp is not None else time.time()
        return [
            s for s in self._sessions.values()
            if (now - s.last_active) < _SESSION_WINDOW_SECONDS
        ]

    def get_sessions_for_agent(self, agent: str) -> list[SessionInfo]:
        return [
            s for s in self._sessions.values()
            if s.agent == agent
        ]

    def expire_sessions(self, timestamp: float | None = None) -> int:
        now = timestamp if timestamp is not None else time.time()
        expired_ids: list[str] = []
        for sid, session in self._sessions.items():
            if (now - session.last_active) >= _SESSION_WINDOW_SECONDS:
                expired_ids.append(sid)

        for sid in expired_ids:
            session = self._sessions.pop(sid)
            index_key = f"{session.agent}:{session.host}"
            id_list = self._agent_host_index.get(index_key, [])
            if sid in id_list:
                id_list.remove(sid)
            if not id_list and index_key in self._agent_host_index:
                del self._agent_host_index[index_key]

        return len(expired_ids)

    @property
    def session_count(self) -> int:
        return len(self._sessions)


def _generate_session_id(agent: str, host: str, timestamp: float) -> str:
    raw = f"{agent}:{host}:{timestamp}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
