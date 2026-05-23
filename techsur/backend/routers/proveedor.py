from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from backend.audit import log_cambio, snapshot
from backend.database import get_db
from backend.auth import verify_token
from backend.models.proveedor import Proveedor
from backend.models.compra import Compra
from backend.schemas.proveedor import ProveedorCreate, ProveedorUpdate, ProveedorResponse

router = APIRouter(prefix="/proveedores", tags=["Proveedores"])


@router.get("/", response_model=List[ProveedorResponse])
async def list_proveedores(db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    result = await db.execute(select(Proveedor).order_by(Proveedor.nombre))
    return result.scalars().all()


@router.get("/{id}", response_model=ProveedorResponse)
async def get_proveedor(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Proveedor, id)
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return p


@router.post("/", response_model=ProveedorResponse, status_code=201)
async def create_proveedor(
    data: ProveedorCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = Proveedor(**data.model_dump())
    db.add(p)
    await db.flush()
    await log_cambio(db, "proveedores", p.id, "CREATE", despues=snapshot(p))
    await db.commit()
    await db.refresh(p)
    return p


@router.put("/{id}", response_model=ProveedorResponse)
async def update_proveedor(
    id: str,
    data: ProveedorUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = await db.get(Proveedor, id)
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    antes = snapshot(p)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    await log_cambio(db, "proveedores", p.id, "UPDATE", antes=antes, despues=snapshot(p))
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{id}", status_code=204)
async def delete_proveedor(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Proveedor, id)
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    compras_count = await db.scalar(select(func.count()).where(Compra.proveedor_id == p.id))
    if compras_count:
        raise HTTPException(status_code=409, detail="No se puede eliminar un proveedor con compras registradas")
    antes = snapshot(p)
    await db.delete(p)
    await log_cambio(db, "proveedores", p.id, "DELETE", antes=antes)
    await db.commit()
