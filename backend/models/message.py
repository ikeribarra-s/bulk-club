import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    sender_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'client' | 'admin'
    receiver_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    receiver_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'client' | 'admin'
    contenido: Mapped[str] = mapped_column(Text, nullable=False)
    rutina: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
