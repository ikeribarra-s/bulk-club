import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.database import get_db


@dataclass
class AuthorInfo:
    id: uuid.UUID
    role: Literal["client", "admin"]
    display_name: str
    foto_url: str | None = None


def create_access_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_token(request: Request) -> dict:
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


async def get_current_admin(request: Request, db: AsyncSession = Depends(get_db)):
    from backend.models.usuario import Usuario
    payload = _decode_token(request)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    result = await db.execute(select(Usuario).where(Usuario.id == uuid.UUID(payload["sub"])))
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return usuario


async def get_current_client(request: Request, db: AsyncSession = Depends(get_db)):
    """Fetch client from DB — habilitado check is left to each route."""
    from backend.models.cliente import Cliente
    payload = _decode_token(request)
    if payload.get("role") != "client":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    result = await db.execute(select(Cliente).where(Cliente.id == uuid.UUID(payload["sub"])))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cliente no encontrado")
    return cliente


async def get_any_user(request: Request, db: AsyncSession = Depends(get_db)) -> AuthorInfo:
    """Accept either client or admin JWT — used by feed endpoints."""
    from backend.models.cliente import Cliente
    from backend.models.usuario import Usuario
    payload = _decode_token(request)
    role = payload.get("role")
    user_id = uuid.UUID(payload["sub"])
    if role == "admin":
        result = await db.execute(select(Usuario).where(Usuario.id == user_id))
        u = result.scalar_one_or_none()
        if not u:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
        return AuthorInfo(id=u.id, role="admin", display_name=u.username, foto_url=u.foto_url)
    if role == "client":
        result = await db.execute(select(Cliente).where(Cliente.id == user_id))
        c = result.scalar_one_or_none()
        if not c:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cliente no encontrado")
        name = " ".join(filter(None, [c.nombre, c.apellido])) or "Cliente"
        return AuthorInfo(id=c.id, role="client", display_name=name, foto_url=c.foto_url)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
