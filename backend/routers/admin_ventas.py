import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_admin
from backend.database import get_db
from backend.models.cliente import Cliente
from backend.models.producto import Producto
from backend.models.venta_producto import VentaProducto
from backend.schemas.venta_producto import VentaProductoCreate, VentaProductoDetalle, VentaProductoOut, VentaProductoUpdate

router = APIRouter(prefix="/admin/ventas", tags=["Admin — Ventas productos"])


@router.get("", response_model=list[VentaProductoDetalle])
async def list_ventas(
    cliente_id: uuid.UUID | None = Query(None),
    pagado: bool | None = Query(None),
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(VentaProducto, Producto, Cliente)
        .join(Producto, Producto.id == VentaProducto.producto_id)
        .join(Cliente, Cliente.id == VentaProducto.cliente_id)
        .order_by(VentaProducto.fecha_venta.desc())
    )
    if cliente_id:
        q = q.where(VentaProducto.cliente_id == cliente_id)
    if pagado is not None:
        q = q.where(VentaProducto.pagado == pagado)
    rows = (await db.execute(q)).all()
    return [
        VentaProductoDetalle(
            **{c: getattr(vp, c) for c in VentaProductoOut.model_fields},
            producto_nombre=prod.nombre,
            cliente_nombre=cli.nombre,
            cliente_apellido=cli.apellido,
        )
        for vp, prod, cli in rows
    ]


@router.post("", response_model=VentaProductoOut, status_code=status.HTTP_201_CREATED)
async def create_venta(
    body: VentaProductoCreate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    prod_result = await db.execute(select(Producto).where(Producto.id == body.producto_id))
    prod = prod_result.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    if prod.stock < body.cantidad:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Stock insuficiente ({prod.stock} disponibles)")

    prod.stock -= body.cantidad
    venta = VentaProducto(
        cliente_id=body.cliente_id,
        producto_id=body.producto_id,
        cantidad=body.cantidad,
        precio_unitario=prod.precio,
        pagado=body.pagado,
    )
    db.add(venta)
    await db.commit()
    await db.refresh(venta)
    return venta


@router.put("/{venta_id}", response_model=VentaProductoOut)
async def update_venta(
    venta_id: uuid.UUID,
    body: VentaProductoUpdate,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VentaProducto).where(VentaProducto.id == venta_id))
    venta = result.scalar_one_or_none()
    if not venta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    venta.pagado = body.pagado
    await db.commit()
    await db.refresh(venta)
    return venta


@router.delete("/{venta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venta(
    venta_id: uuid.UUID,
    _=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VentaProducto).where(VentaProducto.id == venta_id))
    venta = result.scalar_one_or_none()
    if not venta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    prod_result = await db.execute(select(Producto).where(Producto.id == venta.producto_id))
    prod = prod_result.scalar_one_or_none()
    if prod:
        prod.stock += venta.cantidad
    await db.delete(venta)
    await db.commit()
