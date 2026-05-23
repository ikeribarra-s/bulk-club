import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccesoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cliente_id: uuid.UUID
    fecha_hora: datetime
    resultado: str
    motivo: str | None


class AccesoDetalle(AccesoOut):
    cliente_nombre: str | None = None
    cliente_apellido: str | None = None
    cliente_dni: str | None = None


class CheckResult(BaseModel):
    ok: bool
    message: str
    motivo: str | None = None
