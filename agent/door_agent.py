"""Bulk Club — agente del molinete, versión CLI (sin GUI).

La lógica vive en molinete_core.py; este wrapper toma la config de variables
de entorno (o un .env junto al script) y corre el agente en consola.
Para la versión con interfaz gráfica ver molinete_app.py.

Variables de entorno:
  BACKEND_WS_URL      wss://<tu-backend>.onrender.com/api/door/ws
  DOOR_AGENT_TOKEN    mismo valor que en el backend
  MOLINETE_IP         192.168.1.202
  MOLINETE_USER       usuario operador (NO admin) creado en la web del molinete
  MOLINETE_PASSWORD   contraseña de ese usuario
  MOLINETE_DOOR       1 = entrada (default), 2 = salida
  MOLINETE_TIMEOUT    segundos para el request ISAPI (default 4)
  RECONNECT_SECONDS   espera entre reintentos de conexión (default 5)
  MOLINETE_MOCK       true = no llama al molinete, simula apertura OK (solo dev)
"""

import asyncio
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv

from molinete_core import AgentConfig, DoorAgent

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def config_from_env() -> AgentConfig:
    return AgentConfig(
        backend_ws_url=os.environ.get("BACKEND_WS_URL", ""),
        agent_token=os.environ.get("DOOR_AGENT_TOKEN", ""),
        molinete_ip=os.environ.get("MOLINETE_IP", "192.168.1.202"),
        molinete_user=os.environ.get("MOLINETE_USER", ""),
        molinete_password=os.environ.get("MOLINETE_PASSWORD", ""),
        molinete_door=int(os.environ.get("MOLINETE_DOOR", "1")),
        molinete_timeout=float(os.environ.get("MOLINETE_TIMEOUT", "4")),
        reconnect_seconds=float(os.environ.get("RECONNECT_SECONDS", "5")),
        mock=os.environ.get("MOLINETE_MOCK", "").lower() in ("1", "true", "yes"),
    )


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("molinete")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    file_handler = RotatingFileHandler(
        BASE_DIR / "door_agent.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(fmt)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    logger.addHandler(file_handler)
    logger.addHandler(console)
    return logger


if __name__ == "__main__":
    logger = setup_logging()
    cfg = config_from_env()
    errors = cfg.validate()
    if errors:
        for e in errors:
            logger.error(e)
        logger.error("Configurá el archivo .env (ver .env.example).")
        sys.exit(1)

    logger.info(
        "Agente iniciado. Backend: %s | Molinete: %s (door %s)%s",
        cfg.backend_ws_url, cfg.molinete_ip, cfg.molinete_door,
        " [MOCK]" if cfg.mock else "",
    )
    try:
        asyncio.run(DoorAgent(cfg).run())
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Agente detenido manualmente")
