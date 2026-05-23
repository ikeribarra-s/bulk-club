from sqlalchemy import Integer, Numeric, Text, Date, TIMESTAMP, UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
import uuid
from backend.database import Base


class Compra(Base):
    __tablename__ = "compras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proveedor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proveedores.id", ondelete="SET NULL"), nullable=True
    )
    producto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("productos.id", ondelete="RESTRICT")
    )
    cantidad: Mapped[int] = mapped_column(Integer, default=1)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fecha_compra: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    forma_pago: Mapped[str] = mapped_column(String(20), default="efectivo")
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
