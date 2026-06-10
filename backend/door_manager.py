"""Singleton manager for the local door agent WebSocket connection.

The local agent (machine on the turnstile's LAN) keeps one outbound WebSocket
open against this backend. When a QR check-in is approved we push an "open"
command through that socket and wait for the agent's ack.
"""

import asyncio
import logging
import uuid

from fastapi import WebSocket

logger = logging.getLogger("door")


class DoorAgentManager:
    def __init__(self) -> None:
        self._ws: WebSocket | None = None
        self._pending: dict[str, asyncio.Future] = {}

    @property
    def connected(self) -> bool:
        return self._ws is not None

    async def register(self, ws: WebSocket) -> None:
        # Only one agent at a time — a new connection replaces the old one
        # (e.g. the agent reconnected before the dead socket timed out).
        old = self._ws
        self._ws = ws
        if old is not None:
            try:
                await old.close(code=1012, reason="replaced by new agent connection")
            except Exception:
                pass
        logger.info("Door agent connected")

    def unregister(self, ws: WebSocket) -> None:
        if self._ws is ws:
            self._ws = None
            logger.info("Door agent disconnected")
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_result((False, "agente_desconectado"))

    def resolve_ack(self, request_id: str, ok: bool, error: str | None) -> None:
        fut = self._pending.get(request_id)
        if fut is not None and not fut.done():
            fut.set_result((ok, error))

    async def open_door(self, door: int, timeout: float) -> tuple[bool, str | None]:
        """Send an open command and wait for the agent's ack.

        Returns (ok, error). Never raises.
        """
        ws = self._ws
        if ws is None:
            return False, "agente_desconectado"

        request_id = str(uuid.uuid4())
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[request_id] = fut
        try:
            await ws.send_json({"type": "open", "request_id": request_id, "door": door})
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            logger.warning("Door open timed out (request_id=%s)", request_id)
            return False, "timeout"
        except Exception as e:
            logger.error("Door open failed (request_id=%s): %s", request_id, e)
            return False, str(e)
        finally:
            self._pending.pop(request_id, None)


door_manager = DoorAgentManager()
