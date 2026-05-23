from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from backend.audit import log_cambio, snapshot
from backend.database import get_db
from backend.auth import verify_token
from backend.models.producto import Producto
from backend.schemas.producto import ProductoCreate, ProductoUpdate, ProductoResponse, ProductoPublic

router = APIRouter(prefix="/productos", tags=["Productos"])


@router.get("/", response_model=List[ProductoResponse])
async def list_productos(
    estado: Optional[str] = None,
    condicion: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    q = select(Producto)
    if estado:
        q = q.where(Producto.estado == estado)
    if condicion:
        q = q.where(Producto.condicion == condicion)
    result = await db.execute(q.order_by(Producto.created_at.desc()))
    return result.scalars().all()


@router.get("/public", response_model=List[ProductoPublic])
async def list_productos_public(db: AsyncSession = Depends(get_db)):
    q = select(Producto).where(Producto.estado == "disponible").where(Producto.cantidad > 0)
    result = await db.execute(q.order_by(Producto.created_at.desc()))
    return result.scalars().all()


@router.get("/{id}", response_model=ProductoResponse)
async def get_producto(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return p


@router.post("/", response_model=ProductoResponse, status_code=201)
async def create_producto(
    data: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    data_dict = data.model_dump()
    data_dict["estado"] = "disponible" if data_dict["cantidad"] > 0 else "vendido"
    p = Producto(**data_dict)
    db.add(p)
    await db.flush()
    await log_cambio(db, "productos", p.id, "CREATE", despues=snapshot(p))
    await db.commit()
    await db.refresh(p)
    return p


@router.put("/{id}", response_model=ProductoResponse)
async def update_producto(
    id: str,
    data: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    antes = snapshot(p)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    if "cantidad" in data.model_dump(exclude_unset=True):
        p.estado = "disponible" if p.cantidad > 0 else "vendido"
    await log_cambio(db, "productos", p.id, "UPDATE", antes=antes, despues=snapshot(p))
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{id}", status_code=204)
async def delete_producto(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Producto, id)
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    antes = snapshot(p)
    try:
        await db.delete(p)
        await log_cambio(db, "productos", p.id, "DELETE", antes=antes)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: el producto tiene compras o ventas asociadas"
        )
