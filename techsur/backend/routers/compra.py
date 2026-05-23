from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from backend.audit import log_cambio, snapshot
from backend.database import get_db
from backend.auth import verify_token
from backend.models.compra import Compra
from backend.models.producto import Producto
from backend.schemas.compra import CompraCreate, CompraResponse

router = APIRouter(prefix="/compras", tags=["Compras"])


@router.get("/", response_model=List[CompraResponse])
async def list_compras(
    proveedor_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    q = select(Compra)
    if proveedor_id:
        q = q.where(Compra.proveedor_id == proveedor_id)
    result = await db.execute(q.order_by(Compra.fecha_compra.desc()))
    return result.scalars().all()


@router.get("/{id}", response_model=CompraResponse)
async def get_compra(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    c = await db.get(Compra, id)
    if not c:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return c


@router.post("/", response_model=CompraResponse, status_code=201)
async def create_compra(
    data: CompraCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    producto = await db.get(Producto, str(data.producto_id))
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    c = Compra(**data.model_dump())
    db.add(c)
    await db.flush()
    await log_cambio(db, "compras", c.id, "CREATE", despues=snapshot(c))
    await db.commit()
    await db.refresh(c)
    return c


@router.delete("/{id}", status_code=204)
async def delete_compra(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    c = await db.get(Compra, id)
    if not c:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    antes = snapshot(c)
    await db.delete(c)
    await log_cambio(db, "compras", c.id, "DELETE", antes=antes)
    await db.commit()
