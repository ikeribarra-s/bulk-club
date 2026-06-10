"""WebSocket endpoint for the local door agent + admin door utilities.

The agent authenticates with a shared secret (DOOR_AGENT_TOKEN), sent either
as `Authorization: Bearer <token>` header or `?token=` query param.

Protocol (JSON messages):
  backend -> agent: {"type": "open", "request_id": str, "door": int}
  agent -> backend: {"type": "ack", "request_id": str, "ok": bool, "error": str|null}
  agent -> backend: {"type": "hello", "agent": str}   (informational, on connect)
"""

import logging
import secrets

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from backend.auth import get_current_admin
from backend.config import settings
from backend.door_manager import door_manager

logger = logging.getLogger("door")

router = APIRouter(prefix="/door", tags=["Door"])


def _agent_token_valid(ws: WebSocket) -> bool:
    if not settings.DOOR_AGENT_TOKEN:
        return False
    auth = ws.headers.get("authorization", "")
    token = auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else ""
    if not token:
        token = ws.query_params.get("token", "")
    return bool(token) and secrets.compare_digest(token, settings.DOOR_AGENT_TOKEN)


@router.websocket("/ws")
async def door_agent_ws(ws: WebSocket):
    if not _agent_token_valid(ws):
        # Close before accept -> starlette responds 403 to the handshake
        await ws.close(code=1008)
        return

    await ws.accept()
    await door_manager.register(ws)
    try:
        while True:
            msg = await ws.receive_json()
            msg_type = msg.get("type")
            if msg_type == "ack":
                door_manager.resolve_ack(
                    str(msg.get("request_id", "")),
                    bool(msg.get("ok")),
                    msg.get("error"),
                )
            elif msg_type == "hello":
                logger.info("Door agent hello: %s", msg.get("agent", "?"))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("Door agent socket error: %s", e)
    finally:
        door_manager.unregister(ws)


@router.get("/status")
async def door_status(admin=Depends(get_current_admin)):
    return {
        "enabled": settings.DOOR_CONTROL_ENABLED,
        "agent_connected": door_manager.connected,
    }


@router.post("/open")
async def door_open_manual(admin=Depends(get_current_admin)):
    """Manual open from the admin portal — for testing / letting someone in."""
    ok, error = await door_manager.open_door(settings.DOOR_NUMBER, settings.DOOR_OPEN_TIMEOUT)
    return {"ok": ok, "error": error}
