-- ============================================================
-- Bulk Club Gym Management System — Supabase Schema
-- Run in the Supabase SQL Editor (supabase.com > SQL Editor)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- USUARIOS (admin accounts — manually managed in Supabase)
-- ============================================================
create table if not exists usuarios (
  id            uuid primary key default uuid_generate_v4(),
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- ============================================================
-- CLIENTES (gym members — Google OAuth or manual admin creation)
-- ============================================================
create table if not exists clientes (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text,                           -- filled during onboarding or by admin
  apellido      text,                           -- filled during onboarding or by admin
  email         text unique,                    -- from Google or provided by admin (nullable for manual accounts)
  google_id     text unique,                    -- Google sub claim (null for manually created accounts)
  telefono      text,
  dni           text unique,                    -- filled during onboarding; unique per account
  habilitado    boolean not null default false, -- admin must enable after onboarding; true by default for admin-created
  password_hash text,                           -- bcrypt hash; set when admin creates account manually (default = DNI)
  created_at    timestamptz default now()
);

-- ============================================================
-- PLANES (membership plan types)
-- ============================================================
create table if not exists planes (
  id               uuid primary key default uuid_generate_v4(),
  nombre           text not null,           -- "2 días/semana", "3 días/semana", "Full"
  dias_por_semana  int,                     -- NULL = unlimited (Full plan)
  precio_mensual   numeric(12,2) not null,
  descripcion      text,
  activo           boolean not null default true
);

-- ============================================================
-- MEMBRESIAS (memberships per client)
-- ============================================================
create table if not exists membresias (
  id                 uuid primary key default uuid_generate_v4(),
  cliente_id         uuid not null references clientes(id) on delete restrict,
  plan_id            uuid not null references planes(id) on delete restrict,
  fecha_inicio       date not null,
  fecha_vencimiento  date not null,
  created_at         timestamptz default now()
);

-- ============================================================
-- PAGOS (payment records)
-- ============================================================
create table if not exists pagos (
  id            uuid primary key default uuid_generate_v4(),
  cliente_id    uuid not null references clientes(id) on delete restrict,
  membresia_id  uuid references membresias(id) on delete set null,
  monto         numeric(12,2) not null,
  fecha_pago    date not null default current_date,
  forma_pago    text not null check (forma_pago in ('efectivo', 'transferencia', 'tarjeta')),
  notas         text,
  created_at    timestamptz default now()
);

-- ============================================================
-- ACCESOS (check-in log)
-- ============================================================
create table if not exists accesos (
  id          uuid primary key default uuid_generate_v4(),
  cliente_id  uuid not null references clientes(id) on delete restrict,
  fecha_hora  timestamptz not null default now(),
  resultado   text not null check (resultado in ('permitido', 'denegado')),
  motivo      text check (
                motivo in (
                  'cuota_vencida',
                  'ya_ingreso_hoy',
                  'plan_agotado',
                  'cuenta_deshabilitada',
                  'sin_membresia'
                )
              )
);

-- ============================================================
-- PRODUCTOS (stock: Gatorade, supplements, etc.)
-- ============================================================
create table if not exists productos (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  descripcion text,
  precio      numeric(12,2) not null,
  stock       int not null default 0 check (stock >= 0),
  created_at  timestamptz default now()
);

-- ============================================================
-- VENTAS_PRODUCTOS (product sales on client tab)
-- ============================================================
create table if not exists ventas_productos (
  id              uuid primary key default uuid_generate_v4(),
  cliente_id      uuid not null references clientes(id) on delete restrict,
  producto_id     uuid not null references productos(id) on delete restrict,
  cantidad        int not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  pagado          boolean not null default false,
  fecha_venta     timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table usuarios        enable row level security;
alter table clientes        enable row level security;
alter table planes          enable row level security;
alter table membresias      enable row level security;
alter table pagos           enable row level security;
alter table accesos         enable row level security;
alter table productos       enable row level security;
alter table ventas_productos enable row level security;

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_clientes_habilitado    on clientes(habilitado);
create index if not exists idx_clientes_dni           on clientes(dni);
create index if not exists idx_membresias_cliente     on membresias(cliente_id);
create index if not exists idx_membresias_vencimiento on membresias(fecha_vencimiento);
create index if not exists idx_pagos_cliente          on pagos(cliente_id);
create index if not exists idx_accesos_cliente        on accesos(cliente_id);
create index if not exists idx_accesos_fecha          on accesos(fecha_hora desc);
create index if not exists idx_ventas_cliente         on ventas_productos(cliente_id);
create index if not exists idx_ventas_pagado          on ventas_productos(pagado) where not pagado;
