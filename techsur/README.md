# TechSur

Internal management system for a second-hand electronics business. Manages inventory, purchases, sales, trade-ins, clients, and suppliers — with an AI assistant for natural-language queries and bulk operations.

---

## Features

- **Inventario** — stock management with quantity tracking, custom brand/storage, filters, CSV export
- **Ventas** — sales with multi-unit quantity, ARS/USD currency, trade-in support
- **Compras** — purchase records linked to suppliers and products
- **Permutas** — trade-in devices received from clients
- **Clientes / Proveedores** — client and supplier CRM
- **Dashboard** — KPIs: monthly revenue (ARS + USD split), gross margin, stock levels
- **Historial** — full audit log of every change with one-click restore for updates and deletes
- **Asistente IA** — Claude-powered chat for querying data, creating records, and bulk operations
- **Catálogo** — public product listing page (no auth required)

---

## Tech Stack

### Backend
- **FastAPI** + **SQLAlchemy 2.x** (async) + **asyncpg**
- **PostgreSQL** on Supabase
- **JWT** auth via httpOnly cookie
- **Anthropic Claude API** (Sonnet + Haiku routing, prompt caching, SSE streaming)
- **slowapi** rate limiting

### Frontend
- **React 18** + **TypeScript** + **Vite 6**
- **React Router v7**
- **Tailwind CSS v4**
- **sonner** (toasts) + **lucide-react** (icons)

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ with pnpm (`npm install -g pnpm`)
- A Supabase project

### 1. Clone and install

```bash
git clone https://github.com/ikeribarra-s/techsur
cd techsur-app

# Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Frontend
cd frontend && pnpm install && cd ..
```

### 2. Environment variables

Create `.env` in the project root (copy from `.env.example`):

```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
ALLOWED_ORIGINS=["http://localhost:5173"]
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=<service role key>
COOKIE_SECURE=false
```

> **`COOKIE_SECURE`** must be `false` for local HTTP dev. Set to `true` only in production (HTTPS).

### 3. Database migrations

Run in the Supabase SQL editor:

```sql
-- Quantity-based stock tracking
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ventas    ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;
ALTER TABLE compras   ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;

-- Normalize estado
UPDATE productos SET estado = 'disponible' WHERE cantidad > 0 AND estado != 'disponible';
UPDATE productos SET estado = 'vendido'    WHERE cantidad = 0 AND estado != 'vendido';

-- Audit log table
CREATE TABLE IF NOT EXISTS historial_cambios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla       VARCHAR(50)  NOT NULL,
    registro_id VARCHAR(36)  NOT NULL,
    operacion   VARCHAR(10)  NOT NULL,
    antes       JSONB,
    despues     JSONB,
    fuente      VARCHAR(20)  NOT NULL DEFAULT 'manual',
    resumen     VARCHAR(200),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_historial_created_at     ON historial_cambios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_tabla_registro ON historial_cambios(tabla, registro_id);
```

---

## Running locally

```bash
# Backend (from project root, venv active)
uvicorn backend.main:app --reload

# Frontend (separate terminal)
cd frontend && pnpm dev
```

Open `http://localhost:5173`.

> **Do not set `VITE_API_URL`** for local dev — the Vite proxy handles routing to the backend automatically. Only set it for mobile/network access.

---

## Running on mobile (local network)

Find your machine's IP:
```powershell
ipconfig | findstr "IPv4"
# e.g. 192.168.0.2
```

Create `frontend/.env.local`:
```env
VITE_API_URL=http://192.168.0.2:8000
```

Add the network origin to `.env`:
```env
ALLOWED_ORIGINS=["http://localhost:5173","http://192.168.0.2:5173"]
```

Start with network binding:
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && pnpm dev --host
```

Open `http://192.168.0.2:5173` on your phone (same WiFi).

---

## Stock model

- Each `producto` has a `cantidad` (integer units in stock)
- `estado` is always derived: `cantidad > 0` → `disponible`, `cantidad = 0` → `vendido`
- Creating a venta deducts `cantidad`; deleting restores it
- `precio_final` on ventas is the **total** (unit price × quantity), not per-unit
- `estado` is never accepted as user input — it is always computed server-side

---

## AI Assistant

The floating chat button opens the AI assistant powered by Claude. It can:
- Query any data in natural language
- Create, update, and delete records
- Run bulk operations ("cargá 5 iPhone 14 usados a $300.000 cada uno")
- Calculate metrics (capital inmovilizado, margen bruto, ganancia del mes)

Cost optimizations: prompt caching, Haiku routing for tool-dispatch turns, sliding history window, 20 req/min rate limit.

---

## Dev proxy

The Vite dev server proxies all API routes to `http://localhost:8000` so cookies work correctly across ports:

```
browser → localhost:5173 (Vite) → localhost:8000 (FastAPI)
```

This is configured in `frontend/vite.config.ts`. No additional setup needed for local dev.
