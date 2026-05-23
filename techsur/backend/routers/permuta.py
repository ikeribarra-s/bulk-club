from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from backend.audit import log_cambio, snapshot
from backend.database import get_db
from backend.auth import verify_token
from backend.models.permuta import Permuta
from backend.schemas.permuta import PermutaCreate, PermutaResponse

router = APIRouter(prefix="/permutas", tags=["Permutas"])


@router.get("/", response_model=List[PermutaResponse])
async def list_permutas(db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    result = await db.execute(select(Permuta).order_by(Permuta.created_at.desc()))
    return result.scalars().all()


@router.get("/{id}", response_model=PermutaResponse)
async def get_permuta(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Permuta, id)
    if not p:
        raise HTTPException(status_code=404, detail="Permuta no encontrada")
    return p


@router.post("/", response_model=PermutaResponse, status_code=201)
async def create_permuta(
    data: PermutaCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    p = Permuta(**data.model_dump())
    db.add(p)
    await db.flush()
    await log_cambio(db, "permutas", p.id, "CREATE", despues=snapshot(p))
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{id}", status_code=204)
async def delete_permuta(id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_token)):
    p = await db.get(Permuta, id)
    if not p:
        raise HTTPException(status_code=404, detail="Permuta no encontrada")
    antes = snapshot(p)
    await db.delete(p)
    await log_cambio(db, "permutas", p.id, "DELETE", antes=antes)
    await db.commit()
