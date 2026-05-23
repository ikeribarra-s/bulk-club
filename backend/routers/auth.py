import bcrypt

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import create_access_token
from backend.config import settings
from backend.database import get_db
from backend.limiter import limiter
from backend.models.cliente import Cliente
from backend.models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["Auth"])

_SAMESITE = "none" if settings.COOKIE_SECURE else "lax"


def _set_token_cookie(response: JSONResponse, token: str) -> None:
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/admin/token")
@limiter.limit("5/minute")
async def admin_login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Usuario).where(Usuario.username == form.username))
    user = result.scalar_one_or_none()
    if not user or not bcrypt.checkpw(form.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    token = create_access_token({"sub": str(user.id), "role": "admin"})
    response = JSONResponse(content={"message": "ok", "role": "admin"})
    _set_token_cookie(response, token)
    return response


class GoogleTokenIn(BaseModel):
    token: str


@router.post("/google")
@limiter.limit("10/minute")
async def google_login(
    request: Request,
    body: GoogleTokenIn,
    db: AsyncSession = Depends(get_db),
):
    try:
        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de Google inválido")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")

    result = await db.execute(select(Cliente).where(Cliente.google_id == google_id))
    cliente = result.scalar_one_or_none()

    if not cliente:
        cliente = Cliente(google_id=google_id, email=email, habilitado=False)
        db.add(cliente)
        await db.commit()
        await db.refresh(cliente)

    token = create_access_token({"sub": str(cliente.id), "role": "client"})
    onboarded = cliente.dni is not None
    response = JSONResponse(content={
        "message": "ok",
        "role": "client",
        "onboarded": onboarded,
        "habilitado": cliente.habilitado,
    })
    _set_token_cookie(response, token)
    return response


@router.post("/client/token")
@limiter.limit("10/minute")
async def client_login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Cliente).where(Cliente.dni == form.username))
    cliente = result.scalar_one_or_none()
    if not cliente or not cliente.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="DNI o contraseña incorrectos")
    match = bcrypt.checkpw(form.password.encode(), cliente.password_hash.encode())
    if not match:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="DNI o contraseña incorrectos")

    token = create_access_token({"sub": str(cliente.id), "role": "client"})
    onboarded = cliente.dni is not None and cliente.nombre is not None
    response = JSONResponse(content={
        "message": "ok",
        "role": "client",
        "onboarded": onboarded,
        "habilitado": cliente.habilitado,
    })
    _set_token_cookie(response, token)
    return response


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "ok"})
    response.delete_cookie(key="token", httponly=True, secure=settings.COOKIE_SECURE, samesite=_SAMESITE)
    return response
