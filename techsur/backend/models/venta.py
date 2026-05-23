from sqlalchemy import Integer, Numeric, Text, Date, TIMESTAMP, UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
import uuid
from backend.database import Base


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    producto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("productos.id", ondelete="RESTRICT")
    )
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True
    )
    cantidad: Mapped[int] = mapped_column(Integer, default=1)
    precio_final: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    moneda: Mapped[str] = mapped_column(String(3), default="ARS")
    forma_pago: Mapped[str] = mapped_column(String(20), default="efectivo")
    monto_permuta: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_venta: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
