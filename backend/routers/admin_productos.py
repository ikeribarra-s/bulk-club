import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.producto import Producto
from backend.schemas.producto import ProductoCreate, ProductoOut, ProductoUpdate

router = APIRouter(prefix="/admin/productos", tags=["Admin — Stock"])


@router.get("", response_model=list[ProductoOut])
async def list_productos(
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Producto).order_by(Producto.nombre))
    return result.scalars().all()


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
async def create_producto(
    body: ProductoCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    p = Producto(**body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@router.put("/{producto_id}", response_model=ProductoOut)
async def update_producto(
    producto_id: uuid.UUID,
    body: ProductoUpdate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_producto(
    producto_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    await db.delete(p)
    await db.commit()
