from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.routers import auth, producto, cliente, proveedor, compra, venta, permuta, ai, historial
from backend.config import settings
from backend.limiter import limiter

app = FastAPI(title="TechSur API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(producto.router)
app.include_router(cliente.router)
app.include_router(proveedor.router)
app.include_router(compra.router)
app.include_router(venta.router)
app.include_router(permuta.router)
app.include_router(ai.router)
app.include_router(historial.router)


@app.get("/")
async def root():
    return {"status": "ok"}
