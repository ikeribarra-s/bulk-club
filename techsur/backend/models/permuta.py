from sqlalchemy import SmallInteger, Numeric, Text, TIMESTAMP, UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid
from backend.database import Base


class Permuta(Base):
    __tablename__ = "permutas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venta_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True
    )
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True
    )
    marca: Mapped[str] = mapped_column(String(60))
    modelo: Mapped[str] = mapped_column(String(80))
    storage: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    condicion: Mapped[str] = mapped_column(String(20))
    bateria_salud: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    valor_permuta: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
