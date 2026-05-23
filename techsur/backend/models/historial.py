from sqlalchemy import String, TIMESTAMP, UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
import uuid
from backend.database import Base


class HistorialCambio(Base):
    __tablename__ = "historial_cambios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tabla: Mapped[str] = mapped_column(String(50))
    registro_id: Mapped[str] = mapped_column(String(36))
    operacion: Mapped[str] = mapped_column(String(10))  # CREATE, UPDATE, DELETE
    antes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    despues: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    fuente: Mapped[str] = mapped_column(String(20), default="manual")
    resumen: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
