# Bulk Club — Gym Management System

Web app for managing a gym: member check-ins, memberships, payments, and product sales. Two portals — a mobile-first client portal and a desktop admin panel — served from a single React app.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python), async SQLAlchemy 2.x, asyncpg |
| Database | PostgreSQL via Supabase |
| Auth | JWT in httpOnly cookies; Google OAuth for clients, username/password for admins |
| Frontend | React 18, React Router v7, Tailwind CSS v4, Vite |
| Rate limiting | slowapi |

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ with pnpm
- A Supabase project (free tier works)

### 1. Database

Run `supabase_schema.sql` in the Supabase SQL editor to create all tables.

### 2. Backend

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
# Fill in .env (see below)

uvicorn backend.main:app --reload
# API runs at http://localhost:8000
```

**.env values:**

```env
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres
SECRET_KEY=any-long-random-string
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
ALLOWED_ORIGINS=["http://localhost:5173"]
COOKIE_SECURE=false
```

> Note: the `DATABASE_URL` must use the `postgresql+asyncpg://` scheme for the async driver.

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev
# App runs at http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`.

### 4. Create the first admin

Insert directly in Supabase — there is no admin registration UI by design.

```python
# Generate the password hash locally:
import bcrypt
print(bcrypt.hashpw(b"your-password", bcrypt.gensalt()).decode())
```

```sql
INSERT INTO usuarios (username, password_hash)
VALUES ('admin', '$2b$12$...');
```

### 5. Seed fake data (optional)

```bash
python seed_fake_data.py          # creates plans, clients, accesos, ventas
python seed_fake_data.py --clear  # wipes and re-seeds
```

---

## Running in Production

- Set `COOKIE_SECURE=true` and serve over HTTPS
- Set `ALLOWED_ORIGINS` to your production domain
- Build the frontend: `cd frontend && pnpm build` — output goes to `frontend/dist`
- Serve `frontend/dist` as static files or deploy to any CDN; point the API path to the FastAPI server

---

## Architecture

### Two Portals, One App

```
Client portal (mobile-first)      Admin portal (desktop)
/login                             /admin/login
/onboarding                        /admin/dashboard
/                  (dashboard)     /admin/clientes
/acceso            (QR check-in)   /admin/membresias
                                   /admin/pagos
                                   /admin/planes
                                   /admin/stock
                                   /admin/ventas
                                   /admin/accesos
```

### Client Check-In Flow

The QR code at the gym entrance points to `https://your-domain.com/acceso`. The client has the web app open on their phone, already logged in. Scanning the QR navigates to `/acceso`, which fires `POST /api/acceso/check`. The backend runs these checks in order:

1. 90-day inactivity → auto-disable account
2. Account enabled?
3. Has a membership?
4. Membership active (not expired)?
5. Already checked in today?
6. Hit the weekly day limit for their plan?

A row is written to `accesos` for every permitted entry (denied entries without a membership are not logged). The page shows a full-screen green or red result.

### Auth

- **Clients** log in via Google OAuth (primary) or DNI + password (for manually-created accounts).
- **Admins** log in via username + password at `/admin/login`.
- Both issue a JWT stored in an httpOnly cookie. The JWT payload carries `{ sub: user_id, role: "client"|"admin" }`.
- Route guards in `routes.tsx` read `localStorage.role` (set on login) for fast client-side redirects. The actual security is enforced server-side by `get_current_client` / `get_current_admin` FastAPI dependencies.

### Manual Client Creation

Admins can create client accounts from `/admin/clientes`. The password defaults to the client's DNI. Clients can then log in at `/login` using DNI + password, or link their Google account later.

---

## Project Structure

```
bulk-club/
├── backend/
│   ├── main.py               # FastAPI app, router registration
│   ├── config.py             # Settings from .env
│   ├── auth.py               # JWT creation/validation, FastAPI dependencies
│   ├── database.py           # Async SQLAlchemy engine + session
│   ├── limiter.py            # slowapi rate limiter instance
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── cliente.py
│   │   ├── plan.py
│   │   ├── membresia.py
│   │   ├── pago.py
│   │   ├── acceso.py
│   │   ├── producto.py
│   │   └── venta_producto.py
│   ├── schemas/              # Pydantic request/response schemas
│   └── routers/
│       ├── auth.py           # Google OAuth + admin/client token endpoints
│       ├── acceso.py         # POST /acceso/check (check-in logic)
│       ├── me.py             # Client self-service: status, accesos, tab
│       ├── admin_clientes.py
│       ├── admin_membresias.py
│       ├── admin_pagos.py
│       ├── admin_planes.py
│       ├── admin_productos.py
│       ├── admin_ventas.py
│       ├── admin_accesos.py
│       └── admin_dashboard.py
├── frontend/
│   └── src/app/
│       ├── routes.tsx         # React Router route tree
│       ├── api.ts             # All API types + fetch wrappers
│       ├── components/
│       │   ├── AdminLayout.tsx
│       │   └── ClientLayout.tsx
│       └── pages/
│           ├── client/        # Login, Onboarding, Dashboard, Acceso
│           └── admin/         # One file per admin page
├── supabase_schema.sql
├── seed_fake_data.py
├── requirements.txt
└── .env.example
```
