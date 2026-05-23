"""
seed_fake_data.py — populate the DB with realistic test data.

Run from the project root:
    python seed_fake_data.py

Add --clear to wipe existing seed data first:
    python seed_fake_data.py --clear
"""

import asyncio
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text

from backend.database import AsyncSessionLocal
from backend.models.acceso import Acceso
from backend.models.cliente import Cliente
from backend.models.membresia import Membresia
from backend.models.pago import Pago
from backend.models.plan import Plan
from backend.models.producto import Producto
from backend.models.venta_producto import VentaProducto

# ─── Fake data pools ──────────────────────────────────────────────────────────

NOMBRES = ["Lucía", "Mateo", "Valentina", "Santiago", "Camila", "Nicolás",
           "Sofía", "Tomás", "Isabella", "Joaquín", "Martina", "Facundo",
           "Florencia", "Agustín", "Antonella", "Ezequiel", "Milagros",
           "Gonzalo", "Julieta", "Leandro"]

APELLIDOS = ["García", "Fernández", "López", "Martínez", "González", "Rodríguez",
             "Pérez", "Sánchez", "Romero", "Torres", "Flores", "Díaz",
             "Morales", "Herrera", "Medina", "Castro", "Vargas", "Ríos",
             "Suárez", "Blanco"]

FORMAS_PAGO = ["efectivo", "transferencia", "tarjeta"]


def rnd_nombre():
    return random.choice(NOMBRES)

def rnd_apellido():
    return random.choice(APELLIDOS)

def today():
    return date.today()

def days_ago(n: int) -> date:
    return today() - timedelta(days=n)

def days_from_now(n: int) -> date:
    return today() + timedelta(days=n)

def rnd_dt_in_range(start: date, end: date) -> datetime:
    delta = (end - start).days
    d = start + timedelta(days=random.randint(0, max(delta, 0)))
    h, m = random.randint(6, 21), random.randint(0, 59)
    return datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)


# ─── Main seed ────────────────────────────────────────────────────────────────

async def seed(clear: bool = False):
    async with AsyncSessionLocal() as db:

        if clear:
            print("Clearing seed data…")
            for tbl in ["accesos", "ventas_productos", "pagos",
                        "membresias", "clientes", "productos", "planes"]:
                await db.execute(text(f"DELETE FROM {tbl}"))
            await db.commit()
            print("Done.\n")

        # ── Plans ──────────────────────────────────────────────────────────
        existing_planes = (await db.execute(select(Plan))).scalars().all()
        if existing_planes:
            planes = list(existing_planes)
            print(f"  Plans: using {len(planes)} existing")
        else:
            planes_data = [
                dict(nombre="2 días/semana",  dias_por_semana=2, precio_mensual=12_000, descripcion="Lunes y miércoles o martes y jueves"),
                dict(nombre="3 días/semana",  dias_por_semana=3, precio_mensual=16_000, descripcion="Tres días a elección"),
                dict(nombre="Full",           dias_por_semana=None, precio_mensual=22_000, descripcion="Acceso ilimitado"),
            ]
            planes = [Plan(**d) for d in planes_data]
            db.add_all(planes)
            await db.flush()
            print(f"  Plans: created {len(planes)}")

        plan_2d, plan_3d, plan_full = planes[0], planes[1], planes[2]

        # ── Productos ──────────────────────────────────────────────────────
        existing_productos = (await db.execute(select(Producto))).scalars().all()
        if existing_productos:
            productos = list(existing_productos)
            print(f"  Products: using {len(productos)} existing")
        else:
            productos_data = [
                dict(nombre="Gatorade Naranja",    descripcion="500ml",          precio=1_500, stock=18),
                dict(nombre="Gatorade Limón",      descripcion="500ml",          precio=1_500, stock=2),   # low stock
                dict(nombre="Agua mineral",        descripcion="1.5L",           precio=800,  stock=30),
                dict(nombre="Barra proteica",      descripcion="Chocolate 60g",  precio=2_800, stock=0),   # no stock
                dict(nombre="Creatina 300g",       descripcion="Sabor neutro",   precio=9_500, stock=1),   # low stock
                dict(nombre="Whey Protein 1kg",    descripcion="Vainilla",       precio=18_000, stock=5),
                dict(nombre="Pre-workout",         descripcion="Sachet 25g",     precio=3_200, stock=12),
                dict(nombre="Toalla microfibra",   descripcion=None,             precio=4_500, stock=8),
            ]
            productos = [Producto(**d) for d in productos_data]
            db.add_all(productos)
            await db.flush()
            print(f"  Products: created {len(productos)}")

        # ── Clientes ───────────────────────────────────────────────────────
        # Groups:
        #   A) 8  active members   — habilitado, membership active (full 30d)
        #   B) 3  expiring soon    — habilitado, membership expires in 1-6 days
        #   C) 4  expired          — habilitado, membership expired 5-30 days ago
        #   D) 2  pending          — habilitado=False, dni set (awaiting admin)
        #   E) 2  no membership    — habilitado, no membresia yet
        # Total: 19 clients

        client_specs = (
            [("active",   plan_full,  30,  0 )] * 3 +
            [("active",   plan_3d,    30,  0 )] * 3 +
            [("active",   plan_2d,    30,  0 )] * 2 +
            [("expiring", plan_full,   4,  0 )] * 1 +
            [("expiring", plan_3d,     2,  0 )] * 1 +
            [("expiring", plan_2d,     6,  0 )] * 1 +
            [("expired",  plan_3d,   -15,  0 )] * 2 +
            [("expired",  plan_full, -8,   0 )] * 1 +
            [("expired",  plan_2d,  -25,   0 )] * 1 +
            [("pending",  None,        0,  0 )] * 2 +
            [("nomem",    plan_full,   0,  0 )] * 2
        )

        clientes = []
        membresias = []
        pagos = []

        used_dnis = set()
        used_emails = set()
        used_google_ids = set()

        def unique_dni():
            while True:
                d = str(random.randint(20_000_000, 45_000_000))
                if d not in used_dnis:
                    used_dnis.add(d)
                    return d

        def unique_email(nombre, apellido):
            base = f"{nombre.lower()}.{apellido.lower()}".replace(" ", "")
            for suffix in ["", str(random.randint(1, 99)), str(random.randint(100, 999))]:
                e = f"{base}{suffix}@gmail.com"
                if e not in used_emails:
                    used_emails.add(e)
                    return e

        def unique_google_id():
            while True:
                g = str(random.randint(10**17, 10**18 - 1))
                if g not in used_google_ids:
                    used_google_ids.add(g)
                    return g

        for kind, plan, offset, _ in client_specs:
            nombre   = rnd_nombre()
            apellido = rnd_apellido()
            email    = unique_email(nombre, apellido)
            dni      = unique_dni() if kind != "pending" else unique_dni()
            habilitado = kind != "pending"

            c = Cliente(
                nombre=nombre,
                apellido=apellido,
                email=email,
                google_id=unique_google_id(),
                telefono=f"11{random.randint(30000000, 79999999)}",
                dni=dni,
                habilitado=habilitado,
            )
            db.add(c)
            await db.flush()
            clientes.append(c)

            if kind in ("active", "expiring", "expired") and plan:
                if kind == "active":
                    fi = days_ago(random.randint(0, 5))
                    fv = days_from_now(offset - random.randint(0, 3))
                elif kind == "expiring":
                    fi = days_ago(30 - offset)
                    fv = days_from_now(offset)
                else:  # expired
                    fi = days_ago(30 + abs(offset))
                    fv = days_ago(abs(offset))

                m = Membresia(cliente_id=c.id, plan_id=plan.id,
                              fecha_inicio=fi, fecha_vencimiento=fv)
                db.add(m)
                await db.flush()
                membresias.append(m)

                # Payment for this membership
                p = Pago(
                    cliente_id=c.id,
                    membresia_id=m.id,
                    monto=plan.precio_mensual,
                    fecha_pago=fi,
                    forma_pago=random.choice(FORMAS_PAGO),
                )
                db.add(p)
                pagos.append(p)

        await db.flush()
        print(f"  Clients: created {len(clientes)}  (memberships: {len(membresias)}, payments: {len(pagos)})")

        # ── Accesos (check-in history, last 60 days) ───────────────────────
        # Only active/expiring/expired clients get check-in history
        eligible = [c for c, spec in zip(clientes, client_specs) if spec[0] in ("active", "expiring", "expired")]
        accesos = []
        for c in eligible:
            # 10-30 permitted accesos spread over last 60 days
            n = random.randint(10, 30)
            used_days: set[date] = set()
            for _ in range(n):
                for attempt in range(50):
                    d = days_ago(random.randint(1, 60))
                    if d not in used_days:
                        used_days.add(d)
                        break
                else:
                    continue
                dt = rnd_dt_in_range(d, d)
                accesos.append(Acceso(cliente_id=c.id, fecha_hora=dt, resultado="permitido"))

            # 1-3 denied accesos
            for _ in range(random.randint(1, 3)):
                d = days_ago(random.randint(0, 60))
                dt = rnd_dt_in_range(d, d)
                motivo = random.choice(["cuota_vencida", "ya_ingreso_hoy", "plan_agotado"])
                accesos.append(Acceso(cliente_id=c.id, fecha_hora=dt, resultado="denegado", motivo=motivo))

        db.add_all(accesos)
        await db.flush()
        print(f"  Accesos: created {len(accesos)}")

        # ── Ventas de productos ────────────────────────────────────────────
        active_clients = [c for c, spec in zip(clientes, client_specs) if spec[0] == "active"]
        ventas = []
        for _ in range(25):
            c  = random.choice(active_clients)
            pr = random.choice(productos)
            if pr.stock <= 0:
                continue
            qty = random.randint(1, min(3, pr.stock))
            pr.stock -= qty
            pagado = random.random() > 0.35  # 65% paid
            ventas.append(VentaProducto(
                cliente_id=c.id,
                producto_id=pr.id,
                cantidad=qty,
                precio_unitario=pr.precio,
                pagado=pagado,
                fecha_venta=rnd_dt_in_range(days_ago(30), today()),
            ))

        db.add_all(ventas)
        await db.flush()
        print(f"  Ventas: created {len(ventas)}")

        await db.commit()
        print("\nSeed complete.")
        print(f"  Active members : {sum(1 for _, s in zip(clientes, client_specs) if s[0] == 'active')}")
        print(f"  Expiring soon  : {sum(1 for _, s in zip(clientes, client_specs) if s[0] == 'expiring')}")
        print(f"  Expired        : {sum(1 for _, s in zip(clientes, client_specs) if s[0] == 'expired')}")
        print(f"  Pending        : {sum(1 for _, s in zip(clientes, client_specs) if s[0] == 'pending')}")
        print(f"  No membership  : {sum(1 for _, s in zip(clientes, client_specs) if s[0] == 'nomem')}")


if __name__ == "__main__":
    asyncio.run(seed(clear="--clear" in sys.argv))
