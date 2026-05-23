import bcrypt
from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.auth import create_access_token
from backend.config import settings
from backend.database import get_db
from backend.limiter import limiter
from backend.models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["Auth"])

_SAMESITE = "none" if settings.COOKIE_SECURE else "lax"


@router.post("/token")
@limiter.limit("5/minute")
async def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Usuario).where(Usuario.username == form.username))
    user = result.scalar_one_or_none()
    if not user or not bcrypt.checkpw(form.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    token = create_access_token({"sub": user.username})
    response = JSONResponse(content={"message": "ok"})
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return response


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "ok"})
    response.delete_cookie(key="token", httponly=True, secure=settings.COOKIE_SECURE, samesite=_SAMESITE)
    return response
