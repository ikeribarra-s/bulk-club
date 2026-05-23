import uuid

from pydantic import BaseModel, ConfigDict


class PlanCreate(BaseModel):
    nombre: str
    dias_por_semana: int | None = None
    precio_mensual: float
    descripcion: str | None = None


class PlanUpdate(BaseModel):
    nombre: str | None = None
    dias_por_semana: int | None = None
    precio_mensual: float | None = None
    descripcion: str | None = None
    activo: bool | None = None


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    dias_por_semana: int | None
    precio_mensual: float
    descripcion: str | None
    activo: bool
