import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    author_type: Mapped[str] = mapped_column(String(10), nullable=False)   # 'client' | 'admin'
    author_name: Mapped[str] = mapped_column(String(200), nullable=False)  # denormalized at write time
    author_foto_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="general")  # 'general' | 'rutina'
    titulo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contenido: Mapped[str | None] = mapped_column(Text, nullable=True)
    imagen_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    rutina: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
