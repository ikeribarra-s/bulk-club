from datetime import date, timedelta, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_client
from backend.database import get_db
from backend.models.acceso import Acceso
from backend.models.cliente import Cliente
from backend.models.membresia import Membresia
from backend.models.plan import Plan
from backend.schemas.acceso import CheckResult

router = APIRouter(prefix="/acceso", tags=["Acceso"])


async def _log(db: AsyncSession, cliente_id, resultado: str, motivo: str | None, today: date | None = None) -> None:
    if resultado == "denegado" and today is not None:
        existing = await db.execute(
            select(Acceso)
            .where(
                Acceso.cliente_id == cliente_id,
                func.date(Acceso.fecha_hora) == today,
                Acceso.resultado == "denegado",
            )
            .limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            return
    db.add(Acceso(cliente_id=cliente_id, resultado=resultado, motivo=motivo))
    await db.commit()


@router.post("/check", response_model=CheckResult)
async def check_acceso(
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today = date.today()

    # a) Auto-disable after 90 days of inactivity
    last_ok = await db.execute(
        select(func.max(Acceso.fecha_hora))
        .where(Acceso.cliente_id == cliente.id, Acceso.resultado == "permitido")
    )
    last_dt: datetime | None = last_ok.scalar_one_or_none()
    if last_dt is not None:
        last_dt = last_dt.replace(tzinfo=timezone.utc) if last_dt.tzinfo is None else last_dt
        if (now - last_dt).days >= 90:
            cliente.habilitado = False
            await db.commit()
            await _log(db, cliente.id, "denegado", "cuenta_deshabilitada", today)
            return CheckResult(ok=False, message="Tu cuenta fue deshabilitada por inactividad.", motivo="cuenta_deshabilitada")

    # b) Account enabled
    if not cliente.habilitado:
        await _log(db, cliente.id, "denegado", "cuenta_deshabilitada", today)
        return CheckResult(ok=False, message="Tu cuenta está deshabilitada. Contactá al administrador.", motivo="cuenta_deshabilitada")

    # c) Has any membership
    mem_result = await db.execute(
        select(Membresia)
        .where(Membresia.cliente_id == cliente.id)
        .order_by(Membresia.fecha_vencimiento.desc())
        .limit(1)
    )
    membresia = mem_result.scalar_one_or_none()

    if membresia is None:
        return CheckResult(ok=False, message="No tenés una membresía asignada.", motivo="sin_membresia")

    # d) Active membership
    if membresia.fecha_vencimiento < today:
        await _log(db, cliente.id, "denegado", "cuota_vencida", today)
        return CheckResult(ok=False, message="Tu cuota está vencida. Renová tu membresía.", motivo="cuota_vencida")

    # e) Already checked in today
    already = await db.execute(
        select(Acceso)
        .where(
            Acceso.cliente_id == cliente.id,
            func.date(Acceso.fecha_hora) == today,
            Acceso.resultado == "permitido",
        )
    )
    if already.scalar_one_or_none():
        await _log(db, cliente.id, "denegado", "ya_ingreso_hoy", today)
        return CheckResult(ok=False, message="Ya ingresaste hoy.", motivo="ya_ingreso_hoy")

    # f) Weekly plan limit
    plan_result = await db.execute(select(Plan).where(Plan.id == membresia.plan_id))
    plan = plan_result.scalar_one()

    if plan.dias_por_semana is not None:
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        week_count = await db.execute(
            select(func.count())
            .select_from(Acceso)
            .where(
                Acceso.cliente_id == cliente.id,
                func.date(Acceso.fecha_hora) >= week_start,
                func.date(Acceso.fecha_hora) <= week_end,
                Acceso.resultado == "permitido",
            )
        )
        if week_count.scalar_one() >= plan.dias_por_semana:
            await _log(db, cliente.id, "denegado", "plan_agotado", today)
            return CheckResult(
                ok=False,
                message=f"Ya usaste los {plan.dias_por_semana} días de tu plan esta semana.",
                motivo="plan_agotado",
            )

    await _log(db, cliente.id, "permitido", None)
    nombre = cliente.nombre or "campeón"
    return CheckResult(ok=True, message=f"¡Bienvenido, {nombre}!")
