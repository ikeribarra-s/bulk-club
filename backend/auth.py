import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.database import get_db


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
