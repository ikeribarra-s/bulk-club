from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from backend.audit import log_cambio, snapshot
from backend.database import get_db
from backend.auth import verify_token
from backend.models.venta import Venta
from backend.models.producto import Producto
from backend.models.cliente import Cliente
from backend.schemas.venta import VentaCreate, VentaUpdate, VentaResponse, VentaLabel

router = APIRouter(prefix="/ventas", tags=["Ventas"])


@router.get("/labels", response_model=List[VentaLabel])
async def list_venta_labels(db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    rows = await db.execute(
        select(Venta.id, Producto.nombre, Producto.modelo, Cliente.nombre.label("cliente_nombre"), Cliente.apellido)
        .join(Producto, Venta.producto_id == Producto.id)
        .outerjoin(Cliente, Venta.cliente_id == Cliente.id)
        .order_by(Venta.fecha_venta.desc())
    )
    return [
        VentaLabel(
            id=row.id,
            label=f"{row.nombre}"
            + (f" · {row.cliente_nombre} {row.apellido or ''}".strip() if row.cliente_nombre else ""),
        )
        for row in rows
    ]


@router.get("/", response_model=List[VentaResponse])
async def list_ventas(db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    result = await db.execute(select(Venta).order_by(Venta.fecha_venta.desc()))
    return result.scalars().all()


@router.get("/{id}", response_model=VentaResponse)
async def get_venta(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    v = await db.get(Venta, id)
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return v


@router.post("/", response_model=VentaResponse, status_code=201)
async def create_venta(
    data: VentaCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    producto = await db.get(Producto, str(data.producto_id))
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if producto.cantidad < data.cantidad:
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente: hay {producto.cantidad} unidad(es) disponible(s)"
        )

    venta = Venta(**data.model_dump())
    db.add(venta)
    producto.cantidad -= data.cantidad
    if producto.cantidad <= 0:
        producto.estado = "vendido"
    else:
        producto.estado = "disponible"
    await db.flush()
    await log_cambio(db, "ventas", venta.id, "CREATE", despues=snapshot(venta))
    await db.commit()
    await db.refresh(venta)
    return venta


@router.put("/{id}", response_model=VentaResponse)
async def update_venta(
    id: str,
    data: VentaUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    v = await db.get(Venta, id)
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    antes = snapshot(v)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(v, field, val)
    await log_cambio(db, "ventas", v.id, "UPDATE", antes=antes, despues=snapshot(v))
    await db.commit()
    await db.refresh(v)
    return v


@router.delete("/{id}", status_code=204)
async def delete_venta(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    v = await db.get(Venta, id)
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    producto = await db.get(Producto, v.producto_id)
    antes = snapshot(v)
    await db.delete(v)
    if producto:
        producto.cantidad += v.cantidad
        if producto.estado == "vendido" and producto.cantidad > 0:
            producto.estado = "disponible"
    await log_cambio(db, "ventas", v.id, "DELETE", antes=antes)
    await db.commit()
