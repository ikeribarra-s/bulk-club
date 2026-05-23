"""
Tool definitions and execution layer for the AI assistant.
Each tool maps to a direct DB operation (no internal HTTP).
"""
import json
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.audit import log_cambio, snapshot
from backend.models.cliente import Cliente
from backend.models.compra import Compra
from backend.models.permuta import Permuta
from backend.models.producto import Producto
from backend.models.proveedor import Proveedor
from backend.models.venta import Venta


# ── Serialization helpers ─────────────────────────────────────────────────────

def _serialize(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, date):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return {k: _serialize(v) for k, v in vars(obj).items() if not k.startswith("_")}
    return obj


def _row(obj: Any) -> dict:
    return _serialize(obj)


def _ok(data: Any) -> str:
    return json.dumps(data, default=str, ensure_ascii=False)


def _err(msg: str) -> str:
    return json.dumps({"error": msg}, ensure_ascii=False)


# ── Tool executor ─────────────────────────────────────────────────────────────

async def execute_tool(name: str, inputs: dict, db: AsyncSession) -> str:
    try:
        match name:
            # ── Productos ──────────────────────────────────────────────────
            case "list_productos":
                q = select(Producto)
                if inputs.get("estado"):
                    if inputs["estado"] == "disponible":
                        q = q.where(Producto.cantidad > 0)
                    elif inputs["estado"] == "vendido":
                        q = q.where(Producto.cantidad == 0)
                if inputs.get("condicion"):
                    q = q.where(Producto.condicion == inputs["condicion"])
                rows = (await db.execute(q.order_by(Producto.created_at.desc()))).scalars().all()
                result = []
                for p in rows:
                    d = _row(p)
                    d["margen_bruto"] = float(p.precio_venta - p.precio_compra)
                    result.append(d)
                return _ok(result)

            case "get_producto":
                p = await db.get(Producto, inputs["id"])
                if not p:
                    return _err("Producto no encontrado")
                d = _row(p)
                d["margen_bruto"] = float(p.precio_venta - p.precio_compra)
                return _ok(d)

            case "create_producto":
                p = Producto(
                    nombre=inputs["nombre"],
                    marca=inputs.get("marca", "Apple"),
                    modelo=inputs["modelo"],
                    storage=inputs.get("storage"),
                    color=inputs.get("color"),
                    condicion=inputs.get("condicion", "usado"),
                    bateria_salud=inputs.get("bateria_salud"),
                    cantidad=inputs.get("cantidad", 1),
                    precio_compra=Decimal(str(inputs["precio_compra"])),
                    precio_venta=Decimal(str(inputs["precio_venta"])),
                    estado="disponible" if inputs.get("cantidad", 1) > 0 else "vendido",
                    notas=inputs.get("notas"),
                )
                db.add(p)
                await db.flush()
                await log_cambio(db, "productos", p.id, "CREATE", despues=snapshot(p), fuente="ai")
                await db.commit()
                await db.refresh(p)
                return _ok(_row(p))

            case "update_producto":
                p = await db.get(Producto, inputs["id"])
                if not p:
                    return _err("Producto no encontrado")
                antes = snapshot(p)
                allowed = ["nombre", "marca", "modelo", "storage", "color", "condicion",
                           "bateria_salud", "cantidad", "precio_compra", "precio_venta", "notas"]
                for field in allowed:
                    if field in inputs:
                        val = inputs[field]
                        if field in ("precio_compra", "precio_venta"):
                            val = Decimal(str(val))
                        setattr(p, field, val)
                if "cantidad" in inputs:
                    p.estado = "disponible" if p.cantidad > 0 else "vendido"
                await log_cambio(db, "productos", p.id, "UPDATE", antes=antes, despues=snapshot(p), fuente="ai")
                await db.commit()
                await db.refresh(p)
                return _ok(_row(p))

            case "delete_producto":
                p = await db.get(Producto, inputs["id"])
                if not p:
                    return _err("Producto no encontrado")
                if p.cantidad == 0:
                    return _err("No se puede eliminar un producto vendido. Eliminá la venta primero.")
                antes = snapshot(p)
                await db.delete(p)
                await log_cambio(db, "productos", p.id, "DELETE", antes=antes, fuente="ai")
                await db.commit()
                return _ok({"deleted": inputs["id"]})

            # ── Clientes ───────────────────────────────────────────────────
            case "list_clientes":
                rows = (await db.execute(select(Cliente).order_by(Cliente.nombre))).scalars().all()
                return _ok([_row(c) for c in rows])

            case "get_cliente":
                c = await db.get(Cliente, inputs["id"])
                if not c:
                    return _err("Cliente no encontrado")
                return _ok(_row(c))

            case "create_cliente":
                c = Cliente(
                    nombre=inputs["nombre"],
                    apellido=inputs.get("apellido"),
                    dni=inputs.get("dni"),
                    telefono=inputs.get("telefono"),
                    email=inputs.get("email"),
                    direccion=inputs.get("direccion"),
                    notas=inputs.get("notas"),
                )
                db.add(c)
                await db.flush()
                await log_cambio(db, "clientes", c.id, "CREATE", despues=snapshot(c), fuente="ai")
                await db.commit()
                await db.refresh(c)
                return _ok(_row(c))

            case "update_cliente":
                c = await db.get(Cliente, inputs["id"])
                if not c:
                    return _err("Cliente no encontrado")
                antes = snapshot(c)
                for field in ["nombre", "apellido", "dni", "telefono", "email", "direccion", "notas"]:
                    if field in inputs:
                        setattr(c, field, inputs[field])
                await log_cambio(db, "clientes", c.id, "UPDATE", antes=antes, despues=snapshot(c), fuente="ai")
                await db.commit()
                await db.refresh(c)
                return _ok(_row(c))

            case "delete_cliente":
                c = await db.get(Cliente, inputs["id"])
                if not c:
                    return _err("Cliente no encontrado")
                antes = snapshot(c)
                await db.delete(c)
                await log_cambio(db, "clientes", c.id, "DELETE", antes=antes, fuente="ai")
                await db.commit()
                return _ok({"deleted": inputs["id"]})

            # ── Proveedores ────────────────────────────────────────────────
            case "list_proveedores":
                rows = (await db.execute(select(Proveedor).order_by(Proveedor.nombre))).scalars().all()
                return _ok([_row(p) for p in rows])

            case "get_proveedor":
                p = await db.get(Proveedor, inputs["id"])
                if not p:
                    return _err("Proveedor no encontrado")
                return _ok(_row(p))

            case "create_proveedor":
                p = Proveedor(
                    nombre=inputs["nombre"],
                    contacto=inputs.get("contacto"),
                    telefono=inputs.get("telefono"),
                    email=inputs.get("email"),
                    notas=inputs.get("notas"),
                )
                db.add(p)
                await db.flush()
                await log_cambio(db, "proveedores", p.id, "CREATE", despues=snapshot(p), fuente="ai")
                await db.commit()
                await db.refresh(p)
                return _ok(_row(p))

            case "update_proveedor":
                p = await db.get(Proveedor, inputs["id"])
                if not p:
                    return _err("Proveedor no encontrado")
                antes = snapshot(p)
                for field in ["nombre", "contacto", "telefono", "email", "notas"]:
                    if field in inputs:
                        setattr(p, field, inputs[field])
                await log_cambio(db, "proveedores", p.id, "UPDATE", antes=antes, despues=snapshot(p), fuente="ai")
                await db.commit()
                await db.refresh(p)
                return _ok(_row(p))

            case "delete_proveedor":
                p = await db.get(Proveedor, inputs["id"])
                if not p:
                    return _err("Proveedor no encontrado")
                antes = snapshot(p)
                await db.delete(p)
                await log_cambio(db, "proveedores", p.id, "DELETE", antes=antes, fuente="ai")
                await db.commit()
                return _ok({"deleted": inputs["id"]})

            # ── Compras ────────────────────────────────────────────────────
            case "list_compras":
                q = select(Compra)
                if inputs.get("proveedor_id"):
                    q = q.where(Compra.proveedor_id == inputs["proveedor_id"])
                rows = (await db.execute(q.order_by(Compra.fecha_compra.desc()))).scalars().all()
                return _ok([_row(c) for c in rows])

            case "create_compra":
                producto = await db.get(Producto, inputs["producto_id"])
                if not producto:
                    return _err(f"Producto {inputs['producto_id']} no encontrado")
                c = Compra(
                    producto_id=producto.id,
                    proveedor_id=inputs.get("proveedor_id"),
                    cantidad=inputs.get("cantidad", 1),
                    precio_unitario=Decimal(str(inputs["precio_unitario"])),
                    fecha_compra=date.fromisoformat(inputs.get("fecha_compra", date.today().isoformat())),
                    forma_pago=inputs.get("forma_pago", "efectivo"),
                    notas=inputs.get("notas"),
                )
                db.add(c)
                await db.flush()
                await log_cambio(db, "compras", c.id, "CREATE", despues=snapshot(c), fuente="ai")
                await db.commit()
                await db.refresh(c)
                return _ok(_row(c))

            case "delete_compra":
                c = await db.get(Compra, inputs["id"])
                if not c:
                    return _err("Compra no encontrada")
                antes = snapshot(c)
                await db.delete(c)
                await log_cambio(db, "compras", c.id, "DELETE", antes=antes, fuente="ai")
                await db.commit()
                return _ok({"deleted": inputs["id"]})

            # ── Ventas ─────────────────────────────────────────────────────
            case "list_ventas":
                rows = (await db.execute(select(Venta).order_by(Venta.fecha_venta.desc()))).scalars().all()
                return _ok([_row(v) for v in rows])

            case "create_venta":
                producto = await db.get(Producto, inputs["producto_id"])
                if not producto:
                    return _err("Producto no encontrado")
                cantidad = inputs.get("cantidad", 1)
                if producto.cantidad < cantidad:
                    return _err(f"Stock insuficiente: hay {producto.cantidad} unidad(es) disponible(s)")
                v = Venta(
                    producto_id=producto.id,
                    cliente_id=inputs.get("cliente_id"),
                    cantidad=cantidad,
                    precio_final=Decimal(str(inputs["precio_final"])),
                    moneda=inputs.get("moneda", "ARS"),
                    forma_pago=inputs.get("forma_pago", "efectivo"),
                    monto_permuta=Decimal(str(inputs.get("monto_permuta", 0))),
                    notas=inputs.get("notas"),
                    fecha_venta=date.fromisoformat(inputs.get("fecha_venta", date.today().isoformat())),
                )
                db.add(v)
                producto.cantidad -= cantidad
                if producto.cantidad <= 0:
                    producto.estado = "vendido"
                else:
                    producto.estado = "disponible"
                await db.flush()
                await log_cambio(db, "ventas", v.id, "CREATE", despues=snapshot(v), fuente="ai")
                await db.commit()
                await db.refresh(v)
                return _ok(_row(v))

            case "delete_venta":
                v = await db.get(Venta, inputs["id"])
                if not v:
                    return _err("Venta no encontrada")
                producto = await db.get(Producto, v.producto_id)
                antes = snapshot(v)
                await db.delete(v)
                if producto:
                    producto.cantidad += v.cantidad
                    if producto.estado == "vendido" and producto.cantidad > 0:
                        producto.estado = "disponible"
                await log_cambio(db, "ventas", v.id, "DELETE", antes=antes, fuente="ai")
                await db.commit()
                return _ok({"deleted": inputs["id"], "producto_revertido": str(v.producto_id)})

            # ── Permutas ───────────────────────────────────────────────────
            case "list_permutas":
                rows = (await db.execute(select(Permuta).order_by(Permuta.created_at.desc()))).scalars().all()
                return _ok([_row(p) for p in rows])

            case "create_permuta":
                p = Permuta(
                    venta_id=inputs.get("venta_id"),
                    cliente_id=inputs.get("cliente_id"),
                    marca=inputs["marca"],
                    modelo=inputs["modelo"],
                    storage=inputs.get("storage"),
                    color=inputs.get("color"),
                    condicion=inputs["condicion"],
                    bateria_salud=inputs.get("bateria_salud"),
                    valor_permuta=Decimal(str(inputs["valor_permuta"])),
                    notas=inputs.get("notas"),
                )
                db.add(p)
                await db.flush()
                await log_cambio(db, "permutas", p.id, "CREATE", despues=snapshot(p), fuente="ai")
                await db.commit()
                await db.refresh(p)
                return _ok(_row(p))

            case "delete_permuta":
                p = await db.get(Permuta, inputs["id"])
                if not p:
                    return _err("Permuta no encontrada")
                antes = snapshot(p)
                await db.delete(p)
                await log_cambio(db, "permutas", p.id, "DELETE", antes=antes, fuente="ai")
                await db.commit()
                return _ok({"deleted": inputs["id"]})

            case _:
                return _err(f"Herramienta desconocida: {name}")

    except Exception as exc:
        return _err(str(exc))


# ── Tool schema definitions for Anthropic API ─────────────────────────────────

TOOLS: list[dict] = [
    {
        "name": "list_productos",
        "description": "Lista todos los productos del inventario. Filtrá por estado (disponible = en stock, vendido = sin stock) o condicion. Para ver el stock actual usá estado='disponible'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "estado": {"type": "string", "enum": ["disponible", "vendido"]},
                "condicion": {"type": "string", "enum": ["nuevo", "usado", "reacondicionado"]},
            },
        },
    },
    {
        "name": "get_producto",
        "description": "Obtiene un producto por su ID.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "create_producto",
        "description": "Crea un nuevo producto en el inventario.",
        "input_schema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre completo, ej: iPhone 13 Pro 256GB Azul"},
                "marca": {"type": "string", "description": "Default: Apple"},
                "modelo": {"type": "string"},
                "storage": {"type": "string"},
                "color": {"type": "string"},
                "condicion": {"type": "string", "enum": ["nuevo", "usado", "reacondicionado"]},
                "bateria_salud": {"type": "integer", "minimum": 0, "maximum": 100},
                "cantidad": {"type": "integer", "minimum": 1, "description": "Unidades en stock. Default: 1"},
                "precio_compra": {"type": "number"},
                "precio_venta": {"type": "number"},
                "notas": {"type": "string"},
            },
            "required": ["nombre", "modelo", "precio_compra", "precio_venta"],
        },
    },
    {
        "name": "update_producto",
        "description": "Actualiza campos de un producto existente.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "nombre": {"type": "string"},
                "marca": {"type": "string"},
                "modelo": {"type": "string"},
                "storage": {"type": "string"},
                "color": {"type": "string"},
                "condicion": {"type": "string", "enum": ["nuevo", "usado", "reacondicionado"]},
                "bateria_salud": {"type": "integer", "minimum": 0, "maximum": 100},
                "cantidad": {"type": "integer", "minimum": 0, "description": "Stock actual. El estado se calcula automáticamente: >0 = disponible, 0 = vendido"},
                "precio_compra": {"type": "number"},
                "precio_venta": {"type": "number"},
                "notas": {"type": "string"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "delete_producto",
        "description": "Elimina un producto. No se puede eliminar un producto con estado 'vendido'.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "list_clientes",
        "description": "Lista todos los clientes.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_cliente",
        "description": "Obtiene un cliente por su ID.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "create_cliente",
        "description": "Crea un nuevo cliente.",
        "input_schema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string"},
                "apellido": {"type": "string"},
                "dni": {"type": "string"},
                "telefono": {"type": "string"},
                "email": {"type": "string"},
                "direccion": {"type": "string"},
                "notas": {"type": "string"},
            },
            "required": ["nombre"],
        },
    },
    {
        "name": "update_cliente",
        "description": "Actualiza datos de un cliente.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "nombre": {"type": "string"},
                "apellido": {"type": "string"},
                "dni": {"type": "string"},
                "telefono": {"type": "string"},
                "email": {"type": "string"},
                "direccion": {"type": "string"},
                "notas": {"type": "string"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "delete_cliente",
        "description": "Elimina un cliente.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "list_proveedores",
        "description": "Lista todos los proveedores.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_proveedor",
        "description": "Obtiene un proveedor por su ID.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "create_proveedor",
        "description": "Crea un nuevo proveedor.",
        "input_schema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string"},
                "contacto": {"type": "string"},
                "telefono": {"type": "string"},
                "email": {"type": "string"},
                "notas": {"type": "string"},
            },
            "required": ["nombre"],
        },
    },
    {
        "name": "update_proveedor",
        "description": "Actualiza datos de un proveedor.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "nombre": {"type": "string"},
                "contacto": {"type": "string"},
                "telefono": {"type": "string"},
                "email": {"type": "string"},
                "notas": {"type": "string"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "delete_proveedor",
        "description": "Elimina un proveedor.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "list_compras",
        "description": "Lista todas las compras. Opcionalmente filtrá por proveedor_id.",
        "input_schema": {
            "type": "object",
            "properties": {"proveedor_id": {"type": "string"}},
        },
    },
    {
        "name": "create_compra",
        "description": "Registra una compra de un producto. El producto debe existir previamente.",
        "input_schema": {
            "type": "object",
            "properties": {
                "producto_id": {"type": "string"},
                "proveedor_id": {"type": "string"},
                "cantidad": {"type": "integer", "minimum": 1, "description": "Unidades compradas. Default: 1"},
                "precio_unitario": {"type": "number"},
                "fecha_compra": {"type": "string", "description": "Formato YYYY-MM-DD. Default: hoy"},
                "forma_pago": {"type": "string", "enum": ["efectivo", "transferencia", "tarjeta"]},
                "notas": {"type": "string"},
            },
            "required": ["producto_id", "precio_unitario"],
        },
    },
    {
        "name": "delete_compra",
        "description": "Elimina un registro de compra.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "list_ventas",
        "description": "Lista todas las ventas.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "create_venta",
        "description": "Registra una venta. Descuenta `cantidad` unidades del stock del producto. Si el stock llega a 0, el producto pasa a 'vendido'. `precio_final` es el monto TOTAL de la operación (precio_unitario × cantidad).",
        "input_schema": {
            "type": "object",
            "properties": {
                "producto_id": {"type": "string"},
                "cliente_id": {"type": "string"},
                "cantidad": {"type": "integer", "minimum": 1, "description": "Unidades vendidas. Default: 1"},
                "precio_final": {"type": "number", "description": "Monto TOTAL cobrado (precio por unidad × cantidad)"},
                "moneda": {"type": "string", "enum": ["ARS", "USD"], "description": "Moneda del precio. Default: ARS"},
                "forma_pago": {"type": "string", "enum": ["efectivo", "transferencia", "tarjeta", "mixto"]},
                "monto_permuta": {"type": "number", "description": "Monto descontado por permuta. Default: 0"},
                "fecha_venta": {"type": "string", "description": "Formato YYYY-MM-DD. Default: hoy"},
                "notas": {"type": "string"},
            },
            "required": ["producto_id", "precio_final"],
        },
    },
    {
        "name": "delete_venta",
        "description": "Elimina una venta. Restaura las unidades vendidas al stock del producto. Si el producto estaba 'vendido', vuelve a 'disponible'.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "list_permutas",
        "description": "Lista todas las permutas (equipos recibidos en parte de pago).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "create_permuta",
        "description": "Registra una permuta (equipo recibido como parte de pago).",
        "input_schema": {
            "type": "object",
            "properties": {
                "venta_id": {"type": "string", "description": "ID de la venta asociada (opcional)"},
                "cliente_id": {"type": "string"},
                "marca": {"type": "string"},
                "modelo": {"type": "string"},
                "storage": {"type": "string"},
                "color": {"type": "string"},
                "condicion": {"type": "string", "enum": ["bueno", "regular", "malo"]},
                "bateria_salud": {"type": "integer", "minimum": 0, "maximum": 100},
                "valor_permuta": {"type": "number"},
                "notas": {"type": "string"},
            },
            "required": ["marca", "modelo", "condicion", "valor_permuta"],
        },
    },
    {
        "name": "delete_permuta",
        "description": "Elimina una permuta.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
]
