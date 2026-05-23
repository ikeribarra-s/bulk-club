-- ============================================================
-- TechSur - Supabase Database Schema
-- Run this in the Supabase SQL Editor (supabase.com > SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- USUARIOS (internal staff accounts)
-- ============================================================
create table if not exists usuarios (
  id            uuid primary key default uuid_generate_v4(),
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists clientes (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null,
  apellido   text,
  dni        text,
  telefono   text,
  email      text,
  direccion  text,
  notas      text,
  created_at timestamptz default now()
);

-- ============================================================
-- PROVEEDORES (suppliers)
-- ============================================================
create table if not exists proveedores (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null,
  contacto   text,
  telefono   text,
  email      text,
  notas      text,
  created_at timestamptz default now()
);

-- ============================================================
-- PRODUCTOS (inventory)
-- ============================================================
create table if not exists productos (
  id             uuid primary key default uuid_generate_v4(),
  nombre         text not null,                        -- display name, e.g. "iPhone 15 Pro 256GB Titanio"
  marca          text not null default 'Apple',
  modelo         text not null,                        -- e.g. "iPhone 15 Pro"
  storage        text,                                 -- '128GB', '256GB', '512GB', '1TB'
  color          text,
  condicion      text not null default 'usado'
                   check (condicion in ('nuevo', 'usado', 'reacondicionado')),
  bateria_salud  int check (bateria_salud between 0 and 100),  -- % for used devices
  precio_compra  numeric(12,2) not null,
  precio_venta   numeric(12,2) not null,
  estado         text not null default 'disponible'
                   check (estado in ('disponible', 'vendido', 'reservado')),
  notas          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Auto-update updated_at on row change
create or replace function fn_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_productos_updated_at
  before update on productos
  for each row execute function fn_set_updated_at();

-- ============================================================
-- PRODUCTO_FOTOS (product photo gallery)
-- ============================================================
create table if not exists producto_fotos (
  id          uuid primary key default uuid_generate_v4(),
  producto_id uuid not null references productos(id) on delete cascade,
  url         text not null,
  orden       int default 0,
  created_at  timestamptz default now()
);

-- ============================================================
-- COMPRAS (purchases from suppliers → adds stock)
-- ============================================================
create table if not exists compras (
  id              uuid primary key default uuid_generate_v4(),
  proveedor_id    uuid references proveedores(id) on delete set null,
  producto_id     uuid not null references productos(id) on delete restrict,
  precio_unitario numeric(12,2) not null,
  fecha_compra    date not null default current_date,
  forma_pago      text not null default 'efectivo'
                    check (forma_pago in ('efectivo', 'transferencia', 'tarjeta')),
  notas           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- VENTAS (sales)
-- ============================================================
create table if not exists ventas (
  id             uuid primary key default uuid_generate_v4(),
  producto_id    uuid not null references productos(id) on delete restrict,
  cliente_id     uuid references clientes(id) on delete set null,
  precio_final   numeric(12,2) not null,
  forma_pago     text not null default 'efectivo'
                   check (forma_pago in ('efectivo', 'transferencia', 'tarjeta', 'mixto')),
  monto_permuta  numeric(12,2) not null default 0,  -- trade-in credit applied
  notas          text,
  fecha_venta    date not null default current_date,
  created_at     timestamptz default now()
);

-- Auto-mark product as 'vendido' when a sale is inserted
create or replace function fn_mark_producto_vendido()
returns trigger as $$
begin
  update productos set estado = 'vendido' where id = new.producto_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_venta_marca_vendido
  after insert on ventas
  for each row execute function fn_mark_producto_vendido();

-- ============================================================
-- PERMUTAS (trade-ins linked to a sale)
-- ============================================================
create table if not exists permutas (
  id              uuid primary key default uuid_generate_v4(),
  venta_id        uuid references ventas(id) on delete set null,
  cliente_id      uuid references clientes(id) on delete set null,
  marca           text not null,
  modelo          text not null,
  storage         text,
  color           text,
  condicion       text not null
                    check (condicion in ('bueno', 'regular', 'malo')),
  bateria_salud   int check (bateria_salud between 0 and 100),
  valor_permuta   numeric(12,2) not null,
  notas           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (Supabase best practice)
-- Enable RLS on all tables; policies to be added per auth setup
-- ============================================================
alter table usuarios       enable row level security;
alter table clientes       enable row level security;
alter table proveedores    enable row level security;
alter table productos      enable row level security;
alter table producto_fotos enable row level security;
alter table compras        enable row level security;
alter table ventas         enable row level security;
alter table permutas       enable row level security;

-- ============================================================
-- INDEXES for common queries
-- ============================================================
create index if not exists idx_productos_estado     on productos(estado);
create index if not exists idx_productos_marca      on productos(marca);
create index if not exists idx_ventas_fecha         on ventas(fecha_venta);
create index if not exists idx_ventas_cliente       on ventas(cliente_id);
create index if not exists idx_compras_proveedor    on compras(proveedor_id);
create index if not exists idx_permutas_venta       on permutas(venta_id);
create index if not exists idx_producto_fotos_prod  on producto_fotos(producto_id);

-- ============================================================
-- SUPABASE STORAGE BUCKET (run separately or via dashboard)
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('product-photos', 'product-photos', true);
