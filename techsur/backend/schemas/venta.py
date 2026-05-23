from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
import uuid
from backend.models.enums import FormaPago, Moneda


class VentaBase(BaseModel):
    producto_id: uuid.UUID
    cliente_id: Optional[uuid.UUID] = None
    cantidad: int = 1
    precio_final: Decimal
    moneda: Moneda = Moneda.ARS
    forma_pago: FormaPago = FormaPago.efectivo
    monto_permuta: Decimal = Decimal("0")
    notas: Optional[str] = None


class VentaCreate(VentaBase):
    pass


class VentaUpdate(BaseModel):
    precio_final: Optional[Decimal] = None
    moneda: Optional[Moneda] = None
    forma_pago: Optional[FormaPago] = None
    monto_permuta: Optional[Decimal] = None
    notas: Optional[str] = None


class VentaResponse(VentaBase):
    id: uuid.UUID
    fecha_venta: date
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VentaLabel(BaseModel):
    id: uuid.UUID
    label: str
