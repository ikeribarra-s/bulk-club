import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Pago(Base):
    __tablename__ = "pagos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    membresia_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("membresias.id"), nullable=True)
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    fecha_pago: Mapped[date] = mapped_column(Date, nullable=False)
    forma_pago: Mapped[str] = mapped_column(String, nullable=False)
    notas: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
