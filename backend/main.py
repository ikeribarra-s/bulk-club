from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.config import settings
from backend.limiter import limiter
from backend.routers import (
    auth,
    acceso,
    door_agent,
    me,
    feed,
    messages,
    trainer_messages,
    trainer_me,
    admin_me,
    admin_clientes,
    admin_membresias,
    admin_pagos,
    admin_planes,
    admin_productos,
    admin_ventas,
    admin_accesos,
    admin_dashboard,
    admin_entrenadores,
)

app = FastAPI(title="Bulk Club API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(acceso.router, prefix="/api")
app.include_router(door_agent.router, prefix="/api")
app.include_router(me.router, prefix="/api")
app.include_router(feed.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(trainer_messages.router, prefix="/api")
app.include_router(trainer_me.router, prefix="/api")
app.include_router(admin_entrenadores.router, prefix="/api")
app.include_router(admin_me.router, prefix="/api")
app.include_router(admin_clientes.router, prefix="/api")
app.include_router(admin_membresias.router, prefix="/api")
app.include_router(admin_pagos.router, prefix="/api")
app.include_router(admin_planes.router, prefix="/api")
app.include_router(admin_productos.router, prefix="/api")
app.include_router(admin_ventas.router, prefix="/api")
app.include_router(admin_accesos.router, prefix="/api")
app.include_router(admin_dashboard.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "app": "Bulk Club"}
