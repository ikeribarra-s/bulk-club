import uuid

from sqlalchemy import Boolean, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Plan(Base):
    __tablename__ = "planes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    dias_por_semana: Mapped[int | None] = mapped_column(Integer, nullable=True)
    precio_mensual: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
