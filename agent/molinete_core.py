"""Núcleo del agente del molinete — lógica compartida entre la CLI y la GUI.

Mantiene la conexión WebSocket saliente hacia el backend y ejecuta las
órdenes de apertura vía ISAPI (HTTP Digest) contra el molinete Hikvision.
"""

import asyncio
import json
import logging
import socket
import time
from dataclasses import asdict, dataclass

import requests
import websockets
from requests.auth import HTTPDigestAuth

logger = logging.getLogger("molinete")

DEDUP_WINDOW_SECONDS = 300.0


@dataclass
class AgentConfig:
    backend_ws_url: str = ""
    agent_token: str = ""
    molinete_ip: str = "192.168.1.202"
    molinete_user: str = ""
    molinete_password: str = ""
    molinete_door: int = 1
    molinete_timeout: float = 4.0
    reconnect_seconds: float = 5.0
    mock: bool = False

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.backend_ws_url.startswith(("ws://", "wss://")):
            errors.append("La URL del backend debe empezar con ws:// o wss://")
        if not self.agent_token:
            errors.append("Falta el token del agente")
        if not self.mock:
            if not self.molinete_ip:
                errors.append("Falta la IP del molinete")
            if not self.molinete_user or not self.molinete_password:
                errors.append("Faltan usuario y/o contraseña del molinete")
        return errors

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "AgentConfig":
        fields = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in data.items() if k in fields})


def abrir_molinete(cfg: AgentConfig, door: int | None = None) -> tuple[bool, str | None]:
    """Comando ISAPI de apertura. Devuelve (ok, error). Bloqueante."""
    door = door or cfg.molinete_door
    if cfg.mock:
        logger.info("MOCK: apertura simulada (door=%s)", door)
        return True, None
    url = f"http://{cfg.molinete_ip}/ISAPI/AccessControl/RemoteControl/door/{door}"
    body = "<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>"
    try:
        r = requests.put(
            url,
            data=body,
            auth=HTTPDigestAuth(cfg.molinete_user, cfg.molinete_password),
            headers={"Content-Type": "application/xml"},
            timeout=cfg.molinete_timeout,
        )
        if r.status_code == 200:
            return True, None
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except requests.RequestException as e:
        return False, str(e)


class DoorAgent:
    """Bucle del agente: conectar, atender órdenes, reconectar si se cae.

    `on_status(estado, detalle)` se llama (desde el hilo del agente) con:
    "connecting", "connected", "disconnected", "stopped".
    """

    def __init__(self, cfg: AgentConfig, on_status=None):
        self.cfg = cfg
        self.on_status = on_status or (lambda estado, detalle: None)
        self._seen: dict[str, float] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._task: asyncio.Task | None = None

    def request_stop(self) -> None:
        """Detiene el agente. Seguro de llamar desde otro hilo."""
        if self._loop is not None and self._task is not None:
            self._loop.call_soon_threadsafe(self._task.cancel)

    def _is_duplicate(self, request_id: str) -> bool:
        now = time.monotonic()
        for rid in [r for r, t in self._seen.items() if now - t > DEDUP_WINDOW_SECONDS]:
            del self._seen[rid]
        if request_id in self._seen:
            return True
        self._seen[request_id] = now
        return False

    async def run(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._task = asyncio.current_task()
        try:
            while True:
                try:
                    self.on_status("connecting", self.cfg.backend_ws_url)
                    async with websockets.connect(
                        self.cfg.backend_ws_url,
                        additional_headers={"Authorization": f"Bearer {self.cfg.agent_token}"},
                        ping_interval=20,
                        ping_timeout=10,
                    ) as ws:
                        logger.info("Conectado al backend")
                        self.on_status("connected", "")
                        await self._session(ws)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.warning("Conexión caída (%s). Reintento en %ss...", e, self.cfg.reconnect_seconds)
                    self.on_status("disconnected", str(e))
                await asyncio.sleep(self.cfg.reconnect_seconds)
        except asyncio.CancelledError:
            logger.info("Agente detenido")
            self.on_status("stopped", "")
            raise

    async def _session(self, ws) -> None:
        await ws.send(json.dumps({"type": "hello", "agent": socket.gethostname()}))
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                logger.warning("Mensaje no-JSON ignorado: %r", raw)
                continue

            if msg.get("type") != "open":
                continue

            request_id = str(msg.get("request_id", ""))
            door = int(msg.get("door") or self.cfg.molinete_door)

            if request_id and self._is_duplicate(request_id):
                logger.warning("Orden duplicada ignorada (request_id=%s)", request_id)
                await ws.send(json.dumps({"type": "ack", "request_id": request_id, "ok": True, "error": None}))
                continue

            ok, error = await asyncio.to_thread(abrir_molinete, self.cfg, door)
            if ok:
                logger.info("APERTURA OK (door=%s, request_id=%s)", door, request_id)
            else:
                logger.error("APERTURA FALLÓ (door=%s, request_id=%s): %s", door, request_id, error)
            await ws.send(json.dumps({"type": "ack", "request_id": request_id, "ok": ok, "error": error}))
