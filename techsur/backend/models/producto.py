from sqlalchemy import String, SmallInteger, Integer, Numeric, Text, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid
from backend.database import Base


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(120))
    marca: Mapped[str] = mapped_column(String(60), default="Apple")
    modelo: Mapped[str] = mapped_column(String(80))
    storage: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    condicion: Mapped[str] = mapped_column(String(20), default="usado")
    bateria_salud: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    cantidad: Mapped[int] = mapped_column(Integer, default=1)
    precio_compra: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    precio_venta: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estado: Mapped[str] = mapped_column(String(20), default="disponible")
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
