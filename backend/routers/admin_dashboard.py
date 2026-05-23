from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.acceso import Acceso
from backend.models.cliente import Cliente
from backend.models.membresia import Membresia
from backend.models.plan import Plan
from backend.models.producto import Producto

router = APIRouter(prefix="/admin/dashboard", tags=["Admin — Dashboard"])


@router.get("")
async def get_dashboard(
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()

    # Active members: habilitado=True and active membership
    active_q = await db.execute(
        select(func.count(func.distinct(Cliente.id)))
        .join(Membresia, Membresia.cliente_id == Cliente.id)
        .where(Cliente.habilitado == True, Membresia.fecha_vencimiento >= today)
    )
    active_count = active_q.scalar_one()

    # Pending activation: habilitado=False but DNI submitted
    pending_q = await db.execute(
        select(Cliente)
        .where(Cliente.habilitado == False, Cliente.dni.is_not(None))
        .order_by(Cliente.created_at.desc())
    )
    pending = pending_q.scalars().all()

    # Expiring in ≤7 days
    expiring_q = await db.execute(
        select(Membresia, Cliente, Plan)
        .join(Cliente, Cliente.id == Membresia.cliente_id)
        .join(Plan, Plan.id == Membresia.plan_id)
        .where(Membresia.fecha_vencimiento >= today, Membresia.fecha_vencimiento <= today + timedelta(days=7))
        .order_by(Membresia.fecha_vencimiento)
    )
    expiring_rows = expiring_q.all()

    # Expired: active clients whose latest membership is expired (no newer active one)
    active_client_ids_q = await db.execute(
        select(Membresia.cliente_id)
        .where(Membresia.fecha_vencimiento >= today)
    )
    active_client_ids = {r for r in active_client_ids_q.scalars().all()}

    expired_q = await db.execute(
        select(Membresia, Cliente, Plan)
        .join(Cliente, Cliente.id == Membresia.cliente_id)
        .join(Plan, Plan.id == Membresia.plan_id)
        .where(Cliente.habilitado == True, Membresia.fecha_vencimiento < today)
        .order_by(Membresia.fecha_vencimiento.desc())
    )
    expired_rows = [
        r for r in expired_q.all()
        if r[1].id not in active_client_ids
    ]

    # Low stock (≤3)
    low_stock_q = await db.execute(
        select(Producto).where(Producto.stock <= 3).order_by(Producto.stock)
    )

    # Today's check-ins
    today_count_q = await db.execute(
        select(func.count())
        .select_from(Acceso)
        .where(func.date(Acceso.fecha_hora) == today, Acceso.resultado == "permitido")
    )

    return {
        "active_members": active_count,
        "today_checkins": today_count_q.scalar_one(),
        "pending_activation": [
            {"id": str(c.id), "nombre": c.nombre, "apellido": c.apellido, "dni": c.dni, "email": c.email}
            for c in pending
        ],
        "expiring_soon": [
            {
                "membresia_id": str(m.id),
                "cliente_id": str(c.id),
                "cliente_nombre": c.nombre,
                "cliente_apellido": c.apellido,
                "plan_nombre": p.nombre,
                "fecha_vencimiento": m.fecha_vencimiento.isoformat(),
                "dias_restantes": (m.fecha_vencimiento - today).days,
            }
            for m, c, p in expiring_rows
        ],
        "expired": [
            {
                "membresia_id": str(m.id),
                "cliente_id": str(c.id),
                "cliente_nombre": c.nombre,
                "cliente_apellido": c.apellido,
                "plan_nombre": p.nombre,
                "fecha_vencimiento": m.fecha_vencimiento.isoformat(),
                "dias_vencida": (today - m.fecha_vencimiento).days,
            }
            for m, c, p in expired_rows
        ],
        "low_stock": [
            {"id": str(p.id), "nombre": p.nombre, "stock": p.stock}
            for p in low_stock_q.scalars().all()
        ],
    }
