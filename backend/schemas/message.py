import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MessageCreate(BaseModel):
    contenido: str
    rutina: dict | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_id: uuid.UUID
    sender_type: str
    receiver_id: uuid.UUID
    receiver_type: str
    contenido: str
    rutina: dict | None
    read_at: datetime | None
    created_at: datetime


class TrainerInfo(BaseModel):
    id: uuid.UUID
    username: str
    foto_url: str | None


class ConversationOut(BaseModel):
    client_id: uuid.UUID
    client_nombre: str | None
    client_apellido: str | None
    client_foto_url: str | None
    last_message: str | None
    last_message_at: datetime | None
    unread_count: int
