import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.cliente import Cliente
from backend.models.pago import Pago
from backend.schemas.pago import PagoCreate, PagoDetalle, PagoOut

router = APIRouter(prefix="/admin/pagos", tags=["Admin — Pagos"])


@router.get("", response_model=list[PagoDetalle])
async def list_pagos(
    cliente_id: uuid.UUID | None = Query(None),
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(Pago, Cliente).join(Cliente, Cliente.id == Pago.cliente_id).order_by(Pago.fecha_pago.desc())
    if cliente_id:
        q = q.where(Pago.cliente_id == cliente_id)
    rows = (await db.execute(q)).all()
    return [
        PagoDetalle(
            **{c: getattr(p, c) for c in PagoOut.model_fields},
            cliente_nombre=c.nombre,
            cliente_apellido=c.apellido,
        )
        for p, c in rows
    ]


@router.post("", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
async def create_pago(
    body: PagoCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    pago = Pago(**body.model_dump())
    db.add(pago)
    await db.commit()
    await db.refresh(pago)
    return pago


@router.delete("/{pago_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pago(
    pago_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pago).where(Pago.id == pago_id))
    pago = result.scalar_one_or_none()
    if not pago:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    await db.delete(pago)
    await db.commit()
