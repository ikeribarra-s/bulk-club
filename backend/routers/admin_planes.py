import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.membresia import Membresia
from backend.models.plan import Plan
from backend.schemas.plan import PlanCreate, PlanOut, PlanUpdate

router = APIRouter(prefix="/admin/planes", tags=["Admin — Planes"])


@router.get("", response_model=list[PlanOut])
async def list_planes(
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Plan).order_by(Plan.nombre))
    return result.scalars().all()


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    plan = Plan(**body.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.put("/{plan_id}", response_model=PlanOut)
async def update_plan(
    plan_id: uuid.UUID,
    body: PlanUpdate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    mem = await db.execute(select(Membresia).where(Membresia.plan_id == plan_id).limit(1))
    if mem.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El plan tiene membresías asociadas")
    await db.delete(plan)
    await db.commit()
