import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PagoCreate(BaseModel):
    cliente_id: uuid.UUID
    membresia_id: uuid.UUID | None = None
    monto: float
    fecha_pago: date
    forma_pago: str
    notas: str | None = None


class PagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cliente_id: uuid.UUID
    membresia_id: uuid.UUID | None
    monto: float
    fecha_pago: date
    forma_pago: str
    notas: str | None
    created_at: datetime


class PagoDetalle(PagoOut):
    cliente_nombre: str | None = None
    cliente_apellido: str | None = None
