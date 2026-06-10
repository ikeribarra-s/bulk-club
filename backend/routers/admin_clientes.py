import uuid
from datetime import date, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.cliente import Cliente
from backend.models.membresia import Membresia
from backend.models.pago import Pago
from backend.models.plan import Plan
from backend.schemas.cliente import ClienteConPlan, ClienteCreate, ClienteOut, ClienteUpdate

router = APIRouter(prefix="/admin/clientes", tags=["Admin — Clientes"])


async def _enrich_clientes(db: AsyncSession, clientes: list[Cliente]) -> list[ClienteConPlan]:
    """Attach latest membership + plan info to each client in one extra query."""
    if not clientes:
        return []

    ids = [c.id for c in clientes]

    # For each client, get the membership with the latest fecha_vencimiento
    rn_col = func.row_number().over(
        partition_by=Membresia.cliente_id,
        order_by=Membresia.fecha_vencimiento.desc(),
    ).label("rn")

    subq = (
        select(Membresia.id, Membresia.cliente_id, Membresia.plan_id, Membresia.fecha_vencimiento, rn_col)
        .where(Membresia.cliente_id.in_(ids))
        .subquery()
    )

    rows = (await db.execute(
        select(subq, Plan.nombre.label("plan_nombre"))
        .outerjoin(Plan, Plan.id == subq.c.plan_id)
        .where(subq.c.rn == 1)
    )).all()

    mem_map = {r.cliente_id: r for r in rows}
    today = date.today()

    result = []
    for c in clientes:
        m = mem_map.get(c.id)
        result.append(ClienteConPlan(
            id=c.id,
            nombre=c.nombre,
            apellido=c.apellido,
            email=c.email,
            telefono=c.telefono,
            dni=c.dni,
            habilitado=c.habilitado,
            created_at=c.created_at,
            plan_nombre=m.plan_nombre if m else None,
            plan_id=m.plan_id if m else None,
            membresia_id=m.id if m else None,
            fecha_vencimiento=m.fecha_vencimiento if m else None,
            membresia_activa=bool(m and m.fecha_vencimiento >= today),
            trainer_id=c.trainer_id,
        ))
    return result


@router.get("", response_model=list[ClienteConPlan])
async def list_clientes(
    busqueda: str | None = Query(None),
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(Cliente).order_by(Cliente.created_at.desc())
    if busqueda:
        like = f"%{busqueda}%"
        q = q.where(or_(
            Cliente.nombre.ilike(like),
            Cliente.apellido.ilike(like),
            Cliente.email.ilike(like),
            Cliente.dni.ilike(like),
        ))
    clientes = (await db.execute(q)).scalars().all()
    return await _enrich_clientes(db, list(clientes))


@router.get("/{cliente_id}", response_model=ClienteConPlan)
async def get_cliente(
    cliente_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    enriched = await _enrich_clientes(db, [cliente])
    return enriched[0]


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
async def create_cliente(
    body: ClienteCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    raw_password = body.password or body.dni
    password_hash = bcrypt.hashpw(raw_password.encode(), bcrypt.gensalt()).decode()
    data = body.model_dump(exclude={"password"})
    cliente = Cliente(**data, password_hash=password_hash, habilitado=True)
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=ClienteOut)
async def update_cliente(
    cliente_id: uuid.UUID,
    body: ClienteUpdate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cliente, field, value)
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cliente(
    cliente_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    mem = await db.execute(select(Membresia).where(Membresia.cliente_id == cliente_id).limit(1))
    if mem.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El cliente tiene membresías asociadas")
    await db.delete(cliente)
    await db.commit()


@router.post("/{cliente_id}/reset-password", response_model=ClienteOut)
async def reset_password(
    cliente_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    if not cliente.dni:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El cliente no tiene DNI asignado")
    cliente.password_hash = bcrypt.hashpw(cliente.dni.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.post("/{cliente_id}/habilitar", response_model=ClienteOut)
async def habilitar(
    cliente_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    cliente.habilitado = True
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.post("/{cliente_id}/deshabilitar", response_model=ClienteOut)
async def deshabilitar(
    cliente_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    cliente.habilitado = False
    await db.commit()
    await db.refresh(cliente)
    return cliente


class TrainerBody(BaseModel):
    trainer_id: uuid.UUID | None


@router.put("/{cliente_id}/trainer", response_model=ClienteOut)
async def set_trainer(
    cliente_id: uuid.UUID,
    body: TrainerBody,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    cliente.trainer_id = body.trainer_id
    await db.commit()
    await db.refresh(cliente)
    return cliente


class RenovarBody(BaseModel):
    forma_pago: str = "efectivo"


@router.post("/{cliente_id}/renovar")
async def renovar_cliente(
    cliente_id: uuid.UUID,
    body: RenovarBody,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Get latest membership
    mem_result = await db.execute(
        select(Membresia)
        .where(Membresia.cliente_id == cliente_id)
        .order_by(Membresia.fecha_vencimiento.desc())
        .limit(1)
    )
    membresia = mem_result.scalar_one_or_none()
    if not membresia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El cliente no tiene membresía asignada")

    plan_result = await db.execute(select(Plan).where(Plan.id == membresia.plan_id))
    plan = plan_result.scalar_one()

    today = date.today()
    membresia.fecha_inicio = today
    membresia.fecha_vencimiento = today + timedelta(days=30)

    pago = Pago(
        cliente_id=cliente_id,
        membresia_id=membresia.id,
        monto=plan.precio_mensual,
        fecha_pago=today,
        forma_pago=body.forma_pago,
    )
    db.add(pago)
    await db.commit()

    return {
        "message": "Membresía renovada",
        "nueva_fecha_vencimiento": membresia.fecha_vencimiento.isoformat(),
        "monto_pagado": float(plan.precio_mensual),
        "plan": plan.nombre,
    }
