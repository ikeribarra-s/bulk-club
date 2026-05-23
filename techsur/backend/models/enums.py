import enum


class CondicionProducto(str, enum.Enum):
    nuevo = "nuevo"
    usado = "usado"
    reacondicionado = "reacondicionado"


class EstadoProducto(str, enum.Enum):
    disponible = "disponible"
    vendido = "vendido"


class FormaPago(str, enum.Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    tarjeta = "tarjeta"
    mixto = "mixto"


class FormaPagoCompra(str, enum.Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    tarjeta = "tarjeta"


class CondicionPermuta(str, enum.Enum):
    bueno = "bueno"
    regular = "regular"
    malo = "malo"


class Moneda(str, enum.Enum):
    ARS = "ARS"
    USD = "USD"
