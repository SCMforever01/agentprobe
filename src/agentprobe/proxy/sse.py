from __future__ import annotations


class SSEParser:

    def __init__(self) -> None:
        self._buffer: str = ""

    def feed(self, chunk: bytes) -> list[dict]:
        # Returns list of dicts with keys: event, data, id, retry
        try:
            text = chunk.decode("utf-8", errors="replace")
        except Exception:
            return []

        self._buffer += text
        events: list[dict] = []

        while "\n\n" in self._buffer:
            block, self._buffer = self._buffer.split("\n\n", 1)
            event = self._parse_block(block)
            if event:
                events.append(event)

        return events

    def flush(self) -> list[dict]:

        if not self._buffer.strip():
            self._buffer = ""
            return []
        event = self._parse_block(self._buffer)
        self._buffer = ""
        return [event] if event else []

    @staticmethod
    def _parse_block(block: str) -> dict | None:
        event: dict = {}
        data_lines: list[str] = []

        for line in block.split("\n"):
            line = line.rstrip("\r")

            if not line or line.startswith(":"):
                continue

            if ":" in line:
                field, _, value = line.partition(":")
                value = value.lstrip(" ")
            else:
                field = line
                value = ""

            field = field.strip()

            if field == "data":
                data_lines.append(value)
            elif field == "event":
                event["event"] = value
            elif field == "id":
                event["id"] = value
            elif field == "retry":
                event["retry"] = value

        if data_lines:
            event["data"] = "\n".join(data_lines)

        return event if event else None

    def reset(self) -> None:

        self._buffer = ""
