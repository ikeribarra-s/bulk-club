from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from backend.audit import log_cambio, snapshot
from backend.database import get_db
from backend.auth import verify_token
from backend.models.cliente import Cliente
from backend.models.venta import Venta
from backend.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteResponse

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("/", response_model=List[ClienteResponse])
async def list_clientes(
    busqueda: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    q = select(Cliente)
    if busqueda:
        term = f"%{busqueda}%"
        q = q.where(
            Cliente.nombre.ilike(term)
            | Cliente.apellido.ilike(term)
            | Cliente.dni.ilike(term)
        )
    result = await db.execute(q.order_by(Cliente.nombre))
    return result.scalars().all()


@router.get("/{id}", response_model=ClienteResponse)
async def get_cliente(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    c = await db.get(Cliente, id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return c


@router.post("/", response_model=ClienteResponse, status_code=201)
async def create_cliente(
    data: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    c = Cliente(**data.model_dump())
    db.add(c)
    await db.flush()
    await log_cambio(db, "clientes", c.id, "CREATE", despues=snapshot(c))
    await db.commit()
    await db.refresh(c)
    return c


@router.put("/{id}", response_model=ClienteResponse)
async def update_cliente(
    id: str,
    data: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    c = await db.get(Cliente, id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    antes = snapshot(c)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(c, field, val)
    await log_cambio(db, "clientes", c.id, "UPDATE", antes=antes, despues=snapshot(c))
    await db.commit()
    await db.refresh(c)
    return c


@router.delete("/{id}", status_code=204)
async def delete_cliente(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    c = await db.get(Cliente, id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    ventas_count = await db.scalar(select(func.count()).where(Venta.cliente_id == c.id))
    if ventas_count:
        raise HTTPException(status_code=409, detail="No se puede eliminar un cliente con ventas registradas")
    antes = snapshot(c)
    await db.delete(c)
    await log_cambio(db, "clientes", c.id, "DELETE", antes=antes)
    await db.commit()
