import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.cliente import Cliente
from backend.models.membresia import Membresia
from backend.models.plan import Plan
from backend.schemas.membresia import MembresiaCreate, MembresiaDetalle, MembresiaOut, MembresiaUpdate

router = APIRouter(prefix="/admin/membresias", tags=["Admin — Membresías"])


async def _enrich(db, membresia: Membresia) -> MembresiaDetalle:
    plan = (await db.execute(select(Plan).where(Plan.id == membresia.plan_id))).scalar_one_or_none()
    cliente = (await db.execute(select(Cliente).where(Cliente.id == membresia.cliente_id))).scalar_one_or_none()
    return MembresiaDetalle(
        id=membresia.id,
        cliente_id=membresia.cliente_id,
        plan_id=membresia.plan_id,
        fecha_inicio=membresia.fecha_inicio,
        fecha_vencimiento=membresia.fecha_vencimiento,
        created_at=membresia.created_at,
        plan_nombre=plan.nombre if plan else None,
        cliente_nombre=cliente.nombre if cliente else None,
        cliente_apellido=cliente.apellido if cliente else None,
        cliente_dni=cliente.dni if cliente else None,
    )


@router.get("", response_model=list[MembresiaDetalle])
async def list_membresias(
    estado: str | None = Query(None, description="activa | vencida | por_vencer"),
    cliente_id: uuid.UUID | None = Query(None),
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(Membresia).order_by(Membresia.fecha_vencimiento.desc())
    if cliente_id:
        q = q.where(Membresia.cliente_id == cliente_id)
    if estado == "activa":
        q = q.where(Membresia.fecha_vencimiento >= date.today())
    elif estado == "vencida":
        q = q.where(Membresia.fecha_vencimiento < date.today())
    elif estado == "por_vencer":
        q = q.where(
            Membresia.fecha_vencimiento >= date.today(),
            Membresia.fecha_vencimiento <= date.today() + timedelta(days=7),
        )
    result = await db.execute(q)
    rows = result.scalars().all()
    return [await _enrich(db, m) for m in rows]


@router.get("/{membresia_id}", response_model=MembresiaDetalle)
async def get_membresia(
    membresia_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Membresia).where(Membresia.id == membresia_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    return await _enrich(db, m)


@router.post("", response_model=MembresiaOut, status_code=status.HTTP_201_CREATED)
async def create_membresia(
    body: MembresiaCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    m = Membresia(**body.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@router.post("/{membresia_id}/renovar", response_model=MembresiaOut)
async def renovar_membresia(
    membresia_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Membresia).where(Membresia.id == membresia_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    today = date.today()
    m.fecha_inicio = today
    m.fecha_vencimiento = today + timedelta(days=30)
    await db.commit()
    await db.refresh(m)
    return m


@router.put("/{membresia_id}", response_model=MembresiaOut)
async def update_membresia(
    membresia_id: uuid.UUID,
    body: MembresiaUpdate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Membresia).where(Membresia.id == membresia_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(m, field, value)
    await db.commit()
    await db.refresh(m)
    return m


@router.delete("/{membresia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_membresia(
    membresia_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Membresia).where(Membresia.id == membresia_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    await db.delete(m)
    await db.commit()
