import uuid
from datetime import date
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.audit import log_cambio, snapshot
from backend.auth import verify_token
from backend.database import get_db
from backend.models.cliente import Cliente
from backend.models.compra import Compra
from backend.models.historial import HistorialCambio
from backend.models.permuta import Permuta
from backend.models.producto import Producto
from backend.models.proveedor import Proveedor
from backend.models.venta import Venta

router = APIRouter(prefix="/historial", tags=["Historial"])

MODEL_MAP = {
    "productos": Producto,
    "clientes": Cliente,
    "proveedores": Proveedor,
    "compras": Compra,
    "ventas": Venta,
    "permutas": Permuta,
}

_DECIMAL = {"precio_compra", "precio_venta", "precio_unitario", "precio_final", "monto_permuta", "valor_permuta"}
_DATES = {"fecha_compra", "fecha_venta"}
_UUIDS = {"id", "producto_id", "cliente_id", "proveedor_id", "venta_id"}
_INTS = {"cantidad", "bateria_salud", "orden"}
_SKIP = {"updated_at"}


def _coerce(key: str, val):
    if val is None:
        return None
    if key in _UUIDS:
        return uuid.UUID(str(val))
    if key in _DECIMAL:
        return Decimal(str(val))
    if key in _DATES:
        return date.fromisoformat(str(val)[:10])
    if key in _INTS:
        return int(val)
    return val


@router.get("/")
async def list_historial(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    result = await db.execute(
        select(HistorialCambio).order_by(HistorialCambio.created_at.desc()).limit(200)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "tabla": r.tabla,
            "registro_id": r.registro_id,
            "operacion": r.operacion,
            "antes": r.antes,
            "despues": r.despues,
            "fuente": r.fuente,
            "resumen": r.resumen,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/{id}/restaurar")
async def restaurar(
    id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    entrada = await db.get(HistorialCambio, uuid.UUID(id))
    if not entrada:
        raise HTTPException(404, "Entrada de historial no encontrada")

    if entrada.operacion == "CREATE":
        raise HTTPException(
            400,
            "Para deshacer una creación eliminá el registro desde la sección correspondiente."
        )

    ModelClass = MODEL_MAP.get(entrada.tabla)
    if not ModelClass:
        raise HTTPException(400, f"Restauración no soportada para '{entrada.tabla}'")

    if entrada.operacion == "UPDATE":
        record = await db.get(ModelClass, uuid.UUID(entrada.registro_id))
        if not record:
            raise HTTPException(404, "El registro ya no existe (fue eliminado).")
        antes_snap = snapshot(record)
        skip = {"id", "created_at", "updated_at"}
        for k, v in (entrada.antes or {}).items():
            if k in skip:
                continue
            setattr(record, k, _coerce(k, v))
        await log_cambio(
            db, entrada.tabla, entrada.registro_id, "UPDATE",
            antes=antes_snap, despues=entrada.antes,
            fuente="restaurar", resumen=f"Restauró: {entrada.resumen}",
        )
        await db.commit()
        return {"restaurado": True, "tabla": entrada.tabla, "registro_id": entrada.registro_id}

    if entrada.operacion == "DELETE":
        existing = await db.get(ModelClass, uuid.UUID(entrada.registro_id))
        if existing:
            raise HTTPException(409, "El registro ya existe, no es necesario restaurar.")
        datos = {k: _coerce(k, v) for k, v in (entrada.antes or {}).items() if k not in _SKIP}
        obj = ModelClass(**datos)
        db.add(obj)
        if entrada.tabla == "ventas":
            cantidad = int((entrada.antes or {}).get("cantidad", 1))
            pid = (entrada.antes or {}).get("producto_id")
            if pid:
                producto = await db.get(Producto, uuid.UUID(str(pid)))
                if producto:
                    producto.cantidad -= cantidad
                    producto.estado = "vendido" if producto.cantidad <= 0 else "disponible"
        await log_cambio(
            db, entrada.tabla, entrada.registro_id, "CREATE",
            despues=entrada.antes, fuente="restaurar",
            resumen=f"Restauró: {entrada.resumen}",
        )
        await db.commit()
        return {"restaurado": True, "tabla": entrada.tabla, "registro_id": entrada.registro_id}
