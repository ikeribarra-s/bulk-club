import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VentaProductoCreate(BaseModel):
    cliente_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    pagado: bool = False


class VentaProductoUpdate(BaseModel):
    pagado: bool


class VentaProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cliente_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    precio_unitario: float
    pagado: bool
    fecha_venta: datetime


class VentaProductoDetalle(VentaProductoOut):
    producto_nombre: str | None = None
    cliente_nombre: str | None = None
    cliente_apellido: str | None = None


class TabBalance(BaseModel):
    items: list[VentaProductoDetalle]
    total: float
