import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Acceso(Base):
    __tablename__ = "accesos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resultado: Mapped[str] = mapped_column(String, nullable=False)
    motivo: Mapped[str | None] = mapped_column(String, nullable=True)
