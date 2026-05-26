import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class EjercicioCreate(BaseModel):
    nombre: str
    series: int | None = None
    repeticiones: str | None = None
    peso_kg: float | None = None
    notas: str | None = None
    orden: int = 0


class RutinaCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    ejercicios: list[EjercicioCreate] = []


class PostCreate(BaseModel):
    tipo: Literal["general", "rutina"] = "general"
    titulo: str | None = None
    contenido: str | None = None
    imagen_url: str | None = None
    rutina: RutinaCreate | None = None


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    author_type: str
    author_name: str
    author_foto_url: str | None
    tipo: str
    titulo: str | None
    contenido: str | None
    imagen_url: str | None
    rutina: dict | None
    like_count: int
    comment_count: int
    liked_by_me: bool
    created_at: datetime


class LikeOut(BaseModel):
    cliente_id: uuid.UUID
    author_name: str


class CommentCreate(BaseModel):
    contenido: str
    parent_comment_id: uuid.UUID | None = None


class CommentEdit(BaseModel):
    contenido: str


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    post_id: uuid.UUID
    parent_comment_id: uuid.UUID | None
    author_id: uuid.UUID
    author_type: str
    author_name: str
    contenido: str
    edited_at: datetime | None
    created_at: datetime
