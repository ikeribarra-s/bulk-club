from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_trainer
from backend.database import get_db
from backend.models.usuario import Usuario

router = APIRouter(prefix="/trainer", tags=["Trainer — Me"])


class TrainerMeOut(BaseModel):
    id: str
    username: str
    foto_url: str | None
    role: str


class TrainerMeUpdate(BaseModel):
    username: str | None = None
    foto_url: str | None = None


@router.get("/me", response_model=TrainerMeOut)
async def get_me(trainer: Usuario = Depends(get_current_trainer)):
    return TrainerMeOut(
        id=str(trainer.id),
        username=trainer.username,
        foto_url=trainer.foto_url,
        role=trainer.role,
    )


@router.put("/me", response_model=TrainerMeOut)
async def update_me(
    body: TrainerMeUpdate,
    trainer: Usuario = Depends(get_current_trainer),
    db: AsyncSession = Depends(get_db),
):
    if body.username is not None:
        existing = (await db.execute(
            select(Usuario).where(Usuario.username == body.username, Usuario.id != trainer.id)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Nombre de usuario en uso")
        trainer.username = body.username
    if body.foto_url is not None:
        trainer.foto_url = body.foto_url
    await db.commit()
    await db.refresh(trainer)
    return TrainerMeOut(id=str(trainer.id), username=trainer.username, foto_url=trainer.foto_url, role=trainer.role)
