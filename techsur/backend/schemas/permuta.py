from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional
import uuid
from backend.models.enums import CondicionPermuta


class PermutaBase(BaseModel):
    venta_id: Optional[uuid.UUID] = None
    cliente_id: Optional[uuid.UUID] = None
    marca: str
    modelo: str
    storage: Optional[str] = None
    color: Optional[str] = None
    condicion: CondicionPermuta
    bateria_salud: Optional[int] = None
    valor_permuta: Decimal
    notas: Optional[str] = None


class PermutaCreate(PermutaBase):
    pass


class PermutaResponse(PermutaBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
