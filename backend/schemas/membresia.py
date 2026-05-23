import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, model_validator


class MembresiaCreate(BaseModel):
    cliente_id: uuid.UUID
    plan_id: uuid.UUID
    fecha_inicio: date
    fecha_vencimiento: date


class MembresiaUpdate(BaseModel):
    plan_id: uuid.UUID | None = None
    fecha_inicio: date | None = None
    fecha_vencimiento: date | None = None


class MembresiaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cliente_id: uuid.UUID
    plan_id: uuid.UUID
    fecha_inicio: date
    fecha_vencimiento: date
    activa: bool = False
    created_at: datetime

    @model_validator(mode="after")
    def set_activa(self) -> "MembresiaOut":
        from datetime import date as d
        self.activa = self.fecha_vencimiento >= d.today()
        return self


class MembresiaDetalle(MembresiaOut):
    plan_nombre: str | None = None
    cliente_nombre: str | None = None
    cliente_apellido: str | None = None
    cliente_dni: str | None = None
