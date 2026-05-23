import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class VentaProducto(Base):
    __tablename__ = "ventas_productos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("productos.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    pagado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_venta: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
