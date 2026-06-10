import uuid

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.cliente import Cliente
from backend.models.usuario import Usuario

router = APIRouter(prefix="/admin/entrenadores", tags=["Admin — Entrenadores"])


class EntrenadorOut(BaseModel):
    id: str
    username: str
    foto_url: str | None
    client_count: int


class EntrenadorCreate(BaseModel):
    username: str
    password: str


class EntrenadorUpdate(BaseModel):
    username: str | None = None


class ClienteMinOut(BaseModel):
    id: str
    nombre: str | None
    apellido: str | None
    dni: str | None
    foto_url: str | None


@router.get("", response_model=list[EntrenadorOut])
async def list_trainers(
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    trainers = (await db.execute(
        select(Usuario).where(Usuario.role == "trainer").order_by(Usuario.created_at)
    )).scalars().all()

    result = []
    for t in trainers:
        count = (await db.execute(
            select(func.count()).where(Cliente.trainer_id == t.id)
        )).scalar_one()
        result.append(EntrenadorOut(id=str(t.id), username=t.username, foto_url=t.foto_url, client_count=count))
    return result


@router.post("", response_model=EntrenadorOut, status_code=status.HTTP_201_CREATED)
async def create_trainer(
    body: EntrenadorCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        select(Usuario).where(Usuario.username == body.username)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Nombre de usuario en uso")

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    trainer = Usuario(username=body.username, password_hash=password_hash, role="trainer")
    db.add(trainer)
    await db.commit()
    await db.refresh(trainer)
    return EntrenadorOut(id=str(trainer.id), username=trainer.username, foto_url=trainer.foto_url, client_count=0)


@router.put("/{trainer_id}", response_model=EntrenadorOut)
async def update_trainer(
    trainer_id: uuid.UUID,
    body: EntrenadorUpdate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    trainer = (await db.execute(
        select(Usuario).where(Usuario.id == trainer_id, Usuario.role == "trainer")
    )).scalar_one_or_none()
    if not trainer:
        raise HTTPException(status_code=404, detail="Entrenador no encontrado")

    if body.username:
        existing = (await db.execute(
            select(Usuario).where(Usuario.username == body.username, Usuario.id != trainer_id)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Nombre de usuario en uso")
        trainer.username = body.username

    await db.commit()
    await db.refresh(trainer)
    count = (await db.execute(select(func.count()).where(Cliente.trainer_id == trainer.id))).scalar_one()
    return EntrenadorOut(id=str(trainer.id), username=trainer.username, foto_url=trainer.foto_url, client_count=count)


@router.delete("/{trainer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trainer(
    trainer_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    trainer = (await db.execute(
        select(Usuario).where(Usuario.id == trainer_id, Usuario.role == "trainer")
    )).scalar_one_or_none()
    if not trainer:
        raise HTTPException(status_code=404, detail="Entrenador no encontrado")

    # Unassign all clients first
    clientes = (await db.execute(
        select(Cliente).where(Cliente.trainer_id == trainer_id)
    )).scalars().all()
    for c in clientes:
        c.trainer_id = None

    await db.delete(trainer)
    await db.commit()


@router.get("/{trainer_id}/clientes", response_model=list[ClienteMinOut])
async def get_trainer_clients(
    trainer_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    clientes = (await db.execute(
        select(Cliente).where(Cliente.trainer_id == trainer_id)
    )).scalars().all()
    return [
        ClienteMinOut(id=str(c.id), nombre=c.nombre, apellido=c.apellido, dni=c.dni, foto_url=c.foto_url)
        for c in clientes
    ]


@router.post("/{trainer_id}/clientes/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def assign_client(
    trainer_id: uuid.UUID,
    client_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    trainer = (await db.execute(
        select(Usuario).where(Usuario.id == trainer_id, Usuario.role == "trainer")
    )).scalar_one_or_none()
    if not trainer:
        raise HTTPException(status_code=404, detail="Entrenador no encontrado")

    cliente = (await db.execute(select(Cliente).where(Cliente.id == client_id))).scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    cliente.trainer_id = trainer_id
    await db.commit()


@router.delete("/{trainer_id}/clientes/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_client(
    trainer_id: uuid.UUID,
    client_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    cliente = (await db.execute(
        select(Cliente).where(Cliente.id == client_id, Cliente.trainer_id == trainer_id)
    )).scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    cliente.trainer_id = None
    await db.commit()
