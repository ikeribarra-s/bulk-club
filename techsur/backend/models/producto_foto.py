from sqlalchemy import String, Integer, TIMESTAMP, UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid
from backend.database import Base


class ProductoFoto(Base):
    __tablename__ = "producto_fotos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    producto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("productos.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(1000))
    orden: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    producto: Mapped["Producto"] = relationship("Producto")
