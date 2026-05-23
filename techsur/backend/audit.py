"""
Audit log helpers. Call log_cambio() before db.commit() so the entry
lands in the same transaction as the change it describes.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.historial import HistorialCambio


def _jsonify(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _jsonify(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonify(i) for i in obj]
    if hasattr(obj, "__dict__"):
        return {k: _jsonify(v) for k, v in vars(obj).items() if not k.startswith("_")}
    return obj


def snapshot(obj: Any) -> dict:
    """Serialize an ORM object (or plain dict) to a JSONB-safe dict."""
    return _jsonify(obj)


def _nombre(tabla: str, datos: dict) -> str:
    if not datos:
        return ""
    if datos.get("nombre") and datos.get("apellido"):
        return f"{datos['nombre']} {datos['apellido']}"
    if datos.get("nombre"):
        return datos["nombre"]
    if datos.get("modelo"):
        parts = [datos.get("marca") or "", datos["modelo"],
                 datos.get("storage") or "", datos.get("color") or ""]
        return " ".join(p for p in parts if p).strip()
    return str(datos.get("id", ""))[:8]


def gen_resumen(tabla: str, operacion: str, antes: dict | None, despues: dict | None) -> str:
    datos = antes or despues or {}
    nombre = _nombre(tabla, datos)
    tabla_label = {
        "productos": "Producto", "clientes": "Cliente", "proveedores": "Proveedor",
        "compras": "Compra", "ventas": "Venta", "permutas": "Permuta",
    }.get(tabla, tabla.capitalize())
    op_label = {"CREATE": "Creó", "UPDATE": "Actualizó", "DELETE": "Eliminó"}.get(operacion, operacion)
    return f"{op_label} {tabla_label}: {nombre}"[:200]


async def log_cambio(
    db: AsyncSession,
    tabla: str,
    registro_id: Any,
    operacion: str,
    antes: Optional[Any] = None,
    despues: Optional[Any] = None,
    fuente: str = "manual",
    resumen: Optional[str] = None,
) -> None:
    antes_d = snapshot(antes) if antes is not None else None
    despues_d = snapshot(despues) if despues is not None else None
    entry = HistorialCambio(
        tabla=tabla,
        registro_id=str(registro_id),
        operacion=operacion,
        antes=antes_d,
        despues=despues_d,
        fuente=fuente,
        resumen=resumen or gen_resumen(tabla, operacion, antes_d, despues_d),
    )
    db.add(entry)
