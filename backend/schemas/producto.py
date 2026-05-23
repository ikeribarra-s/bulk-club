import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProductoCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    precio: float
    stock: int = 0


class ProductoUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    precio: float | None = None
    stock: int | None = None


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    descripcion: str | None
    precio: float
    stock: int
    created_at: datetime
