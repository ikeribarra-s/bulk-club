from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_client
from backend.database import get_db
from backend.models.acceso import Acceso
from backend.models.cliente import Cliente
from backend.models.membresia import Membresia
from backend.models.pago import Pago
from backend.models.plan import Plan
from backend.models.producto import Producto
from backend.models.venta_producto import VentaProducto
from backend.schemas.acceso import AccesoOut
from backend.schemas.cliente import ClienteMe, OnboardingIn
from backend.schemas.venta_producto import TabBalance, VentaProductoDetalle

router = APIRouter(prefix="/me", tags=["Me"])


@router.post("/onboarding")
async def onboarding(
    body: OnboardingIn,
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    if cliente.dni is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding ya completado")

    dni_taken = await db.execute(select(Cliente).where(Cliente.dni == body.dni.strip()))
    if dni_taken.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El DNI ya está registrado")

    cliente.nombre = body.nombre.strip()
    cliente.apellido = body.apellido.strip()
    cliente.dni = body.dni.strip()
    await db.commit()
    return {"pending": True, "message": "Tu cuenta está pendiente de activación por el administrador."}


@router.get("", response_model=ClienteMe)
async def get_me(
    cliente: Cliente = Depends(get_current_client),
):
    return cliente


@router.get("/status")
async def get_status(
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    """Returns onboarding + activation state for the frontend to route correctly."""
    onboarded = cliente.dni is not None
    membresia = None
    if cliente.habilitado:
        mem = await db.execute(
            select(Membresia, Plan)
            .join(Plan, Plan.id == Membresia.plan_id)
            .where(Membresia.cliente_id == cliente.id)
            .order_by(Membresia.fecha_vencimiento.desc())
            .limit(1)
        )
        row = mem.first()
        if row:
            m, p = row
            membresia = {
                "plan_nombre": p.nombre,
                "fecha_vencimiento": m.fecha_vencimiento.isoformat(),
                "activa": m.fecha_vencimiento >= date.today(),
            }
    return {
        "onboarded": onboarded,
        "habilitado": cliente.habilitado,
        "nombre": cliente.nombre,
        "apellido": cliente.apellido,
        "membresia": membresia,
    }


@router.get("/accesos", response_model=list[AccesoOut])
async def get_mis_accesos(
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    if not cliente.habilitado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta no habilitada")
    result = await db.execute(
        select(Acceso)
        .where(Acceso.cliente_id == cliente.id)
        .order_by(Acceso.fecha_hora.desc())
        .limit(20)
    )
    return result.scalars().all()


@router.get("/tab", response_model=TabBalance)
async def get_tab(
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    if not cliente.habilitado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta no habilitada")
    result = await db.execute(
        select(VentaProducto, Producto)
        .join(Producto, Producto.id == VentaProducto.producto_id)
        .where(VentaProducto.cliente_id == cliente.id, VentaProducto.pagado == False)
        .order_by(VentaProducto.fecha_venta.desc())
    )
    rows = result.all()
    items = []
    total = 0.0
    for vp, prod in rows:
        subtotal = float(vp.precio_unitario) * vp.cantidad
        total += subtotal
        items.append(VentaProductoDetalle(
            id=vp.id,
            cliente_id=vp.cliente_id,
            producto_id=vp.producto_id,
            cantidad=vp.cantidad,
            precio_unitario=float(vp.precio_unitario),
            pagado=vp.pagado,
            fecha_venta=vp.fecha_venta,
            producto_nombre=prod.nombre,
        ))
    return TabBalance(items=items, total=round(total, 2))
