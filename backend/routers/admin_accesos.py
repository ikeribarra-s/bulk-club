import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.acceso import Acceso
from backend.models.cliente import Cliente
from backend.schemas.acceso import AccesoDetalle

router = APIRouter(prefix="/admin/accesos", tags=["Admin — Accesos"])


@router.get("", response_model=list[AccesoDetalle])
async def list_accesos(
    cliente_id: uuid.UUID | None = Query(None),
    fecha: date | None = Query(None),
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Acceso, Cliente)
        .join(Cliente, Cliente.id == Acceso.cliente_id)
        .order_by(Acceso.fecha_hora.desc())
        .limit(500)
    )
    if cliente_id:
        q = q.where(Acceso.cliente_id == cliente_id)
    if fecha:
        from sqlalchemy import func
        q = q.where(func.date(Acceso.fecha_hora) == fecha)
    rows = (await db.execute(q)).all()
    return [
        AccesoDetalle(
            id=a.id,
            cliente_id=a.cliente_id,
            fecha_hora=a.fecha_hora,
            resultado=a.resultado,
            motivo=a.motivo,
            cliente_nombre=c.nombre,
            cliente_apellido=c.apellido,
            cliente_dni=c.dni,
        )
        for a, c in rows
    ]
