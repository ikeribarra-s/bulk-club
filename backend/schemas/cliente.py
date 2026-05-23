import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class OnboardingIn(BaseModel):
    nombre: str
    apellido: str
    dni: str


class ClienteCreate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    email: str | None = None
    telefono: str | None = None
    dni: str
    password: str | None = None  # defaults to DNI when not provided


class ClienteUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    telefono: str | None = None
    dni: str | None = None
    habilitado: bool | None = None


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str | None
    apellido: str | None
    email: str
    telefono: str | None
    dni: str | None
    habilitado: bool
    created_at: datetime


class ClienteMe(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str | None
    apellido: str | None
    email: str
    dni: str | None
    habilitado: bool


class ClienteConPlan(ClienteOut):
    plan_nombre: str | None = None
    plan_id: uuid.UUID | None = None
    membresia_id: uuid.UUID | None = None
    fecha_vencimiento: date | None = None
    membresia_activa: bool = False
