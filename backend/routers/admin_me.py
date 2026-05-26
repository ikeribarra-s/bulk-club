from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.usuario import Usuario
from backend.utils.uploads import delete_upload

router = APIRouter(prefix="/admin/me", tags=["Admin Me"])


class AdminProfileUpdate(BaseModel):
    username: str | None = None
    foto_url: str | None = None
    password: str | None = None


@router.get("")
async def get_admin_me(admin: Usuario = Depends(get_current_admin)):
    return {
        "id": str(admin.id),
        "username": admin.username,
        "foto_url": admin.foto_url,
    }


@router.put("")
async def update_admin_me(
    body: AdminProfileUpdate,
    admin: Usuario = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.username is not None:
        new_username = body.username.strip()
        if not new_username:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre de usuario no puede estar vacío")
        taken = (await db.execute(
            select(Usuario).where(Usuario.username == new_username, Usuario.id != admin.id)
        )).scalar_one_or_none()
        if taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese nombre de usuario ya está en uso")
        admin.username = new_username

    if body.foto_url is not None:
        old_foto = admin.foto_url
        admin.foto_url = body.foto_url or None
        await db.commit()
        if old_foto and old_foto != admin.foto_url:
            delete_upload(old_foto)
    else:
        await db.commit()

    return {
        "id": str(admin.id),
        "username": admin.username,
        "foto_url": admin.foto_url,
    }
